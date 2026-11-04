"""Required roommates for a guest stay (no HTTP)."""

from __future__ import annotations

import sqlite3
from pathlib import Path

from app.residents.guests.decisions import active_roommate_user_ids

BLOCK_B = "d032aad6-a203-5ea0-ba9a-3a9257edbfc8"
HOST_ID = "b22de000-0000-4000-8000-000000000002"
ROOMMATE_ID = "b22de000-0000-4000-8000-000000000012"
SUSPENDED_ID = "b22de000-0000-4000-8000-000000000013"
SOLO_ID = "c44ef000-0000-4000-8000-000000000009"
UNKNOWN_ID = "b22de000-0000-4000-8000-000000000099"
ROOM_ID = "d4400000-0000-4000-8000-000000000004"
OTHER_ROOM = "d4400000-0000-4000-8000-000000000005"
CREATED = "2026-09-30T00:00:00Z"


def _seed(path: Path) -> None:
    connection = sqlite3.connect(path)
    try:
        connection.execute("PRAGMA foreign_keys=ON;")
        connection.execute(
            """
            INSERT INTO rooms (id, block_id, number, label, bed_count, is_active)
            VALUES (?, ?, '204', 'B-204', 3, 1), (?, ?, '205', 'B-205', 2, 1)
            """,
            (ROOM_ID, BLOCK_B, OTHER_ROOM, BLOCK_B),
        )
        people = (
            (HOST_ID, "24-GLLB-118", "Aisha Khan", "active", ROOM_ID, "Rashid Khan", "+919876543210"),
            (ROOMMATE_ID, "24-BA-014", "Zaynab Ali", "active", ROOM_ID, "Imran Ali", "+919876543212"),
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
        connection.commit()
    finally:
        connection.close()


def test_active_roommates_other_active_same_room(database_path: Path) -> None:
    from app.shared.migrate import migrate

    migrate()
    _seed(database_path)
    connection = sqlite3.connect(database_path)
    try:
        assert active_roommate_user_ids(connection, HOST_ID) == [ROOMMATE_ID]
        assert active_roommate_user_ids(connection, ROOMMATE_ID) == [HOST_ID]
        assert active_roommate_user_ids(connection, SOLO_ID) == []
        assert active_roommate_user_ids(connection, UNKNOWN_ID) == []
    finally:
        connection.close()
