"""Required roommates, and recording a decision that promotes the stay (no HTTP)."""

from __future__ import annotations

import sqlite3
from pathlib import Path

import pytest

from app.residents.guests.decisions import (
    DuplicateDecisionError,
    GuestStayNotFoundError,
    StayNotPendingError,
    active_roommate_user_ids,
    apply_decision,
)
from app.shared.db import INTEGRITY_ERRORS

BLOCK_B = "d032aad6-a203-5ea0-ba9a-3a9257edbfc8"
HOST_ID = "b22de000-0000-4000-8000-000000000002"
ROOMMATE_ID = "b22de000-0000-4000-8000-000000000012"
ROOMMATE_B = "b22de000-0000-4000-8000-000000000014"
SUSPENDED_ID = "b22de000-0000-4000-8000-000000000013"
SOLO_ID = "c44ef000-0000-4000-8000-000000000009"
PROVOST_ID = "f66ab000-0000-4000-8000-000000000006"
UNKNOWN_ID = "b22de000-0000-4000-8000-000000000099"
ROOM_ID = "d4400000-0000-4000-8000-000000000004"
OTHER_ROOM = "d4400000-0000-4000-8000-000000000005"
SPARE_ROOM = "d4400000-0000-4000-8000-000000000006"
STAY_ID = "aa220000-0000-4000-8000-0000000000a1"
MISSING_STAY = "aa220000-0000-4000-8000-0000000000a9"
CREATED = "2026-09-30T00:00:00Z"
NOW = "2026-10-01T04:00:00Z"
LATER = "2026-10-01T05:00:00Z"
LATER_STILL = "2026-10-01T06:00:00Z"


def _seed(path: Path) -> None:
    connection = sqlite3.connect(path)
    try:
        connection.execute("PRAGMA foreign_keys=ON;")
        connection.execute(
            """
            INSERT INTO rooms (id, block_id, number, label, bed_count, is_active)
            VALUES
              (?, ?, '204', 'B-204', 4, 1),
              (?, ?, '205', 'B-205', 2, 1),
              (?, ?, '206', 'B-206', 2, 1)
            """,
            (ROOM_ID, BLOCK_B, OTHER_ROOM, BLOCK_B, SPARE_ROOM, BLOCK_B),
        )
        people = (
            (HOST_ID, "24-GLLB-118", "Aisha Khan", "active", ROOM_ID, "Rashid Khan", "+919876543210"),
            (ROOMMATE_ID, "24-BA-014", "Zaynab Ali", "active", ROOM_ID, "Imran Ali", "+919876543212"),
            (
                ROOMMATE_B,
                "24-BA-016",
                "Nadira Qureshi",
                "active",
                ROOM_ID,
                "Salim Qureshi",
                "+919876543214",
            ),
            (
                SUSPENDED_ID,
                "24-BA-015",
                "Hiba Noor",
                "suspended",
                ROOM_ID,
                "Farhan Noor",
                "+919876543213",
            ),
            (SOLO_ID, "24-BA-002", "Maryam Siddiqui", "active", OTHER_ROOM, "Yusuf Siddiqui", "+919876543211"),
        )
        for user_id, username, full_name, status, room_id, guardian, phone in people:
            connection.execute(
                """
                INSERT INTO users (
                  id, role, username, full_name, password_hash, status, created_at, updated_at
                ) VALUES (?, 'resident', ?, ?, '$argon2id$test', ?, ?, ?)
                """,
                (user_id, username, full_name, status, CREATED, CREATED),
            )
            connection.execute(
                """
                INSERT INTO residents (
                  user_id, enrolment_number, course, room_id, guardian_name, guardian_phone,
                  qr_token, presence, created_at, updated_at
                ) VALUES (?, ?, 'B.A.', ?, ?, ?, ?, 'inside', ?, ?)
                """,
                (
                    user_id,
                    username,
                    room_id,
                    guardian,
                    phone,
                    f"bsj:v1:test-{username}",
                    CREATED,
                    CREATED,
                ),
            )
        connection.execute(
            """
            INSERT INTO users (
              id, role, username, full_name, password_hash, status, created_at, updated_at
            ) VALUES (?, 'provost', 'provost.halima', 'Halima Begum', '$argon2id$test', 'active', ?, ?)
            """,
            (PROVOST_ID, CREATED, CREATED),
        )
        connection.execute(
            "INSERT INTO staff (user_id, job_title) VALUES (?, 'Provost')",
            (PROVOST_ID,),
        )
        connection.commit()
    finally:
        connection.close()


def _open(path: Path) -> sqlite3.Connection:
    from app.shared.migrate import migrate

    migrate()
    _seed(path)
    connection = sqlite3.connect(path)
    connection.execute("PRAGMA foreign_keys=ON;")
    return connection


def _park_second_roommate(connection: sqlite3.Connection) -> None:
    connection.execute(
        "UPDATE residents SET room_id = ?, updated_at = ? WHERE user_id = ?",
        (SPARE_ROOM, CREATED, ROOMMATE_B),
    )


def _insert_stay(connection: sqlite3.Connection, stay_id: str, host_id: str) -> None:
    connection.execute(
        """
        INSERT INTO guest_stays (
          id, host_resident_id, guest_name, relation, guest_start_date, guest_end_date, reason,
          status, payment_status, created_at, updated_at
        ) VALUES (
          ?, ?, 'Amina Yusuf', 'Cousin', '2026-10-10', '2026-10-12', 'Family visit.',
          'pending', 'unpaid', ?, ?
        )
        """,
        (stay_id, host_id, CREATED, CREATED),
    )


def _parent(connection: sqlite3.Connection, stay_id: str) -> tuple:
    return connection.execute(
        """
        SELECT status, decided_by, decided_at, decision_note, updated_at
        FROM guest_stays
        WHERE id = ?
        """,
        (stay_id,),
    ).fetchone()


def _rows(connection: sqlite3.Connection, stay_id: str) -> list[tuple]:
    return connection.execute(
        """
        SELECT actor_user_id, role, decision, note, decided_at
        FROM guest_stay_decisions
        WHERE guest_stay_id = ?
        ORDER BY decided_at, actor_user_id
        """,
        (stay_id,),
    ).fetchall()


def _decide(
    connection: sqlite3.Connection,
    *,
    actor_user_id: str,
    role: str,
    decision: str,
    now_text: str,
    note: str | None = None,
    guest_stay_id: str = STAY_ID,
) -> str:
    return apply_decision(
        connection,
        guest_stay_id=guest_stay_id,
        actor_user_id=actor_user_id,
        role=role,
        decision=decision,
        note=note,
        now_text=now_text,
    )


def test_active_roommates_other_active_same_room(database_path: Path) -> None:
    connection = _open(database_path)
    try:
        assert active_roommate_user_ids(connection, HOST_ID) == [ROOMMATE_ID, ROOMMATE_B]
        assert active_roommate_user_ids(connection, ROOMMATE_ID) == [HOST_ID, ROOMMATE_B]
        assert active_roommate_user_ids(connection, ROOMMATE_B) == [HOST_ID, ROOMMATE_ID]
        assert active_roommate_user_ids(connection, SOLO_ID) == []
        assert active_roommate_user_ids(connection, UNKNOWN_ID) == []
    finally:
        connection.close()


def test_roommate_approve_alone_stays_pending(database_path: Path) -> None:
    connection = _open(database_path)
    try:
        _park_second_roommate(connection)
        _insert_stay(connection, STAY_ID, HOST_ID)
        assert active_roommate_user_ids(connection, HOST_ID) == [ROOMMATE_ID]
        assert _decide(
            connection,
            actor_user_id=ROOMMATE_ID,
            role="roommate",
            decision="approved",
            now_text=NOW,
        ) == "pending"
        assert _parent(connection, STAY_ID) == ("pending", None, None, None, CREATED)
        assert _rows(connection, STAY_ID) == [
            (ROOMMATE_ID, "roommate", "approved", None, NOW),
        ]
    finally:
        connection.close()


def test_provost_approve_after_roommate_approves_the_stay(database_path: Path) -> None:
    connection = _open(database_path)
    try:
        _park_second_roommate(connection)
        _insert_stay(connection, STAY_ID, HOST_ID)
        assert _decide(
            connection,
            actor_user_id=ROOMMATE_ID,
            role="roommate",
            decision="approved",
            now_text=NOW,
        ) == "pending"
        assert _decide(
            connection,
            actor_user_id=PROVOST_ID,
            role="provost",
            decision="approved",
            note="Welcome.",
            now_text=LATER,
        ) == "approved"
        assert _parent(connection, STAY_ID) == ("approved", PROVOST_ID, LATER, "Welcome.", LATER)
        assert _rows(connection, STAY_ID) == [
            (ROOMMATE_ID, "roommate", "approved", None, NOW),
            (PROVOST_ID, "provost", "approved", "Welcome.", LATER),
        ]
    finally:
        connection.close()


def test_roommate_approve_after_provost_approves_the_stay(database_path: Path) -> None:
    connection = _open(database_path)
    try:
        _park_second_roommate(connection)
        _insert_stay(connection, STAY_ID, HOST_ID)
        assert _decide(
            connection,
            actor_user_id=PROVOST_ID,
            role="provost",
            decision="approved",
            note="Welcome.",
            now_text=NOW,
        ) == "pending"
        assert _parent(connection, STAY_ID) == ("pending", None, None, None, CREATED)
        assert _decide(
            connection,
            actor_user_id=ROOMMATE_ID,
            role="roommate",
            decision="approved",
            now_text=LATER,
        ) == "approved"
        assert _parent(connection, STAY_ID) == ("approved", PROVOST_ID, LATER, "Welcome.", LATER)
        assert _rows(connection, STAY_ID) == [
            (PROVOST_ID, "provost", "approved", "Welcome.", NOW),
            (ROOMMATE_ID, "roommate", "approved", None, LATER),
        ]
    finally:
        connection.close()


def test_roommate_reject_leaves_the_staff_decision_empty(database_path: Path) -> None:
    connection = _open(database_path)
    try:
        _park_second_roommate(connection)
        _insert_stay(connection, STAY_ID, HOST_ID)
        assert _decide(
            connection,
            actor_user_id=ROOMMATE_ID,
            role="roommate",
            decision="rejected",
            note="Not while I have exams.",
            now_text=NOW,
        ) == "rejected"
        assert _parent(connection, STAY_ID) == ("rejected", None, None, None, NOW)
        assert _rows(connection, STAY_ID) == [
            (ROOMMATE_ID, "roommate", "rejected", "Not while I have exams.", NOW),
        ]
    finally:
        connection.close()


def test_provost_reject_records_the_provost(database_path: Path) -> None:
    connection = _open(database_path)
    try:
        _park_second_roommate(connection)
        _insert_stay(connection, STAY_ID, HOST_ID)
        assert _decide(
            connection,
            actor_user_id=PROVOST_ID,
            role="provost",
            decision="rejected",
            note="Not this week.",
            now_text=NOW,
        ) == "rejected"
        assert _parent(connection, STAY_ID) == (
            "rejected",
            PROVOST_ID,
            NOW,
            "Not this week.",
            NOW,
        )
        assert _rows(connection, STAY_ID) == [
            (PROVOST_ID, "provost", "rejected", "Not this week.", NOW),
        ]
    finally:
        connection.close()


def test_provost_approve_with_no_roommate_approves(database_path: Path) -> None:
    connection = _open(database_path)
    try:
        _insert_stay(connection, STAY_ID, SOLO_ID)
        assert active_roommate_user_ids(connection, SOLO_ID) == []
        assert _decide(
            connection,
            actor_user_id=PROVOST_ID,
            role="provost",
            decision="approved",
            now_text=NOW,
        ) == "approved"
        assert _parent(connection, STAY_ID) == ("approved", PROVOST_ID, NOW, None, NOW)
        assert _rows(connection, STAY_ID) == [
            (PROVOST_ID, "provost", "approved", None, NOW),
        ]
    finally:
        connection.close()


def test_both_current_roommates_must_approve(database_path: Path) -> None:
    connection = _open(database_path)
    try:
        _insert_stay(connection, STAY_ID, HOST_ID)
        assert active_roommate_user_ids(connection, HOST_ID) == [ROOMMATE_ID, ROOMMATE_B]
        assert _decide(
            connection,
            actor_user_id=ROOMMATE_ID,
            role="roommate",
            decision="approved",
            now_text=NOW,
        ) == "pending"
        assert _decide(
            connection,
            actor_user_id=PROVOST_ID,
            role="provost",
            decision="approved",
            now_text=LATER,
        ) == "pending"
        assert _parent(connection, STAY_ID)[0] == "pending"
        assert _decide(
            connection,
            actor_user_id=ROOMMATE_B,
            role="roommate",
            decision="approved",
            now_text=LATER_STILL,
        ) == "approved"
        assert _parent(connection, STAY_ID)[:2] == ("approved", PROVOST_ID)
        actors = [row[0] for row in _rows(connection, STAY_ID)]
        assert actors == [ROOMMATE_ID, PROVOST_ID, ROOMMATE_B]
    finally:
        connection.close()


def test_roommate_who_moved_out_does_not_count_and_her_row_remains(database_path: Path) -> None:
    connection = _open(database_path)
    try:
        _park_second_roommate(connection)
        _insert_stay(connection, STAY_ID, HOST_ID)
        assert active_roommate_user_ids(connection, HOST_ID) == [ROOMMATE_ID]
        assert _decide(
            connection,
            actor_user_id=ROOMMATE_ID,
            role="roommate",
            decision="approved",
            now_text=NOW,
        ) == "pending"
        connection.execute(
            "UPDATE residents SET room_id = ?, updated_at = ? WHERE user_id = ?",
            (SPARE_ROOM, CREATED, ROOMMATE_ID),
        )
        connection.execute(
            "UPDATE residents SET room_id = ?, updated_at = ? WHERE user_id = ?",
            (ROOM_ID, CREATED, ROOMMATE_B),
        )
        assert active_roommate_user_ids(connection, HOST_ID) == [ROOMMATE_B]
        assert _decide(
            connection,
            actor_user_id=PROVOST_ID,
            role="provost",
            decision="approved",
            now_text=LATER,
        ) == "pending"
        assert _parent(connection, STAY_ID)[0] == "pending"
        assert _decide(
            connection,
            actor_user_id=ROOMMATE_B,
            role="roommate",
            decision="approved",
            now_text=LATER_STILL,
        ) == "approved"
        assert _parent(connection, STAY_ID)[:2] == ("approved", PROVOST_ID)
        rows = _rows(connection, STAY_ID)
        assert (ROOMMATE_ID, "roommate", "approved", None, NOW) in rows
        assert (ROOMMATE_B, "roommate", "approved", None, LATER_STILL) in rows
        assert (PROVOST_ID, "provost", "approved", None, LATER) in rows
    finally:
        connection.close()


def test_same_actor_and_role_cannot_decide_twice(database_path: Path) -> None:
    connection = _open(database_path)
    try:
        _park_second_roommate(connection)
        _insert_stay(connection, STAY_ID, HOST_ID)
        assert _decide(
            connection,
            actor_user_id=ROOMMATE_ID,
            role="roommate",
            decision="approved",
            now_text=NOW,
        ) == "pending"
        with pytest.raises(DuplicateDecisionError):
            _decide(
                connection,
                actor_user_id=ROOMMATE_ID,
                role="roommate",
                decision="rejected",
                now_text=LATER,
            )
        assert _parent(connection, STAY_ID) == ("pending", None, None, None, CREATED)
        assert _rows(connection, STAY_ID) == [
            (ROOMMATE_ID, "roommate", "approved", None, NOW),
        ]
    finally:
        connection.close()


def test_host_edit_does_not_clear_decisions(database_path: Path) -> None:
    connection = _open(database_path)
    try:
        _park_second_roommate(connection)
        _insert_stay(connection, STAY_ID, HOST_ID)
        assert _decide(
            connection,
            actor_user_id=ROOMMATE_ID,
            role="roommate",
            decision="approved",
            now_text=NOW,
        ) == "pending"
        connection.execute(
            """
            UPDATE guest_stays
            SET guest_name = 'Amina Begum',
                relation = 'Aunt',
                guest_start_date = '2026-10-11',
                guest_end_date = '2026-10-13',
                reason = 'Changed visit.',
                updated_at = ?
            WHERE id = ?
            """,
            (LATER, STAY_ID),
        )
        assert _parent(connection, STAY_ID)[0] == "pending"
        assert _rows(connection, STAY_ID) == [
            (ROOMMATE_ID, "roommate", "approved", None, NOW),
        ]
    finally:
        connection.close()


def test_decision_on_a_stay_that_is_not_pending_is_refused(database_path: Path) -> None:
    connection = _open(database_path)
    try:
        _insert_stay(connection, STAY_ID, SOLO_ID)
        connection.execute(
            "UPDATE guest_stays SET status = 'cancelled', updated_at = ? WHERE id = ?",
            (NOW, STAY_ID),
        )
        with pytest.raises(StayNotPendingError):
            _decide(
                connection,
                actor_user_id=PROVOST_ID,
                role="provost",
                decision="approved",
                now_text=LATER,
            )
        assert _rows(connection, STAY_ID) == []
        assert _parent(connection, STAY_ID)[0] == "cancelled"
    finally:
        connection.close()


def test_missing_stay_is_refused(database_path: Path) -> None:
    connection = _open(database_path)
    try:
        with pytest.raises(GuestStayNotFoundError):
            _decide(
                connection,
                guest_stay_id=MISSING_STAY,
                actor_user_id=PROVOST_ID,
                role="provost",
                decision="approved",
                now_text=NOW,
            )
        assert _rows(connection, MISSING_STAY) == []
    finally:
        connection.close()


def test_a_decision_row_is_not_deleted_or_edited(database_path: Path) -> None:
    connection = _open(database_path)
    try:
        _park_second_roommate(connection)
        _insert_stay(connection, STAY_ID, HOST_ID)
        _decide(
            connection,
            actor_user_id=ROOMMATE_ID,
            role="roommate",
            decision="approved",
            now_text=NOW,
        )
        with pytest.raises(INTEGRITY_ERRORS, match="not deleted"):
            connection.execute("DELETE FROM guest_stay_decisions WHERE guest_stay_id = ?", (STAY_ID,))
        with pytest.raises(INTEGRITY_ERRORS, match="not edited"):
            connection.execute(
                """
                UPDATE guest_stay_decisions
                SET decision = 'rejected'
                WHERE guest_stay_id = ?
                """,
                (STAY_ID,),
            )
        assert _rows(connection, STAY_ID) == [
            (ROOMMATE_ID, "roommate", "approved", None, NOW),
        ]
    finally:
        connection.close()
