"""Warden and provost inbox. The events are derived in records.EVENTS_SQL."""

from __future__ import annotations

from typing import Literal

from fastapi import APIRouter
from pydantic import BaseModel, ConfigDict

from app.shared import clock
from app.shared.auth.routes import ConnectionDep
from app.staff.register.records import EVENTS_SQL, notifications_read_at, unread_count
from app.staff.register.routes import RegisterDep

router = APIRouter(prefix="/api/v1/register", tags=["Register"])

LIST_LIMIT = 50


class StaffNotification(BaseModel):
    model_config = ConfigDict(extra="forbid")
    kind: Literal["permission_requested", "guest_stay_requested", "resident_late"]
    record_id: str
    resident_name: str
    room_label: str
    occurred_at: str
    unread: bool


class StaffNotificationList(BaseModel):
    model_config = ConfigDict(extra="forbid")
    items: list[StaffNotification]


class StaffNotificationsMarked(BaseModel):
    model_config = ConfigDict(extra="forbid")
    marked: int


@router.get("/notifications", response_model=StaffNotificationList)
def list_staff_notifications(
    account: RegisterDep, connection: ConnectionDep
) -> StaffNotificationList:
    read_at = notifications_read_at(connection, account.id)
    rows = connection.execute(
        EVENTS_SQL + " ORDER BY events.occurred_at DESC, events.record_id DESC LIMIT :limit",
        {"now": clock.format_instant(clock.utc_now()), "limit": LIST_LIMIT},
    ).fetchall()
    return StaffNotificationList(
        items=[
            StaffNotification(
                kind=row["kind"],
                record_id=row["record_id"],
                resident_name=row["resident_name"],
                room_label=row["room_label"],
                occurred_at=row["occurred_at"],
                unread=row["occurred_at"] > read_at,
            )
            for row in rows
        ]
    )


@router.post("/notifications/read", response_model=StaffNotificationsMarked)
def mark_staff_notifications_read(
    account: RegisterDep, connection: ConnectionDep
) -> StaffNotificationsMarked:
    now_text = clock.format_instant(clock.utc_now())
    marked = unread_count(connection, account.id, now_text)
    connection.execute(
        "UPDATE staff SET notifications_read_at = ? WHERE user_id = ?",
        (now_text, account.id),
    )
    return StaffNotificationsMarked(marked=marked)
