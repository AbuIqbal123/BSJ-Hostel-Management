"""Provost hall-office destination routes."""

from __future__ import annotations

import json
import sqlite3
import uuid

from fastapi import APIRouter

from app.shared import clock
from app.shared.auth.routes import ConnectionDep
from app.shared.errors import ApiError
from app.staff.office.records import (
    Destination,
    DestinationCreate,
    DestinationList,
    DestinationUpdate,
    active_other_exists,
    list_admin_destinations,
    load_destination,
    record_destination_audit,
)
from app.staff.office.routes import ProvostDep

router = APIRouter(prefix="/api/v1/admin", tags=["Hall office"])

_OTHER_EXISTS = "Another active Other row exists."
_DUPLICATE = "That destination name is already in use."


@router.get("/destinations", response_model=DestinationList)
def admin_list_destinations(
    _account: ProvostDep,
    connection: ConnectionDep,
) -> DestinationList:
    return list_admin_destinations(connection)


@router.post("/destinations", response_model=Destination, status_code=201)
def create_destination(
    body: DestinationCreate,
    account: ProvostDep,
    connection: ConnectionDep,
) -> Destination:
    name = body.name.strip()
    if not name:
        raise ApiError(
            422,
            "validation_error",
            "Name is required.",
            field="name",
        )
    if body.is_other and active_other_exists(connection):
        raise ApiError(409, "other_exists", _OTHER_EXISTS)

    destination_id = str(uuid.uuid4())
    now_text = clock.format_instant(clock.utc_now())
    try:
        connection.execute(
            """
            INSERT INTO destinations (id, name, is_other, is_active)
            VALUES (?, ?, ?, 1)
            """,
            (destination_id, name, 1 if body.is_other else 0),
        )
    except sqlite3.IntegrityError as exc:
        message = str(exc).lower()
        if "destinations_one_active_other" in message:
            raise ApiError(409, "other_exists", _OTHER_EXISTS) from exc
        if "destinations_name" in message or "unique" in message:
            raise ApiError(409, "duplicate_destination", _DUPLICATE) from exc
        raise

    record_destination_audit(
        connection,
        now_text,
        account.id,
        "destination.created",
        destination_id,
        f"{account.full_name} created destination {name}.",
    )
    connection.commit()
    created = load_destination(connection, destination_id)
    assert created is not None
    return created


@router.patch("/destinations/{destination_id}", response_model=Destination)
def update_destination(
    destination_id: str,
    body: DestinationUpdate,
    account: ProvostDep,
    connection: ConnectionDep,
) -> Destination:
    current = load_destination(connection, destination_id)
    if current is None:
        raise ApiError(404, "not_found", "That record was not found.")

    changes: dict[str, object] = {}
    for field_name in body.model_fields_set:
        value = getattr(body, field_name)
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

    will_be_other = bool(changes["is_other"]) if "is_other" in changes else current.is_other
    will_be_active = bool(changes["is_active"]) if "is_active" in changes else current.is_active
    if will_be_other and will_be_active and active_other_exists(
        connection, excluding_id=destination_id
    ):
        raise ApiError(409, "other_exists", _OTHER_EXISTS)

    assignments: list[str] = []
    values: list[object] = []
    for key, value in changes.items():
        if key in {"is_other", "is_active"}:
            assignments.append(f"{key} = ?")
            values.append(1 if value else 0)
        else:
            assignments.append(f"{key} = ?")
            values.append(value)

    try:
        connection.execute(
            f"UPDATE destinations SET {', '.join(assignments)} WHERE id = ?",
            (*values, destination_id),
        )
    except sqlite3.IntegrityError as exc:
        message = str(exc).lower()
        if "destinations_one_active_other" in message:
            raise ApiError(409, "other_exists", _OTHER_EXISTS) from exc
        if "destinations_name" in message or "unique" in message:
            raise ApiError(409, "duplicate_destination", _DUPLICATE) from exc
        raise

    now_text = clock.format_instant(clock.utc_now())
    detail = json.dumps(
        {"before": {key: getattr(current, key) for key in changes}, "after": changes},
        sort_keys=True,
    )
    record_destination_audit(
        connection,
        now_text,
        account.id,
        "destination.updated",
        destination_id,
        f"{account.full_name} updated destination {changes.get('name', current.name)}.",
        detail,
    )
    connection.commit()
    updated = load_destination(connection, destination_id)
    assert updated is not None
    return updated
