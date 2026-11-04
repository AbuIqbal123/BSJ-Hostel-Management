"""Resident home and history assembly."""

from __future__ import annotations

import sqlite3
from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict

from app.shared import clock
from app.shared.db import hall_settings
from app.residents.notifications.records import guest_stay_history_lines
from app.residents.outings.usable import find_usable_outing
from app.residents.permissions.records import PermissionBody, permission_from_row


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
    notice_kind: Literal[
        "guest_stay_decided",
        "guest_stay_roommate_decided",
        "guest_stay_roommate_recorded",
    ] | None = None
    host_name: str | None = None
    actor_name: str | None = None
    decision: Literal["approved", "rejected"] | None = None
    guest_stay_id: str | None = None


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


def hall_pass_outing_type(
    connection: sqlite3.Connection, resident_id: str, now: datetime
) -> Literal["ordinary", "late_night", "home_going"] | None:
    """Type of the outing her QR is showing for now, or None when it is hidden."""
    lead = int(hall_settings(connection)["permission_lead_minutes"])
    usable = find_usable_outing(connection, resident_id, now, lead)
    if usable is None or not usable.is_open:
        return None
    return usable.outing_type


def active_permission(connection: sqlite3.Connection, resident_id: str) -> PermissionBody | None:
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


def recent_history(connection: sqlite3.Connection, resident_id: str) -> list[HistoryEvent]:
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


def hall_day_bounds_instant(day: str, *, end: bool) -> str:
    year, month, day_number = (int(part) for part in day.split("-"))
    if end:
        local = datetime(year, month, day_number, 23, 59, 59, tzinfo=clock.HALL_ZONE)
    else:
        local = datetime(year, month, day_number, 0, 0, 0, tzinfo=clock.HALL_ZONE)
    return clock.format_instant(local)


def hall_span(started_at: str, ended_at: str) -> tuple[date, date]:
    start = clock.hall_calendar_date(started_at)
    end = clock.hall_calendar_date(ended_at)
    if end < start:
        return end, start
    return start, end


def covers_hall_day(started_at: str, ended_at: str, on: date) -> bool:
    start, end = hall_span(started_at, ended_at)
    return start <= on <= end


def overlaps_range(
    started_at: str,
    ended_at: str,
    first: date | None,
    last: date | None,
) -> bool:
    if first is None and last is None:
        return True
    start, end = hall_span(started_at, ended_at)
    if first is not None and end < first:
        return False
    if last is not None and start > last:
        return False
    return True


def history_items(
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
                started_at=hall_day_bounds_instant(row["guest_start_date"], end=False),
                ended_at=hall_day_bounds_instant(row["guest_end_date"], end=True),
                exit_recorded_by=None,
                return_recorded_by=None,
                unused=row["status"] != "departed",
            )
        )
    for line in guest_stay_history_lines(connection, resident_id):
        items.append(
            HistoryItem(
                id=line.id,
                kind="guest_stay",
                place=None,
                who=line.guest_name,
                started_at=hall_day_bounds_instant(line.guest_start_date, end=False),
                ended_at=hall_day_bounds_instant(line.guest_end_date, end=True),
                exit_recorded_by=None,
                return_recorded_by=None,
                unused=False,
                notice_kind=line.notice_kind,
                host_name=line.host_name,
                actor_name=line.actor_name,
                decision=line.decision,
                guest_stay_id=line.guest_stay_id,
            )
        )
    items.sort(key=lambda item: (item.ended_at, item.id), reverse=True)
    return items
