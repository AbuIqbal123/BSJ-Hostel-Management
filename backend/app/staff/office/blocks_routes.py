"""Provost hall-office block routes."""

from __future__ import annotations

import json
import sqlite3
import uuid

from fastapi import APIRouter

from app.shared import clock
from app.shared.audit import record_audit
from app.shared.auth.routes import ConnectionDep
from app.shared.errors import ApiError
from app.staff.office.records import (
    Block,
    BlockCreate,
    BlockUpdate,
    list_blocks,
    load_block,
)
from app.staff.office.routes import ProvostDep

router = APIRouter(prefix="/api/v1/admin", tags=["Hall office"])


@router.get("/blocks", response_model=list[Block])
def get_blocks(_account: ProvostDep, connection: ConnectionDep) -> list[Block]:
    return list_blocks(connection)


@router.post("/blocks", response_model=Block, status_code=201)
def create_block(
    body: BlockCreate,
    account: ProvostDep,
    connection: ConnectionDep,
) -> Block:
    code = body.code.strip()
    name = body.name.strip()
    if not code or not name:
        raise ApiError(422, "validation_error", "Code and name are required.")
    block_id = str(uuid.uuid4())
    now_text = clock.format_instant(clock.utc_now())
    try:
        connection.execute(
            """
            INSERT INTO blocks (
              id, code, name, floors, room_count, beds_per_room, is_active
            ) VALUES (?, ?, ?, ?, ?, ?, 1)
            """,
            (
                block_id,
                code,
                name,
                body.floors,
                body.room_count,
                body.beds_per_room,
            ),
        )
    except sqlite3.IntegrityError as exc:
        if "blocks_code" in str(exc).lower() or "unique" in str(exc).lower():
            raise ApiError(409, "duplicate_block", "Code already in use.") from exc
        raise
    record_audit(
        connection,
        now_text,
        account.id,
        "block.created",
        "block",
        block_id,
        f"{account.full_name} created block {code}.",
    )
    created = load_block(connection, block_id)
    assert created is not None
    return created


@router.patch("/blocks/{block_id}", response_model=Block)
def update_block(
    block_id: str,
    body: BlockUpdate,
    account: ProvostDep,
    connection: ConnectionDep,
) -> Block:
    current = load_block(connection, block_id)
    if current is None:
        raise ApiError(404, "not_found", "That record was not found.")

    changes: dict[str, object] = {}
    for field_name in body.model_fields_set:
        value = getattr(body, field_name)
        if value is None and field_name != "floors":
            label = field_name.replace("_", " ").capitalize()
            raise ApiError(
                422,
                "validation_error",
                f"{label} is required.",
                field=field_name,
            )
        if field_name == "name":
            assert isinstance(value, str)
            value = value.strip()
            if not value:
                raise ApiError(
                    422,
                    "validation_error",
                    "Name is required.",
                    field="name",
                )
        if getattr(current, field_name) != value:
            changes[field_name] = value

    if not changes:
        return current

    assignments: list[str] = []
    values: list[object] = []
    for key, value in changes.items():
        if key == "status":
            assignments.append("is_active = ?")
            values.append(1 if value == "active" else 0)
        else:
            assignments.append(f"{key} = ?")
            values.append(value)

    connection.execute(
        f"UPDATE blocks SET {', '.join(assignments)} WHERE id = ?",
        (*values, block_id),
    )
    now_text = clock.format_instant(clock.utc_now())
    detail = json.dumps(
        {"before": {key: getattr(current, key) for key in changes}, "after": changes},
        sort_keys=True,
    )
    record_audit(
        connection,
        now_text,
        account.id,
        "block.updated",
        "block",
        block_id,
        f"{account.full_name} updated block {current.code}.",
        detail,
    )
    updated = load_block(connection, block_id)
    assert updated is not None
    return updated
