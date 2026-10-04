"""Resident inbox for a permission that was approved or rejected."""

from __future__ import annotations

from typing import Literal

from fastapi import APIRouter
from pydantic import BaseModel, ConfigDict

from app.residents.home.routes import ResidentDep
from app.shared import clock
from app.shared.auth.routes import ConnectionDep

router = APIRouter(prefix="/api/v1", tags=["Resident"])

LIST_LIMIT = 50


class ResidentNotification(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: str
    permission_id: str
    permission_type: Literal["late_night", "home_going"]
    decision: Literal["approved", "rejected"]
    place: str
    departure_at: str
    expected_return_at: str
    decided_by: str
    created_at: str
    unread: bool


class ResidentNotificationList(BaseModel):
    model_config = ConfigDict(extra="forbid")
    items: list[ResidentNotification]


class ResidentNotificationsMarked(BaseModel):
    model_config = ConfigDict(extra="forbid")
    marked: int


@router.get("/me/notifications", response_model=ResidentNotificationList)
def list_notifications(
    account: ResidentDep,
    connection: ConnectionDep,
) -> ResidentNotificationList:
    rows = connection.execute(
        """
        SELECT
          resident_notifications.id,
          resident_notifications.permission_id,
          resident_notifications.decision,
          resident_notifications.created_at,
          resident_notifications.read_at,
          permissions.type AS permission_type,
          permissions.short_place AS place,
          permissions.departure_at,
          permissions.expected_return_at,
          users.full_name AS decided_by
        FROM resident_notifications
        JOIN permissions ON permissions.id = resident_notifications.permission_id
        JOIN users ON users.id = permissions.decided_by
        WHERE resident_notifications.resident_id = ?
        ORDER BY resident_notifications.created_at DESC, resident_notifications.id DESC
        LIMIT ?
        """,
        (account.id, LIST_LIMIT),
    ).fetchall()
    return ResidentNotificationList(
        items=[
            ResidentNotification(
                id=row["id"],
                permission_id=row["permission_id"],
                permission_type=row["permission_type"],
                decision=row["decision"],
                place=row["place"],
                departure_at=row["departure_at"],
                expected_return_at=row["expected_return_at"],
                decided_by=row["decided_by"],
                created_at=row["created_at"],
                unread=row["read_at"] is None,
            )
            for row in rows
        ]
    )


@router.post("/me/notifications/read", response_model=ResidentNotificationsMarked)
def mark_notifications_read(
    account: ResidentDep,
    connection: ConnectionDep,
) -> ResidentNotificationsMarked:
    now_text = clock.format_instant(clock.utc_now())
    cursor = connection.execute(
        """
        UPDATE resident_notifications
        SET read_at = ?
        WHERE resident_id = ? AND read_at IS NULL
        """,
        (now_text, account.id),
    )
    return ResidentNotificationsMarked(marked=cursor.rowcount)
