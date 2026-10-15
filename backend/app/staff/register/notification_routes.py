"""Warden and provost inbox. The events are derived in records.EVENTS_SQL."""

from __future__ import annotations

from datetime import date
from typing import Annotated, Literal

from fastapi import APIRouter, Body, Query
from pydantic import BaseModel, ConfigDict

from app.shared import clock
from app.shared.auth.routes import ConnectionDep
from app.shared.errors import ApiError
from app.shared.inbox import (
    InboxFilter,
    Marked,
    ReadRequest,
    UnreadCount,
    decode_cursor,
    encode_cursor,
    hall_day_bounds,
    mark_until,
    window_start,
)
from app.staff.register.records import event_exists, list_events, notifications_read_at, unread_count
from app.staff.register.routes import RegisterDep

router = APIRouter(prefix="/api/v1/register", tags=["Register"])


class StaffNotification(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: str
    kind: Literal["permission_requested", "guest_stay_requested", "resident_late"]
    record_id: str
    resident_id: str
    resident_name: str
    room_label: str
    block_name: str
    occurred_at: str
    read_at: str | None
    unread: bool
    needs_action: bool
    outcome: Literal["approved", "declined", "cancelled", "returned"] | None
    decided_at: str | None
    decided_by_name: str | None


class StaffNotificationPage(BaseModel):
    model_config = ConfigDict(extra="forbid")
    items: list[StaffNotification]
    next_cursor: str | None


@router.get("/notifications", response_model=StaffNotificationPage)
def list_staff_notifications(
    account: RegisterDep,
    connection: ConnectionDep,
    cursor: Annotated[str | None, Query(max_length=200)] = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 30,
    filter: Annotated[InboxFilter, Query()] = "all",
    q: Annotated[str | None, Query(max_length=80)] = None,
    from_day: Annotated[date | None, Query(alias="from")] = None,
    to_day: Annotated[date | None, Query(alias="to")] = None,
    block_id: Annotated[str | None, Query(max_length=80)] = None,
) -> StaffNotificationPage:
    now_text = clock.format_instant(clock.utc_now())
    filters: list[str] = []
    extra: dict[str, object] = {}
    if filter == "unread":
        filters.append("read_at IS NULL")
    elif filter == "needs_action":
        filters.append("needs_action")
    if q and q.strip():
        filters.append("(lower(resident_name) LIKE :q OR lower(room_label) LIKE :q)")
        extra["q"] = f"%{q.strip().lower()}%"
    if block_id:
        filters.append("block_id = :block_id")
        extra["block_id"] = block_id
    start, end = hall_day_bounds(from_day, to_day)
    if start:
        filters.append("occurred_at >= :from_at")
        extra["from_at"] = start
    if end:
        filters.append("occurred_at <= :to_at")
        extra["to_at"] = end
    if cursor:
        at, item_id = decode_cursor(cursor)
        filters.append("(occurred_at < :c_at OR (occurred_at = :c_at AND id < :c_id))")
        extra.update(c_at=at, c_id=item_id)
    rows = list_events(
        connection,
        account.id,
        now_text=now_text,
        since=window_start(now_text),
        filters=filters,
        extra=extra,
        limit=limit + 1,
    )
    page = rows[:limit]
    next_cursor = (
        encode_cursor(page[-1]["occurred_at"], page[-1]["id"]) if len(rows) > limit else None
    )
    return StaffNotificationPage(
        items=[
            StaffNotification(
                id=row["id"],
                kind=row["kind"],
                record_id=row["record_id"],
                resident_id=row["resident_id"],
                resident_name=row["resident_name"],
                room_label=row["room_label"],
                block_name=row["block_name"],
                occurred_at=row["occurred_at"],
                read_at=row["read_at"],
                unread=row["read_at"] is None,
                needs_action=bool(row["needs_action"]),
                outcome=row["outcome"],
                decided_at=row["decided_at"],
                decided_by_name=row["decided_by_name"],
            )
            for row in page
        ],
        next_cursor=next_cursor,
    )


@router.post("/notifications/read", response_model=Marked)
def mark_staff_notifications_read(
    account: RegisterDep,
    connection: ConnectionDep,
    body: Annotated[ReadRequest | None, Body()] = None,
) -> Marked:
    now_text = clock.format_instant(clock.utc_now())
    until = mark_until(body, now_text)
    marked = unread_count(connection, account.id, now_text, up_to=until)
    if until > notifications_read_at(connection, account.id):
        connection.execute(
            "UPDATE staff SET notifications_read_at = ? WHERE user_id = ?",
            (until, account.id),
        )
    return Marked(marked=marked, unread_count=unread_count(connection, account.id, now_text))


@router.post("/notifications/{notification_id}/read", response_model=UnreadCount)
def mark_staff_notification_read(
    notification_id: str,
    account: RegisterDep,
    connection: ConnectionDep,
) -> UnreadCount:
    now_text = clock.format_instant(clock.utc_now())
    if len(notification_id) > 80 or not event_exists(connection, notification_id, now_text):
        raise ApiError(404, "not_found", "That record was not found.")
    connection.execute(
        """
        INSERT INTO staff_notification_reads (user_id, notification_id, read_at)
        VALUES (?, ?, ?)
        ON CONFLICT (user_id, notification_id) DO NOTHING
        """,
        (account.id, notification_id, now_text),
    )
    return UnreadCount(unread_count=unread_count(connection, account.id, now_text))
