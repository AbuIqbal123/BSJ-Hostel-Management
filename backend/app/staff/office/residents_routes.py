"""Provost hall-office resident account routes."""

from __future__ import annotations

import json
import uuid
from typing import Annotated

from fastapi import APIRouter, Query

from app.shared import clock
from app.shared.audit import record_audit
from app.shared.auth.routes import ConnectionDep
from app.shared.auth.security import hash_password
from app.shared.db import INTEGRITY_ERRORS
from app.shared.errors import ApiError
from app.staff.office.records import (
    HallPass,
    ResidentAccount,
    ResidentAccountPage,
    ResidentCreate,
    ResidentCreated,
    ResidentUpdate,
    list_resident_accounts,
    load_resident_account,
    new_hall_pass_token,
    revoke_live_sessions,
    room_exists,
    room_has_capacity,
    room_is_active,
)
from app.staff.office.routes import ProvostDep

router = APIRouter(prefix="/api/v1/admin", tags=["Hall office"])

_DUPLICATE = "Enrolment number already in use."
_ROOM_FULL = "This room already has as many residents as it has beds."
_ROOM_INACTIVE = "That room is not in use."
_NOT_CLEARABLE = {
    "full_name",
    "enrolment_number",
    "room_id",
    "guardian_name",
    "guardian_phone",
    "status",
}


@router.get("/residents", response_model=ResidentAccountPage)
def admin_list_residents(
    _account: ProvostDep,
    connection: ConnectionDep,
    q: Annotated[str | None, Query(max_length=80)] = None,
    limit: Annotated[int, Query(ge=1, le=500)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> ResidentAccountPage:
    return list_resident_accounts(connection, q=q, limit=limit, offset=offset)


@router.post("/residents", response_model=ResidentCreated, status_code=201)
def admin_create_resident(
    body: ResidentCreate,
    account: ProvostDep,
    connection: ConnectionDep,
) -> ResidentCreated:
    full_name = body.full_name.strip()
    enrolment = body.enrolment_number.strip()
    guardian_name = body.guardian_name.strip()
    course = None if body.course is None else body.course.strip() or None
    if not full_name or not enrolment or not guardian_name:
        raise ApiError(422, "validation_error", "Required fields are missing.")
    if not room_exists(connection, body.room_id):
        raise ApiError(404, "not_found", "That record was not found.")
    if not room_is_active(connection, body.room_id):
        raise ApiError(409, "room_inactive", _ROOM_INACTIVE)
    if not room_has_capacity(connection, body.room_id):
        raise ApiError(422, "validation_error", _ROOM_FULL)

    user_id = str(uuid.uuid4())
    qr_payload = new_hall_pass_token()
    now_text = clock.format_instant(clock.utc_now())
    try:
        connection.execute(
            """
            INSERT INTO users (
              id, role, username, full_name, password_hash, status, created_at, updated_at
            ) VALUES (?, 'resident', ?, ?, ?, 'active', ?, ?)
            """,
            (
                user_id,
                enrolment,
                full_name,
                hash_password(body.temporary_password),
                now_text,
                now_text,
            ),
        )
        connection.execute(
            """
            INSERT INTO residents (
              user_id, enrolment_number, course, room_id, phone, guardian_name, guardian_phone,
              qr_token, presence, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'inside', ?, ?)
            """,
            (
                user_id,
                enrolment,
                course,
                body.room_id,
                body.phone,
                guardian_name,
                body.guardian_phone,
                qr_payload,
                now_text,
                now_text,
            ),
        )
    except INTEGRITY_ERRORS as exc:
        message = str(exc).lower()
        if "unique" in message:
            raise ApiError(409, "duplicate_username", _DUPLICATE) from exc
        if "beds" in message:
            raise ApiError(422, "validation_error", _ROOM_FULL) from exc
        raise

    record_audit(
        connection,
        now_text,
        account.id,
        "resident.created",
        "resident",
        user_id,
        f"{account.full_name} created resident {full_name}.",
    )
    created = load_resident_account(connection, user_id)
    assert created is not None
    return ResidentCreated(
        account=created,
        hall_pass=HallPass(
            qr_payload=qr_payload,
            full_name=created.full_name,
            room_label=created.room_label,
        ),
    )


@router.get("/residents/{resident_id}", response_model=ResidentAccount)
def admin_get_resident(
    resident_id: str,
    _account: ProvostDep,
    connection: ConnectionDep,
) -> ResidentAccount:
    resident = load_resident_account(connection, resident_id)
    if resident is None:
        raise ApiError(404, "not_found", "That record was not found.")
    return resident


@router.patch("/residents/{resident_id}", response_model=ResidentAccount)
def admin_update_resident(
    resident_id: str,
    body: ResidentUpdate,
    account: ProvostDep,
    connection: ConnectionDep,
) -> ResidentAccount:
    current = load_resident_account(connection, resident_id)
    if current is None:
        raise ApiError(404, "not_found", "That record was not found.")

    changes: dict[str, object] = {}
    for field_name in body.model_fields_set:
        value = getattr(body, field_name)
        if field_name in _NOT_CLEARABLE and value is None:
            raise ApiError(
                422,
                "validation_error",
                f"{field_name.replace('_', ' ').capitalize()} is required.",
                field=field_name,
            )
        if field_name in {"full_name", "enrolment_number", "guardian_name"}:
            assert isinstance(value, str)
            value = value.strip()
            if not value:
                raise ApiError(
                    422,
                    "validation_error",
                    f"{field_name.replace('_', ' ').capitalize()} is required.",
                    field=field_name,
                )
        if field_name == "course":
            if value is not None:
                assert isinstance(value, str)
                value = value.strip() or None
        if getattr(current, field_name) != value:
            changes[field_name] = value

    if not changes:
        return current

    if "room_id" in changes:
        room_id = str(changes["room_id"])
        if not room_exists(connection, room_id):
            raise ApiError(404, "not_found", "That record was not found.")
        if not room_is_active(connection, room_id):
            raise ApiError(409, "room_inactive", _ROOM_INACTIVE)
        if not room_has_capacity(connection, room_id, excluding_user_id=resident_id):
            raise ApiError(422, "validation_error", _ROOM_FULL)

    now_text = clock.format_instant(clock.utc_now())
    user_sets: list[str] = []
    user_values: list[object] = []
    resident_sets: list[str] = []
    resident_values: list[object] = []

    if "full_name" in changes:
        user_sets.append("full_name = ?")
        user_values.append(changes["full_name"])
    if "enrolment_number" in changes:
        user_sets.append("username = ?")
        user_values.append(changes["enrolment_number"])
        resident_sets.append("enrolment_number = ?")
        resident_values.append(changes["enrolment_number"])
    if "status" in changes:
        user_sets.append("status = ?")
        user_values.append(changes["status"])
    if "course" in changes:
        resident_sets.append("course = ?")
        resident_values.append(changes["course"])
    if "room_id" in changes:
        resident_sets.append("room_id = ?")
        resident_values.append(changes["room_id"])
    if "guardian_name" in changes:
        resident_sets.append("guardian_name = ?")
        resident_values.append(changes["guardian_name"])
    if "guardian_phone" in changes:
        resident_sets.append("guardian_phone = ?")
        resident_values.append(changes["guardian_phone"])
    if "phone" in changes:
        resident_sets.append("phone = ?")
        resident_values.append(changes["phone"])

    try:
        if user_sets:
            user_sets.append("updated_at = ?")
            user_values.append(now_text)
            connection.execute(
                f"UPDATE users SET {', '.join(user_sets)} WHERE id = ?",
                (*user_values, resident_id),
            )
        if resident_sets:
            resident_sets.append("updated_at = ?")
            resident_values.append(now_text)
            connection.execute(
                f"UPDATE residents SET {', '.join(resident_sets)} WHERE user_id = ?",
                (*resident_values, resident_id),
            )
    except INTEGRITY_ERRORS as exc:
        message = str(exc).lower()
        if "unique" in message:
            raise ApiError(409, "duplicate_username", _DUPLICATE) from exc
        if "beds" in message:
            raise ApiError(422, "validation_error", _ROOM_FULL) from exc
        raise

    new_status = changes.get("status")
    if new_status == "suspended" and current.status != "suspended":
        revoke_live_sessions(connection, resident_id, now_text)
        action = "resident.suspended"
        summary = f"{account.full_name} suspended resident {current.full_name}."
    elif new_status == "active" and current.status == "suspended":
        action = "resident.reinstated"
        summary = f"{account.full_name} reinstated resident {current.full_name}."
    else:
        action = "resident.updated"
        summary = f"{account.full_name} updated resident {current.full_name}."

    detail = json.dumps(
        {
            "before": {key: getattr(current, key) for key in changes},
            "after": changes,
        },
        sort_keys=True,
    )
    record_audit(
        connection,
        now_text,
        account.id,
        action,
        "resident",
        resident_id,
        summary,
        detail,
    )
    updated = load_resident_account(connection, resident_id)
    assert updated is not None
    return updated


@router.post("/residents/{resident_id}/hall-pass/reissue", response_model=HallPass)
def reissue_hall_pass(
    resident_id: str,
    account: ProvostDep,
    connection: ConnectionDep,
) -> HallPass:
    current = load_resident_account(connection, resident_id)
    if current is None:
        raise ApiError(404, "not_found", "That record was not found.")
    qr_payload = new_hall_pass_token()
    now_text = clock.format_instant(clock.utc_now())
    connection.execute(
        """
        UPDATE residents
        SET qr_token = ?, updated_at = ?
        WHERE user_id = ?
        """,
        (qr_payload, now_text, resident_id),
    )
    record_audit(
        connection,
        now_text,
        account.id,
        "hall_pass.reissued",
        "hall_pass",
        resident_id,
        f"{account.full_name} reissued the hall pass for {current.full_name}.",
    )
    return HallPass(
        qr_payload=qr_payload,
        full_name=current.full_name,
        room_label=current.room_label,
    )
