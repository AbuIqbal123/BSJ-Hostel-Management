"""Late-night and home-going requests on the resident phone."""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta
from typing import Annotated, Literal
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Query
from pydantic import BaseModel, ConfigDict, Field

from app.residents.home.routes import ResidentDep
from app.residents.permissions.records import (
    PermissionBody,
    PermissionPageBody,
    PermissionStatus,
    expire_passed_permissions,
    list_own,
    load_permission,
    record_permission,
)
from app.shared import clock
from app.shared.auth.routes import ConnectionDep
from app.shared.errors import ApiError

router = APIRouter(prefix="/api/v1", tags=["Resident"])

# Phones and the hall clock can disagree by a little; allow a short skew.
DEPARTURE_PAST_SKEW = timedelta(minutes=5)
LATE_NIGHT_SAME_DAY = (
    "A late-night return has to be the same day. Only 12:00 AM can be the next day."
)


class LateNightCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    permission_type: Literal["late_night"]
    short_place: str = Field(min_length=1, max_length=120)
    destination_detail: str | None = Field(default=None, min_length=1, max_length=120)
    reason: str = Field(min_length=1, max_length=500)
    departure_at: str
    expected_return_at: str


class HomeGoingCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    permission_type: Literal["home_going"]
    short_place: str = Field(min_length=1, max_length=120)
    address: str = Field(min_length=1, max_length=300)
    reason: str = Field(min_length=1, max_length=500)
    departure_at: str
    expected_return_at: str


PermissionCreate = Annotated[
    LateNightCreate | HomeGoingCreate,
    Field(discriminator="permission_type"),
]


def _instant(value: str, *, field: str) -> datetime:
    try:
        moment = clock.parse_instant(value)
    except ValueError:
        raise ApiError(
            422,
            "validation_error",
            "Use a UTC instant, such as 2026-09-30T13:00:00Z.",
            field=field,
        ) from None
    if clock.format_instant(moment) != value:
        raise ApiError(
            422,
            "validation_error",
            "Use a UTC instant, such as 2026-09-30T13:00:00Z.",
            field=field,
        )
    return moment


def _required_text(value: str, *, field: str, label: str) -> str:
    text = value.strip()
    if not text:
        raise ApiError(422, "validation_error", f"{label} is required.", field=field)
    return text


def _optional_text(value: str | None) -> str | None:
    if value is None:
        return None
    text = value.strip()
    return text or None


def _require_same_late_night(
    connection: ConnectionDep,
    departure: datetime,
    expected_return: datetime,
) -> None:
    row = connection.execute(
        "SELECT timezone FROM hall_settings WHERE id = 'hall'"
    ).fetchone()
    zone = ZoneInfo(row["timezone"])
    leave = departure.astimezone(zone)
    back = expected_return.astimezone(zone)
    if leave.date() == back.date():
        return
    next_day = leave.date() + timedelta(days=1)
    if back.date() == next_day and (back.hour, back.minute) == (0, 0):
        return
    raise ApiError(
        422,
        "validation_error",
        LATE_NIGHT_SAME_DAY,
        field="expected_return_at",
    )


class _PermissionFields(BaseModel):
    model_config = ConfigDict(extra="forbid")
    permission_type: Literal["late_night", "home_going"]
    short_place: str
    destination_detail: str | None
    address: str | None
    reason: str
    departure_at: str
    expected_return_at: str
    label: str


def _permission_fields(
    connection: ConnectionDep,
    body: LateNightCreate | HomeGoingCreate,
    now: datetime,
) -> _PermissionFields:
    departure = _instant(body.departure_at, field="departure_at")
    expected_return = _instant(body.expected_return_at, field="expected_return_at")
    if departure < now - DEPARTURE_PAST_SKEW:
        raise ApiError(
            422,
            "validation_error",
            "The departure must not be in the past.",
            field="departure_at",
        )
    if expected_return <= departure:
        raise ApiError(
            422,
            "validation_error",
            "The expected return must be after the departure.",
        )
    if body.permission_type == "late_night":
        _require_same_late_night(connection, departure, expected_return)
        destination_detail = _optional_text(body.destination_detail)
        address = None
        label = "late-night"
    else:
        destination_detail = None
        address = _required_text(body.address, field="address", label="Address")
        label = "home-going"
    return _PermissionFields(
        permission_type=body.permission_type,
        short_place=_required_text(body.short_place, field="short_place", label="Short place"),
        destination_detail=destination_detail,
        address=address,
        reason=_required_text(body.reason, field="reason", label="Reason"),
        departure_at=body.departure_at,
        expected_return_at=body.expected_return_at,
        label=label,
    )


@router.get("/me/permissions", response_model=PermissionPageBody)
def list_own_permissions(
    account: ResidentDep,
    connection: ConnectionDep,
    limit: Annotated[int, Query(ge=1, le=500)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
    status: Annotated[PermissionStatus | None, Query()] = None,
) -> PermissionPageBody:
    return list_own(
        connection,
        resident_id=account.id,
        status=status,
        limit=limit,
        offset=offset,
    )


@router.post("/me/permissions", status_code=201, response_model=PermissionBody)
def submit_permission(
    body: PermissionCreate,
    account: ResidentDep,
    connection: ConnectionDep,
) -> PermissionBody:
    now = clock.utc_now()
    fields = _permission_fields(connection, body, now)
    now_text = clock.format_instant(now)
    expire_passed_permissions(connection, now_text, resident_id=account.id)
    permission_id = str(uuid.uuid4())
    connection.execute(
        """
        INSERT INTO permissions (
          id, resident_id, type, status, short_place, destination_detail, address,
          reason, departure_at, expected_return_at, decided_by, decided_at,
          decision_note, created_at, updated_at
        ) VALUES (
          ?, ?, ?, 'pending', ?, ?, ?,
          ?, ?, ?, NULL, NULL,
          NULL, ?, ?
        )
        """,
        (
            permission_id,
            account.id,
            fields.permission_type,
            fields.short_place,
            fields.destination_detail,
            fields.address,
            fields.reason,
            fields.departure_at,
            fields.expected_return_at,
            now_text,
            now_text,
        ),
    )
    record_permission(
        connection,
        now_text,
        account.id,
        "permission.submitted",
        permission_id,
        f"{account.full_name} submitted a {fields.label} permission for {fields.short_place}.",
    )
    return load_permission(connection, permission_id)


@router.patch("/me/permissions/{permission_id}", response_model=PermissionBody)
def update_permission(
    permission_id: str,
    body: PermissionCreate,
    account: ResidentDep,
    connection: ConnectionDep,
) -> PermissionBody:
    row = connection.execute(
        "SELECT resident_id, status, type FROM permissions WHERE id = ?",
        (permission_id,),
    ).fetchone()
    if row is None or row["resident_id"] != account.id:
        raise ApiError(404, "not_found", "That record was not found.")
    if row["status"] != "pending":
        raise ApiError(
            409,
            "not_editable",
            "Only a pending permission can be changed.",
        )
    if body.permission_type != row["type"]:
        raise ApiError(
            422,
            "validation_error",
            "The kind of permission cannot be changed.",
            field="permission_type",
        )
    now = clock.utc_now()
    fields = _permission_fields(connection, body, now)
    now_text = clock.format_instant(now)
    updated = connection.execute(
        """
        UPDATE permissions
        SET short_place = ?, destination_detail = ?, address = ?, reason = ?,
            departure_at = ?, expected_return_at = ?, updated_at = ?
        WHERE id = ? AND resident_id = ? AND status = 'pending'
        RETURNING id
        """,
        (
            fields.short_place,
            fields.destination_detail,
            fields.address,
            fields.reason,
            fields.departure_at,
            fields.expected_return_at,
            now_text,
            permission_id,
            account.id,
        ),
    ).fetchone()
    if updated is None:
        raise ApiError(409, "not_editable", "Only a pending permission can be changed.")
    return load_permission(connection, permission_id)


@router.get("/me/permissions/{permission_id}", response_model=PermissionBody)
def get_own_permission(
    permission_id: str,
    account: ResidentDep,
    connection: ConnectionDep,
) -> PermissionBody:
    row = connection.execute(
        "SELECT resident_id FROM permissions WHERE id = ?",
        (permission_id,),
    ).fetchone()
    if row is None or row["resident_id"] != account.id:
        raise ApiError(404, "not_found", "That record was not found.")
    return load_permission(connection, permission_id)


@router.post("/me/permissions/{permission_id}/cancel", response_model=PermissionBody)
def cancel_permission(
    permission_id: str,
    account: ResidentDep,
    connection: ConnectionDep,
) -> PermissionBody:
    now_text = clock.format_instant(clock.utc_now())
    expire_passed_permissions(connection, now_text, permission_id=permission_id)
    connection.commit()
    row = connection.execute(
        """
        SELECT id, resident_id, status, type, short_place
        FROM permissions
        WHERE id = ?
        """,
        (permission_id,),
    ).fetchone()
    if row is None or row["resident_id"] != account.id:
        raise ApiError(404, "not_found", "That record was not found.")
    if row["status"] == "in_use":
        raise ApiError(
            409,
            "permission_in_use",
            "The gate has already recorded an exit on this permission, so it cannot be cancelled.",
        )
    if row["status"] not in {"pending", "approved"}:
        raise ApiError(
            409,
            "not_cancellable",
            "Only a pending or approved permission can be cancelled "
            f"(current status: {row['status']}).",
        )
    updated = connection.execute(
        """
        UPDATE permissions
        SET status = 'cancelled', updated_at = ?
        WHERE id = ? AND status IN ('pending', 'approved')
        RETURNING id, type, short_place
        """,
        (now_text, permission_id),
    ).fetchone()
    if updated is None:
        current = connection.execute(
            "SELECT status FROM permissions WHERE id = ?",
            (permission_id,),
        ).fetchone()
        assert current is not None
        if current["status"] == "in_use":
            raise ApiError(
                409,
                "permission_in_use",
                "The gate has already recorded an exit on this permission, so it cannot be cancelled.",
            )
        raise ApiError(
            409,
            "not_cancellable",
            "Only a pending or approved permission can be cancelled "
            f"(current status: {current['status']}).",
        )
    label = "late-night" if updated["type"] == "late_night" else "home-going"
    record_permission(
        connection,
        now_text,
        account.id,
        "permission.cancelled",
        permission_id,
        f"{account.full_name} cancelled a {label} permission for {updated['short_place']}.",
    )
    return load_permission(connection, permission_id)
