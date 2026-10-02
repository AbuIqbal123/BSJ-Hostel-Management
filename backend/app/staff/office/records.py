"""Hall office settings records."""

from __future__ import annotations

import secrets
import sqlite3
import uuid

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.shared.schemas import Destination, DestinationList, HallPass

SETTINGS_COLUMNS = (
    "hall_name",
    "university_name",
    "timezone",
    "grace_minutes",
    "summer_outing_start",
    "summer_outing_end",
    "winter_outing_start",
    "winter_outing_end",
    "summer_season_start",
    "winter_season_start",
    "permission_lead_minutes",
    "guest_max_inclusive_days",
    "guest_min_lead_days",
    "scan_duplicate_window_seconds",
)

NOTIFICATIONS_COLUMNS = (
    "late_sms_template",
    "return_sms_template",
)

LATE_PLACEHOLDERS = (
    "{resident_name}",
    "{room}",
    "{expected_return_local}",
    "{hall_name}",
)
RETURN_PLACEHOLDERS = (
    "{resident_name}",
    "{room}",
    "{returned_at_local}",
    "{hall_name}",
)

HHMM = r"^([01][0-9]|2[0-3]):[0-5][0-9]$"
MMDD = r"^(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$"


class HallSettings(BaseModel):
    model_config = ConfigDict(extra="forbid")
    hall_name: str
    university_name: str
    timezone: str
    grace_minutes: int
    summer_outing_start: str
    summer_outing_end: str
    winter_outing_start: str
    winter_outing_end: str
    summer_season_start: str
    winter_season_start: str
    permission_lead_minutes: int
    guest_max_inclusive_days: int
    guest_min_lead_days: int
    scan_duplicate_window_seconds: int


class HallSettingsUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    hall_name: str | None = Field(default=None, min_length=1, max_length=160)
    university_name: str | None = Field(default=None, min_length=1, max_length=160)
    grace_minutes: int | None = Field(default=None, ge=0, le=180)
    summer_outing_start: str | None = Field(default=None, pattern=HHMM)
    summer_outing_end: str | None = Field(default=None, pattern=HHMM)
    winter_outing_start: str | None = Field(default=None, pattern=HHMM)
    winter_outing_end: str | None = Field(default=None, pattern=HHMM)
    summer_season_start: str | None = Field(default=None, pattern=MMDD)
    winter_season_start: str | None = Field(default=None, pattern=MMDD)
    permission_lead_minutes: int | None = Field(default=None, ge=0, le=180)
    guest_max_inclusive_days: int | None = Field(default=None, ge=1, le=30)
    guest_min_lead_days: int | None = Field(default=None, ge=0, le=14)
    scan_duplicate_window_seconds: int | None = Field(default=None, ge=0, le=600)


class HallNotifications(BaseModel):
    model_config = ConfigDict(extra="forbid")
    late_sms_template: str
    return_sms_template: str


class HallNotificationsUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    late_sms_template: str | None = Field(default=None, min_length=1)
    return_sms_template: str | None = Field(default=None, min_length=1)


def load_settings(connection: sqlite3.Connection) -> HallSettings:
    row = connection.execute(
        f"SELECT {', '.join(SETTINGS_COLUMNS)} FROM hall_settings WHERE id = 'hall'"
    ).fetchone()
    assert row is not None
    return HallSettings(**{key: row[key] for key in SETTINGS_COLUMNS})


def load_notifications(connection: sqlite3.Connection) -> HallNotifications:
    row = connection.execute(
        f"SELECT {', '.join(NOTIFICATIONS_COLUMNS)} FROM hall_settings WHERE id = 'hall'"
    ).fetchone()
    assert row is not None
    return HallNotifications(**{key: row[key] for key in NOTIFICATIONS_COLUMNS})


def template_keeps_placeholders(template: str, required: tuple[str, ...]) -> bool:
    return all(token in template for token in required)


def record_settings_updated(
    connection: sqlite3.Connection,
    occurred_at: str,
    actor_user_id: str,
    summary: str,
    detail: str | None = None,
) -> None:
    connection.execute(
        """
        INSERT INTO audit_log (
          id, occurred_at, actor_user_id, action, entity_type, entity_id, summary, detail
        ) VALUES (?, ?, ?, 'settings.updated', 'settings', 'hall', ?, ?)
        """,
        (str(uuid.uuid4()), occurred_at, actor_user_id, summary, detail),
    )



def _apply_patch(
    data: dict[str, object],
    patch_fields_set: set[str],
    patch: object,
) -> tuple[dict[str, object], dict[str, object]]:
    changes: dict[str, object] = {}
    merged = dict(data)
    for field_name in patch_fields_set:
        value = getattr(patch, field_name)
        if value is None:
            continue
        if isinstance(value, str):
            value = value.strip()
            if not value:
                continue
        if merged[field_name] != value:
            changes[field_name] = value
            merged[field_name] = value
    return merged, changes


def apply_settings_update(
    current: HallSettings,
    patch: HallSettingsUpdate,
) -> tuple[HallSettings, dict[str, object]]:
    """Return merged settings and the changed field map (new values only)."""
    merged, changes = _apply_patch(current.model_dump(), patch.model_fields_set, patch)
    return HallSettings(**merged), changes


def apply_notifications_update(
    current: HallNotifications,
    patch: HallNotificationsUpdate,
) -> tuple[HallNotifications, dict[str, object]]:
    """Return merged notification templates and the changed field map."""
    merged, changes = _apply_patch(current.model_dump(), patch.model_fields_set, patch)
    return HallNotifications(**merged), changes


BLOCK_COLUMNS = (
    "id",
    "code",
    "name",
    "floors",
    "room_count",
    "beds_per_room",
    "is_active",
)


class Block(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: str
    code: str
    name: str
    floors: int | None
    room_count: int
    beds_per_room: int
    status: Literal["active", "inactive"]


class BlockCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    code: str = Field(min_length=1, max_length=16)
    name: str = Field(min_length=1, max_length=80)
    floors: int | None = Field(default=None, ge=1, le=20)
    room_count: int = Field(ge=1, le=500)
    beds_per_room: int = Field(ge=1, le=6)


class BlockUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str | None = Field(default=None, min_length=1, max_length=80)
    floors: int | None = Field(default=None, ge=1, le=20)
    room_count: int | None = Field(default=None, ge=1, le=500)
    beds_per_room: int | None = Field(default=None, ge=1, le=6)
    status: Literal["active", "inactive"] | None = None


def row_to_block(row: sqlite3.Row) -> Block:
    return Block(
        id=row["id"],
        code=row["code"],
        name=row["name"],
        floors=row["floors"],
        room_count=row["room_count"],
        beds_per_room=row["beds_per_room"],
        status="active" if row["is_active"] else "inactive",
    )


def list_blocks(connection: sqlite3.Connection) -> list[Block]:
    rows = connection.execute(
        f"""
        SELECT {', '.join(BLOCK_COLUMNS)}
        FROM blocks
        ORDER BY code COLLATE NOCASE, id
        """
    ).fetchall()
    return [row_to_block(row) for row in rows]


def load_block(connection: sqlite3.Connection, block_id: str) -> Block | None:
    row = connection.execute(
        f"""
        SELECT {', '.join(BLOCK_COLUMNS)}
        FROM blocks
        WHERE id = ?
        """,
        (block_id,),
    ).fetchone()
    if row is None:
        return None
    return row_to_block(row)


def record_block_audit(
    connection: sqlite3.Connection,
    occurred_at: str,
    actor_user_id: str,
    action: str,
    block_id: str,
    summary: str,
    detail: str | None = None,
) -> None:
    connection.execute(
        """
        INSERT INTO audit_log (
          id, occurred_at, actor_user_id, action, entity_type, entity_id, summary, detail
        ) VALUES (?, ?, ?, ?, 'block', ?, ?, ?)
        """,
        (str(uuid.uuid4()), occurred_at, actor_user_id, action, block_id, summary, detail),
    )


ROOM_COLUMNS = (
    "id",
    "block_id",
    "number",
    "label",
    "bed_count",
    "is_active",
)


class Room(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: str
    block_id: str
    number: str
    label: str
    bed_count: int
    status: Literal["active", "inactive"]


class RoomCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    block_id: str
    number: str = Field(min_length=1, max_length=12)


class RoomUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    number: str | None = Field(default=None, min_length=1, max_length=12)
    bed_count: int | None = Field(default=None, ge=1, le=6)
    status: Literal["active", "inactive"] | None = None


def row_to_room(row: sqlite3.Row) -> Room:
    return Room(
        id=row["id"],
        block_id=row["block_id"],
        number=row["number"],
        label=row["label"],
        bed_count=row["bed_count"],
        status="active" if row["is_active"] else "inactive",
    )


def list_rooms(
    connection: sqlite3.Connection,
    *,
    block_id: str | None = None,
) -> list[Room]:
    if block_id is None:
        rows = connection.execute(
            f"""
            SELECT {', '.join(ROOM_COLUMNS)}
            FROM rooms
            ORDER BY label COLLATE NOCASE, id
            """
        ).fetchall()
    else:
        rows = connection.execute(
            f"""
            SELECT {', '.join(ROOM_COLUMNS)}
            FROM rooms
            WHERE block_id = ?
            ORDER BY label COLLATE NOCASE, id
            """,
            (block_id,),
        ).fetchall()
    return [row_to_room(row) for row in rows]


def load_room(connection: sqlite3.Connection, room_id: str) -> Room | None:
    row = connection.execute(
        f"""
        SELECT {', '.join(ROOM_COLUMNS)}
        FROM rooms
        WHERE id = ?
        """,
        (room_id,),
    ).fetchone()
    if row is None:
        return None
    return row_to_room(row)


def residents_in_room(connection: sqlite3.Connection, room_id: str) -> int:
    row = connection.execute(
        "SELECT COUNT(*) AS n FROM residents WHERE room_id = ?",
        (room_id,),
    ).fetchone()
    return int(row["n"])


def record_room_audit(
    connection: sqlite3.Connection,
    occurred_at: str,
    actor_user_id: str,
    action: str,
    room_id: str,
    summary: str,
    detail: str | None = None,
) -> None:
    connection.execute(
        """
        INSERT INTO audit_log (
          id, occurred_at, actor_user_id, action, entity_type, entity_id, summary, detail
        ) VALUES (?, ?, ?, ?, 'room', ?, ?, ?)
        """,
        (str(uuid.uuid4()), occurred_at, actor_user_id, action, room_id, summary, detail),
    )


DESTINATION_COLUMNS = ("id", "name", "is_other", "is_active")


class DestinationCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str = Field(min_length=1, max_length=80)
    source: Literal["preset", "custom"] = "preset"


class DestinationUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str | None = Field(default=None, min_length=1, max_length=80)
    source: Literal["preset", "custom"] | None = None
    status: Literal["active", "inactive"] | None = None


def row_to_destination(row: sqlite3.Row) -> Destination:
    return Destination(
        id=row["id"],
        name=row["name"],
        source="custom" if row["is_other"] else "preset",
        status="active" if row["is_active"] else "inactive",
    )


def list_admin_destinations(connection: sqlite3.Connection) -> DestinationList:
    rows = connection.execute(
        f"""
        SELECT {', '.join(DESTINATION_COLUMNS)}
        FROM destinations
        ORDER BY is_other, name COLLATE NOCASE, id
        """
    ).fetchall()
    return DestinationList(items=[row_to_destination(row) for row in rows])


def load_destination(connection: sqlite3.Connection, destination_id: str) -> Destination | None:
    row = connection.execute(
        f"""
        SELECT {', '.join(DESTINATION_COLUMNS)}
        FROM destinations
        WHERE id = ?
        """,
        (destination_id,),
    ).fetchone()
    if row is None:
        return None
    return row_to_destination(row)


def active_other_exists(
    connection: sqlite3.Connection,
    *,
    excluding_id: str | None = None,
) -> bool:
    if excluding_id is None:
        row = connection.execute(
            """
            SELECT 1 FROM destinations
            WHERE is_other = 1 AND is_active = 1
            LIMIT 1
            """
        ).fetchone()
    else:
        row = connection.execute(
            """
            SELECT 1 FROM destinations
            WHERE is_other = 1 AND is_active = 1 AND id <> ?
            LIMIT 1
            """,
            (excluding_id,),
        ).fetchone()
    return row is not None


def record_destination_audit(
    connection: sqlite3.Connection,
    occurred_at: str,
    actor_user_id: str,
    action: str,
    destination_id: str,
    summary: str,
    detail: str | None = None,
) -> None:
    connection.execute(
        """
        INSERT INTO audit_log (
          id, occurred_at, actor_user_id, action, entity_type, entity_id, summary, detail
        ) VALUES (?, ?, ?, ?, 'destination', ?, ?, ?)
        """,
        (
            str(uuid.uuid4()),
            occurred_at,
            actor_user_id,
            action,
            destination_id,
            summary,
            detail,
        ),
    )


AccountStatus = Literal["active", "suspended"]
Presence = Literal["inside", "outside"]


class ResidentAccount(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: str
    full_name: str
    enrolment_number: str
    course: str | None = None
    room_id: str
    room_label: str
    guardian_name: str
    guardian_phone: str
    status: AccountStatus
    presence: Presence


class ResidentAccountPage(BaseModel):
    model_config = ConfigDict(extra="forbid")
    total: int
    limit: int
    offset: int
    items: list[ResidentAccount]


class ResidentCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    full_name: str = Field(min_length=1, max_length=120)
    enrolment_number: str = Field(min_length=1, max_length=40)
    course: str | None = Field(default=None, max_length=120)
    room_id: str
    guardian_name: str = Field(min_length=1, max_length=120)
    guardian_phone: str = Field(pattern=r"^\+[1-9][0-9]{7,14}$")
    temporary_password: str = Field(min_length=10, max_length=200)


class ResidentCreated(BaseModel):
    model_config = ConfigDict(extra="forbid")
    account: ResidentAccount
    hall_pass: HallPass


class ResidentUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    full_name: str | None = Field(default=None, min_length=1, max_length=120)
    enrolment_number: str | None = Field(default=None, min_length=1, max_length=40)
    course: str | None = Field(default=None, max_length=120)
    room_id: str | None = None
    guardian_name: str | None = Field(default=None, min_length=1, max_length=120)
    guardian_phone: str | None = Field(default=None, pattern=r"^\+[1-9][0-9]{7,14}$")
    status: AccountStatus | None = None


def row_to_resident_account(row: sqlite3.Row) -> ResidentAccount:
    return ResidentAccount(
        id=row["id"],
        full_name=row["full_name"],
        enrolment_number=row["enrolment_number"],
        course=row["course"],
        room_id=row["room_id"],
        room_label=row["room_label"],
        guardian_name=row["guardian_name"],
        guardian_phone=row["guardian_phone"],
        status=row["status"],
        presence=row["presence"],
    )


_RESIDENT_SELECT = """
SELECT
  users.id,
  users.full_name,
  users.status,
  residents.enrolment_number,
  residents.course,
  residents.room_id,
  rooms.label AS room_label,
  residents.guardian_name,
  residents.guardian_phone,
  residents.presence
FROM residents
JOIN users ON users.id = residents.user_id
JOIN rooms ON rooms.id = residents.room_id
"""


def load_resident_account(
    connection: sqlite3.Connection, resident_id: str
) -> ResidentAccount | None:
    row = connection.execute(
        _RESIDENT_SELECT + " WHERE residents.user_id = ?",
        (resident_id,),
    ).fetchone()
    if row is None:
        return None
    return row_to_resident_account(row)


def list_resident_accounts(
    connection: sqlite3.Connection,
    *,
    q: str | None,
    limit: int,
    offset: int,
) -> ResidentAccountPage:
    filters = ["users.role = 'resident'"]
    params: list[object] = []
    if q is not None and q.strip():
        needle = f"%{q.strip().lower()}%"
        filters.append(
            """
            (
              lower(users.full_name) LIKE ?
              OR lower(residents.enrolment_number) LIKE ?
              OR lower(rooms.label) LIKE ?
            )
            """
        )
        params.extend([needle, needle, needle])
    where = " AND ".join(filters)
    total = connection.execute(
        f"""
        SELECT COUNT(*) AS n
        FROM residents
        JOIN users ON users.id = residents.user_id
        JOIN rooms ON rooms.id = residents.room_id
        WHERE {where}
        """,
        params,
    ).fetchone()["n"]
    rows = connection.execute(
        f"""
        {_RESIDENT_SELECT}
        WHERE {where}
        ORDER BY users.full_name COLLATE NOCASE, users.id
        LIMIT ? OFFSET ?
        """,
        (*params, limit, offset),
    ).fetchall()
    return ResidentAccountPage(
        total=int(total),
        limit=limit,
        offset=offset,
        items=[row_to_resident_account(row) for row in rows],
    )


def new_hall_pass_token() -> str:
    return f"bsj:v1:{secrets.token_urlsafe(32)}"


def revoke_live_sessions(
    connection: sqlite3.Connection, user_id: str, when: str
) -> None:
    connection.execute(
        """
        UPDATE sessions
        SET revoked_at = ?
        WHERE user_id = ? AND revoked_at IS NULL
        """,
        (when, user_id),
    )


def record_resident_audit(
    connection: sqlite3.Connection,
    occurred_at: str,
    actor_user_id: str,
    action: str,
    entity_type: str,
    entity_id: str,
    summary: str,
    detail: str | None = None,
) -> None:
    connection.execute(
        """
        INSERT INTO audit_log (
          id, occurred_at, actor_user_id, action, entity_type, entity_id, summary, detail
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            str(uuid.uuid4()),
            occurred_at,
            actor_user_id,
            action,
            entity_type,
            entity_id,
            summary,
            detail,
        ),
    )


def room_exists(connection: sqlite3.Connection, room_id: str) -> bool:
    row = connection.execute(
        "SELECT 1 FROM rooms WHERE id = ?",
        (room_id,),
    ).fetchone()
    return row is not None


def room_is_active(connection: sqlite3.Connection, room_id: str) -> bool:
    row = connection.execute(
        "SELECT is_active FROM rooms WHERE id = ?",
        (room_id,),
    ).fetchone()
    return row is not None and int(row["is_active"]) == 1


def room_has_capacity(
    connection: sqlite3.Connection, room_id: str, *, excluding_user_id: str | None = None
) -> bool:
    if excluding_user_id is None:
        row = connection.execute(
            """
            SELECT rooms.bed_count AS beds,
                   (SELECT COUNT(*) FROM residents WHERE room_id = rooms.id) AS taken
            FROM rooms
            WHERE rooms.id = ?
            """,
            (room_id,),
        ).fetchone()
    else:
        row = connection.execute(
            """
            SELECT rooms.bed_count AS beds,
                   (
                     SELECT COUNT(*) FROM residents
                     WHERE room_id = rooms.id AND user_id <> ?
                   ) AS taken
            FROM rooms
            WHERE rooms.id = ?
            """,
            (excluding_user_id, room_id),
        ).fetchone()
    if row is None:
        return False
    return int(row["taken"]) < int(row["beds"])


StaffRole = Literal["gate", "warden", "provost"]


class StaffAccount(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: str
    full_name: str
    username: str
    role: StaffRole
    job_title: str
    status: AccountStatus


class StaffPage(BaseModel):
    model_config = ConfigDict(extra="forbid")
    total: int
    limit: int
    offset: int
    items: list[StaffAccount]


class StaffCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    full_name: str = Field(min_length=1, max_length=120)
    username: str = Field(min_length=1, max_length=80)
    role: StaffRole
    job_title: str = Field(min_length=1, max_length=80)
    temporary_password: str = Field(min_length=10, max_length=200)


class StaffUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    full_name: str | None = Field(default=None, min_length=1, max_length=120)
    job_title: str | None = Field(default=None, min_length=1, max_length=80)
    status: AccountStatus | None = None


_STAFF_SELECT = """
SELECT
  users.id,
  users.full_name,
  users.username,
  users.role,
  users.status,
  staff.job_title
FROM staff
JOIN users ON users.id = staff.user_id
"""


def row_to_staff_account(row: sqlite3.Row) -> StaffAccount:
    return StaffAccount(
        id=row["id"],
        full_name=row["full_name"],
        username=row["username"],
        role=row["role"],
        job_title=row["job_title"],
        status=row["status"],
    )


def load_staff_account(connection: sqlite3.Connection, user_id: str) -> StaffAccount | None:
    row = connection.execute(
        _STAFF_SELECT + " WHERE staff.user_id = ?",
        (user_id,),
    ).fetchone()
    if row is None:
        return None
    return row_to_staff_account(row)


def list_staff_accounts(
    connection: sqlite3.Connection,
    *,
    limit: int,
    offset: int,
) -> StaffPage:
    total = connection.execute(
        """
        SELECT COUNT(*) AS n
        FROM staff
        JOIN users ON users.id = staff.user_id
        WHERE users.role IN ('gate', 'warden', 'provost')
        """
    ).fetchone()["n"]
    rows = connection.execute(
        f"""
        {_STAFF_SELECT}
        WHERE users.role IN ('gate', 'warden', 'provost')
        ORDER BY users.full_name COLLATE NOCASE, users.id
        LIMIT ? OFFSET ?
        """,
        (limit, offset),
    ).fetchall()
    return StaffPage(
        total=int(total),
        limit=limit,
        offset=offset,
        items=[row_to_staff_account(row) for row in rows],
    )
