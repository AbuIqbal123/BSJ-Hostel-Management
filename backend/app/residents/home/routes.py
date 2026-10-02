"""What the resident sees when she opens the phone."""

from __future__ import annotations

import sqlite3
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, ConfigDict

from app.shared import clock
from app.shared.auth.routes import Account, AccountDep, ConnectionDep, ResidentSummary
from app.shared.errors import ApiError
from app.residents.outings.records import OutingBody, expire_passed_plans, load_current_outing
from app.residents.permissions.records import PermissionBody, expire_passed_permissions

router = APIRouter(prefix="/api/v1", tags=["Resident"])


class HistoryEvent(BaseModel):
    model_config = ConfigDict(extra="forbid")
    event: Literal["exited", "returned"]
    place: str
    occurred_at: str
    outing_id: str


class HistoryPage(BaseModel):
    model_config = ConfigDict(extra="forbid")
    total: int
    limit: int
    offset: int
    items: list[HistoryEvent]


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
        permission_type=row["type"],
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


_HISTORY_EVENTS_SQL = """
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
"""


def load_history(
    connection: sqlite3.Connection,
    resident_id: str,
    *,
    limit: int,
    offset: int,
) -> HistoryPage:
    total = connection.execute(
        f"SELECT COUNT(*) AS n FROM ({_HISTORY_EVENTS_SQL})",
        (resident_id, resident_id),
    ).fetchone()["n"]
    rows = connection.execute(
        f"""
        {_HISTORY_EVENTS_SQL}
        ORDER BY occurred_at DESC, CASE event WHEN 'returned' THEN 0 ELSE 1 END, outing_id DESC
        LIMIT ? OFFSET ?
        """,
        (resident_id, resident_id, limit, offset),
    ).fetchall()
    return HistoryPage(
        total=total,
        limit=limit,
        offset=offset,
        items=[
            HistoryEvent(
                event=row["event"],
                place=row["place"],
                occurred_at=row["occurred_at"],
                outing_id=row["outing_id"],
            )
            for row in rows
        ],
    )


def _recent_history(connection: sqlite3.Connection, resident_id: str) -> list[HistoryEvent]:
    return load_history(connection, resident_id, limit=10, offset=0).items


@router.get("/me/home", response_model=ResidentHome)
def resident_home(account: ResidentDep, connection: ConnectionDep) -> ResidentHome:
    now = clock.utc_now()
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


@router.get("/me/history", response_model=HistoryPage)
def resident_history(
    account: ResidentDep,
    connection: ConnectionDep,
    limit: Annotated[int, Query(ge=1, le=500)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> HistoryPage:
    return load_history(connection, account.id, limit=limit, offset=offset)


class ExpirePassedResult(BaseModel):
    model_config = ConfigDict(extra="forbid")
    plans_expired: int
    permissions_expired: int


@router.post("/me/expire-passed", response_model=ExpirePassedResult)
def expire_own_passed(account: ResidentDep, connection: ConnectionDep) -> ExpirePassedResult:
    now_text = clock.format_instant(clock.utc_now())
    plans = expire_passed_plans(connection, account.id, now_text)
    permissions = expire_passed_permissions(connection, now_text, resident_id=account.id)
    connection.commit()
    return ExpirePassedResult(plans_expired=plans, permissions_expired=permissions)
