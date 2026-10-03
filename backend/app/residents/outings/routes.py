"""Ordinary outings. The destination list, plans for each return, and cancelling one plan."""

from __future__ import annotations

import sqlite3
import uuid
from datetime import datetime, timedelta, timezone

from typing import Annotated

from fastapi import APIRouter, Query
from pydantic import BaseModel, ConfigDict, Field

from app.shared import clock
from app.shared.schemas import Destination, DestinationList
from app.shared.auth.routes import AccountDep, ConnectionDep
from app.shared.errors import ApiError
from app.residents.home.routes import ResidentDep
from app.residents.outings.records import (
    OutingBody,
    return_is_taken,
    expire_passed_plans,
    hall_day,
    hours_refusal,
    load_current_outing,
    load_outing,
    load_upcoming,
    ordinary_window_is_open,
    record_outing,
)

router = APIRouter(prefix="/api/v1", tags=["Resident"])


def _active_destinations(connection: sqlite3.Connection) -> list[Destination]:
    rows = connection.execute(
        """
        SELECT id, name, is_other, is_active
        FROM destinations
        WHERE is_active = 1
        ORDER BY is_other, name COLLATE NOCASE, id
        """
    ).fetchall()
    return [
        Destination(
            id=row["id"],
            name=row["name"],
            source="custom" if row["is_other"] else "preset",
            status="active" if row["is_active"] else "inactive",
        )
        for row in rows
    ]


@router.get("/destinations", response_model=DestinationList)
def list_destinations(_account: AccountDep, connection: ConnectionDep) -> DestinationList:
    return DestinationList(items=_active_destinations(connection))


class PlanOutingRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    destination_id: str
    destination_text: str | None = Field(default=None, min_length=1, max_length=120)
    starts_at: str
    expected_return_at: str


_WINDOW_MESSAGE = {
    "outside_ordinary_hours": "That return is outside ordinary hours.",
    "permission_required": "That return is outside ordinary hours. Please submit a permission request.",
}


def _instant(value: str) -> datetime:
    try:
        moment = datetime.strptime(value, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc)
    except ValueError:
        raise ApiError(
            422,
            "validation_error",
            "Use a UTC instant, such as 2026-09-30T13:00:00Z.",
        ) from None
    if clock.format_instant(moment) != value:
        raise ApiError(
            422,
            "validation_error",
            "Use a UTC instant, such as 2026-09-30T13:00:00Z.",
        )
    return moment


def _settings(connection: sqlite3.Connection) -> sqlite3.Row:
    row = connection.execute("SELECT * FROM hall_settings WHERE id = 'hall'").fetchone()
    if row is None:
        raise ApiError(422, "validation_error", "The hall settings are missing.")
    return row


def _destination(connection: sqlite3.Connection, destination_id: str) -> sqlite3.Row:
    row = connection.execute(
        """
        SELECT id, name, is_other, is_active
        FROM destinations
        WHERE id = ? AND is_active = 1
        """,
        (destination_id,),
    ).fetchone()
    if row is None:
        raise ApiError(422, "validation_error", "Choose a destination from the list.")
    return row


@router.post("/me/outings", status_code=201, response_model=OutingBody)
def plan_outing(
    body: PlanOutingRequest,
    account: ResidentDep,
    connection: ConnectionDep,
) -> OutingBody:
    moment = _instant(body.expected_return_at)
    start = _instant(body.starts_at)
    now = clock.utc_now()
    now_text = clock.format_instant(now)
    if body.expected_return_at <= now_text:
        raise ApiError(422, "validation_error", "The expected return must be in the future.")
    settings = _settings(connection)
    refusal = hours_refusal(moment, settings)
    if refusal is not None:
        raise ApiError(409, refusal, _WINDOW_MESSAGE[refusal])
    if body.starts_at <= now_text:
        raise ApiError(422, "validation_error", "The outing start must be in the future.")
    if body.starts_at >= body.expected_return_at:
        raise ApiError(422, "validation_error", "The expected return must be after the start.")
    if hall_day(start, settings["timezone"]) != hall_day(moment, settings["timezone"]):
        raise ApiError(
            422,
            "validation_error",
            "An ordinary outing starts and returns on the same hall day.",
        )
    start_refusal = hours_refusal(start, settings)
    if start_refusal == "outside_ordinary_hours":
        raise ApiError(409, start_refusal, "That start is outside ordinary hours.")
    if start_refusal == "permission_required":
        raise ApiError(
            409,
            start_refusal,
            "That start is outside ordinary hours. Please submit a permission request.",
        )
    destination = _destination(connection, body.destination_id)
    if destination["is_other"]:
        place = (body.destination_text or "").strip()
        if not place:
            raise ApiError(422, "validation_error", "Destination text is required.")
        destination_id = None
    else:
        place = destination["name"]
        destination_id = destination["id"]
    expire_passed_plans(connection, account.id, now_text)
    day = hall_day(moment, settings["timezone"])
    if ordinary_window_is_open(connection, account.id, now):
        connection.commit()
        raise ApiError(
            409,
            "outing_window_open",
            "You cannot start another outing while one is inside its window.",
        )
    if return_is_taken(connection, account.id, body.expected_return_at):
        connection.commit()
        raise ApiError(409, "return_already_planned", "You already have an outing ending at that time.")
    outing_id = str(uuid.uuid4())
    grace_ends_at = clock.format_instant(moment + timedelta(minutes=int(settings["grace_minutes"])))
    connection.execute(
        """
        INSERT INTO outings (
          id, resident_id, permission_id, type, status, destination_id, place,
          starts_at, expected_return_at, grace_ends_at, exited_at, exit_recorded_by,
          returned_at, return_recorded_by, created_at, updated_at, cancelled_at,
          hall_date
        ) VALUES (
          ?, ?, NULL, 'ordinary', 'planned', ?, ?,
          ?, ?, ?, NULL, NULL,
          NULL, NULL, ?, ?, NULL, ?
        )
        """,
        (
            outing_id,
            account.id,
            destination_id,
            place,
            body.starts_at,
            body.expected_return_at,
            grace_ends_at,
            now_text,
            now_text,
            day,
        ),
    )
    record_outing(
        connection,
        now_text,
        account.id,
        "outing.planned",
        outing_id,
        f"{account.full_name} planned an outing to {place}.",
    )
    return load_outing(connection, outing_id)


class CurrentOuting(BaseModel):
    model_config = ConfigDict(extra="forbid")
    outing: OutingBody | None


class OutingList(BaseModel):
    model_config = ConfigDict(extra="forbid")
    total: int
    limit: int
    offset: int
    items: list[OutingBody]


@router.get("/me/outings", response_model=OutingList)
def list_outings(
    account: ResidentDep,
    connection: ConnectionDep,
    limit: Annotated[int, Query(ge=1, le=500)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> OutingList:
    items = load_upcoming(connection, account.id)
    total = len(items)
    return OutingList(
        total=total,
        limit=limit,
        offset=offset,
        items=items[offset : offset + limit],
    )


@router.get("/me/outings/current", response_model=CurrentOuting)
def current_outing(account: ResidentDep, connection: ConnectionDep) -> CurrentOuting:
    now = clock.utc_now()
    return CurrentOuting(outing=load_current_outing(connection, account.id, now))


@router.post("/me/outings/{outing_id}/cancel", response_model=OutingBody)
def cancel_outing(outing_id: str, account: ResidentDep, connection: ConnectionDep) -> OutingBody:
    now_text = clock.format_instant(clock.utc_now())
    expire_passed_plans(connection, account.id, now_text)
    # A passed plan is already cancelled. Keep that if this request is refused.
    connection.commit()
    outing = connection.execute(
        "SELECT id, resident_id, status, place FROM outings WHERE id = ?",
        (outing_id,),
    ).fetchone()
    if outing is None or outing["resident_id"] != account.id:
        raise ApiError(404, "not_found", "That record was not found.")
    if outing["status"] == "outside":
        raise ApiError(409, "already_outside", "You are already outside.")
    if outing["status"] != "planned":
        raise ApiError(409, "no_outing_planned", "There is no planned outing.")
    connection.execute(
        """
        UPDATE outings
        SET status = 'cancelled', cancelled_at = ?, updated_at = ?
        WHERE id = ? AND status = 'planned'
        """,
        (now_text, now_text, outing["id"]),
    )
    record_outing(
        connection,
        now_text,
        account.id,
        "outing.cancelled",
        outing["id"],
        f"{account.full_name} cancelled a planned outing to {outing['place']}.",
    )
    return load_outing(connection, outing["id"])
