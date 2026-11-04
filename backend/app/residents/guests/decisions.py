"""Roommate resolution and append-only guest-stay decisions."""

from __future__ import annotations

import sqlite3
import uuid
from typing import Literal

from app.shared.db import INTEGRITY_ERRORS

StayStatus = Literal["pending", "approved", "rejected"]


class DuplicateDecisionError(Exception):
    """This person already recorded this role on this stay.

    Routes map this to 409. The first row is left as it is.
    """


class GuestStayNotFoundError(Exception):
    """No guest stay has this id."""


class StayNotPendingError(Exception):
    """Only a pending guest stay can take a decision."""


def active_roommate_user_ids(
    connection: sqlite3.Connection, host_resident_id: str
) -> list[str]:
    rows = connection.execute(
        """
        SELECT roommates.user_id
        FROM residents AS host
        JOIN residents AS roommates
          ON roommates.room_id = host.room_id
         AND roommates.user_id <> host.user_id
        JOIN users ON users.id = roommates.user_id
        WHERE host.user_id = ?
          AND users.status = 'active'
        ORDER BY roommates.user_id
        """,
        (host_resident_id,),
    ).fetchall()
    return [row[0] for row in rows]


def apply_decision(
    connection: sqlite3.Connection,
    *,
    guest_stay_id: str,
    actor_user_id: str,
    role: str,
    decision: str,
    note: str | None,
    now_text: str,
) -> StayStatus:
    """Append one decision and move the stay when the required yeses or a no are in."""
    stay = connection.execute(
        """
        SELECT host_resident_id, status
        FROM guest_stays
        WHERE id = ?
        """,
        (guest_stay_id,),
    ).fetchone()
    if stay is None:
        raise GuestStayNotFoundError("That guest stay was not found.")
    host_resident_id, status = stay[0], stay[1]
    if status != "pending":
        raise StayNotPendingError("Only a pending guest stay can be decided.")
    if _already_decided(connection, guest_stay_id, actor_user_id, role):
        raise DuplicateDecisionError(
            "This person already recorded a decision for this stay in this role."
        )
    stored_note = _clean_note(note)
    try:
        connection.execute(
            """
            INSERT INTO guest_stay_decisions (
              id, guest_stay_id, actor_user_id, role, decision, note, decided_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                str(uuid.uuid4()),
                guest_stay_id,
                actor_user_id,
                role,
                decision,
                stored_note,
                now_text,
            ),
        )
    except INTEGRITY_ERRORS as exc:
        if _already_decided(connection, guest_stay_id, actor_user_id, role):
            raise DuplicateDecisionError(
                "This person already recorded a decision for this stay in this role."
            ) from exc
        raise
    if decision == "rejected":
        _reject(connection, guest_stay_id, role, actor_user_id, stored_note, now_text)
        return "rejected"
    provost = _approving_provost(connection, guest_stay_id)
    if provost is not None and _roommates_have_approved(
        connection, guest_stay_id, host_resident_id
    ):
        _mark_approved(connection, guest_stay_id, provost[0], provost[1], now_text)
        return "approved"
    return "pending"


def _clean_note(note: str | None) -> str | None:
    if note is None:
        return None
    stripped = note.strip()
    if stripped == "":
        return None
    return stripped


def _already_decided(
    connection: sqlite3.Connection,
    guest_stay_id: str,
    actor_user_id: str,
    role: str,
) -> bool:
    row = connection.execute(
        """
        SELECT 1
        FROM guest_stay_decisions
        WHERE guest_stay_id = ? AND actor_user_id = ? AND role = ?
        """,
        (guest_stay_id, actor_user_id, role),
    ).fetchone()
    return row is not None


def _reject(
    connection: sqlite3.Connection,
    guest_stay_id: str,
    role: str,
    actor_user_id: str,
    note: str | None,
    now_text: str,
) -> None:
    if role == "provost":
        connection.execute(
            """
            UPDATE guest_stays
            SET status = 'rejected',
                decided_by = ?,
                decided_at = ?,
                decision_note = ?,
                updated_at = ?
            WHERE id = ? AND status = 'pending'
            """,
            (actor_user_id, now_text, note, now_text, guest_stay_id),
        )
        return
    connection.execute(
        """
        UPDATE guest_stays
        SET status = 'rejected',
            decided_by = NULL,
            decided_at = NULL,
            updated_at = ?
        WHERE id = ? AND status = 'pending'
        """,
        (now_text, guest_stay_id),
    )


def _approving_provost(
    connection: sqlite3.Connection, guest_stay_id: str
) -> tuple | None:
    return connection.execute(
        """
        SELECT actor_user_id, note
        FROM guest_stay_decisions
        WHERE guest_stay_id = ?
          AND role = 'provost'
          AND decision = 'approved'
        ORDER BY decided_at
        LIMIT 1
        """,
        (guest_stay_id,),
    ).fetchone()


def _mark_approved(
    connection: sqlite3.Connection,
    guest_stay_id: str,
    provost_user_id: str,
    note: str | None,
    now_text: str,
) -> None:
    connection.execute(
        """
        UPDATE guest_stays
        SET status = 'approved',
            decided_by = ?,
            decided_at = ?,
            decision_note = ?,
            updated_at = ?
        WHERE id = ? AND status = 'pending'
        """,
        (provost_user_id, now_text, note, now_text, guest_stay_id),
    )


def _roommates_have_approved(
    connection: sqlite3.Connection,
    guest_stay_id: str,
    host_resident_id: str,
) -> bool:
    required = active_roommate_user_ids(connection, host_resident_id)
    if not required:
        return True
    rows = connection.execute(
        """
        SELECT actor_user_id
        FROM guest_stay_decisions
        WHERE guest_stay_id = ?
          AND role = 'roommate'
          AND decision = 'approved'
        """,
        (guest_stay_id,),
    ).fetchall()
    approved = {row[0] for row in rows}
    return set(required) <= approved
