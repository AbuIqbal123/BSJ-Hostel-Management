"""What the resident sees when she opens the phone."""

from __future__ import annotations

import sqlite3
from typing import Annotated, Literal

from fastapi import APIRouter, Depends
from pydantic import BaseModel, ConfigDict

from app.shared import clock
from app.shared.auth.routes import Account, AccountDep, ConnectionDep, ResidentSummary
from app.shared.errors import ApiError
from app.residents.outings.records import OutingBody, expire_passed_plans, load_current_outing

router = APIRouter(prefix="/api/v1", tags=["Resident"])


class HistoryEvent(BaseModel):
    model_config = ConfigDict(extra="forbid")
    event: Literal["exited", "returned"]
    place: str
    occurred_at: str
    outing_id: str


class PermissionBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: str
    type: Literal["late_night", "home_going"]
    status: Literal[
        "pending",
        "approved",
        "rejected",
        "cancelled",
        "in_use",
        "completed",
        "expired",
    ]
    short_place: str
    destination_detail: str | None
    address: str | None
    reason: str
    departure_at: str
    expected_return_at: str
    decision_note: str | None
    decided_at: str | None
    created_at: str


class ResidentHome(BaseModel):
    model_config = ConfigDict(extra="forbid")
    resident: ResidentSummary
    current_outing: OutingBody | None
    active_permission: PermissionBody | None
    recent_history: list[HistoryEvent]


def resident_account(account: AccountDep) -> Account:
    if account.role != "resident":
        raise ApiError(403, "forbidden", "This account cannot do that.")
    return account


ResidentDep = Annotated[Account, Depends(resident_account)]


def _active_permission(connection: sqlite3.Connection, resident_id: str) -> PermissionBody | None:
    row = connection.execute(
        """
        SELECT
          id, type, status, short_place, destination_detail, address, reason,
          departure_at, expected_return_at, decision_note, decided_at, created_at
        FROM permissions
        WHERE resident_id = ? AND status IN ('pending', 'approved', 'in_use')
        ORDER BY created_at DESC, id DESC
        LIMIT 1
        """,
        (resident_id,),
    ).fetchone()
    if row is None:
        return None
    return PermissionBody(
        id=row["id"],
        type=row["type"],
        status=row["status"],
        short_place=row["short_place"],
        destination_detail=row["destination_detail"],
        address=row["address"],
        reason=row["reason"],
        departure_at=row["departure_at"],
        expected_return_at=row["expected_return_at"],
        decision_note=row["decision_note"],
        decided_at=row["decided_at"],
        created_at=row["created_at"],
    )


def _recent_history(connection: sqlite3.Connection, resident_id: str) -> list[HistoryEvent]:
    rows = connection.execute(
        """
        SELECT event, place, occurred_at, outing_id
        FROM (
          SELECT
            'exited' AS event,
            place,
            exited_at AS occurred_at,
            id AS outing_id
          FROM outings
          WHERE resident_id = ? AND exited_at IS NOT NULL
          UNION ALL
          SELECT
            'returned',
            place,
            returned_at,
            id
          FROM outings
          WHERE resident_id = ? AND returned_at IS NOT NULL
        )
        ORDER BY occurred_at DESC, CASE event WHEN 'returned' THEN 0 ELSE 1 END, outing_id DESC
        LIMIT 10
        """,
        (resident_id, resident_id),
    ).fetchall()
    return [
        HistoryEvent(
            event=row["event"],
            place=row["place"],
            occurred_at=row["occurred_at"],
            outing_id=row["outing_id"],
        )
        for row in rows
    ]


@router.get("/me/home", response_model=ResidentHome)
def resident_home(account: ResidentDep, connection: ConnectionDep) -> ResidentHome:
    now = clock.utc_now()
    expire_passed_plans(connection, account.id, clock.format_instant(now))
    return ResidentHome(
        resident=ResidentSummary.model_validate(
            {
                "enrolment_number": account.enrolment_number,
                "course": account.course,
                "room_label": account.room_label,
                "block_name": account.block_name,
                "presence": account.presence,
            }
        ),
        current_outing=load_current_outing(connection, account.id, now),
        active_permission=_active_permission(connection, account.id),
        recent_history=_recent_history(connection, account.id),
    )
