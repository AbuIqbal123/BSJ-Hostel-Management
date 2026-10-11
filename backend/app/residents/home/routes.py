"""What the resident sees when she opens the phone."""

from __future__ import annotations

import sqlite3
from datetime import date, datetime
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, ConfigDict

from app.shared import clock
from app.shared.auth.routes import Account, AccountDep, ConnectionDep
from app.shared.errors import ApiError
from app.residents.outings.records import OutingBody, UpcomingOuting, expire_passed_plans, load_current_outing, load_upcoming_outings, ordinary_window_is_open
from app.residents.permissions.records import PermissionBody, expire_passed_permissions, permission_from_row

router = APIRouter(prefix="/api/v1", tags=["Resident"])


class HistoryEvent(BaseModel):
    model_config = ConfigDict(extra="forbid")
    event: Literal["exited", "returned"]
    place: str
    outing_id: str
    exited_at: str | None
    returned_at: str | None
    recorded_by: str


HistoryKind = Literal["all", "late_night", "home_going", "guest_stay", "outing"]


class HistoryItem(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: str
    kind: Literal["late_night", "home_going", "guest_stay", "outing"]
    place: str | None
    who: str | None
    started_at: str
    ended_at: str
    exit_recorded_by: str | None
    return_recorded_by: str | None
    unused: bool


class HistoryList(BaseModel):
    model_config = ConfigDict(extra="forbid")
    items: list[HistoryItem]


class HomeResident(BaseModel):
    model_config = ConfigDict(extra="forbid")
    full_name: str
    enrolment_number: str
    course: str | None
    room_label: str
    block_name: str
    presence: Literal["inside", "outside"]
    hall_name: str
    returned_outings: int


class ResidentHome(BaseModel):
    model_config = ConfigDict(extra="forbid")
    resident: HomeResident
    ordinary_outing_active: bool
    current_outing: OutingBody | None
    upcoming_outings: list[UpcomingOuting]
    active_permission: PermissionBody | None
    recent_history: list[HistoryEvent]
    notifications_unread: bool


def resident_account(account: AccountDep) -> Account:
    if account.role != "resident":
        raise ApiError(403, "forbidden", "This account cannot do that.")
    return account


ResidentDep = Annotated[Account, Depends(resident_account)]


def _active_permission(connection: sqlite3.Connection, resident_id: str) -> PermissionBody | None:
    row = connection.execute(
        """
        SELECT
          permissions.id, permissions.type, permissions.status, permissions.short_place,
          permissions.destination_detail, permissions.address, permissions.reason,
          permissions.departure_at, permissions.expected_return_at, permissions.decision_note,
          permissions.decided_at, decider.full_name AS decided_by, permissions.created_at
        FROM permissions
        LEFT JOIN users AS decider ON decider.id = permissions.decided_by
        WHERE permissions.resident_id = ? AND permissions.status IN ('pending', 'approved', 'in_use')
        ORDER BY permissions.created_at DESC, permissions.id DESC
        LIMIT 1
        """,
        (resident_id,),
    ).fetchone()
    if row is None:
        return None
    return permission_from_row(row)


_HISTORY_EVENTS_SQL = """
SELECT event, place, exited_at, returned_at, outing_id, recorded_by
FROM (
  SELECT
    'exited' AS event,
    outings.place AS place,
    outings.exited_at AS exited_at,
    CAST(NULL AS TEXT) AS returned_at,
    outings.id AS outing_id,
    exit_staff.full_name AS recorded_by
  FROM outings
  LEFT JOIN users AS exit_staff ON exit_staff.id = outings.exit_recorded_by
  WHERE outings.resident_id = ? AND outings.exited_at IS NOT NULL
  UNION ALL
  SELECT
    'returned',
    outings.place,
    CAST(NULL AS TEXT),
    outings.returned_at,
    outings.id,
    return_staff.full_name
  FROM outings
  LEFT JOIN users AS return_staff ON return_staff.id = outings.return_recorded_by
  WHERE outings.resident_id = ? AND outings.returned_at IS NOT NULL
)
"""


def _recent_history(connection: sqlite3.Connection, resident_id: str) -> list[HistoryEvent]:
    rows = connection.execute(
        f"""
        {_HISTORY_EVENTS_SQL}
        ORDER BY COALESCE(returned_at, exited_at) DESC,
          CASE event WHEN 'returned' THEN 0 ELSE 1 END, outing_id DESC
        LIMIT 10
        """,
        (resident_id, resident_id),
    ).fetchall()
    return [
        HistoryEvent(
            event=row["event"],
            place=row["place"],
            outing_id=row["outing_id"],
            exited_at=row["exited_at"],
            returned_at=row["returned_at"],
            recorded_by=row["recorded_by"],
        )
        for row in rows
    ]


@router.get("/me/home", response_model=ResidentHome)
def resident_home(account: ResidentDep, connection: ConnectionDep) -> ResidentHome:
    now = clock.utc_now()
    hall_name = connection.execute(
        "SELECT hall_name FROM hall_settings WHERE id = 'hall'"
    ).fetchone()["hall_name"]
    returned_outings = connection.execute(
        """
        SELECT COUNT(*) FROM outings
        WHERE resident_id = ? AND type = 'ordinary' AND returned_at IS NOT NULL
        """,
        (account.id,),
    ).fetchone()[0]
    return ResidentHome(
        resident=HomeResident(
            full_name=account.full_name,
            enrolment_number=account.enrolment_number or "",
            course=account.course,
            room_label=account.room_label or "",
            block_name=account.block_name or "",
            presence=account.presence or "inside",
            hall_name=hall_name,
            returned_outings=int(returned_outings),
        ),
        ordinary_outing_active=ordinary_window_is_open(connection, account.id, now),
        current_outing=load_current_outing(connection, account.id, now),
        upcoming_outings=load_upcoming_outings(connection, account.id, now),
        active_permission=_active_permission(connection, account.id),
        recent_history=_recent_history(connection, account.id),
        notifications_unread=connection.execute(
            """
            SELECT 1 FROM resident_notifications
            WHERE resident_id = ? AND read_at IS NULL
            LIMIT 1
            """,
            (account.id,),
        ).fetchone() is not None,
    )


def _hall_day(instant: str) -> date:
    return clock.parse_instant(instant).astimezone(clock.HALL_ZONE).date()


def _hall_instant(day: str, *, end: bool) -> str:
    year, month, day_number = (int(part) for part in day.split("-"))
    if end:
        local = datetime(year, month, day_number, 23, 59, 59, tzinfo=clock.HALL_ZONE)
    else:
        local = datetime(year, month, day_number, 0, 0, 0, tzinfo=clock.HALL_ZONE)
    return clock.format_instant(local)


def _hall_span(started_at: str, ended_at: str) -> tuple[date, date]:
    start = _hall_day(started_at)
    end = _hall_day(ended_at)
    if end < start:
        return end, start
    return start, end


def _covers_hall_day(started_at: str, ended_at: str, on: date) -> bool:
    start, end = _hall_span(started_at, ended_at)
    return start <= on <= end


def _overlaps_range(
    started_at: str,
    ended_at: str,
    first: date | None,
    last: date | None,
) -> bool:
    if first is None and last is None:
        return True
    start, end = _hall_span(started_at, ended_at)
    if first is not None and end < first:
        return False
    if last is not None and start > last:
        return False
    return True


def _history_items(
    connection: sqlite3.Connection,
    resident_id: str,
    *,
    now_text: str,
    today: str,
) -> list[HistoryItem]:
    items: list[HistoryItem] = []
    outings = connection.execute(
        """
        SELECT
          outings.id,
          outings.place,
          outings.starts_at,
          outings.expected_return_at,
          outings.exited_at,
          outings.returned_at,
          exit_staff.full_name AS exit_recorded_by,
          return_staff.full_name AS return_recorded_by
        FROM outings
        LEFT JOIN users AS exit_staff ON exit_staff.id = outings.exit_recorded_by
        LEFT JOIN users AS return_staff ON return_staff.id = outings.return_recorded_by
        WHERE outings.resident_id = ?
          AND outings.type = 'ordinary'
          AND (
            outings.status = 'cancelled'
            OR (
              outings.exited_at IS NULL
              AND outings.returned_at IS NULL
              AND outings.starts_at IS NOT NULL
              AND outings.expected_return_at < ?
            )
            OR (
              outings.exited_at IS NOT NULL
              AND outings.returned_at IS NOT NULL
            )
          )
        """,
        (resident_id, now_text),
    ).fetchall()
    for row in outings:
        finished = row["exited_at"] is not None and row["returned_at"] is not None
        if finished:
            items.append(
                HistoryItem(
                    id=row["id"],
                    kind="outing",
                    place=row["place"],
                    who=None,
                    started_at=row["exited_at"],
                    ended_at=row["returned_at"],
                    exit_recorded_by=row["exit_recorded_by"],
                    return_recorded_by=row["return_recorded_by"],
                    unused=False,
                )
            )
        else:
            items.append(
                HistoryItem(
                    id=row["id"],
                    kind="outing",
                    place=row["place"],
                    who=None,
                    started_at=row["starts_at"],
                    ended_at=row["expected_return_at"],
                    exit_recorded_by=None,
                    return_recorded_by=None,
                    unused=True,
                )
            )

    permissions = connection.execute(
        """
        SELECT
          permissions.id,
          permissions.type AS kind,
          permissions.short_place AS place,
          permissions.departure_at AS started_at,
          permissions.expected_return_at AS ended_at,
          permissions.status,
          exit_staff.full_name AS exit_recorded_by,
          return_staff.full_name AS return_recorded_by
        FROM permissions
        LEFT JOIN outings ON outings.id = (
          SELECT o.id
          FROM outings AS o
          WHERE o.permission_id = permissions.id
            AND o.exited_at IS NOT NULL
            AND o.returned_at IS NOT NULL
          ORDER BY o.returned_at DESC, o.id DESC
          LIMIT 1
        )
        LEFT JOIN users AS exit_staff ON exit_staff.id = outings.exit_recorded_by
        LEFT JOIN users AS return_staff ON return_staff.id = outings.return_recorded_by
        WHERE permissions.resident_id = ?
          AND (
            permissions.status IN ('completed', 'cancelled', 'rejected')
            OR (
              permissions.status IN ('approved', 'expired')
              AND permissions.expected_return_at < ?
            )
          )
        """,
        (resident_id, now_text),
    ).fetchall()
    for row in permissions:
        completed = row["status"] == "completed"
        items.append(
            HistoryItem(
                id=row["id"],
                kind=row["kind"],
                place=row["place"],
                who=None,
                started_at=row["started_at"],
                ended_at=row["ended_at"],
                exit_recorded_by=row["exit_recorded_by"] if completed else None,
                return_recorded_by=row["return_recorded_by"] if completed else None,
                unused=not completed,
            )
        )

    stays = connection.execute(
        """
        SELECT id, guest_name, guest_start_date, guest_end_date, status
        FROM guest_stays
        WHERE host_resident_id = ?
          AND (
            status IN ('departed', 'rejected', 'cancelled')
            OR (
              status = 'approved'
              AND arrived_at IS NULL
              AND guest_end_date < ?
            )
          )
        """,
        (resident_id, today),
    ).fetchall()
    for row in stays:
        items.append(
            HistoryItem(
                id=row["id"],
                kind="guest_stay",
                place=None,
                who=row["guest_name"],
                started_at=_hall_instant(row["guest_start_date"], end=False),
                ended_at=_hall_instant(row["guest_end_date"], end=True),
                exit_recorded_by=None,
                return_recorded_by=None,
                unused=row["status"] != "departed",
            )
        )
    items.sort(key=lambda item: (item.ended_at, item.id), reverse=True)
    return items


@router.get("/me/history", response_model=HistoryList)
def resident_history(
    account: ResidentDep,
    connection: ConnectionDep,
    kind: Annotated[HistoryKind | None, Query()] = None,
    on: Annotated[date | None, Query()] = None,
    from_day: Annotated[date | None, Query(alias="from")] = None,
    to_day: Annotated[date | None, Query(alias="to")] = None,
) -> HistoryList:
    now = clock.utc_now()
    today = clock.hall_local_date(now)
    items = _history_items(
        connection,
        account.id,
        now_text=clock.format_instant(now),
        today=today,
    )
    if kind is not None and kind != "all":
        items = [item for item in items if item.kind == kind]
    if on is not None:
        items = [
            item
            for item in items
            if _covers_hall_day(item.started_at, item.ended_at, on)
        ]
    if from_day is not None or to_day is not None:
        items = [
            item
            for item in items
            if _overlaps_range(item.started_at, item.ended_at, from_day, to_day)
        ]
    return HistoryList(items=items)


class ExpirePassedResult(BaseModel):
    model_config = ConfigDict(extra="forbid")
    plans_expired: int
    permissions_expired: int


@router.post("/me/expire-passed", response_model=ExpirePassedResult)
def expire_own_passed(account: ResidentDep, connection: ConnectionDep) -> ExpirePassedResult:
    now_text = clock.format_instant(clock.utc_now())
    plans = expire_passed_plans(connection, account.id, now_text)
    permissions = expire_passed_permissions(connection, now_text, resident_id=account.id)
    return ExpirePassedResult(plans_expired=plans, permissions_expired=permissions)
