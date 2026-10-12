"""A resident deletes the account she created."""

from __future__ import annotations

import secrets
import sqlite3

from fastapi import APIRouter
from fastapi.responses import Response
from pydantic import BaseModel, ConfigDict, Field

from app.residents.home.routes import ResidentDep
from app.shared import clock
from app.shared.audit import record_audit
from app.shared.auth.routes import ConnectionDep
from app.shared.auth.security import hash_password, password_matches
from app.shared.errors import ApiError
from app.staff.office.records import revoke_live_sessions

router = APIRouter(prefix="/api/v1", tags=["Resident"])

_UTILITY_BLOCK_ID = "916c689d-598e-55b4-b3dc-fcf7120ca3b1"
_FORMER_ROOM_ID = "f0f0e200-0000-4000-8000-000000000001"
_OUTSIDE = "Return to the hall before deleting your account."
_GUEST = "A guest is still in the hall, so this account cannot be deleted yet."
_WRONG_PASSWORD = "The current password is wrong."


class DeleteAccountRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    password: str = Field(min_length=1, max_length=200)


def _former_room(connection: sqlite3.Connection) -> None:
    row = connection.execute(
        "SELECT id FROM rooms WHERE id = ?",
        (_FORMER_ROOM_ID,),
    ).fetchone()
    if row is not None:
        return
    connection.execute(
        """
        INSERT INTO rooms (id, block_id, number, label, bed_count, is_active)
        VALUES (?, ?, 'former', 'Utility-former', 100000, 0)
        """,
        (_FORMER_ROOM_ID, _UTILITY_BLOCK_ID),
    )


@router.post("/me/account/delete", status_code=204)
def delete_own_account(
    body: DeleteAccountRequest,
    account: ResidentDep,
    connection: ConnectionDep,
) -> Response:
    if not password_matches(account.password_hash, body.password):
        raise ApiError(401, "unauthenticated", _WRONG_PASSWORD)
    if account.presence == "outside":
        raise ApiError(409, "account_in_use", _OUTSIDE)
    outside = connection.execute(
        """
        SELECT 1 FROM outings
        WHERE resident_id = ? AND status = 'outside'
        """,
        (account.id,),
    ).fetchone()
    if outside is not None:
        raise ApiError(409, "account_in_use", _OUTSIDE)
    guest = connection.execute(
        """
        SELECT 1 FROM guest_stays
        WHERE host_resident_id = ?
          AND arrived_at IS NOT NULL
          AND departed_at IS NULL
        """,
        (account.id,),
    ).fetchone()
    if guest is not None:
        raise ApiError(409, "account_in_use", _GUEST)

    now_text = clock.format_instant(clock.utc_now())
    connection.execute(
        """
        UPDATE outings
        SET status = 'cancelled', cancelled_at = ?, updated_at = ?
        WHERE resident_id = ? AND status = 'planned'
        """,
        (now_text, now_text, account.id),
    )
    connection.execute(
        """
        UPDATE permissions
        SET status = 'cancelled', updated_at = ?
        WHERE resident_id = ? AND status IN ('pending', 'approved')
        """,
        (now_text, account.id),
    )
    connection.execute(
        """
        UPDATE guest_stays
        SET
          status = 'cancelled',
          decided_by = NULL,
          decided_at = NULL,
          decision_note = NULL,
          updated_at = ?
        WHERE host_resident_id = ?
          AND arrived_at IS NULL
          AND departed_at IS NULL
          AND status IN ('pending', 'approved')
        """,
        (now_text, account.id),
    )
    revoke_live_sessions(connection, account.id, now_text)
    _former_room(connection)
    retired = f"deleted-{account.id}"
    connection.execute(
        """
        UPDATE users
        SET
          username = ?,
          full_name = 'Deleted account',
          password_hash = ?,
          status = 'suspended',
          updated_at = ?
        WHERE id = ?
        """,
        (retired, hash_password(secrets.token_urlsafe(32)), now_text, account.id),
    )
    connection.execute(
        """
        UPDATE residents
        SET
          enrolment_number = ?,
          course = NULL,
          room_id = ?,
          guardian_name = 'Deleted',
          guardian_phone = '+910000000000',
          phone = NULL,
          qr_token = ?,
          presence = 'inside',
          updated_at = ?
        WHERE user_id = ?
        """,
        (
            retired,
            _FORMER_ROOM_ID,
            f"bsj:v1:{secrets.token_urlsafe(32)}",
            now_text,
            account.id,
        ),
    )
    record_audit(
        connection,
        now_text,
        account.id,
        "resident.deleted",
        "person",
        account.id,
        "The resident deleted her account.",
    )
    return Response(status_code=204)
