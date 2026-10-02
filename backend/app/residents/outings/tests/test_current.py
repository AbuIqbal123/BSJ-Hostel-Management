"""The resident's planned or outside outing."""

from __future__ import annotations

from app.shared.testing_env import signing_key_for_tests

import json
import sqlite3
from collections.abc import Iterator
from datetime import datetime, timezone
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.dev_seed import (
    GATE_PHRASE,
    RESIDENT_PHRASE,
)


ARTIFACT = Path(__file__).resolve().parent / "artifacts" / "current-outing.json"
BLOCK_B = "d032aad6-a203-5ea0-ba9a-3a9257edbfc8"
LIBRARY = "fc2da7c5-8d65-5680-8034-d8acb69745eb"
GATE_ID = "a11ce000-0000-4000-8000-000000000001"
RESIDENT_ID = "b22de000-0000-4000-8000-000000000002"
ROOM_ID = "d4400000-0000-4000-8000-000000000004"
OUTSIDE_ID = "e7700000-0000-4000-8000-0000000000bb"
CREATED = "2026-09-30T00:00:00Z"
NOW = datetime(2026, 9, 30, 8, 0, tzinfo=timezone.utc)


class FrozenClock:
    def __init__(self) -> None:
        self.moment = NOW

    def utc_now(self) -> datetime:
        return self.moment


@pytest.fixture
def database_path(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Iterator[Path]:
    path = tmp_path / "hostel.db"
    monkeypatch.setenv("DATABASE_PATH", str(path))
    monkeypatch.setenv("ENVIRONMENT", "development")
    monkeypatch.setenv("SMS_DRIVER", "mock")
    monkeypatch.setenv("APP_SECRET_KEY", signing_key_for_tests())
    from app.shared.config import get_settings

    get_settings.cache_clear()
    yield path
    get_settings.cache_clear()


def assert_error(response, status: int, code: str, message: str) -> None:
    assert response.status_code == status
    body = response.json()
    assert set(body) == {"error"}
    assert body["error"] == {"code": code, "message": message}


def issue_people(path: Path) -> None:
    from app.shared.auth.security import hash_password

    connection = sqlite3.connect(path)
    try:
        connection.execute("PRAGMA foreign_keys=ON;")
        connection.execute(
            """
            INSERT INTO rooms (id, block_id, number, label, bed_count, is_active)
            VALUES (?, ?, '204', 'B-204', 2, 1)
            """,
            (ROOM_ID, BLOCK_B),
        )
        people = (
            (GATE_ID, "gate", "gate.fatima", "Fatima Khan", GATE_PHRASE),
            (RESIDENT_ID, "resident", "24-GLLB-118", "Aisha Khan", RESIDENT_PHRASE),
        )
        for user_id, role, username, full_name, password in people:
            connection.execute(
                """
                INSERT INTO users (
                  id, role, username, full_name, password_hash, status, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, 'active', ?, ?)
                """,
                (user_id, role, username, full_name, hash_password(password), CREATED, CREATED),
            )
        connection.execute(
            "INSERT INTO staff (user_id, job_title) VALUES (?, 'Gatekeeper')",
            (GATE_ID,),
        )
        connection.execute(
            """
            INSERT INTO residents (
              user_id, enrolment_number, course, room_id, guardian_name, guardian_phone,
              qr_token, presence, created_at, updated_at
            ) VALUES (?, '24-GLLB-118', 'B.A. LL.B. (Hons.)', ?, 'Rashid Khan',
              '+919876543210', 'bsj:v1:test-resident-hall-pass', 'inside', ?, ?)
            """,
            (RESIDENT_ID, ROOM_ID, CREATED, CREATED),
        )
        connection.commit()
    finally:
        connection.close()


def sign_in(client: TestClient, username: str, password: str) -> str:
    response = client.post(
        "/api/v1/auth/login",
        json={"username": username, "password": password},
    )
    assert response.status_code == 200
    return response.json()["access_token"]


def current(client: TestClient, token: str):
    return client.get(
        "/api/v1/me/outings/current",
        headers={"Authorization": f"Bearer {token}"},
    )


def test_current_outing(database_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    expected = json.loads(ARTIFACT.read_text(encoding="utf-8"))
    frozen = FrozenClock()
    from app.shared import clock
    from app.main import app

    monkeypatch.setattr(clock, "utc_now", frozen.utc_now)
    with TestClient(app) as client:
        issue_people(database_path)
        assert_error(client.get("/api/v1/me/outings/current"), 401, "unauthenticated", "Sign in again.")
        gate = sign_in(client, "gate.fatima", GATE_PHRASE)
        assert_error(current(client, gate), 403, "forbidden", "This account cannot do that.")
        resident = sign_in(client, "24-GLLB-118", RESIDENT_PHRASE)
        empty = current(client, resident)
        assert empty.status_code == 200
        assert empty.json() == expected["empty"]

        planned = client.post(
            "/api/v1/me/outings",
            headers={"Authorization": f"Bearer {resident}"},
            json={"destination_id": LIBRARY, "expected_return_at": "2026-09-30T13:00:00Z"},
        )
        assert planned.status_code == 201
        outing_id = planned.json()["id"]
        opened = current(client, resident)
        assert opened.status_code == 200
        body = opened.json()
        assert body["outing"]["id"] == outing_id
        assert {key: value for key, value in body["outing"].items() if key != "id"} == {
            key: value for key, value in expected["library"]["outing"].items()
        }

        frozen.moment = datetime(2026, 9, 30, 13, 0, tzinfo=timezone.utc)
        resident = sign_in(client, "24-GLLB-118", RESIDENT_PHRASE)
        still = current(client, resident)
        assert still.status_code == 200
        assert still.json()["outing"]["id"] == outing_id
        assert still.json()["outing"]["status"] == "planned"

        frozen.moment = datetime(2026, 9, 30, 13, 0, 1, tzinfo=timezone.utc)
        expired = client.post(
            "/api/v1/me/expire-passed",
            headers={"Authorization": f"Bearer {resident}"},
        )
        assert expired.status_code == 200
        assert expired.json()["plans_expired"] == 1
        passed = current(client, resident)
        assert passed.status_code == 200
        assert passed.json() == expected["empty"]
        connection = sqlite3.connect(database_path)
        connection.row_factory = sqlite3.Row
        row = connection.execute("SELECT status, cancelled_at FROM outings WHERE id = ?", (outing_id,)).fetchone()
        audit = connection.execute(
            """
            SELECT actor_user_id, action, summary
            FROM audit_log
            WHERE entity_id = ? AND action = 'outing.cancelled'
            """,
            (outing_id,),
        ).fetchone()
        connection.close()
        assert row["status"] == "cancelled"
        assert row["cancelled_at"] == "2026-09-30T13:00:01Z"
        assert audit["actor_user_id"] is None
        assert audit["summary"] == (
            "A planned outing to Maulana Azad Library was cancelled because the expected return passed."
        )

        connection = sqlite3.connect(database_path)
        connection.execute(
            """
            INSERT INTO outings (
              id, resident_id, permission_id, type, status, destination_id, place,
              expected_return_at, grace_ends_at, exited_at, exit_recorded_by,
              returned_at, return_recorded_by, created_at, updated_at, cancelled_at, hall_date
            ) VALUES (
              ?, ?, NULL, 'ordinary', 'outside', ?, 'Shamshad Market',
              '2026-09-30T12:00:00Z', '2026-09-30T13:30:00Z', '2026-09-30T07:00:00Z', ?,
              NULL, NULL, '2026-09-30T06:30:00Z', '2026-09-30T07:00:00Z', NULL, '2026-09-30'
            )
            """,
            (OUTSIDE_ID, RESIDENT_ID, LIBRARY, GATE_ID),
        )
        connection.execute(
            "UPDATE residents SET presence = 'outside', updated_at = '2026-09-30T07:00:00Z' WHERE user_id = ?",
            (RESIDENT_ID,),
        )
        connection.commit()
        connection.close()
        outside = current(client, resident)
        assert outside.status_code == 200
        assert outside.json() == expected["outside"]

        frozen.moment = datetime(2026, 9, 30, 13, 30, tzinfo=timezone.utc)
        resident = sign_in(client, "24-GLLB-118", RESIDENT_PHRASE)
        on_grace = current(client, resident)
        assert on_grace.json()["outing"]["lateness"] == "on_time"
        frozen.moment = datetime(2026, 9, 30, 13, 30, 1, tzinfo=timezone.utc)
        late = current(client, resident)
        assert late.json()["outing"]["lateness"] == "late"
        assert late.json()["outing"]["status"] == "outside"
        home = client.get("/api/v1/me/home", headers={"Authorization": f"Bearer {resident}"})
        assert home.status_code == 200
        assert home.json()["current_outing"]["id"] == OUTSIDE_ID
        assert home.json()["current_outing"]["lateness"] == "late"
