"""Office password reset."""

from __future__ import annotations

import json

from fastapi import APIRouter, Response
from pydantic import BaseModel, ConfigDict

from app.shared import clock
from app.shared.audit import record_audit
from app.shared.auth.password_rules import StrongPassword
from app.shared.auth.roles import can_act_on_target
from app.shared.auth.routes import ConnectionDep
from app.shared.auth.security import hash_password
from app.shared.errors import ApiError
from app.staff.office.records import revoke_live_sessions
from app.staff.office.routes import OfficeDep

router = APIRouter(prefix="/api/v1/admin", tags=["Hall office"])


class PasswordResetRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    temporary_password: StrongPassword


@router.post("/users/{user_id}/password", status_code=204)
def reset_password(
    user_id: str,
    body: PasswordResetRequest,
    account: OfficeDep,
    connection: ConnectionDep,
) -> Response:
    row = connection.execute(
        "SELECT id, role, full_name, username FROM users WHERE id = ?",
        (user_id,),
    ).fetchone()
    if row is None:
        raise ApiError(404, "not_found", "That record was not found.")
    target_id, target_role, target_name, target_username = row
    if not can_act_on_target(account.role, target_role):
        raise ApiError(403, "forbidden", "This account cannot do that.")
    now_text = clock.format_instant(clock.utc_now())
    connection.execute(
        """
        UPDATE users
        SET password_hash = ?, updated_at = ?
        WHERE id = ?
        """,
        (hash_password(body.temporary_password), now_text, target_id),
    )
    revoke_live_sessions(connection, target_id, now_text)
    record_audit(
        connection,
        now_text,
        account.id,
        "user.password_reset",
        "person",
        target_id,
        f"{account.full_name} reset the password for {target_name}.",
        json.dumps(
            {
                "actor_user_id": account.id,
                "target_user_id": target_id,
                "target_username": target_username,
                "target_role": target_role,
            },
            sort_keys=True,
        ),
    )
    return Response(status_code=204)
