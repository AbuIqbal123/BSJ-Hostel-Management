"""Permanent hall pass shown on the resident phone."""

from __future__ import annotations

import json
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.dev_seed import GATE_PHRASE, RESIDENT_PHRASE, WARDEN_PHRASE

ARTIFACT = Path(__file__).resolve().parent / "artifacts" / "resident-hall-pass.json"
BLOCK_B = "d032aad6-a203-5ea0-ba9a-3a9257edbfc8"
GATE_ID = "a11ce000-0000-4000-8000-000000000001"
WARDEN_ID = "e55fa000-0000-4000-8000-000000000005"
RESIDENT_ID = "b22de000-0000-4000-8000-000000000002"
ROOM_ID = "d4400000-0000-4000-8000-000000000004"
CREATED = "2026-09-30T00:00:00Z"
RESIDENT_QR = "bsj:v1:test-resident-hall-pass"
OUTING_ID = "e7700000-0000-4000-8000-0000000000cc"


class FrozenClock:
    def utc_now(self) -> datetime:
        return datetime(2026, 9, 30, 13, 0, tzinfo=timezone.utc)


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
            (WARDEN_ID, "warden", "warden.sara", "Sara Malik", WARDEN_PHRASE),
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
            "INSERT INTO staff (user_id, job_title) VALUES (?, 'Warden')",
            (WARDEN_ID,),
        )
        connection.execute(
            """
            INSERT INTO residents (
              user_id, enrolment_number, course, room_id, guardian_name, guardian_phone,
              qr_token, presence, created_at, updated_at
            ) VALUES (?, '24-GLLB-118', 'B.A. LL.B. (Hons.)', ?, 'Rashid Khan',
              '+919876543210', ?, 'inside', ?, ?)
            """,
            (RESIDENT_ID, ROOM_ID, RESIDENT_QR, CREATED, CREATED),
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


def test_resident_hall_pass(database_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    expected = json.loads(ARTIFACT.read_text(encoding="utf-8"))
    from app.main import app
    from app.shared import clock

    monkeypatch.setattr(clock, "utc_now", FrozenClock().utc_now)
    with TestClient(app) as client:
        issue_people(database_path)
        assert_error(
            client.get("/api/v1/me/hall-pass"),
            401,
            "unauthenticated",
            "Sign in again.",
        )
        gate = sign_in(client, "gate.fatima", GATE_PHRASE)
        assert_error(
            client.get("/api/v1/me/hall-pass", headers={"Authorization": f"Bearer {gate}"}),
            403,
            "forbidden",
            "This account cannot do that.",
        )
        warden = sign_in(client, "warden.sara", WARDEN_PHRASE)
        assert_error(
            client.get("/api/v1/me/hall-pass", headers={"Authorization": f"Bearer {warden}"}),
            403,
            "forbidden",
            "This account cannot do that.",
        )
        resident = sign_in(client, "24-GLLB-118", RESIDENT_PHRASE)
        headers = {"Authorization": f"Bearer {resident}"}
        response = client.get("/api/v1/me/hall-pass", headers=headers)
        assert response.status_code == 200
        assert response.json() == expected["hidden"]
        assert response.json()["qr_payload"] is None

        connection = sqlite3.connect(database_path)
        connection.execute(
            """
            INSERT INTO outings (
              id, resident_id, permission_id, type, status, destination_id, place,
              starts_at, expected_return_at, grace_ends_at, exited_at, exit_recorded_by,
              returned_at, return_recorded_by, created_at, updated_at, cancelled_at,
              hall_date
            ) VALUES (
              ?, ?, NULL, 'ordinary', 'planned', NULL, 'Maulana Azad Library',
              '2026-09-30T14:00:00Z', '2026-09-30T15:00:00Z', '2026-09-30T15:30:00Z', NULL, NULL,
              NULL, NULL, ?, ?, NULL, '2026-09-30'
            )
            """,
            (OUTING_ID, RESIDENT_ID, CREATED, CREATED),
        )
        connection.commit()
        connection.close()
        waiting = client.get("/api/v1/me/hall-pass", headers=headers)
        assert waiting.status_code == 200
        assert waiting.json() == expected["waiting"]

        connection = sqlite3.connect(database_path)
        connection.execute(
            "UPDATE outings SET starts_at = '2026-09-30T13:04:00Z', updated_at = ? WHERE id = ?",
            (CREATED, OUTING_ID),
        )
        connection.commit()
        try:
            stored = connection.execute(
                "SELECT qr_token FROM residents WHERE user_id = ?",
                (RESIDENT_ID,),
            ).fetchone()[0]
            audit = [
                row[0]
                for row in connection.execute(
                    "SELECT action FROM audit_log ORDER BY occurred_at, rowid"
                )
            ]
        finally:
            connection.close()
        showing = client.get("/api/v1/me/hall-pass", headers=headers)
        assert showing.status_code == 200
        assert showing.json() == expected["showing"]
        assert stored == RESIDENT_QR
        assert audit == ["auth.login", "auth.login", "auth.login"]
