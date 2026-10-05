"""Outing rows shared by the resident's home screen and her outing requests."""

from __future__ import annotations

import sqlite3
from datetime import datetime, timedelta
from typing import Literal
from zoneinfo import ZoneInfo

from pydantic import BaseModel, ConfigDict

from app.shared import clock
from app.shared.audit import record_audit


class UpcomingOuting(BaseModel):
    """A planned ordinary outing still in the future, for the home list."""

    model_config = ConfigDict(extra="forbid")
    id: str
    place: str
    starts_at: str | None
    expected_return_at: str
    can_modify: bool


class OutingBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: str
    permission_id: str | None
    outing_type: Literal["ordinary", "late_night", "home_going"]
    status: Literal["planned", "outside", "returned", "cancelled"]
    place: str
    starts_at: str | None
    qr_visible: bool
    qr_visible_from: str | None
    qr_visible_until: str | None
    expected_return_at: str
    grace_ends_at: str
    exited_at: str | None
    exit_recorded_by_name: str | None
    returned_at: str | None
    return_recorded_by_name: str | None
    lateness: Literal["on_time", "late"]
    created_at: str


def outing_lateness(status: str, grace_ends_at: str) -> Literal["on_time", "late"]:
    if status == "outside" and clock.format_instant(clock.utc_now()) > grace_ends_at:
        return "late"
    return "on_time"


_QR_LEAD = timedelta(minutes=30)


def qr_window(
    *,
    outing_type: str,
    status: str,
    starts_at: str | None,
    expected_return_at: str,
    exited_at: str | None,
    now: datetime,
) -> tuple[bool, str | None, str | None]:
    """QR show window for one outing.

    An ordinary outing opens 30 minutes before starts_at. A planned outing
    closes at expected_return_at. An outside ordinary outing stays open until
    the return scan. Other types have no ordinary window.
    """
    if outing_type != "ordinary":
        return False, None, None
    if starts_at is None:
        if status == "outside":
            return True, exited_at, None
        return False, None, None
    start = clock.parse_instant(starts_at)
    visible_from = clock.format_instant(start - _QR_LEAD)
    if status == "outside":
        return True, visible_from, None
    visible_until = expected_return_at
    if status != "planned":
        return False, visible_from, visible_until
    if now >= clock.parse_instant(expected_return_at):
        return False, visible_from, visible_until
    if now >= start - _QR_LEAD:
        return True, visible_from, visible_until
    return False, visible_from, visible_until


def outing_from_row(row: sqlite3.Row) -> OutingBody:
    visible, visible_from, visible_until = qr_window(
        outing_type=row["type"],
        status=row["status"],
        starts_at=row["starts_at"],
        expected_return_at=row["expected_return_at"],
        exited_at=row["exited_at"],
        now=clock.utc_now(),
    )
    return OutingBody(
        id=row["id"],
        permission_id=row["permission_id"],
        outing_type=row["type"],
        status=row["status"],
        place=row["place"],
        starts_at=row["starts_at"],
        qr_visible=visible,
        qr_visible_from=visible_from,
        qr_visible_until=visible_until,
        expected_return_at=row["expected_return_at"],
        grace_ends_at=row["grace_ends_at"],
        exited_at=row["exited_at"],
        exit_recorded_by_name=row["exit_recorded_by_name"],
        returned_at=row["returned_at"],
        return_recorded_by_name=row["return_recorded_by_name"],
        lateness=outing_lateness(row["status"], row["grace_ends_at"]),
        created_at=row["created_at"],
    )


_OUTING_SELECT = """
SELECT
  outings.id,
  outings.permission_id,
  outings.type,
  outings.status,
  outings.place,
  outings.starts_at,
  outings.expected_return_at,
  outings.grace_ends_at,
  outings.exited_at,
  outings.returned_at,
  outings.created_at,
  exit_staff.full_name AS exit_recorded_by_name,
  return_staff.full_name AS return_recorded_by_name
FROM outings
LEFT JOIN users AS exit_staff ON exit_staff.id = outings.exit_recorded_by
LEFT JOIN users AS return_staff ON return_staff.id = outings.return_recorded_by
"""


def ordinary_window_is_open(
    connection: sqlite3.Connection, resident_id: str, now: datetime
) -> bool:
    rows = connection.execute(
        """
        SELECT type, status, starts_at, expected_return_at, exited_at
        FROM outings
        WHERE resident_id = ?
          AND type = 'ordinary'
          AND status IN ('planned', 'outside')
        """,
        (resident_id,),
    ).fetchall()
    for row in rows:
        visible, _, _ = qr_window(
            outing_type=row["type"],
            status=row["status"],
            starts_at=row["starts_at"],
            expected_return_at=row["expected_return_at"],
            exited_at=row["exited_at"],
            now=now,
        )
        if visible:
            return True
    return False


def can_modify_outing(
    *,
    outing_type: str,
    status: str,
    starts_at: str | None,
    expected_return_at: str,
    exited_at: str | None,
    now: datetime,
) -> bool:
    """True only while she may still change or cancel this outing.

    False once its hall-pass window is open, and false while she is outside
    on it. Only a planned ordinary outing can be true.
    """
    if outing_type != "ordinary" or status != "planned":
        return False
    visible, _, _ = qr_window(
        outing_type=outing_type,
        status=status,
        starts_at=starts_at,
        expected_return_at=expected_return_at,
        exited_at=exited_at,
        now=now,
    )
    return not visible


def return_is_taken(
    connection: sqlite3.Connection,
    resident_id: str,
    expected_return_at: str,
    *,
    except_outing_id: str | None = None,
) -> bool:
    sql = """
        SELECT 1 FROM outings
        WHERE resident_id = ?
          AND expected_return_at = ?
          AND status IN ('planned', 'outside')
    """
    params: list[str] = [resident_id, expected_return_at]
    if except_outing_id is not None:
        sql += " AND id != ?"
        params.append(except_outing_id)
    row = connection.execute(sql, params).fetchone()
    return row is not None


def load_current_outing(
    connection: sqlite3.Connection, resident_id: str, moment: datetime
) -> OutingBody | None:
    """The outing she is outside on, or the soonest plan for today."""
    today = clock.hall_local_date(connection, moment)
    row = connection.execute(
        _OUTING_SELECT
        + """
        WHERE outings.resident_id = ?
          AND (
            outings.status = 'outside'
            OR (outings.status = 'planned' AND outings.hall_date = ?)
          )
        ORDER BY CASE outings.status WHEN 'outside' THEN 0 ELSE 1 END,
                 outings.expected_return_at,
                 outings.id
        LIMIT 1
        """,
        (resident_id, today),
    ).fetchone()
    if row is None:
        return None
    return outing_from_row(row)


def load_upcoming(connection: sqlite3.Connection, resident_id: str) -> list[OutingBody]:
    rows = connection.execute(
        _OUTING_SELECT
        + """
        WHERE outings.resident_id = ? AND outings.status IN ('planned', 'outside')
        ORDER BY outings.expected_return_at, outings.id
        """,
        (resident_id,),
    ).fetchall()
    return [outing_from_row(row) for row in rows]


def list_upcoming_page(
    connection: sqlite3.Connection,
    resident_id: str,
    *,
    limit: int,
    offset: int,
) -> tuple[int, list[OutingBody]]:
    """Upcoming planned/outside outings with COUNT + LIMIT/OFFSET in SQL."""
    where = "WHERE outings.resident_id = ? AND outings.status IN ('planned', 'outside')"
    params: list[object] = [resident_id]
    total = connection.execute(
        f"SELECT COUNT(*) AS n FROM outings {where}",
        params,
    ).fetchone()["n"]
    rows = connection.execute(
        _OUTING_SELECT
        + f"""
        {where}
        ORDER BY outings.expected_return_at, outings.id
        LIMIT ? OFFSET ?
        """,
        [*params, limit, offset],
    ).fetchall()
    return int(total), [outing_from_row(row) for row in rows]


def load_upcoming_outings(
    connection: sqlite3.Connection, resident_id: str, now: datetime
) -> list[UpcomingOuting]:
    """Planned ordinary outings whose expected return is still ahead.

    Soonest start first. Returned, cancelled, outside, and passed plans are
    left off. A plan inside its show window stays, with can_modify false.
    """
    now_text = clock.format_instant(now)
    rows = connection.execute(
        """
        SELECT id, type, status, place, starts_at, expected_return_at, exited_at
        FROM outings
        WHERE resident_id = ?
          AND type = 'ordinary'
          AND status = 'planned'
          AND expected_return_at > ?
        ORDER BY COALESCE(starts_at, expected_return_at), id
        """,
        (resident_id, now_text),
    ).fetchall()
    return [
        UpcomingOuting(
            id=row["id"],
            place=row["place"],
            starts_at=row["starts_at"],
            expected_return_at=row["expected_return_at"],
            can_modify=can_modify_outing(
                outing_type=row["type"],
                status=row["status"],
                starts_at=row["starts_at"],
                expected_return_at=row["expected_return_at"],
                exited_at=row["exited_at"],
                now=now,
            ),
        )
        for row in rows
    ]


def load_outing(connection: sqlite3.Connection, outing_id: str) -> OutingBody:
    row = connection.execute(
        _OUTING_SELECT + "WHERE outings.id = ?",
        (outing_id,),
    ).fetchone()
    if row is None:
        raise LookupError(outing_id)
    return outing_from_row(row)


def record_outing(
    connection: sqlite3.Connection,
    when: str,
    actor_user_id: str | None,
    action: str,
    outing_id: str,
    summary: str,
) -> None:
    record_audit(connection, when, actor_user_id, action, "outing", outing_id, summary)


def expire_passed_plans(connection: sqlite3.Connection, resident_id: str, now_text: str) -> int:
    rows = connection.execute(
        """
        UPDATE outings
        SET status = 'cancelled', cancelled_at = ?, updated_at = ?
        WHERE resident_id = ? AND status = 'planned' AND expected_return_at < ?
        RETURNING id, place
        """,
        (now_text, now_text, resident_id, now_text),
    ).fetchall()
    for row in rows:
        record_outing(
            connection,
            now_text,
            None,
            "outing.cancelled",
            row["id"],
            f"A planned outing to {row['place']} was cancelled because the expected return passed.",
        )
    return len(rows)


def hours_refusal(moment: datetime, settings: sqlite3.Row) -> str | None:
    """None when the instant is inside that hall date's ordinary hours.

    The start is not included. The end is included. A later return needs a
    permission. An earlier return is outside ordinary hours.
    """
    local = moment.astimezone(ZoneInfo(settings["timezone"]))
    month_day = local.strftime("%m-%d")
    summer_start = settings["summer_season_start"]
    winter_start = settings["winter_season_start"]
    if summer_start < winter_start:
        is_summer = summer_start <= month_day < winter_start
    else:
        is_summer = month_day >= summer_start or month_day < winter_start
    if is_summer:
        start = settings["summer_outing_start"]
        end = settings["summer_outing_end"]
    else:
        start = settings["winter_outing_start"]
        end = settings["winter_outing_end"]
    clock_time = local.strftime("%H:%M:%S")
    if clock_time <= f"{start}:00":
        return "outside_ordinary_hours"
    if clock_time > f"{end}:00":
        return "permission_required"
    return None
