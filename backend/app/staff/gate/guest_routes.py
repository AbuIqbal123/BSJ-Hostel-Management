"""Gate guest lists, occupancy, arrival, and departure."""

from __future__ import annotations

import sqlite3
from typing import Annotated, Literal

from fastapi import APIRouter, Query
from pydantic import BaseModel, ConfigDict

from app.residents.guests.records import (
    derive_bucket,
    hall_today,
    record_guest_stay,
)
from app.shared import clock
from app.shared.auth.routes import ConnectionDep
from app.shared.errors import ApiError
from app.staff.gate.routes import GateDep

router = APIRouter(prefix="/api/v1/gate", tags=["Gate"])

GateGuestBucket = Literal["expected", "in_hall"]


class GateGuestCard(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: str
    guest_name: str
    host_name: str
    host_room_label: str
    guest_start_date: str
    guest_end_date: str
    payment_status: Literal["unpaid", "paid"]
    bucket: str


class GateGuestList(BaseModel):
    model_config = ConfigDict(extra="forbid")
    items: list[GateGuestCard]


class GateOccupancy(BaseModel):
    model_config = ConfigDict(extra="forbid")
    guests_in_hall_count: int
    guests_should_have_left_count: int


class GuestMovementResult(BaseModel):
    model_config = ConfigDict(extra="forbid")
    guest_name: str
    host_name: str
    host_room_label: str
    recorded_at: str
    message: str


def guests_in_hall_count(connection: sqlite3.Connection) -> int:
    row = connection.execute(
        """
        SELECT COUNT(*) AS n
        FROM guest_stays
        WHERE arrived_at IS NOT NULL AND departed_at IS NULL
        """
    ).fetchone()
    return int(row["n"])


def guests_should_have_left_count(connection: sqlite3.Connection, today: str) -> int:
    row = connection.execute(
        """
        SELECT COUNT(*) AS n
        FROM guest_stays
        WHERE arrived_at IS NOT NULL
          AND departed_at IS NULL
          AND guest_end_date < ?
        """,
        (today,),
    ).fetchone()
    return int(row["n"])


def _host_fields(connection: sqlite3.Connection, guest_stay_id: str) -> sqlite3.Row | None:
    return connection.execute(
        """
        SELECT
          guest_stays.id,
          guest_stays.guest_name,
          guest_stays.status,
          guest_stays.payment_status,
          guest_stays.guest_start_date,
          guest_stays.guest_end_date,
          guest_stays.arrived_at,
          guest_stays.departed_at,
          host.full_name AS host_name,
          rooms.label AS host_room_label
        FROM guest_stays
        JOIN users AS host ON host.id = guest_stays.host_resident_id
        JOIN residents ON residents.user_id = guest_stays.host_resident_id
        JOIN rooms ON rooms.id = residents.room_id
        WHERE guest_stays.id = ?
        """,
        (guest_stay_id,),
    ).fetchone()


@router.get("/occupancy", response_model=GateOccupancy)
def gate_occupancy(
    _account: GateDep,
    connection: ConnectionDep,
) -> GateOccupancy:
    today = hall_today(connection, clock.utc_now())
    return GateOccupancy(
        guests_in_hall_count=guests_in_hall_count(connection),
        guests_should_have_left_count=guests_should_have_left_count(connection, today),
    )


@router.get("/guests", response_model=GateGuestList)
def gate_guests(
    _account: GateDep,
    connection: ConnectionDep,
    bucket: Annotated[GateGuestBucket, Query()],
    payment_status: Annotated[Literal["paid", "unpaid"] | None, Query()] = None,
) -> GateGuestList:
    today = hall_today(connection, clock.utc_now())
    rows = connection.execute(
        """
        SELECT
          guest_stays.id,
          guest_stays.guest_name,
          guest_stays.status,
          guest_stays.payment_status,
          guest_stays.guest_start_date,
          guest_stays.guest_end_date,
          guest_stays.arrived_at,
          guest_stays.departed_at,
          host.full_name AS host_name,
          rooms.label AS host_room_label
        FROM guest_stays
        JOIN users AS host ON host.id = guest_stays.host_resident_id
        JOIN residents ON residents.user_id = guest_stays.host_resident_id
        JOIN rooms ON rooms.id = residents.room_id
        WHERE guest_stays.status = 'approved'
        ORDER BY guest_stays.guest_start_date, guest_stays.guest_name, guest_stays.id
        """
    ).fetchall()
    items: list[GateGuestCard] = []
    for row in rows:
        derived = derive_bucket(
            status=row["status"],
            payment_status=row["payment_status"],
            start_date=row["guest_start_date"],
            end_date=row["guest_end_date"],
            arrived_at=row["arrived_at"],
            departed_at=row["departed_at"],
            today=today,
        )
        if bucket == "expected":
            # Timing only: approved stay within dates, not yet arrived.
            if not (
                row["arrived_at"] is None
                and row["guest_start_date"] <= today <= row["guest_end_date"]
            ):
                continue
            card_bucket = "expected"
        else:
            # Dining set: arrived and not departed (includes should_have_left).
            if row["arrived_at"] is None or row["departed_at"] is not None:
                continue
            card_bucket = derived
        if payment_status is not None and row["payment_status"] != payment_status:
            continue
        items.append(
            GateGuestCard(
                id=row["id"],
                guest_name=row["guest_name"],
                host_name=row["host_name"],
                host_room_label=row["host_room_label"],
                guest_start_date=row["guest_start_date"],
                guest_end_date=row["guest_end_date"],
                payment_status=row["payment_status"],
                bucket=card_bucket,
            )
        )
    return GateGuestList(items=items)


@router.post("/guests/{guest_stay_id}/arrival", response_model=GuestMovementResult)
def record_guest_arrival(
    guest_stay_id: str,
    account: GateDep,
    connection: ConnectionDep,
) -> GuestMovementResult:
    row = _host_fields(connection, guest_stay_id)
    if row is None:
        raise ApiError(404, "not_found", "That record was not found.")
    today = hall_today(connection, clock.utc_now())
    if row["status"] != "approved" or row["arrived_at"] is not None:
        raise ApiError(
            409,
            "guest_not_expected",
            "That guest is not expected for arrival today.",
        )
    if not (row["guest_start_date"] <= today <= row["guest_end_date"]):
        raise ApiError(
            409,
            "guest_not_expected",
            "That guest is not expected for arrival today.",
        )
    if row["payment_status"] != "paid":
        raise ApiError(
            409,
            "payment_required",
            "Payment must be marked before this guest can enter.",
        )
    now_text = clock.format_instant(clock.utc_now())
    updated = connection.execute(
        """
        UPDATE guest_stays
        SET
          arrived_at = ?,
          arrived_recorded_by = ?,
          updated_at = ?
        WHERE id = ?
          AND status = 'approved'
          AND payment_status = 'paid'
          AND arrived_at IS NULL
          AND departed_at IS NULL
        RETURNING id, guest_name
        """,
        (now_text, account.id, now_text, guest_stay_id),
    ).fetchone()
    if updated is None:
        raise ApiError(
            409,
            "guest_not_expected",
            "That guest is not expected for arrival today.",
        )
    record_guest_stay(
        connection,
        now_text,
        account.id,
        "guest_stay.arrived",
        guest_stay_id,
        f"{account.full_name} recorded arrival for {updated['guest_name']}.",
    )
    return GuestMovementResult(
        guest_name=row["guest_name"],
        host_name=row["host_name"],
        host_room_label=row["host_room_label"],
        recorded_at=now_text,
        message="The guest is now in the hall.",
    )


@router.post("/guests/{guest_stay_id}/departure", response_model=GuestMovementResult)
def record_guest_departure(
    guest_stay_id: str,
    account: GateDep,
    connection: ConnectionDep,
) -> GuestMovementResult:
    row = _host_fields(connection, guest_stay_id)
    if row is None:
        raise ApiError(404, "not_found", "That record was not found.")
    if row["arrived_at"] is None or row["departed_at"] is not None or row["status"] not in {"approved", "pending"}:
        raise ApiError(
            409,
            "guest_not_in_hall",
            "That guest is not currently in the hall.",
        )
    now_text = clock.format_instant(clock.utc_now())
    updated = connection.execute(
        """
        UPDATE guest_stays
        SET
          status = 'departed',
          departed_at = ?,
          departed_recorded_by = ?,
          updated_at = ?
        WHERE id = ?
          AND status IN ('approved', 'pending')
          AND arrived_at IS NOT NULL
          AND departed_at IS NULL
        RETURNING id, guest_name
        """,
        (now_text, account.id, now_text, guest_stay_id),
    ).fetchone()
    if updated is None:
        raise ApiError(
            409,
            "guest_not_in_hall",
            "That guest is not currently in the hall.",
        )
    record_guest_stay(
        connection,
        now_text,
        account.id,
        "guest_stay.departed",
        guest_stay_id,
        f"{account.full_name} recorded departure for {updated['guest_name']}.",
    )
    return GuestMovementResult(
        guest_name=row["guest_name"],
        host_name=row["host_name"],
        host_room_label=row["host_room_label"],
        recorded_at=now_text,
        message="The guest has left the hall.",
    )
