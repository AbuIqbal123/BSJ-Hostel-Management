"""What the resident sees when she opens the phone."""

from __future__ import annotations

import sqlite3
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, ConfigDict

from app.shared import clock
from app.shared.auth.routes import Account, AccountDep, ConnectionDep
from app.shared.errors import ApiError
from app.residents.outings.records import OutingBody, UpcomingOuting, expire_passed_plans, load_current_outing, load_upcoming, load_upcoming_outings
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


class HistoryPage(BaseModel):
    model_config = ConfigDict(extra="forbid")
    total: int
    limit: int
    offset: int
    items: list[HistoryEvent]


class HomeResident(BaseModel):
    model_config = ConfigDict(extra="forbid")
    full_name: str
    enrolment_number: str
    course: str | None
    room_label: str
    block_name: str
    presence: Literal["inside", "outside"]


class ResidentHome(BaseModel):
    model_config = ConfigDict(extra="forbid")
    resident: HomeResident
    ordinary_outing_active: bool
    current_outing: OutingBody | None
    upcoming_outings: list[UpcomingOuting]
    active_permission: PermissionBody | None
    recent_history: list[HistoryEvent]


def resident_account(account: AccountDep) -> Account:
    if account.role != "resident":
        raise ApiError(403, "forbidden", "This account cannot do that.")
    return account


ResidentDep = Annotated[Account, Depends(resident_account)]


def _active_permission(connection: sqlite3.Connection, resident_id: str) -> PermissionBody | None:
    row = connection.execute(
        """
        SELECT
          id, type, status, short_place, destination_detail, address, reason,
          departure_at, expected_return_at, decision_note, decided_at, created_at
        FROM permissions
        WHERE resident_id = ? AND status IN ('pending', 'approved', 'in_use')
        ORDER BY created_at DESC, id DESC
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


def load_history(
    connection: sqlite3.Connection,
    resident_id: str,
    *,
    limit: int,
    offset: int,
) -> HistoryPage:
    total = connection.execute(
        f"SELECT COUNT(*) AS n FROM ({_HISTORY_EVENTS_SQL})",
        (resident_id, resident_id),
    ).fetchone()["n"]
    rows = connection.execute(
        f"""
        {_HISTORY_EVENTS_SQL}
        ORDER BY COALESCE(returned_at, exited_at) DESC,
          CASE event WHEN 'returned' THEN 0 ELSE 1 END, outing_id DESC
        LIMIT ? OFFSET ?
        """,
        (resident_id, resident_id, limit, offset),
    ).fetchall()
    return HistoryPage(
        total=total,
        limit=limit,
        offset=offset,
        items=[
            HistoryEvent(
                event=row["event"],
                place=row["place"],
                outing_id=row["outing_id"],
                exited_at=row["exited_at"],
                returned_at=row["returned_at"],
                recorded_by=row["recorded_by"],
            )
            for row in rows
        ],
    )


@router.get("/me/home", response_model=ResidentHome)
def resident_home(account: ResidentDep, connection: ConnectionDep) -> ResidentHome:
    now = clock.utc_now()
    upcoming = load_upcoming(connection, account.id)
    return ResidentHome(
        resident=HomeResident(
            full_name=account.full_name,
            enrolment_number=account.enrolment_number or "",
            course=account.course,
            room_label=account.room_label or "",
            block_name=account.block_name or "",
            presence=account.presence or "inside",
        ),
        ordinary_outing_active=any(
            item.outing_type == "ordinary" and item.qr_visible for item in upcoming
        ),
        current_outing=load_current_outing(connection, account.id, now),
        upcoming_outings=load_upcoming_outings(connection, account.id, now),
        active_permission=_active_permission(connection, account.id),
        recent_history=load_history(connection, account.id, limit=10, offset=0).items,
    )


@router.get("/me/history", response_model=HistoryPage)
def resident_history(
    account: ResidentDep,
    connection: ConnectionDep,
    limit: Annotated[int, Query(ge=1, le=500)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> HistoryPage:
    return load_history(connection, account.id, limit=limit, offset=offset)


class ExpirePassedResult(BaseModel):
    model_config = ConfigDict(extra="forbid")
    plans_expired: int
    permissions_expired: int


@router.post("/me/expire-passed", response_model=ExpirePassedResult)
def expire_own_passed(account: ResidentDep, connection: ConnectionDep) -> ExpirePassedResult:
    now_text = clock.format_instant(clock.utc_now())
    plans = expire_passed_plans(connection, account.id, now_text)
    permissions = expire_passed_permissions(connection, now_text, resident_id=account.id)
    connection.commit()
    return ExpirePassedResult(plans_expired=plans, permissions_expired=permissions)
