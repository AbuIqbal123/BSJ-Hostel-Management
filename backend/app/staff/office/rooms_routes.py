"""Provost hall-office room routes."""

from __future__ import annotations

import json
import sqlite3
import uuid
from typing import Annotated

from fastapi import APIRouter, Query

from app.shared import clock
from app.shared.audit import record_audit
from app.shared.auth.routes import ConnectionDep
from app.shared.errors import ApiError
from app.staff.office.records import (
    Room,
    RoomCreate,
    RoomUpdate,
    list_rooms,
    load_block,
    load_room,
    residents_in_room,
)
from app.staff.office.routes import ProvostDep

router = APIRouter(prefix="/api/v1/admin", tags=["Hall office"])


@router.get("/rooms", response_model=list[Room])
def get_rooms(
    _account: ProvostDep,
    connection: ConnectionDep,
    block_id: Annotated[str | None, Query()] = None,
) -> list[Room]:
    return list_rooms(connection, block_id=block_id)


@router.post("/rooms", response_model=Room, status_code=201)
def create_room(
    body: RoomCreate,
    account: ProvostDep,
    connection: ConnectionDep,
) -> Room:
    number = body.number.strip()
    if not number:
        raise ApiError(
            422,
            "validation_error",
            "Number is required.",
            field="number",
        )
    block = load_block(connection, body.block_id)
    if block is None:
        raise ApiError(404, "not_found", "That record was not found.")
    label = f"{block.code}-{number}"
    room_id = str(uuid.uuid4())
    now_text = clock.format_instant(clock.utc_now())
    try:
        connection.execute(
            """
            INSERT INTO rooms (
              id, block_id, number, label, bed_count, is_active
            ) VALUES (?, ?, ?, ?, ?, 1)
            """,
            (room_id, body.block_id, number, label, block.beds_per_room),
        )
    except sqlite3.IntegrityError as exc:
        message = str(exc).lower()
        if "rooms_block_number" in message or "unique" in message or "rooms_label" in message:
            raise ApiError(
                409,
                "duplicate_room",
                "That number is already used in the block.",
            ) from exc
        raise
    record_audit(
        connection,
        now_text,
        account.id,
        "room.created",
        "room",
        room_id,
        f"{account.full_name} created room {label}.",
    )
    created = load_room(connection, room_id)
    assert created is not None
    return created


@router.patch("/rooms/{room_id}", response_model=Room)
def update_room(
    room_id: str,
    body: RoomUpdate,
    account: ProvostDep,
    connection: ConnectionDep,
) -> Room:
    current = load_room(connection, room_id)
    if current is None:
        raise ApiError(404, "not_found", "That record was not found.")

    changes: dict[str, object] = {}
    for field_name in body.model_fields_set:
        value = getattr(body, field_name)
        if value is None:
            label = field_name.replace("_", " ").capitalize()
            raise ApiError(
                422,
                "validation_error",
                f"{label} is required.",
                field=field_name,
            )
        if field_name == "number":
            assert isinstance(value, str)
            value = value.strip()
            if not value:
                raise ApiError(
                    422,
                    "validation_error",
                    "Number is required.",
                    field="number",
                )
        if getattr(current, field_name) != value:
            changes[field_name] = value

    if not changes:
        return current

    if changes.get("status") == "inactive" and residents_in_room(connection, room_id) > 0:
        raise ApiError(
            409,
            "room_in_use",
            "Residents are still assigned.",
        )

    if "bed_count" in changes:
        bed_count = int(changes["bed_count"])  # type: ignore[arg-type]
        if bed_count < residents_in_room(connection, room_id):
            raise ApiError(
                409,
                "room_in_use",
                "Residents are still assigned.",
            )

    new_number = str(changes["number"]) if "number" in changes else current.number
    if "number" in changes:
        block = load_block(connection, current.block_id)
        assert block is not None
        changes["label"] = f"{block.code}-{new_number}"

    assignments: list[str] = []
    values: list[object] = []
    for key, value in changes.items():
        if key == "status":
            assignments.append("is_active = ?")
            values.append(1 if value == "active" else 0)
        else:
            assignments.append(f"{key} = ?")
            values.append(value)

    try:
        connection.execute(
            f"UPDATE rooms SET {', '.join(assignments)} WHERE id = ?",
            (*values, room_id),
        )
    except sqlite3.IntegrityError as exc:
        message = str(exc).lower()
        if "rooms_block_number" in message or "unique" in message or "rooms_label" in message:
            raise ApiError(
                409,
                "duplicate_room",
                "That number is already used in the block.",
            ) from exc
        raise

    now_text = clock.format_instant(clock.utc_now())
    detail = json.dumps(
        {
            "before": {key: getattr(current, key) for key in changes if hasattr(current, key)},
            "after": changes,
        },
        sort_keys=True,
    )
    record_audit(
        connection,
        now_text,
        account.id,
        "room.updated",
        "room",
        room_id,
        f"{account.full_name} updated room {changes.get('label', current.label)}.",
        detail,
    )
    updated = load_room(connection, room_id)
    assert updated is not None
    return updated
