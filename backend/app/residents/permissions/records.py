"""Permission rows shared by the resident phone and the warden queue."""

from __future__ import annotations

import sqlite3
from typing import Literal

from pydantic import BaseModel, ConfigDict

from app.shared.audit import record_audit

PermissionType = Literal["late_night", "home_going"]
PermissionStatus = Literal[
    "pending",
    "approved",
    "rejected",
    "cancelled",
    "in_use",
    "completed",
    "expired",
]


class PermissionBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: str
    permission_type: PermissionType
    status: PermissionStatus
    short_place: str
    destination_detail: str | None
    address: str | None
    reason: str
    departure_at: str
    expected_return_at: str
    decision_note: str | None
    decided_at: str | None
    decided_by: str | None
    created_at: str


class PermissionReviewBody(PermissionBody):
    resident_id: str
    resident_name: str
    room_label: str


class PermissionPageBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    total: int
    limit: int
    offset: int
    items: list[PermissionBody]


class PermissionReviewPageBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    total: int
    limit: int
    offset: int
    items: list[PermissionReviewBody]


_PERMISSION_COLUMNS = """
  permissions.id,
  permissions.type,
  permissions.status,
  permissions.short_place,
  permissions.destination_detail,
  permissions.address,
  permissions.reason,
  permissions.departure_at,
  permissions.expected_return_at,
  permissions.decision_note,
  permissions.decided_at,
  permissions.created_at
"""

_REVIEW_SELECT = f"""
SELECT
  {_PERMISSION_COLUMNS},
  permissions.resident_id,
  users.full_name AS resident_name,
  rooms.label AS room_label,
  decider.full_name AS decided_by
FROM permissions
JOIN residents ON residents.user_id = permissions.resident_id
JOIN users ON users.id = permissions.resident_id
JOIN rooms ON rooms.id = residents.room_id
LEFT JOIN users AS decider ON decider.id = permissions.decided_by
"""


def permission_from_row(row: sqlite3.Row) -> PermissionBody:
    return PermissionBody(
        id=row["id"],
        permission_type=row["type"],
        status=row["status"],
        short_place=row["short_place"],
        destination_detail=row["destination_detail"],
        address=row["address"],
        reason=row["reason"],
        departure_at=row["departure_at"],
        expected_return_at=row["expected_return_at"],
        decision_note=row["decision_note"],
        decided_at=row["decided_at"],
        decided_by=row["decided_by"],
        created_at=row["created_at"],
    )


def review_from_row(row: sqlite3.Row) -> PermissionReviewBody:
    return PermissionReviewBody(
        **permission_from_row(row).model_dump(),
        resident_id=row["resident_id"],
        resident_name=row["resident_name"],
        room_label=row["room_label"],
    )


def record_permission(
    connection: sqlite3.Connection,
    when: str,
    actor_user_id: str | None,
    action: str,
    permission_id: str,
    summary: str,
) -> None:
    record_audit(connection, when, actor_user_id, action, "permission", permission_id, summary)


def expire_passed_permissions(
    connection: sqlite3.Connection,
    now_text: str,
    *,
    resident_id: str | None = None,
    permission_id: str | None = None,
) -> int:
    """Mark unused approved permissions past their expected return as expired."""
    clauses = [
        "status = 'approved'",
        "expected_return_at < ?",
    ]
    params: list[str] = [now_text]
    if resident_id is not None:
        clauses.append("resident_id = ?")
        params.append(resident_id)
    if permission_id is not None:
        clauses.append("id = ?")
        params.append(permission_id)
    where = " AND ".join(clauses)
    rows = connection.execute(
        f"""
        UPDATE permissions
        SET status = 'expired', updated_at = ?
        WHERE {where}
        RETURNING id, short_place, type
        """,
        [now_text, *params],
    ).fetchall()
    for row in rows:
        label = "late-night" if row["type"] == "late_night" else "home-going"
        record_permission(
            connection,
            now_text,
            None,
            "permission.expired",
            row["id"],
            f"An approved {label} permission for {row['short_place']} expired unused.",
        )
    return len(rows)


def load_permission(connection: sqlite3.Connection, permission_id: str) -> PermissionBody:
    row = connection.execute(
        f"""
        SELECT {_PERMISSION_COLUMNS}, decider.full_name AS decided_by
        FROM permissions
        LEFT JOIN users AS decider ON decider.id = permissions.decided_by
        WHERE permissions.id = ?
        """,
        (permission_id,),
    ).fetchone()
    if row is None:
        raise LookupError(permission_id)
    return permission_from_row(row)


def load_review(connection: sqlite3.Connection, permission_id: str) -> PermissionReviewBody | None:
    row = connection.execute(
        _REVIEW_SELECT + " WHERE permissions.id = ?",
        (permission_id,),
    ).fetchone()
    if row is None:
        return None
    return review_from_row(row)


def list_reviews(
    connection: sqlite3.Connection,
    *,
    resident_id: str | None,
    status: str | None,
    limit: int,
    offset: int,
    permission_type: str | None = None,
    block_id: str | None = None,
    created_from: str | None = None,
    created_to: str | None = None,
    order: Literal["newest", "oldest", "departure"] = "newest",
    q: str | None = None,
) -> PermissionReviewPageBody:
    clauses: list[str] = []
    params: list[str] = []
    if resident_id is not None:
        clauses.append("permissions.resident_id = ?")
        params.append(resident_id)
    if status is not None:
        clauses.append("permissions.status = ?")
        params.append(status)
    if permission_type is not None:
        clauses.append("permissions.type = ?")
        params.append(permission_type)
    if block_id is not None:
        clauses.append("rooms.block_id = ?")
        params.append(block_id)
    if created_from is not None:
        clauses.append("permissions.created_at >= ?")
        params.append(created_from)
    if created_to is not None:
        clauses.append("permissions.created_at <= ?")
        params.append(created_to)
    if q:
        clauses.append("(lower(users.full_name) LIKE ? OR lower(rooms.label) LIKE ?)")
        pattern = f"%{q.strip().lower()}%"
        params.extend([pattern, pattern])
    where = f"WHERE {' AND '.join(clauses)}" if clauses else ""
    total = connection.execute(
        f"SELECT COUNT(*) FROM ({_REVIEW_SELECT} {where})",
        params,
    ).fetchone()[0]
    if order == "departure":
        order_by = "permissions.departure_at ASC, permissions.id ASC"
    else:
        direction = "ASC" if order == "oldest" else "DESC"
        order_by = f"permissions.created_at {direction}, permissions.id {direction}"
    rows = connection.execute(
        f"""
        {_REVIEW_SELECT}
        {where}
        ORDER BY {order_by}
        LIMIT ? OFFSET ?
        """,
        [*params, limit, offset],
    ).fetchall()
    return PermissionReviewPageBody(
        total=total,
        limit=limit,
        offset=offset,
        items=[review_from_row(row) for row in rows],
    )


def list_own(
    connection: sqlite3.Connection,
    *,
    resident_id: str,
    status: str | None,
    limit: int,
    offset: int,
) -> PermissionPageBody:
    page = list_reviews(
        connection,
        resident_id=resident_id,
        status=status,
        limit=limit,
        offset=offset,
    )
    return PermissionPageBody(
        total=page.total,
        limit=page.limit,
        offset=page.offset,
        items=[
            PermissionBody(
                **item.model_dump(exclude={"resident_id", "resident_name", "room_label"})
            )
            for item in page.items
        ],
    )
