"""What the resident sees when she opens the phone."""

from __future__ import annotations

from datetime import date
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, ConfigDict

from app.shared.page import PageDep
from app.shared import clock
from app.shared.auth.roles import RESIDENT, require_roles
from app.shared.auth.routes import Account, ConnectionDep
from app.shared.db import hall_settings
from app.shared.inbox import decode_cursor, encode_cursor
from app.residents.outings.records import OutingBody, UpcomingOuting, expire_passed_plans, load_current_outing, load_upcoming_outings, ordinary_window_is_open
from app.residents.permissions.records import PermissionBody, expire_passed_permissions
from app.residents.home.records import (
    HistoryEvent,
    HistoryItem,
    HistoryKind,
    active_permission,
    covers_hall_day,
    hall_pass_outing_type,
    history_items,
    overlaps_range,
    recent_history,
)

router = APIRouter(prefix="/api/v1", tags=["Resident"])


class HistoryList(BaseModel):
    model_config = ConfigDict(extra="forbid")
    items: list[HistoryItem]
    next_cursor: str | None = None


class HomeResident(BaseModel):
    model_config = ConfigDict(extra="forbid")
    full_name: str
    enrolment_number: str
    course: str | None
    room_label: str
    block_name: str
    presence: Literal["inside", "outside"]
    hall_name: str
    permissions_requested: int
    permissions_rejected: int
    ordinary_returns: int
    late_night_returns: int
    home_going_returns: int
    guest_stays: int


class OrdinaryHours(BaseModel):
    model_config = ConfigDict(extra="forbid")
    summer_outing_start: str
    summer_outing_end: str
    winter_outing_start: str
    winter_outing_end: str
    summer_season_start: str
    winter_season_start: str


class ResidentHome(BaseModel):
    model_config = ConfigDict(extra="forbid")
    resident: HomeResident
    ordinary_outing_active: bool
    ordinary_hours: OrdinaryHours
    hall_pass_outing_type: Literal["ordinary", "late_night", "home_going"] | None
    current_outing: OutingBody | None
    upcoming_outings: list[UpcomingOuting]
    active_permission: PermissionBody | None
    recent_history: list[HistoryEvent]
    notifications_unread: bool
    notifications_unread_count: int


resident_account = require_roles(RESIDENT)


ResidentDep = Annotated[Account, Depends(resident_account)]


@router.get("/me/home", response_model=ResidentHome)
def resident_home(account: ResidentDep, connection: ConnectionDep) -> ResidentHome:
    now = clock.utc_now()
    settings = hall_settings(connection)
    counts = connection.execute(
        """
        SELECT
          (SELECT COUNT(*) FROM permissions WHERE resident_id = ?) AS permissions_requested,
          (SELECT COUNT(*) FROM permissions
            WHERE resident_id = ? AND status = 'rejected') AS permissions_rejected,
          (SELECT COUNT(*) FROM outings
            WHERE resident_id = ? AND type = 'ordinary' AND returned_at IS NOT NULL)
            AS ordinary_returns,
          (SELECT COUNT(*) FROM outings
            WHERE resident_id = ? AND type = 'late_night' AND returned_at IS NOT NULL)
            AS late_night_returns,
          (SELECT COUNT(*) FROM outings
            WHERE resident_id = ? AND type = 'home_going' AND returned_at IS NOT NULL)
            AS home_going_returns,
          (SELECT COUNT(*) FROM guest_stays WHERE host_resident_id = ?) AS guest_stays
        """,
        (account.id, account.id, account.id, account.id, account.id, account.id),
    ).fetchone()
    unread = connection.execute(
        "SELECT COUNT(*) FROM resident_notifications WHERE resident_id = ? AND read_at IS NULL",
        (account.id,),
    ).fetchone()[0]
    return ResidentHome(
        resident=HomeResident(
            full_name=account.full_name,
            enrolment_number=account.enrolment_number or "",
            course=account.course,
            room_label=account.room_label or "",
            block_name=account.block_name or "",
            presence=account.presence or "inside",
            hall_name=str(settings["hall_name"]),
            permissions_requested=int(counts["permissions_requested"]),
            permissions_rejected=int(counts["permissions_rejected"]),
            ordinary_returns=int(counts["ordinary_returns"]),
            late_night_returns=int(counts["late_night_returns"]),
            home_going_returns=int(counts["home_going_returns"]),
            guest_stays=int(counts["guest_stays"]),
        ),
        ordinary_outing_active=ordinary_window_is_open(connection, account.id, now),
        ordinary_hours=OrdinaryHours(
            summer_outing_start=str(settings["summer_outing_start"]),
            summer_outing_end=str(settings["summer_outing_end"]),
            winter_outing_start=str(settings["winter_outing_start"]),
            winter_outing_end=str(settings["winter_outing_end"]),
            summer_season_start=str(settings["summer_season_start"]),
            winter_season_start=str(settings["winter_season_start"]),
        ),
        hall_pass_outing_type=hall_pass_outing_type(connection, account.id, now),
        current_outing=load_current_outing(connection, account.id, now),
        upcoming_outings=load_upcoming_outings(connection, account.id, now),
        active_permission=active_permission(connection, account.id),
        recent_history=recent_history(connection, account.id),
        notifications_unread=unread > 0,
        notifications_unread_count=unread,
    )


@router.get("/me/history", response_model=HistoryList)
def resident_history(
    account: ResidentDep,
    connection: ConnectionDep,
    page: PageDep,
    kind: Annotated[HistoryKind | None, Query()] = None,
    on: Annotated[date | None, Query()] = None,
    from_day: Annotated[date | None, Query(alias="from")] = None,
    to_day: Annotated[date | None, Query(alias="to")] = None,
    cursor: Annotated[str | None, Query(max_length=200)] = None,
) -> HistoryList:
    limit = page.limit
    now = clock.utc_now()
    today = clock.hall_local_date(now)
    items = history_items(
        connection,
        account.id,
        now_text=clock.format_instant(now),
        today=today,
    )
    if kind is not None and kind != "all":
        items = [item for item in items if item.kind == kind]
    if on is not None:
        items = [
            item
            for item in items
            if covers_hall_day(item.started_at, item.ended_at, on)
        ]
    if from_day is not None or to_day is not None:
        items = [
            item
            for item in items
            if overlaps_range(item.started_at, item.ended_at, from_day, to_day)
        ]
    if cursor:
        after = decode_cursor(cursor)
        items = [item for item in items if (item.ended_at, item.id) < after]
    page_items = items[:limit]
    next_cursor = (
        encode_cursor(page_items[-1].ended_at, page_items[-1].id)
        if len(items) > limit
        else None
    )
    return HistoryList(items=page_items, next_cursor=next_cursor)


class ExpirePassedResult(BaseModel):
    model_config = ConfigDict(extra="forbid")
    plans_expired: int
    permissions_expired: int


@router.post("/me/expire-passed", response_model=ExpirePassedResult)
def expire_own_passed(account: ResidentDep, connection: ConnectionDep) -> ExpirePassedResult:
    now_text = clock.format_instant(clock.utc_now())
    plans = expire_passed_plans(connection, account.id, now_text)
    permissions = expire_passed_permissions(connection, now_text, resident_id=account.id)
    return ExpirePassedResult(plans_expired=plans, permissions_expired=permissions)
