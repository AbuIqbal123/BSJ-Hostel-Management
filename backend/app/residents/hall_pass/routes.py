"""The resident's hall pass, shown for one outing inside its window."""

from __future__ import annotations

from typing import Literal

from fastapi import APIRouter
from pydantic import BaseModel, ConfigDict

from app.residents.home.routes import ResidentDep
from app.residents.outings.usable import find_usable_outing
from app.shared import clock
from app.shared.auth.routes import ConnectionDep
from app.shared.db import hall_settings
from app.shared.errors import ApiError

router = APIRouter(prefix="/api/v1", tags=["Resident"])


class ResidentHallPass(BaseModel):
    model_config = ConfigDict(extra="forbid")
    qr_payload: str | None
    full_name: str
    room_label: str
    outing_id: str | None
    permission_id: str | None
    outing_type: Literal["ordinary", "late_night", "home_going"] | None
    place: str | None
    starts_at: str | None
    expected_return_at: str | None
    qr_visible: bool
    qr_visible_from: str | None
    qr_visible_until: str | None


@router.get("/me/hall-pass", response_model=ResidentHallPass)
def resident_hall_pass(account: ResidentDep, connection: ConnectionDep) -> ResidentHallPass:
    row = connection.execute(
        "SELECT qr_token FROM residents WHERE user_id = ?",
        (account.id,),
    ).fetchone()
    if row is None:
        raise ApiError(404, "not_found", "That record was not found.")
    lead = int(hall_settings(connection)["permission_lead_minutes"])
    usable = find_usable_outing(connection, account.id, clock.utc_now(), lead)
    shown = usable is not None and usable.is_open
    return ResidentHallPass(
        qr_payload=row["qr_token"] if shown else None,
        full_name=account.full_name,
        room_label=account.room_label,
        outing_id=None if usable is None else usable.outing_id,
        permission_id=None if usable is None else usable.permission_id,
        outing_type=None if usable is None else usable.outing_type,
        place=None if usable is None else usable.place,
        starts_at=None if usable is None else usable.starts_at,
        expected_return_at=None if usable is None else usable.expected_return_at,
        qr_visible=shown,
        qr_visible_from=None if usable is None else usable.visible_from,
        qr_visible_until=None if usable is None else usable.visible_until,
    )
