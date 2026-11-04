"""Guardian SMS log list queries for the hall office."""

from __future__ import annotations

import sqlite3
from datetime import date
from typing import Literal

from app.shared.inbox import hall_day_bounds
from app.shared.like import like_contains

NoticeType = Literal["late_notice", "return_notice"]
SmsStatus = Literal["sent", "failed"]


def list_sms_rows(
    connection: sqlite3.Connection,
    *,
    q: str | None,
    notice_type: NoticeType | None,
    status: SmsStatus | None,
    from_day: date | None,
    to_day: date | None,
    limit: int,
    offset: int,
) -> tuple[int, list[sqlite3.Row]]:
    filters: list[str] = []
    params: list[object] = []
    if notice_type is not None:
        filters.append("guardian_messages.notice_type = ?")
        params.append(notice_type)
    if status is not None:
        filters.append("guardian_messages.status = ?")
        params.append(status)
    if q is not None and q.strip():
        needle = like_contains(q.strip().lower())
        filters.append(
            """
            (
              lower(users.full_name) LIKE ? ESCAPE '\\'
              OR lower(guardian_messages.recipient_phone) LIKE ? ESCAPE '\\'
              OR lower(guardian_messages.body) LIKE ? ESCAPE '\\'
            )
            """
        )
        params.extend([needle, needle, needle])
    start, end = hall_day_bounds(from_day, to_day)
    if start:
        filters.append("guardian_messages.created_at >= ?")
        params.append(start)
    if end:
        filters.append("guardian_messages.created_at <= ?")
        params.append(end)
    where = (" WHERE " + " AND ".join(filters)) if filters else ""
    total = connection.execute(
        f"""
        SELECT COUNT(*) AS n
        FROM guardian_messages
        JOIN users ON users.id = guardian_messages.resident_id
        {where}
        """,
        params,
    ).fetchone()["n"]
    rows = connection.execute(
        f"""
        SELECT
          guardian_messages.id,
          guardian_messages.outing_id,
          guardian_messages.resident_id,
          users.full_name AS resident_name,
          guardian_messages.notice_type,
          guardian_messages.recipient_phone,
          guardian_messages.body,
          guardian_messages.status,
          guardian_messages.created_at
        FROM guardian_messages
        JOIN users ON users.id = guardian_messages.resident_id
        {where}
        ORDER BY guardian_messages.created_at DESC, guardian_messages.id DESC
        LIMIT ? OFFSET ?
        """,
        (*params, limit, offset),
    ).fetchall()
    return int(total), list(rows)
