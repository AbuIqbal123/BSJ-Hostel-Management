"""The resident's hall pass, shown for one outing inside its window."""

from __future__ import annotations

import sqlite3

from fastapi import APIRouter
from pydantic import BaseModel, ConfigDict

from app.residents.home.routes import ResidentDep
from app.residents.outings.records import qr_window
from app.shared import clock
from app.shared.auth.routes import ConnectionDep
from app.shared.errors import ApiError

router = APIRouter(prefix="/api/v1", tags=["Resident"])


class ResidentHallPass(BaseModel):
    model_config = ConfigDict(extra="forbid")
    qr_payload: str | None
    full_name: str
    room_label: str
    outing_id: str | None
    qr_visible: bool
    qr_visible_from: str | None
    qr_visible_until: str | None


def _pass(
    *,
    token: str | None,
    full_name: str,
    room_label: str,
    outing_id: str | None,
    qr_visible: bool,
    qr_visible_from: str | None,
    qr_visible_until: str | None,
) -> ResidentHallPass:
    return ResidentHallPass(
        qr_payload=token if qr_visible else None,
        full_name=full_name,
        room_label=room_label,
        outing_id=outing_id,
        qr_visible=qr_visible,
        qr_visible_from=qr_visible_from,
        qr_visible_until=qr_visible_until,
    )


@router.get("/me/hall-pass", response_model=ResidentHallPass)
def resident_hall_pass(account: ResidentDep, connection: ConnectionDep) -> ResidentHallPass:
    row = connection.execute(
        """
        SELECT residents.qr_token, users.full_name, rooms.label AS room_label
        FROM residents
        JOIN users ON users.id = residents.user_id
        JOIN rooms ON rooms.id = residents.room_id
        WHERE residents.user_id = ?
        """,
        (account.id,),
    ).fetchone()
    if row is None:
        raise ApiError(404, "not_found", "That record was not found.")
    now = clock.utc_now()
    outings = connection.execute(
        """
        SELECT id, type, status, starts_at, expected_return_at, exited_at
        FROM outings
        WHERE resident_id = ? AND status IN ('planned', 'outside')
        ORDER BY expected_return_at, id
        """,
        (account.id,),
    ).fetchall()
    token = row["qr_token"]
    name = row["full_name"]
    room = row["room_label"]

    open_ordinary: list[tuple[sqlite3.Row, str | None, str | None]] = []
    for outing in outings:
        if outing["type"] != "ordinary":
            continue
        visible, visible_from, visible_until = qr_window(
            outing_type=outing["type"],
            status=outing["status"],
            starts_at=outing["starts_at"],
            expected_return_at=outing["expected_return_at"],
            exited_at=outing["exited_at"],
            now=now,
        )
        if visible:
            open_ordinary.append((outing, visible_from, visible_until))
    if open_ordinary:
        open_ordinary.sort(
            key=lambda item: (
                0 if item[0]["status"] == "outside" else 1,
                item[0]["expected_return_at"],
                item[0]["id"],
            )
        )
        outing, visible_from, visible_until = open_ordinary[0]
        return _pass(
            token=token,
            full_name=name,
            room_label=room,
            outing_id=outing["id"],
            qr_visible=True,
            qr_visible_from=visible_from,
            qr_visible_until=visible_until,
        )

    outside = next((outing for outing in outings if outing["status"] == "outside"), None)
    if outside is not None:
        return _pass(
            token=token,
            full_name=name,
            room_label=room,
            outing_id=outside["id"],
            qr_visible=True,
            qr_visible_from=outside["exited_at"],
            qr_visible_until=None,
        )

    waiting = [
        outing
        for outing in outings
        if outing["type"] == "ordinary" and outing["status"] == "planned" and outing["starts_at"]
    ]
    if waiting:
        waiting.sort(key=lambda outing: (outing["starts_at"], outing["id"]))
        outing = waiting[0]
        _visible, visible_from, visible_until = qr_window(
            outing_type=outing["type"],
            status=outing["status"],
            starts_at=outing["starts_at"],
            expected_return_at=outing["expected_return_at"],
            exited_at=outing["exited_at"],
            now=now,
        )
        return _pass(
            token=token,
            full_name=name,
            room_label=room,
            outing_id=outing["id"],
            qr_visible=False,
            qr_visible_from=visible_from,
            qr_visible_until=visible_until,
        )

    return _pass(
        token=token,
        full_name=name,
        room_label=room,
        outing_id=None,
        qr_visible=False,
        qr_visible_from=None,
        qr_visible_until=None,
    )
