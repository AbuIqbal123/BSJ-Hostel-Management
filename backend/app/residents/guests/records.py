"""Guest stay rows shared by the resident phone and later staff/gate routes."""

from __future__ import annotations

import sqlite3
import uuid
from datetime import date, datetime, timedelta
from typing import Literal
from zoneinfo import ZoneInfo

from pydantic import BaseModel, ConfigDict

from app.shared import clock

GuestStatus = Literal["pending", "approved", "rejected", "cancelled", "departed"]
PaymentStatus = Literal["unpaid", "paid"]
GuestBucket = Literal[
    "pending",
    "upcoming",
    "expected",
    "not_expected",
    "in_hall",
    "should_have_left",
    "departed",
    "rejected",
    "cancelled",
]


class GuestStayBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: str
    host_resident_id: str
    host_name: str
    host_room_label: str
    guest_name: str
    relation: str
    guest_start_date: str
    guest_end_date: str
    inclusive_days: int
    reason: str
    status: GuestStatus
    payment_status: PaymentStatus
    payment_note: str | None = None
    bucket: GuestBucket
    decision_note: str | None = None
    decided_by: str | None = None
    arrived_recorded_by: str | None = None
    departed_recorded_by: str | None = None
    arrived_at: str | None = None
    departed_at: str | None = None
    created_at: str


class GuestStaySummaryBody(BaseModel):
    """List card; full detail is GuestStayBody on GET by id."""

    model_config = ConfigDict(extra="forbid")
    id: str
    guest_name: str
    host_name: str
    host_room_label: str
    guest_start_date: str
    guest_end_date: str
    status: GuestStatus
    payment_status: PaymentStatus
    bucket: GuestBucket


class GuestStayPageBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    total: int
    limit: int
    offset: int
    items: list[GuestStaySummaryBody]


def inclusive_days(start_date: str, end_date: str) -> int:
    start = date.fromisoformat(start_date)
    end = date.fromisoformat(end_date)
    return (end - start).days + 1


def hall_today(connection: sqlite3.Connection, moment: datetime) -> str:
    row = connection.execute(
        "SELECT timezone FROM hall_settings WHERE id = 'hall'"
    ).fetchone()
    assert row is not None
    return moment.astimezone(ZoneInfo(row["timezone"])).date().isoformat()


def derive_bucket(
    *,
    status: str,
    payment_status: str,
    start_date: str,
    end_date: str,
    arrived_at: str | None,
    departed_at: str | None,
    today: str,
) -> GuestBucket:
    if status == "pending":
        return "pending"
    if status == "rejected":
        return "rejected"
    if status == "cancelled":
        return "cancelled"
    if status == "departed" or departed_at is not None:
        return "departed"
    # approved
    if arrived_at is None:
        if today < start_date:
            return "upcoming"
        if payment_status == "paid" and today <= end_date:
            return "expected"
        return "not_expected"
    if today <= end_date:
        return "in_hall"
    return "should_have_left"


def bucket_matches(filter_bucket: GuestBucket | None, actual: GuestBucket) -> bool:
    """Staff list: `in_hall` is the dining set (in_hall + should_have_left)."""
    if filter_bucket is None:
        return True
    if filter_bucket == "in_hall":
        return actual in {"in_hall", "should_have_left"}
    return actual == filter_bucket


_STAY_SELECT = """
SELECT
  guest_stays.id,
  guest_stays.host_resident_id,
  host.full_name AS host_name,
  rooms.label AS host_room_label,
  guest_stays.guest_name,
  guest_stays.relation,
  guest_stays.guest_start_date,
  guest_stays.guest_end_date,
  guest_stays.reason,
  guest_stays.status,
  guest_stays.payment_status,
  guest_stays.payment_note,
  guest_stays.decision_note,
  guest_stays.decided_by,
  guest_stays.arrived_recorded_by,
  guest_stays.departed_recorded_by,
  guest_stays.arrived_at,
  guest_stays.departed_at,
  guest_stays.created_at
FROM guest_stays
JOIN users AS host ON host.id = guest_stays.host_resident_id
JOIN residents ON residents.user_id = guest_stays.host_resident_id
JOIN rooms ON rooms.id = residents.room_id
"""


def _body_from_row(row: sqlite3.Row, today: str) -> GuestStayBody:
    start = row["guest_start_date"]
    end = row["guest_end_date"]
    return GuestStayBody(
        id=row["id"],
        host_resident_id=row["host_resident_id"],
        host_name=row["host_name"],
        host_room_label=row["host_room_label"],
        guest_name=row["guest_name"],
        relation=row["relation"],
        guest_start_date=start,
        guest_end_date=end,
        inclusive_days=inclusive_days(start, end),
        reason=row["reason"],
        status=row["status"],
        payment_status=row["payment_status"],
        payment_note=row["payment_note"],
        bucket=derive_bucket(
            status=row["status"],
            payment_status=row["payment_status"],
            start_date=start,
            end_date=end,
            arrived_at=row["arrived_at"],
            departed_at=row["departed_at"],
            today=today,
        ),
        decision_note=row["decision_note"],
        decided_by=row["decided_by"],
        arrived_recorded_by=row["arrived_recorded_by"],
        departed_recorded_by=row["departed_recorded_by"],
        arrived_at=row["arrived_at"],
        departed_at=row["departed_at"],
        created_at=row["created_at"],
    )


def _summary_from_body(body: GuestStayBody) -> GuestStaySummaryBody:
    return GuestStaySummaryBody(
        id=body.id,
        guest_name=body.guest_name,
        host_name=body.host_name,
        host_room_label=body.host_room_label,
        guest_start_date=body.guest_start_date,
        guest_end_date=body.guest_end_date,
        status=body.status,
        payment_status=body.payment_status,
        bucket=body.bucket,
    )


def load_guest_stay(
    connection: sqlite3.Connection,
    guest_stay_id: str,
    *,
    host_resident_id: str | None = None,
    today: str,
) -> GuestStayBody | None:
    clauses = ["guest_stays.id = ?"]
    params: list[object] = [guest_stay_id]
    if host_resident_id is not None:
        clauses.append("guest_stays.host_resident_id = ?")
        params.append(host_resident_id)
    row = connection.execute(
        f"{_STAY_SELECT} WHERE {' AND '.join(clauses)}",
        params,
    ).fetchone()
    if row is None:
        return None
    return _body_from_row(row, today)


def list_guest_stays(
    connection: sqlite3.Connection,
    *,
    host_resident_id: str | None,
    limit: int,
    offset: int,
    today: str,
    bucket: GuestBucket | None = None,
) -> GuestStayPageBody:
    where = ""
    params: list[object] = []
    if host_resident_id is not None:
        where = "WHERE guest_stays.host_resident_id = ?"
        params.append(host_resident_id)
    rows = connection.execute(
        f"""
        {_STAY_SELECT}
        {where}
        ORDER BY guest_stays.created_at DESC, guest_stays.id DESC
        """,
        params,
    ).fetchall()
    full = [
        body
        for body in (_body_from_row(row, today) for row in rows)
        if bucket_matches(bucket, body.bucket)
    ]
    total = len(full)
    items = [_summary_from_body(body) for body in full[offset : offset + limit]]
    return GuestStayPageBody(
        total=total,
        limit=limit,
        offset=offset,
        items=items,
    )


def record_guest_stay(
    connection: sqlite3.Connection,
    occurred_at: str,
    actor_user_id: str,
    action: str,
    guest_stay_id: str,
    summary: str,
) -> None:
    connection.execute(
        """
        INSERT INTO audit_log (
          id, occurred_at, actor_user_id, action, entity_type, entity_id, summary, detail
        ) VALUES (?, ?, ?, ?, 'guest_stay', ?, ?, NULL)
        """,
        (str(uuid.uuid4()), occurred_at, actor_user_id, action, guest_stay_id, summary),
    )
    connection.commit()


def guest_settings(connection: sqlite3.Connection) -> sqlite3.Row:
    row = connection.execute(
        """
        SELECT guest_min_lead_days, guest_max_inclusive_days, timezone
        FROM hall_settings WHERE id = 'hall'
        """
    ).fetchone()
    assert row is not None
    return row


def earliest_start_date(today: str, lead_days: int) -> str:
    return (date.fromisoformat(today) + timedelta(days=lead_days)).isoformat()
