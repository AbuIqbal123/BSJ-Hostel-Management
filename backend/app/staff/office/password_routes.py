"""Provost password reset."""

from __future__ import annotations

from fastapi import APIRouter, Response
from pydantic import BaseModel, ConfigDict, Field

from app.shared import clock
from app.shared.auth.routes import ConnectionDep
from app.shared.auth.security import hash_password
from app.shared.errors import ApiError
from app.staff.office.records import revoke_live_sessions
from app.staff.office.routes import ProvostDep

router = APIRouter(prefix="/api/v1/admin", tags=["Hall office"])


class PasswordResetRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    temporary_password: str = Field(min_length=10, max_length=200)


@router.post("/users/{user_id}/password", status_code=204)
def reset_password(
    user_id: str,
    body: PasswordResetRequest,
    _account: ProvostDep,
    connection: ConnectionDep,
) -> Response:
    row = connection.execute(
        "SELECT id FROM users WHERE id = ?",
        (user_id,),
    ).fetchone()
    if row is None:
        raise ApiError(404, "not_found", "That record was not found.")
    now_text = clock.format_instant(clock.utc_now())
    connection.execute(
        """
        UPDATE users
        SET password_hash = ?, updated_at = ?
        WHERE id = ?
        """,
        (hash_password(body.temporary_password), now_text, user_id),
    )
    revoke_live_sessions(connection, user_id, now_text)
    connection.commit()
    return Response(status_code=204)
