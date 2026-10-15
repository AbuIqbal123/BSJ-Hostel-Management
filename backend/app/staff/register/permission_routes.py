"""Warden and provost permission queue and decisions."""

from __future__ import annotations

import sqlite3
from typing import Annotated, Literal

from fastapi import APIRouter, BackgroundTasks, Query
from pydantic import BaseModel, ConfigDict

from app.shared.schemas import DecisionRequest
from app.residents.permissions.records import (
    PermissionReviewBody,
    PermissionReviewPageBody,
    PermissionStatus,
    expire_passed_permissions,
    list_reviews,
    load_review,
    record_permission,
)
from app.residents.notifications.records import record_decision
from app.shared import clock, push
from app.shared.auth.routes import ConnectionDep
from app.shared.errors import ApiError
from app.staff.register.routes import RegisterDep

router = APIRouter(prefix="/api/v1", tags=["Permissions"])


class ExpirePassedPermissionsResult(BaseModel):
    model_config = ConfigDict(extra="forbid")
    permissions_expired: int


@router.post("/permissions/expire-passed", response_model=ExpirePassedPermissionsResult)
def expire_passed_permissions_staff(
    _account: RegisterDep,
    connection: ConnectionDep,
) -> ExpirePassedPermissionsResult:
    now_text = clock.format_instant(clock.utc_now())
    count = expire_passed_permissions(connection, now_text)
    return ExpirePassedPermissionsResult(permissions_expired=count)


@router.get("/permissions", response_model=PermissionReviewPageBody)
def list_permissions(
    _account: RegisterDep,
    connection: ConnectionDep,
    status: Annotated[PermissionStatus | None, Query()] = None,
    permission_type: Annotated[Literal["late_night", "home_going"] | None, Query()] = None,
    block_id: Annotated[str | None, Query()] = None,
    created_from: Annotated[str | None, Query()] = None,
    created_to: Annotated[str | None, Query()] = None,
    order: Annotated[Literal["newest", "oldest", "departure"], Query()] = "newest",
    q: Annotated[str | None, Query(max_length=80)] = None,
    limit: Annotated[int, Query(ge=1, le=500)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> PermissionReviewPageBody:
    filter_status = "pending" if status is None else status
    return list_reviews(
        connection,
        resident_id=None,
        status=filter_status,
        limit=limit,
        offset=offset,
        permission_type=permission_type,
        block_id=block_id,
        created_from=created_from,
        created_to=created_to,
        order=order,
        q=q,
    )


@router.get("/permissions/{permission_id}", response_model=PermissionReviewBody)
def get_permission(
    permission_id: str,
    _account: RegisterDep,
    connection: ConnectionDep,
) -> PermissionReviewBody:
    review = load_review(connection, permission_id)
    if review is None:
        raise ApiError(404, "not_found", "That record was not found.")
    return review


def _refuse_overlap(connection: sqlite3.Connection, permission_id: str) -> None:
    """A resident cannot hold two approved or in-use permissions that overlap.

    Back-to-back trips (one ends when the next begins) are fine. A planned
    ordinary outing in the same hours is not a conflict: it stays, and the
    permission wins at the gate and on the hall pass (see usable.py).
    """
    clash = connection.execute(
        """
        SELECT 1
        FROM permissions AS target
        JOIN permissions AS other
          ON other.resident_id = target.resident_id
         AND other.id != target.id
         AND other.status IN ('approved', 'in_use')
         AND other.departure_at < target.expected_return_at
         AND target.departure_at < other.expected_return_at
        WHERE target.id = ? AND target.status = 'pending'
        LIMIT 1
        """,
        (permission_id,),
    ).fetchone()
    if clash is not None:
        raise ApiError(
            409,
            "permission_overlap",
            "This resident already has an approved permission that overlaps these hours.",
        )


@router.post("/permissions/{permission_id}/decision", response_model=PermissionReviewBody)
def decide_permission(
    permission_id: str,
    body: DecisionRequest,
    account: RegisterDep,
    connection: ConnectionDep,
    background_tasks: BackgroundTasks,
) -> PermissionReviewBody:
    now_text = clock.format_instant(clock.utc_now())
    expire_passed_permissions(connection, now_text, permission_id=permission_id)
    note = None if body.note is None else body.note.strip() or None
    if body.decision == "approved":
        _refuse_overlap(connection, permission_id)
    row = connection.execute(
        """
        UPDATE permissions
        SET status = ?, decided_by = ?, decided_at = ?, decision_note = ?, updated_at = ?
        WHERE id = ? AND status = 'pending'
        RETURNING id, type, short_place, resident_id
        """,
        (body.decision, account.id, now_text, note, now_text, permission_id),
    ).fetchone()
    if row is None:
        existing = connection.execute(
            "SELECT status FROM permissions WHERE id = ?",
            (permission_id,),
        ).fetchone()
        if existing is None:
            raise ApiError(404, "not_found", "That record was not found.")
        raise ApiError(
            409,
            "not_pending",
            "Only a pending permission can be approved or rejected "
            f"(current status: {existing['status']}).",
        )
    label = "late-night" if row["type"] == "late_night" else "home-going"
    action = "permission.approved" if body.decision == "approved" else "permission.rejected"
    verb = "approved" if body.decision == "approved" else "rejected"
    job = record_decision(
        connection,
        kind="permission_decided",
        record_id=permission_id,
        resident_id=row["resident_id"],
        decision=body.decision,
        now_text=now_text,
        what=f"{label} permission",
        noun=f"{label} request",
        by_name=account.full_name,
    )
    background_tasks.add_task(push.dispatch, [job])
    record_permission(
        connection,
        now_text,
        account.id,
        action,
        permission_id,
        f"{account.full_name} {verb} a {label} permission for {row['short_place']}.",
    )
    review = load_review(connection, permission_id)
    assert review is not None
    return review
