"""Her inbox: decisions on her requests, and late outings. 90-day pages."""

from __future__ import annotations

from typing import Annotated, Literal

from fastapi import APIRouter, Body, Query
from pydantic import BaseModel, ConfigDict

from app.shared.page import PageDep
from app.residents.home.routes import ResidentDep
from app.residents.notifications.records import resident_unread_count
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
    mark_until,
    window_start,
)

router = APIRouter(prefix="/api/v1", tags=["Resident"])


class ResidentNotification(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: str
    kind: Literal[
        "permission_decided",
        "guest_stay_decided",
        "resident_late",
        "guest_stay_roommate_requested",
        "guest_stay_roommate_decided",
        "guest_stay_roommate_recorded",
    ]
    record_id: str
    occurred_at: str
    read_at: str | None
    unread: bool
    needs_action: bool
    outcome: Literal["approved", "declined", "returned"] | None
    decided_at: str | None
    decided_by_name: str | None
    place: str | None
    guest_name: str | None
    guest_start_date: str | None
    guest_end_date: str | None
    host_name: str | None
    actor_name: str | None
    permission_id: str | None
    permission_type: Literal["late_night", "home_going"] | None
    decision: Literal["approved", "rejected"] | None
    departure_at: str | None
    expected_return_at: str | None
    decided_by: str | None
    created_at: str


class ResidentNotificationPage(BaseModel):
    model_config = ConfigDict(extra="forbid")
    items: list[ResidentNotification]
    next_cursor: str | None


_GUEST_KINDS = (
    "guest_stay_decided",
    "guest_stay_roommate_requested",
    "guest_stay_roommate_decided",
    "guest_stay_roommate_recorded",
)

_OPEN_REQUEST = """
(
  notes.kind = 'guest_stay_roommate_requested'
  AND guest_stays.status = 'pending'
  AND NOT EXISTS (
    SELECT 1 FROM guest_stay_decisions AS open_decision
    WHERE open_decision.guest_stay_id = notes.record_id
      AND open_decision.actor_user_id = notes.resident_id
      AND open_decision.role = 'roommate'
  )
)
"""

_SELECT = f"""
SELECT
  notes.id, notes.kind, notes.record_id, notes.decision, notes.created_at, notes.read_at,
  permissions.type AS permission_type,
  permissions.departure_at,
  COALESCE(permissions.short_place, outings.place) AS place,
  COALESCE(permissions.expected_return_at, outings.expected_return_at) AS expected_return_at,
  guest_stays.guest_name,
  guest_stays.guest_start_date,
  guest_stays.guest_end_date,
  host_user.full_name AS host_name,
  CASE WHEN notes.kind = 'guest_stay_roommate_decided' THEN decider.full_name END AS actor_name,
  outings.status AS outing_status,
  CASE notes.kind
    WHEN 'permission_decided' THEN permissions.decided_at
    WHEN 'guest_stay_decided' THEN guest_stays.decided_at
    WHEN 'guest_stay_roommate_decided' THEN notes.created_at
    WHEN 'guest_stay_roommate_recorded' THEN notes.created_at
    ELSE outings.returned_at
  END AS decided_at,
  decider.full_name AS decided_by_name,
  {_OPEN_REQUEST} AS request_open
FROM resident_notifications AS notes
LEFT JOIN permissions ON notes.kind = 'permission_decided' AND permissions.id = notes.record_id
LEFT JOIN guest_stays ON notes.kind IN ({", ".join(f"'{kind}'" for kind in _GUEST_KINDS)})
  AND guest_stays.id = notes.record_id
LEFT JOIN users AS host_user ON host_user.id = guest_stays.host_resident_id
LEFT JOIN outings ON notes.kind = 'resident_late' AND outings.id = notes.record_id
LEFT JOIN users AS decider ON decider.id = CASE notes.kind
    WHEN 'permission_decided' THEN permissions.decided_by
    WHEN 'guest_stay_decided' THEN guest_stays.decided_by
    WHEN 'guest_stay_roommate_decided' THEN notes.actor_user_id
    ELSE outings.return_recorded_by
  END
"""


def _item(row) -> ResidentNotification:
    late = row["kind"] == "resident_late"
    if late:
        outcome = "returned" if row["outing_status"] == "returned" else None
    elif row["decision"] is None:
        outcome = None
    else:
        outcome = "approved" if row["decision"] == "approved" else "declined"
    is_permission = row["kind"] == "permission_decided"
    return ResidentNotification(
        id=row["id"],
        kind=row["kind"],
        record_id=row["record_id"],
        occurred_at=row["created_at"],
        read_at=row["read_at"],
        unread=row["read_at"] is None,
        needs_action=(late and row["outing_status"] == "outside") or bool(row["request_open"]),
        outcome=outcome,
        decided_at=row["decided_at"] if outcome else None,
        decided_by_name=row["decided_by_name"] if outcome else None,
        place=row["place"],
        guest_name=row["guest_name"],
        guest_start_date=row["guest_start_date"],
        guest_end_date=row["guest_end_date"],
        host_name=row["host_name"],
        actor_name=row["actor_name"],
        permission_id=row["record_id"] if is_permission else None,
        permission_type=row["permission_type"] if is_permission else None,
        decision=row["decision"],
        departure_at=row["departure_at"] if is_permission else None,
        expected_return_at=row["expected_return_at"],
        decided_by=row["decided_by_name"] if outcome else None,
        created_at=row["created_at"],
    )


@router.get("/me/notifications", response_model=ResidentNotificationPage)
def list_notifications(
    account: ResidentDep,
    connection: ConnectionDep,
    page: PageDep,
    cursor: Annotated[str | None, Query(max_length=200)] = None,
    filter: Annotated[InboxFilter, Query()] = "all",
) -> ResidentNotificationPage:
    limit = page.limit
    now_text = clock.format_instant(clock.utc_now())
    where = ["notes.resident_id = :resident_id", "notes.created_at >= :since"]
    params: dict[str, object] = {
        "resident_id": account.id,
        "since": window_start(now_text),
        "limit": limit + 1,
    }
    if filter == "unread":
        where.append("notes.read_at IS NULL")
    elif filter == "needs_action":
        where.append(
            f"(notes.kind = 'resident_late' AND outings.status = 'outside') OR {_OPEN_REQUEST}"
        )
    if cursor:
        at, item_id = decode_cursor(cursor)
        where.append(
            "(notes.created_at < :c_at OR (notes.created_at = :c_at AND notes.id < :c_id))"
        )
        params.update(c_at=at, c_id=item_id)
    rows = connection.execute(
        _SELECT
        + " WHERE "
        + " AND ".join(where)
        + " ORDER BY notes.created_at DESC, notes.id DESC LIMIT :limit",
        params,
    ).fetchall()
    page = rows[:limit]
    next_cursor = (
        encode_cursor(page[-1]["created_at"], page[-1]["id"]) if len(rows) > limit else None
    )
    return ResidentNotificationPage(items=[_item(row) for row in page], next_cursor=next_cursor)


@router.post("/me/notifications/read", response_model=Marked)
def mark_notifications_read(
    account: ResidentDep,
    connection: ConnectionDep,
    body: Annotated[ReadRequest | None, Body()] = None,
) -> Marked:
    now_text = clock.format_instant(clock.utc_now())
    # Without up_to every unread row is marked, whatever its instant.
    until = mark_until(body, now_text) if body is not None and body.up_to else "9999"
    cursor = connection.execute(
        """
        UPDATE resident_notifications
        SET read_at = ?
        WHERE resident_id = ? AND read_at IS NULL AND created_at <= ?
        """,
        (now_text, account.id, until),
    )
    return Marked(marked=cursor.rowcount, unread_count=resident_unread_count(connection, account.id))


@router.post("/me/notifications/{notification_id}/read", response_model=UnreadCount)
def mark_notification_read(
    notification_id: str,
    account: ResidentDep,
    connection: ConnectionDep,
) -> UnreadCount:
    now_text = clock.format_instant(clock.utc_now())
    row = connection.execute(
        "SELECT 1 FROM resident_notifications WHERE id = ? AND resident_id = ?",
        (notification_id, account.id),
    ).fetchone()
    if row is None:
        raise ApiError(404, "not_found", "That record was not found.")
    connection.execute(
        "UPDATE resident_notifications SET read_at = ? WHERE id = ? AND read_at IS NULL",
        (now_text, notification_id),
    )
    return UnreadCount(unread_count=resident_unread_count(connection, account.id))
