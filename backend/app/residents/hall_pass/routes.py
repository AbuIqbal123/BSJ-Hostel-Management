"""The resident's permanent hall pass."""

from __future__ import annotations

from fastapi import APIRouter
from app.residents.home.routes import ResidentDep
from app.shared.auth.routes import ConnectionDep
from app.shared.errors import ApiError
from app.shared.schemas import HallPass

router = APIRouter(prefix="/api/v1", tags=["Resident"])


@router.get("/me/hall-pass", response_model=HallPass)
def resident_hall_pass(account: ResidentDep, connection: ConnectionDep) -> HallPass:
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
    return HallPass(
        qr_payload=row["qr_token"],
        full_name=row["full_name"],
        room_label=row["room_label"],
    )
