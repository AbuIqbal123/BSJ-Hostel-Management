"""Warden and provost permission queue and decisions."""

from __future__ import annotations

from typing import Annotated, Literal

from fastapi import APIRouter, Query
from pydantic import BaseModel, ConfigDict, Field

from app.residents.permissions.records import (
    PermissionPageBody,
    PermissionReviewBody,
    PermissionStatus,
    expire_passed_permissions,
    list_reviews,
    load_review,
    record_permission,
)
from app.shared import clock
from app.shared.auth.routes import ConnectionDep
from app.shared.errors import ApiError
from app.staff.register.routes import RegisterDep

router = APIRouter(prefix="/api/v1", tags=["Register"])


class DecisionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    decision: Literal["approved", "rejected"]
    note: str | None = Field(default=None, max_length=500)


@router.get("/permissions", response_model=PermissionPageBody)
def list_permissions(
    _account: RegisterDep,
    connection: ConnectionDep,
    status: Annotated[PermissionStatus | None, Query()] = None,
    limit: Annotated[int, Query(ge=1, le=500)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> PermissionPageBody:
    now_text = clock.format_instant(clock.utc_now())
    expire_passed_permissions(connection, now_text)
    filter_status = "pending" if status is None else status
    page = list_reviews(
        connection,
        resident_id=None,
        status=filter_status,
        limit=limit,
        offset=offset,
    )
    connection.commit()
    return page


@router.get("/permissions/{permission_id}", response_model=PermissionReviewBody)
def get_permission(
    permission_id: str,
    _account: RegisterDep,
    connection: ConnectionDep,
) -> PermissionReviewBody:
    now_text = clock.format_instant(clock.utc_now())
    expire_passed_permissions(connection, now_text, permission_id=permission_id)
    connection.commit()
    review = load_review(connection, permission_id)
    if review is None:
        raise ApiError(404, "not_found", "That record was not found.")
    return review


@router.post("/permissions/{permission_id}/decision", response_model=PermissionReviewBody)
def decide_permission(
    permission_id: str,
    body: DecisionRequest,
    account: RegisterDep,
    connection: ConnectionDep,
) -> PermissionReviewBody:
    now_text = clock.format_instant(clock.utc_now())
    expire_passed_permissions(connection, now_text, permission_id=permission_id)
    connection.commit()
    row = connection.execute(
        """
        SELECT id, status, type, short_place
        FROM permissions
        WHERE id = ?
        """,
        (permission_id,),
    ).fetchone()
    if row is None:
        raise ApiError(404, "not_found", "That record was not found.")
    if row["status"] != "pending":
        raise ApiError(
            409,
            "not_pending",
            "That permission is not waiting for a decision.",
        )
    note = None if body.note is None else body.note.strip() or None
    connection.execute(
        """
        UPDATE permissions
        SET status = ?, decided_by = ?, decided_at = ?, decision_note = ?, updated_at = ?
        WHERE id = ? AND status = 'pending'
        """,
        (body.decision, account.id, now_text, note, now_text, permission_id),
    )
    label = "late-night" if row["type"] == "late_night" else "home-going"
    action = "permission.approved" if body.decision == "approved" else "permission.rejected"
    verb = "approved" if body.decision == "approved" else "rejected"
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
