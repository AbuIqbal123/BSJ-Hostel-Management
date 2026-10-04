"""Guardian late and return notices. Development uses the mock driver only."""

from __future__ import annotations

import sqlite3
import uuid
from zoneinfo import ZoneInfo

from app.shared import clock
from app.shared.config import get_settings


def format_local_stamp(instant_utc: str, timezone_name: str) -> str:
    moment = clock.parse_instant(instant_utc)
    local = moment.astimezone(ZoneInfo(timezone_name))
    hour = local.hour % 12 or 12
    suffix = "AM" if local.hour < 12 else "PM"
    return f"{local.day} {local.strftime('%B %Y')}, {hour}:{local.minute:02d} {suffix}"


def fill_template(template: str, values: dict[str, str]) -> str:
    body = template
    for key, value in values.items():
        body = body.replace("{" + key + "}", value)
    return body


def _mock_send(body: str) -> tuple[str, str | None, str | None]:
    """Record-only send. Never contacts a phone network."""
    _ = body
    return "sent", f"mock-{uuid.uuid4().hex[:12]}", None


def _insert_message(
    connection: sqlite3.Connection,
    *,
    outing_id: str,
    resident_id: str,
    notice_type: str,
    phone: str,
    body: str,
    now_text: str,
    summary: str,
) -> bool:
    settings = get_settings()
    driver = settings.sms_driver
    if driver == "mock":
        status, reference, error = _mock_send(body)
    else:
        # Live provider is out of scope for this path; refuse rather than invent.
        status, reference, error = "failed", None, "Live SMS driver is not configured in this build."
    message_id = str(uuid.uuid4())
    cursor = connection.execute(
        """
        INSERT INTO guardian_messages (
          id, outing_id, resident_id, notice_type, recipient_phone, body,
          driver, status, provider_reference, error, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT (outing_id, notice_type) DO NOTHING
        """,
        (
            message_id,
            outing_id,
            resident_id,
            notice_type,
            phone,
            body,
            driver,
            status,
            reference,
            error,
            now_text,
        ),
    )
    if cursor.rowcount != 1:
        return False
    action = "sms.late_notice" if notice_type == "late_notice" else "sms.return_notice"
    connection.execute(
        """
        INSERT INTO audit_log (
          id, occurred_at, actor_user_id, action, entity_type, entity_id, summary, detail
        ) VALUES (?, ?, NULL, ?, 'guardian_message', ?, ?, NULL)
        """,
        (str(uuid.uuid4()), now_text, action, message_id, summary),
    )
    return True


def consider_late_notices(connection: sqlite3.Connection, now_text: str) -> int:
    """Send late notices for outside outings whose grace has ended."""
    rows = connection.execute(
        """
        SELECT
          outings.id AS outing_id,
          outings.resident_id,
          outings.expected_return_at,
          users.full_name AS resident_name,
          rooms.label AS room,
          residents.guardian_phone,
          hall_settings.hall_name,
          hall_settings.late_sms_template,
          hall_settings.timezone
        FROM outings
        JOIN residents ON residents.user_id = outings.resident_id
        JOIN users ON users.id = outings.resident_id
        JOIN rooms ON rooms.id = residents.room_id
        JOIN hall_settings ON hall_settings.id = 'hall'
        WHERE outings.status = 'outside'
          AND outings.grace_ends_at < ?
          AND NOT EXISTS (
            SELECT 1 FROM guardian_messages
            WHERE outing_id = outings.id AND notice_type = 'late_notice'
          )
        """,
        (now_text,),
    ).fetchall()
    sent = 0
    for row in rows:
        local_expected = format_local_stamp(row["expected_return_at"], row["timezone"])
        body = fill_template(
            row["late_sms_template"],
            {
                "resident_name": row["resident_name"],
                "room": row["room"],
                "expected_return_local": local_expected,
                "hall_name": row["hall_name"],
            },
        )
        inserted = _insert_message(
            connection,
            outing_id=row["outing_id"],
            resident_id=row["resident_id"],
            notice_type="late_notice",
            phone=row["guardian_phone"],
            body=body,
            now_text=now_text,
            summary=f"Late notice recorded for {row['resident_name']}.",
        )
        if inserted:
            sent += 1
    return sent


def send_return_notice_if_due(
    connection: sqlite3.Connection,
    *,
    outing_id: str,
    now_text: str,
) -> bool:
    """After a return scan: send return notice only if a late notice was sent."""
    late = connection.execute(
        """
        SELECT status
        FROM guardian_messages
        WHERE outing_id = ? AND notice_type = 'late_notice'
        """,
        (outing_id,),
    ).fetchone()
    if late is None or late["status"] != "sent":
        return False
    existing = connection.execute(
        """
        SELECT 1 FROM guardian_messages
        WHERE outing_id = ? AND notice_type = 'return_notice'
        """,
        (outing_id,),
    ).fetchone()
    if existing is not None:
        return False
    row = connection.execute(
        """
        SELECT
          outings.resident_id,
          users.full_name AS resident_name,
          rooms.label AS room,
          residents.guardian_phone,
          hall_settings.hall_name,
          hall_settings.return_sms_template,
          hall_settings.timezone
        FROM outings
        JOIN residents ON residents.user_id = outings.resident_id
        JOIN users ON users.id = outings.resident_id
        JOIN rooms ON rooms.id = residents.room_id
        JOIN hall_settings ON hall_settings.id = 'hall'
        WHERE outings.id = ?
        """,
        (outing_id,),
    ).fetchone()
    if row is None:
        return False
    body = fill_template(
        row["return_sms_template"],
        {
            "resident_name": row["resident_name"],
            "room": row["room"],
            "returned_at_local": format_local_stamp(now_text, row["timezone"]),
            "hall_name": row["hall_name"],
        },
    )
    return _insert_message(
        connection,
        outing_id=outing_id,
        resident_id=row["resident_id"],
        notice_type="return_notice",
        phone=row["guardian_phone"],
        body=body,
        now_text=now_text,
        summary=f"Return notice recorded for {row['resident_name']}.",
    )
