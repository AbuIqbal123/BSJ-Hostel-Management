"""Provost hall-office staff account routes."""

from __future__ import annotations

import json
import sqlite3
import uuid
from typing import Annotated

from fastapi import APIRouter, Query

from app.shared import clock
from app.shared.audit import record_audit
from app.shared.auth.routes import ConnectionDep
from app.shared.auth.security import hash_password
from app.shared.errors import ApiError
from app.staff.office.records import (
    StaffAccount,
    StaffCreate,
    StaffPage,
    StaffUpdate,
    list_staff_accounts,
    load_staff_account,
    revoke_live_sessions,
)
from app.staff.office.routes import ProvostDep

router = APIRouter(prefix="/api/v1/admin", tags=["Hall office"])

_DUPLICATE = "Username already in use."


@router.get("/staff", response_model=StaffPage)
def admin_list_staff(
    _account: ProvostDep,
    connection: ConnectionDep,
    limit: Annotated[int, Query(ge=1, le=500)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> StaffPage:
    return list_staff_accounts(connection, limit=limit, offset=offset)


@router.post("/staff", response_model=StaffAccount, status_code=201)
def admin_create_staff(
    body: StaffCreate,
    account: ProvostDep,
    connection: ConnectionDep,
) -> StaffAccount:
    full_name = body.full_name.strip()
    username = body.username.strip()
    job_title = body.job_title.strip()
    if not full_name or not username or not job_title:
        raise ApiError(422, "validation_error", "Required fields are missing.")

    user_id = str(uuid.uuid4())
    now_text = clock.format_instant(clock.utc_now())
    try:
        connection.execute(
            """
            INSERT INTO users (
              id, role, username, full_name, password_hash, status, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, 'active', ?, ?)
            """,
            (
                user_id,
                body.role,
                username,
                full_name,
                hash_password(body.temporary_password),
                now_text,
                now_text,
            ),
        )
        connection.execute(
            "INSERT INTO staff (user_id, job_title) VALUES (?, ?)",
            (user_id, job_title),
        )
    except sqlite3.IntegrityError as exc:
        message = str(exc).lower()
        if "users_username" in message or "unique" in message:
            raise ApiError(409, "duplicate_username", _DUPLICATE) from exc
        raise

    record_audit(
        connection,
        now_text,
        account.id,
        "staff.created",
        "staff",
        user_id,
        f"{account.full_name} created staff account {username}.",
    )
    connection.commit()
    created = load_staff_account(connection, user_id)
    assert created is not None
    return created


@router.patch("/staff/{user_id}", response_model=StaffAccount)
def admin_update_staff(
    user_id: str,
    body: StaffUpdate,
    account: ProvostDep,
    connection: ConnectionDep,
) -> StaffAccount:
    current = load_staff_account(connection, user_id)
    if current is None:
        raise ApiError(404, "not_found", "That record was not found.")

    changes: dict[str, object] = {}
    for field_name in body.model_fields_set:
        value = getattr(body, field_name)
        if field_name in {"full_name", "job_title"}:
            assert isinstance(value, str)
            value = value.strip()
            if not value:
                raise ApiError(
                    422,
                    "validation_error",
                    f"{field_name.replace('_', ' ').capitalize()} is required.",
                    field=field_name,
                )
        if getattr(current, field_name) != value:
            changes[field_name] = value

    if not changes:
        return current

    now_text = clock.format_instant(clock.utc_now())
    user_sets: list[str] = []
    user_values: list[object] = []
    staff_sets: list[str] = []
    staff_values: list[object] = []

    if "full_name" in changes:
        user_sets.append("full_name = ?")
        user_values.append(changes["full_name"])
    if "status" in changes:
        user_sets.append("status = ?")
        user_values.append(changes["status"])
    if "job_title" in changes:
        staff_sets.append("job_title = ?")
        staff_values.append(changes["job_title"])

    if user_sets:
        user_sets.append("updated_at = ?")
        user_values.append(now_text)
        connection.execute(
            f"UPDATE users SET {', '.join(user_sets)} WHERE id = ?",
            (*user_values, user_id),
        )
    if staff_sets:
        connection.execute(
            f"UPDATE staff SET {', '.join(staff_sets)} WHERE user_id = ?",
            (*staff_values, user_id),
        )

    if changes.get("status") == "suspended" and current.status != "suspended":
        revoke_live_sessions(connection, user_id, now_text)

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
        "staff.updated",
        "staff",
        user_id,
        f"{account.full_name} updated staff account {current.username}.",
        detail,
    )
    connection.commit()
    updated = load_staff_account(connection, user_id)
    assert updated is not None
    return updated
