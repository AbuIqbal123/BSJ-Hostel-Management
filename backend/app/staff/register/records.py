"""Register presence counts and resident rows for the warden desk."""

from __future__ import annotations

import sqlite3
from datetime import datetime
from typing import Literal
from zoneinfo import ZoneInfo

from pydantic import BaseModel, ConfigDict

from app.residents.outings.records import OutingBody, outing_from_row
from app.shared import clock


RegisterState = Literal["inside", "outside", "late"]
GuardianNotice = Literal["not_due", "sent", "failed"]


class BlockRegisterCounts(BaseModel):
    model_config = ConfigDict(extra="forbid")
    block_id: str
    code: str
    name: str
    inside_count: int
    outside_count: int
    late_count: int
    pending_permission_count: int
    guests_in_hall_count: int
    guests_should_have_left_count: int
    pending_guest_stay_count: int


class RegisterSummary(BaseModel):
    model_config = ConfigDict(extra="forbid")
    inside_count: int
    outside_count: int
    late_count: int
    pending_permission_count: int
    guests_in_hall_count: int
    guests_should_have_left_count: int
    pending_guest_stay_count: int
    blocks: list[BlockRegisterCounts]


class RegisterRow(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: str
    full_name: str
    room_label: str
    presence: Literal["inside", "outside"]
    state: RegisterState
    outside_destination: str | None = None
    expected_return_at: str | None = None
    returned_at: str | None = None


class RegisterPage(BaseModel):
    model_config = ConfigDict(extra="forbid")
    total: int
    limit: int
    offset: int
    items: list[RegisterRow]


class ResidentRecord(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: str
    full_name: str
    enrolment_number: str
    course: str | None = None
    room_label: str
    presence: Literal["inside", "outside"]
    state: RegisterState
    outing: OutingBody | None = None
    guardian_name: str
    guardian_notice: GuardianNotice


def _now_text() -> str:
    return clock.format_instant(clock.utc_now())


def _hall_day(connection: sqlite3.Connection, moment: datetime) -> str:
    row = connection.execute("SELECT timezone FROM hall_settings WHERE id = 'hall'").fetchone()
    return moment.astimezone(ZoneInfo(row["timezone"])).date().isoformat()


def register_state(presence: str, grace_ends_at: str | None, now_text: str) -> RegisterState:
    if presence != "outside":
        return "inside"
    if grace_ends_at is not None and now_text > grace_ends_at:
        return "late"
    return "outside"


def load_summary(connection: sqlite3.Connection) -> RegisterSummary:
    now_text = _now_text()
    today = _hall_day(connection, clock.utc_now())
    blocks = connection.execute(
        """
        SELECT id AS block_id, code, name
        FROM blocks
        ORDER BY code COLLATE NOCASE, id
        """
    ).fetchall()
    block_counts: list[BlockRegisterCounts] = []
    for block in blocks:
        presence_rows = connection.execute(
            """
            SELECT
              residents.presence,
              open_outing.grace_ends_at
            FROM residents
            JOIN users ON users.id = residents.user_id
            JOIN rooms ON rooms.id = residents.room_id
            LEFT JOIN outings AS open_outing
              ON open_outing.resident_id = residents.user_id
             AND open_outing.status = 'outside'
            WHERE users.status = 'active'
              AND rooms.block_id = ?
            """,
            (block["block_id"],),
        ).fetchall()
        inside_count = 0
        outside_count = 0
        late_count = 0
        for row in presence_rows:
            state = register_state(row["presence"], row["grace_ends_at"], now_text)
            if state == "inside":
                inside_count += 1
            elif state == "outside":
                outside_count += 1
            else:
                late_count += 1
        pending_permission_count = connection.execute(
            """
            SELECT COUNT(*)
            FROM permissions
            JOIN residents ON residents.user_id = permissions.resident_id
            JOIN users ON users.id = residents.user_id
            JOIN rooms ON rooms.id = residents.room_id
            WHERE permissions.status = 'pending'
              AND users.status = 'active'
              AND rooms.block_id = ?
            """,
            (block["block_id"],),
        ).fetchone()[0]
        guests_in_hall_count = connection.execute(
            """
            SELECT COUNT(*)
            FROM guest_stays
            JOIN residents ON residents.user_id = guest_stays.host_resident_id
            JOIN rooms ON rooms.id = residents.room_id
            WHERE guest_stays.status = 'approved'
              AND guest_stays.arrived_at IS NOT NULL
              AND guest_stays.departed_at IS NULL
              AND rooms.block_id = ?
            """,
            (block["block_id"],),
        ).fetchone()[0]
        guests_should_have_left_count = connection.execute(
            """
            SELECT COUNT(*)
            FROM guest_stays
            JOIN residents ON residents.user_id = guest_stays.host_resident_id
            JOIN rooms ON rooms.id = residents.room_id
            WHERE guest_stays.status = 'approved'
              AND guest_stays.arrived_at IS NOT NULL
              AND guest_stays.departed_at IS NULL
              AND guest_stays.end_date < ?
              AND rooms.block_id = ?
            """,
            (today, block["block_id"]),
        ).fetchone()[0]
        pending_guest_stay_count = connection.execute(
            """
            SELECT COUNT(*)
            FROM guest_stays
            JOIN residents ON residents.user_id = guest_stays.host_resident_id
            JOIN rooms ON rooms.id = residents.room_id
            WHERE guest_stays.status = 'pending'
              AND rooms.block_id = ?
            """,
            (block["block_id"],),
        ).fetchone()[0]
        block_counts.append(
            BlockRegisterCounts(
                block_id=block["block_id"],
                code=block["code"],
                name=block["name"],
                inside_count=inside_count,
                outside_count=outside_count,
                late_count=late_count,
                pending_permission_count=pending_permission_count,
                guests_in_hall_count=guests_in_hall_count,
                guests_should_have_left_count=guests_should_have_left_count,
                pending_guest_stay_count=pending_guest_stay_count,
            )
        )
    return RegisterSummary(
        inside_count=sum(block.inside_count for block in block_counts),
        outside_count=sum(block.outside_count for block in block_counts),
        late_count=sum(block.late_count for block in block_counts),
        pending_permission_count=sum(block.pending_permission_count for block in block_counts),
        guests_in_hall_count=sum(block.guests_in_hall_count for block in block_counts),
        guests_should_have_left_count=sum(
            block.guests_should_have_left_count for block in block_counts
        ),
        pending_guest_stay_count=sum(block.pending_guest_stay_count for block in block_counts),
        blocks=block_counts,
    )


def _row_from_resident(row: sqlite3.Row, now_text: str) -> RegisterRow:
    state = register_state(row["presence"], row["grace_ends_at"], now_text)
    if state == "inside":
        outside_destination = None
        expected_return_at = None
        returned_at = None
    else:
        outside_destination = row["place"]
        expected_return_at = row["expected_return_at"]
        returned_at = None
    return RegisterRow(
        id=row["id"],
        full_name=row["full_name"],
        room_label=row["room_label"],
        presence=row["presence"],
        state=state,
        outside_destination=outside_destination,
        expected_return_at=expected_return_at,
        returned_at=returned_at,
    )


_RESIDENT_SELECT = """
SELECT
  users.id,
  users.full_name,
  rooms.label AS room_label,
  residents.presence,
  open_outing.place,
  open_outing.expected_return_at,
  open_outing.grace_ends_at
FROM residents
JOIN users ON users.id = residents.user_id
JOIN rooms ON rooms.id = residents.room_id
LEFT JOIN outings AS open_outing
  ON open_outing.resident_id = residents.user_id
 AND open_outing.status = 'outside'
WHERE users.status = 'active'
"""


def list_register(
    connection: sqlite3.Connection,
    *,
    q: str | None,
    state: RegisterState | None,
    block_id: str | None,
    limit: int,
    offset: int,
) -> RegisterPage:
    now_text = _now_text()
    params: list[object] = []
    filters: list[str] = []
    if q:
        filters.append("(lower(users.full_name) LIKE ? OR lower(rooms.label) LIKE ?)")
        pattern = f"%{q.strip().lower()}%"
        params.extend([pattern, pattern])
    if block_id:
        filters.append("rooms.block_id = ?")
        params.append(block_id)
    if state == "inside":
        filters.append("residents.presence != 'outside'")
    elif state == "outside":
        filters.append("residents.presence = 'outside'")
        filters.append("(open_outing.grace_ends_at IS NULL OR open_outing.grace_ends_at >= ?)")
        params.append(now_text)
    elif state == "late":
        filters.append("residents.presence = 'outside'")
        filters.append("open_outing.grace_ends_at IS NOT NULL")
        filters.append("open_outing.grace_ends_at < ?")
        params.append(now_text)
    where_extra = (" AND " + " AND ".join(filters)) if filters else ""
    count_sql = f"""
        SELECT COUNT(*) AS n
        FROM residents
        JOIN users ON users.id = residents.user_id
        JOIN rooms ON rooms.id = residents.room_id
        LEFT JOIN outings AS open_outing
          ON open_outing.resident_id = residents.user_id
         AND open_outing.status = 'outside'
        WHERE users.status = 'active'{where_extra}
    """
    total = connection.execute(count_sql, params).fetchone()["n"]
    page_sql = (
        _RESIDENT_SELECT
        + where_extra
        + " ORDER BY users.full_name COLLATE NOCASE, users.id LIMIT ? OFFSET ?"
    )
    rows = connection.execute(page_sql, [*params, limit, offset]).fetchall()
    items = [_row_from_resident(row, now_text) for row in rows]
    return RegisterPage(total=total, limit=limit, offset=offset, items=items)


def late_list(connection: sqlite3.Connection, *, limit: int, offset: int) -> RegisterPage:
    return list_register(
        connection,
        q=None,
        state="late",
        block_id=None,
        limit=limit,
        offset=offset,
    )


_OUTING_SELECT = """
SELECT
  outings.id,
  outings.permission_id,
  outings.type,
  outings.status,
  outings.place,
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


def load_open_outing(
    connection: sqlite3.Connection, resident_id: str
) -> OutingBody | None:
    row = connection.execute(
        _OUTING_SELECT
        + """
        WHERE outings.resident_id = ?
          AND outings.status = 'outside'
        LIMIT 1
        """,
        (resident_id,),
    ).fetchone()
    if row is None:
        return None
    return outing_from_row(row)


def guardian_notice_for(
    connection: sqlite3.Connection, *, outing: OutingBody | None, state: RegisterState
) -> GuardianNotice:
    if outing is None or outing.status != "outside":
        return "not_due"
    if state != "late":
        return "not_due"
    row = connection.execute(
        """
        SELECT status
        FROM guardian_messages
        WHERE outing_id = ? AND notice_type = 'late_notice'
        ORDER BY created_at DESC, id DESC
        LIMIT 1
        """,
        (outing.id,),
    ).fetchone()
    if row is None:
        return "not_due"
    if row["status"] == "sent":
        return "sent"
    return "failed"


def load_resident_record(connection: sqlite3.Connection, resident_id: str) -> ResidentRecord | None:
    now_text = _now_text()
    row = connection.execute(
        """
        SELECT
          users.id,
          users.full_name,
          residents.enrolment_number,
          residents.course,
          rooms.label AS room_label,
          residents.presence,
          residents.guardian_name,
          open_outing.grace_ends_at
        FROM residents
        JOIN users ON users.id = residents.user_id
        JOIN rooms ON rooms.id = residents.room_id
        LEFT JOIN outings AS open_outing
          ON open_outing.resident_id = residents.user_id
         AND open_outing.status = 'outside'
        WHERE residents.user_id = ?
        """,
        (resident_id,),
    ).fetchone()
    if row is None:
        return None
    state = register_state(row["presence"], row["grace_ends_at"], now_text)
    outing = load_open_outing(connection, resident_id)
    return ResidentRecord(
        id=row["id"],
        full_name=row["full_name"],
        enrolment_number=row["enrolment_number"],
        course=row["course"],
        room_label=row["room_label"],
        presence=row["presence"],
        state=state,
        outing=outing,
        guardian_name=row["guardian_name"],
        guardian_notice=guardian_notice_for(connection, outing=outing, state=state),
    )
