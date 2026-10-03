"""The onboard form lists resident blocks A–D and their free active rooms."""

from __future__ import annotations

import json
import sqlite3
from collections.abc import Iterator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.shared.auth.onboard_catalog import RESIDENT_BLOCK_CODES, RESIDENT_BLOCK_ROOM_COUNTS
from app.shared.auth.rate_limit import login_limiter, refresh_limiter
from app.shared.auth.security import hash_password
from app.shared.auth.tests.test_session import assert_error
from app.shared.testing_env import signing_key_for_tests
from app.dev_seed import joined

ARTIFACT = Path(__file__).resolve().parent / "artifacts" / "auth-onboard-options.json"
BLOCK_A = "01b885ad-e40d-56a4-81ab-2371f654f558"
BLOCK_B = "d032aad6-a203-5ea0-ba9a-3a9257edbfc8"
BLOCK_C = "dad52ee9-0b9a-53e2-a792-1dbee295ada9"
BLOCK_D = "f75a0c4d-cf9e-5b03-9ba5-13f77337453d"
BLOCK_UTILITY = "916c689d-598e-55b4-b3dc-fcf7120ca3b1"
RESIDENT_TAKEN = "b22de000-0000-4000-8000-000000000205"
CREATED = "2026-09-30T00:00:00Z"


@pytest.fixture
def database_path(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Iterator[Path]:
    path = tmp_path / "hostel.db"
    monkeypatch.setenv("DATABASE_PATH", str(path))
    monkeypatch.setenv("ENVIRONMENT", "development")
    monkeypatch.setenv("SMS_DRIVER", "mock")
    monkeypatch.setenv("APP_SECRET_KEY", signing_key_for_tests())
    from app.shared.config import get_settings

    get_settings.cache_clear()
    login_limiter.reset()
    refresh_limiter.reset()
    yield path
    login_limiter.reset()
    refresh_limiter.reset()
    get_settings.cache_clear()


def room_id_for(path: Path, label: str) -> str:
    connection = sqlite3.connect(path)
    try:
        row = connection.execute(
            "SELECT id FROM rooms WHERE label = ?",
            (label,),
        ).fetchone()
        assert row is not None, label
        return row[0]
    finally:
        connection.close()


def assign_resident(path: Path, room_label: str, username: str) -> None:
    connection = sqlite3.connect(path)
    try:
        connection.execute("PRAGMA foreign_keys=ON;")
        room_id = connection.execute(
            "SELECT id FROM rooms WHERE label = ?",
            (room_label,),
        ).fetchone()[0]
        phrase = hash_password(joined("resident", "options", "10"))
        connection.execute(
            """
            INSERT INTO users (
              id, role, username, full_name, password_hash, status, created_at, updated_at
            ) VALUES (?, 'resident', ?, 'Aisha Khan', ?, 'active', ?, ?)
            """,
            (RESIDENT_TAKEN, username, phrase, CREATED, CREATED),
        )
        connection.execute(
            """
            INSERT INTO residents (
              user_id, enrolment_number, course, room_id, guardian_name, guardian_phone,
              qr_token, presence, created_at, updated_at
            ) VALUES (?, ?, NULL, ?, 'Rashid Khan', '+919876543210', ?, 'inside', ?, ?)
            """,
            (RESIDENT_TAKEN, username, room_id, f"bsj:v1:{username}", CREATED, CREATED),
        )
        connection.commit()
    finally:
        connection.close()


def deactivate_room(path: Path, label: str) -> None:
    connection = sqlite3.connect(path)
    try:
        connection.execute(
            "UPDATE rooms SET is_active = 0 WHERE label = ?",
            (label,),
        )
        connection.commit()
    finally:
        connection.close()


def assign_every_room_in_block(path: Path, block_id: str) -> None:
    connection = sqlite3.connect(path)
    try:
        connection.execute("PRAGMA foreign_keys=ON;")
        rooms = connection.execute(
            "SELECT id, label FROM rooms WHERE block_id = ? ORDER BY CAST(number AS INTEGER)",
            (block_id,),
        ).fetchall()
        phrase = hash_password(joined("resident", "full", "10"))
        for index, (room_id, label) in enumerate(rooms):
            user_id = f"b22de000-0000-4000-8000-{index + 1:012d}"
            username = f"24-FULL-{index + 1:03d}"
            connection.execute(
                """
                INSERT INTO users (
                  id, role, username, full_name, password_hash, status, created_at, updated_at
                ) VALUES (?, 'resident', ?, ?, ?, 'active', ?, ?)
                """,
                (user_id, username, f"Resident {label}", phrase, CREATED, CREATED),
            )
            connection.execute(
                """
                INSERT INTO residents (
                  user_id, enrolment_number, course, room_id, guardian_name, guardian_phone,
                  qr_token, presence, created_at, updated_at
                ) VALUES (?, ?, NULL, ?, 'Rashid Khan', '+919876543210', ?, 'inside', ?, ?)
                """,
                (user_id, username, room_id, f"bsj:v1:{username}", CREATED, CREATED),
            )
        connection.commit()
    finally:
        connection.close()


def test_onboard_options(database_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    expected = json.loads(ARTIFACT.read_text(encoding="utf-8"))
    from app.main import app

    with TestClient(app) as client:
        assert client.get("/health").json() == {"status": "ok"}

        listed = client.get("/api/v1/auth/onboard/options")
        assert listed.status_code == 200
        body = listed.json()
        assert [block["name"] for block in body] == [
            "Block-A",
            "Block-B",
            "Block-C",
            "Block-D",
        ]
        assert [block["id"] for block in body] == [BLOCK_A, BLOCK_B, BLOCK_C, BLOCK_D]
        assert all(name != "Utility" for name in (block["name"] for block in body))
        assert BLOCK_UTILITY not in {block["id"] for block in body}

        counts = {
            "Block-A": RESIDENT_BLOCK_ROOM_COUNTS["A"],
            "Block-B": RESIDENT_BLOCK_ROOM_COUNTS["B"],
            "Block-C": RESIDENT_BLOCK_ROOM_COUNTS["C"],
            "Block-D": RESIDENT_BLOCK_ROOM_COUNTS["D"],
        }
        for block in body:
            assert set(block) == {"id", "name", "rooms"}
            assert len(block["rooms"]) == counts[block["name"]]
            code = block["name"].removeprefix("Block-")
            assert code in RESIDENT_BLOCK_CODES
            for index, room in enumerate(block["rooms"], start=1):
                assert set(room) == {"id", "label"}
                assert room["label"] == f"{code}-{index}"
                assert room["id"] == room_id_for(database_path, room["label"])

        assert body == expected["fresh"]

        deactivate_room(database_path, "A-1")
        assign_resident(database_path, "B-1", "24-GLLB-205")
        assign_every_room_in_block(database_path, BLOCK_C)

        filtered = client.get("/api/v1/auth/onboard/options")
        assert filtered.status_code == 200
        filtered_body = filtered.json()
        assert [block["id"] for block in filtered_body] == [
            BLOCK_A,
            BLOCK_B,
            BLOCK_C,
            BLOCK_D,
        ]
        by_name = {block["name"]: block for block in filtered_body}
        assert "A-1" not in {room["label"] for room in by_name["Block-A"]["rooms"]}
        assert len(by_name["Block-A"]["rooms"]) == RESIDENT_BLOCK_ROOM_COUNTS["A"] - 1
        assert "B-1" not in {room["label"] for room in by_name["Block-B"]["rooms"]}
        assert len(by_name["Block-B"]["rooms"]) == RESIDENT_BLOCK_ROOM_COUNTS["B"] - 1
        assert by_name["Block-C"]["rooms"] == []
        assert len(by_name["Block-D"]["rooms"]) == RESIDENT_BLOCK_ROOM_COUNTS["D"]
        assert filtered_body == expected["filtered"]

        login_limiter.reset()
        monkeypatch.setattr(login_limiter, "limit", 2)
        for _ in range(2):
            again = client.get("/api/v1/auth/onboard/options")
            assert again.status_code == 200
        blocked = client.get("/api/v1/auth/onboard/options")
        assert_error(
            blocked,
            429,
            "rate_limited",
            "Too many attempts. Try again shortly.",
        )
