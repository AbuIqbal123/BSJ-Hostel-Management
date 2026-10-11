"""Provost hall-office destination routes."""

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
    Destination,
    DestinationCreate,
    DestinationList,
    DestinationUpdate,
    active_other_exists,
    list_admin_destinations,
    load_destination,
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
    if body.source == "custom" and active_other_exists(connection):
        raise ApiError(409, "other_exists", _OTHER_EXISTS)

    destination_id = str(uuid.uuid4())
    now_text = clock.format_instant(clock.utc_now())
    try:
        connection.execute(
            """
            INSERT INTO destinations (id, name, is_other, is_active)
            VALUES (?, ?, ?, 1)
            """,
            (destination_id, name, 1 if body.source == "custom" else 0),
        )
    except sqlite3.IntegrityError as exc:
        message = str(exc).lower()
        if "destinations_one_active_other" in message:
            raise ApiError(409, "other_exists", _OTHER_EXISTS) from exc
        if "destinations_name" in message or "unique" in message:
            raise ApiError(409, "duplicate_destination", _DUPLICATE) from exc
        raise

    record_audit(
        connection,
        now_text,
        account.id,
        "destination.created",
        "destination",
        destination_id,
        f"{account.full_name} created destination {name}.",
    )
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
        if value is None:
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

    will_be_other = (
        changes["source"] == "custom" if "source" in changes else current.source == "custom"
    )
    will_be_active = (
        changes["status"] == "active" if "status" in changes else current.status == "active"
    )
    if will_be_other and will_be_active and active_other_exists(
        connection, excluding_id=destination_id
    ):
        raise ApiError(409, "other_exists", _OTHER_EXISTS)

    assignments: list[str] = []
    values: list[object] = []
    for key, value in changes.items():
        if key == "source":
            assignments.append("is_other = ?")
            values.append(1 if value == "custom" else 0)
        elif key == "status":
            assignments.append("is_active = ?")
            values.append(1 if value == "active" else 0)
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
    record_audit(
        connection,
        now_text,
        account.id,
        "destination.updated",
        "destination",
        destination_id,
        f"{account.full_name} updated destination {changes.get('name', current.name)}.",
        detail,
    )
    updated = load_destination(connection, destination_id)
    assert updated is not None
    return updated
