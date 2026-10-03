"""The onboard form lists active blocks and unassigned active rooms."""

from __future__ import annotations

import json
import sqlite3
from collections.abc import Iterator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.shared.auth.rate_limit import login_limiter, refresh_limiter
from app.shared.auth.security import hash_password
from app.shared.auth.tests.test_session import assert_error
from app.shared.testing_env import signing_key_for_tests
from app.dev_seed import joined

ARTIFACT = Path(__file__).resolve().parent / "artifacts" / "auth-onboard-options.json"
BLOCK_A = "01b885ad-e40d-56a4-81ab-2371f654f558"
BLOCK_B = "d032aad6-a203-5ea0-ba9a-3a9257edbfc8"
BLOCK_C = "dad52ee9-0b9a-53e2-a792-1dbee295ada9"
ROOM_FREE = "d4400000-0000-4000-8000-000000000204"
ROOM_FREE_LATER = "d4400000-0000-4000-8000-000000000207"
ROOM_TAKEN = "d4400000-0000-4000-8000-000000000205"
ROOM_INACTIVE = "d4400000-0000-4000-8000-000000000206"
ROOM_INACTIVE_BLOCK = "d4400000-0000-4000-8000-000000000104"
ROOM_ONLY_TAKEN = "d4400000-0000-4000-8000-000000000304"
RESIDENT_TAKEN = "b22de000-0000-4000-8000-000000000205"
RESIDENT_ONLY = "b22de000-0000-4000-8000-000000000304"
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


def issue_rooms(path: Path) -> None:
    connection = sqlite3.connect(path)
    try:
        connection.execute("PRAGMA foreign_keys=ON;")
        connection.execute(
            "UPDATE blocks SET is_active = 0 WHERE id = ?",
            (BLOCK_A,),
        )
        connection.execute(
            """
            INSERT INTO rooms (id, block_id, number, label, bed_count, is_active) VALUES
              (?, ?, '204', 'B-204', 2, 1),
              (?, ?, '207', 'B-207', 2, 1),
              (?, ?, '205', 'B-205', 2, 1),
              (?, ?, '206', 'B-206', 2, 0),
              (?, ?, '104', 'A-104', 2, 1),
              (?, ?, '304', 'C-304', 2, 1)
            """,
            (
                ROOM_FREE,
                BLOCK_B,
                ROOM_FREE_LATER,
                BLOCK_B,
                ROOM_TAKEN,
                BLOCK_B,
                ROOM_INACTIVE,
                BLOCK_B,
                ROOM_INACTIVE_BLOCK,
                BLOCK_A,
                ROOM_ONLY_TAKEN,
                BLOCK_C,
            ),
        )
        phrase = hash_password(joined("resident", "options", "10"))
        for user_id, username, room_id in (
            (RESIDENT_TAKEN, "24-GLLB-205", ROOM_TAKEN),
            (RESIDENT_ONLY, "24-GLLB-304", ROOM_ONLY_TAKEN),
        ):
            connection.execute(
                """
                INSERT INTO users (
                  id, role, username, full_name, password_hash, status, created_at, updated_at
                ) VALUES (?, 'resident', ?, 'Aisha Khan', ?, 'active', ?, ?)
                """,
                (user_id, username, phrase, CREATED, CREATED),
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
        issue_rooms(database_path)

        listed = client.get("/api/v1/auth/onboard/options")
        assert listed.status_code == 200
        body = listed.json()
        assert body == expected
        for block in body:
            assert set(block) == {"id", "name", "rooms"}
            assert block["rooms"]
            for room in block["rooms"]:
                assert set(room) == {"id", "label"}

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
