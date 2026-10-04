"""Ordinary outings. The destination list, plans for each return, and changing or cancelling one plan."""

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
    can_modify_outing,
    return_is_taken,
    expire_passed_plans,
    hall_day,
    hours_refusal,
    load_current_outing,
    load_outing,
    list_upcoming_page,
    ordinary_window_is_open,
    record_outing,
)

router = APIRouter(prefix="/api/v1", tags=["Resident"])


def _active_destinations(connection: sqlite3.Connection) -> list[Destination]:
    rows = connection.execute(
        """
        SELECT id, name, is_other
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
            status="active",
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


def _require_ordinary_times(
    body: PlanOutingRequest, settings: sqlite3.Row, now_text: str
) -> tuple[datetime, datetime]:
    moment = _instant(body.expected_return_at)
    start = _instant(body.starts_at)
    if body.expected_return_at <= now_text:
        raise ApiError(422, "validation_error", "The expected return must be in the future.")
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
    return start, moment


def _remembered_place(connection: sqlite3.Connection, body: PlanOutingRequest) -> tuple[str | None, str]:
    destination = _destination(connection, body.destination_id)
    if destination["is_other"]:
        place = (body.destination_text or "").strip()
        if not place:
            raise ApiError(422, "validation_error", "Destination text is required.")
        return None, place
    return destination["id"], destination["name"]


def _own_outing(connection: sqlite3.Connection, outing_id: str, resident_id: str) -> sqlite3.Row:
    row = connection.execute(
        """
        SELECT id, resident_id, type, status, place, starts_at, expected_return_at, exited_at
        FROM outings
        WHERE id = ?
        """,
        (outing_id,),
    ).fetchone()
    if row is None or row["resident_id"] != resident_id:
        raise ApiError(404, "not_found", "That record was not found.")
    return row


def _refuse_unless_changeable(row: sqlite3.Row, now: datetime) -> None:
    if row["status"] == "outside":
        raise ApiError(409, "already_outside", "You are already outside.")
    if row["status"] != "planned" or row["type"] != "ordinary":
        raise ApiError(409, "no_outing_planned", "There is no planned outing.")
    if not can_modify_outing(
        outing_type=row["type"],
        status=row["status"],
        starts_at=row["starts_at"],
        expected_return_at=row["expected_return_at"],
        exited_at=row["exited_at"],
        now=now,
    ):
        raise ApiError(
            409,
            "outing_window_open",
            "You cannot change this outing while its window is open.",
        )


@router.post("/me/outings", status_code=201, response_model=OutingBody)
def plan_outing(
    body: PlanOutingRequest,
    account: ResidentDep,
    connection: ConnectionDep,
) -> OutingBody:
    now = clock.utc_now()
    now_text = clock.format_instant(now)
    settings = _settings(connection)
    _start, moment = _require_ordinary_times(body, settings, now_text)
    destination_id, place = _remembered_place(connection, body)
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


@router.patch("/me/outings/{outing_id}", response_model=OutingBody)
def update_outing(
    outing_id: str,
    body: PlanOutingRequest,
    account: ResidentDep,
    connection: ConnectionDep,
) -> OutingBody:
    now = clock.utc_now()
    now_text = clock.format_instant(now)
    expire_passed_plans(connection, account.id, now_text)
    connection.commit()
    outing = _own_outing(connection, outing_id, account.id)
    _refuse_unless_changeable(outing, now)
    settings = _settings(connection)
    _start, moment = _require_ordinary_times(body, settings, now_text)
    destination_id, place = _remembered_place(connection, body)
    if return_is_taken(
        connection,
        account.id,
        body.expected_return_at,
        except_outing_id=outing_id,
    ):
        raise ApiError(409, "return_already_planned", "You already have an outing ending at that time.")
    grace_ends_at = clock.format_instant(moment + timedelta(minutes=int(settings["grace_minutes"])))
    day = hall_day(moment, settings["timezone"])
    changed = connection.execute(
        """
        UPDATE outings
        SET destination_id = ?, place = ?, starts_at = ?, expected_return_at = ?,
            grace_ends_at = ?, hall_date = ?, updated_at = ?
        WHERE id = ? AND resident_id = ? AND type = 'ordinary' AND status = 'planned'
        """,
        (
            destination_id,
            place,
            body.starts_at,
            body.expected_return_at,
            grace_ends_at,
            day,
            now_text,
            outing_id,
            account.id,
        ),
    )
    if changed.rowcount != 1:
        raise ApiError(409, "no_outing_planned", "There is no planned outing.")
    record_outing(
        connection,
        now_text,
        account.id,
        "outing.updated",
        outing_id,
        f"{account.full_name} changed a planned outing to {place}.",
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
    total, items = list_upcoming_page(
        connection, account.id, limit=limit, offset=offset
    )
    return OutingList(
        total=total,
        limit=limit,
        offset=offset,
        items=items,
    )


@router.get("/me/outings/current", response_model=CurrentOuting)
def current_outing(account: ResidentDep, connection: ConnectionDep) -> CurrentOuting:
    now = clock.utc_now()
    return CurrentOuting(outing=load_current_outing(connection, account.id, now))


@router.post("/me/outings/{outing_id}/cancel", response_model=OutingBody)
def cancel_outing(outing_id: str, account: ResidentDep, connection: ConnectionDep) -> OutingBody:
    now = clock.utc_now()
    now_text = clock.format_instant(now)
    expire_passed_plans(connection, account.id, now_text)
    # A passed plan is already cancelled. Keep that if this request is refused.
    connection.commit()
    outing = _own_outing(connection, outing_id, account.id)
    _refuse_unless_changeable(outing, now)
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
