"""Register presence counts and resident rows for the warden desk."""

from __future__ import annotations

import sqlite3
from typing import Literal

from pydantic import BaseModel, ConfigDict

from app.residents.outings.records import OUTING_SELECT, OutingBody, outing_from_row
from app.shared import clock


RegisterState = Literal["inside", "outside", "late"]
RegisterFilter = Literal["inside", "outside", "late", "out"]
RegisterOrder = Literal["name", "back_by"]
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
    notifications_unread: bool = False


class RegisterRow(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: str
    full_name: str
    room_label: str
    presence: Literal["inside", "outside"]
    state: RegisterState
    block_name: str
    outing_type: Literal["ordinary", "late_night", "home_going"] | None = None
    outside_destination: str | None = None
    expected_return_at: str | None = None


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


def register_state(presence: str, grace_ends_at: str | None, now_text: str) -> RegisterState:
    if presence != "outside":
        return "inside"
    if grace_ends_at is not None and now_text > grace_ends_at:
        return "late"
    return "outside"


def load_summary(connection: sqlite3.Connection) -> RegisterSummary:
    now_text = _now_text()
    today = clock.hall_local_date(clock.utc_now())
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
              AND guest_stays.guest_end_date < ?
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
    inside = state == "inside"
    return RegisterRow(
        id=row["id"],
        full_name=row["full_name"],
        room_label=row["room_label"],
        presence=row["presence"],
        state=state,
        block_name=row["block_name"],
        outing_type=None if inside else row["outing_type"],
        outside_destination=None if inside else row["place"],
        expected_return_at=None if inside else row["expected_return_at"],
    )


_RESIDENT_SELECT = """
SELECT
  users.id,
  users.full_name,
  rooms.label AS room_label,
  blocks.name AS block_name,
  residents.presence,
  open_outing.type AS outing_type,
  open_outing.place,
  open_outing.expected_return_at,
  open_outing.grace_ends_at
FROM residents
JOIN users ON users.id = residents.user_id
JOIN rooms ON rooms.id = residents.room_id
JOIN blocks ON blocks.id = rooms.block_id
LEFT JOIN outings AS open_outing
  ON open_outing.resident_id = residents.user_id
 AND open_outing.status = 'outside'
WHERE users.status = 'active'
"""


def list_register(
    connection: sqlite3.Connection,
    *,
    q: str | None,
    state: RegisterFilter | None,
    block_id: str | None,
    limit: int,
    offset: int,
    order: RegisterOrder = "name",
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
    elif state == "out":
        filters.append("residents.presence = 'outside'")
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
    back_by = (
        "open_outing.expected_return_at IS NULL, open_outing.expected_return_at, "
        if order == "back_by"
        else ""
    )
    page_sql = (
        _RESIDENT_SELECT
        + where_extra
        + f" ORDER BY {back_by}users.full_name COLLATE NOCASE, users.id LIMIT ? OFFSET ?"
    )
    rows = connection.execute(page_sql, [*params, limit, offset]).fetchall()
    items = [_row_from_resident(row, now_text) for row in rows]
    return RegisterPage(total=total, limit=limit, offset=offset, items=items)


def load_open_outing(
    connection: sqlite3.Connection, resident_id: str
) -> OutingBody | None:
    row = connection.execute(
        OUTING_SELECT
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
    if outing is None or state != "late":
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


LateSource = Literal["ordinary", "late_night", "home_going"]
LateState = Literal["now", "past"]


class LateReturnRow(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: str
    resident_id: str
    resident_name: str
    room_label: str
    block_id: str
    block_name: str
    source: LateSource
    due_at: str
    returned_at: str | None
    minutes_late: int


class LateReturnPage(BaseModel):
    model_config = ConfigDict(extra="forbid")
    total: int
    limit: int
    offset: int
    items: list[LateReturnRow]


def _minutes_between(earlier: str, later: str) -> int:
    seconds = (clock.parse_instant(later) - clock.parse_instant(earlier)).total_seconds()
    return int(seconds // 60)


def list_late_returns(
    connection: sqlite3.Connection,
    *,
    source: LateSource | None,
    state: LateState | None,
    first_day: str | None,
    last_day: str | None,
    limit: int,
    offset: int,
) -> LateReturnPage:
    """Outings past grace: still outside (now) or returned after grace (past)."""
    now_text = _now_text()
    now_clause = "(outings.status = 'outside' AND outings.grace_ends_at < ?)"
    past_clause = "(outings.status = 'returned' AND outings.returned_at > outings.grace_ends_at)"
    params: list[object] = []
    if state == "now":
        filters = [now_clause]
        params.append(now_text)
    elif state == "past":
        filters = [past_clause]
    else:
        filters = [f"({now_clause} OR {past_clause})"]
        params.append(now_text)
    if source is not None:
        filters.append("outings.type = ?")
        params.append(source)
    if first_day is not None:
        filters.append("outings.hall_date >= ?")
        params.append(first_day)
    if last_day is not None:
        filters.append("outings.hall_date <= ?")
        params.append(last_day)
    from_where = f"""
        FROM outings
        JOIN users ON users.id = outings.resident_id
        JOIN residents ON residents.user_id = outings.resident_id
        JOIN rooms ON rooms.id = residents.room_id
        JOIN blocks ON blocks.id = rooms.block_id
        WHERE {' AND '.join(filters)}
    """
    total = connection.execute(f"SELECT COUNT(*) AS n {from_where}", params).fetchone()["n"]
    rows = connection.execute(
        f"""
        SELECT
          outings.id,
          outings.resident_id,
          users.full_name AS resident_name,
          rooms.label AS room_label,
          blocks.id AS block_id,
          blocks.name AS block_name,
          outings.type AS source,
          outings.expected_return_at AS due_at,
          outings.returned_at
        {from_where}
        ORDER BY outings.expected_return_at DESC, outings.id DESC
        LIMIT ? OFFSET ?
        """,
        [*params, limit, offset],
    ).fetchall()
    items = [
        LateReturnRow(
            id=row["id"],
            resident_id=row["resident_id"],
            resident_name=row["resident_name"],
            room_label=row["room_label"],
            block_id=row["block_id"],
            block_name=row["block_name"],
            source=row["source"],
            due_at=row["due_at"],
            returned_at=row["returned_at"],
            minutes_late=_minutes_between(row["due_at"], row["returned_at"] or now_text),
        )
        for row in rows
    ]
    return LateReturnPage(total=total, limit=limit, offset=offset, items=items)


# Staff inbox events. Nothing writes a notification row: an event is a
# permission or guest stay being requested (created_at) or an outing passing
# grace (grace_ends_at). staff.notifications_read_at is the only stored state;
# an event after it is unread.
EVENTS_SQL = """
SELECT events.kind, events.record_id, events.occurred_at,
       users.full_name AS resident_name, rooms.label AS room_label
FROM (
  SELECT 'permission_requested' AS kind, id AS record_id,
         resident_id, created_at AS occurred_at
  FROM permissions
  UNION ALL
  SELECT 'guest_stay_requested', id, host_resident_id, created_at
  FROM guest_stays
  UNION ALL
  SELECT 'resident_late', id, resident_id, grace_ends_at
  FROM outings
  WHERE grace_ends_at < :now
    AND (status = 'outside' OR (status = 'returned' AND returned_at > grace_ends_at))
) AS events
JOIN users ON users.id = events.resident_id
JOIN residents ON residents.user_id = events.resident_id
JOIN rooms ON rooms.id = residents.room_id
"""


def notifications_read_at(connection: sqlite3.Connection, user_id: str) -> str:
    row = connection.execute(
        "SELECT notifications_read_at FROM staff WHERE user_id = ?", (user_id,)
    ).fetchone()
    return "" if row is None or row[0] is None else row[0]


def unread_count(connection: sqlite3.Connection, user_id: str, now_text: str) -> int:
    return connection.execute(
        f"SELECT COUNT(*) FROM ({EVENTS_SQL}) WHERE occurred_at > :read_at",
        {"now": now_text, "read_at": notifications_read_at(connection, user_id)},
    ).fetchone()[0]


def has_unread(connection: sqlite3.Connection, user_id: str) -> bool:
    return unread_count(connection, user_id, clock.format_instant(clock.utc_now())) > 0
