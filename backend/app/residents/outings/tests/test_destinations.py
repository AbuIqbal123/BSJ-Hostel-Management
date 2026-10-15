"""The active destinations a resident chooses before an ordinary outing."""

from __future__ import annotations

import json
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.shared.testing_env import role_credential


ARTIFACT = Path(__file__).resolve().parent / "artifacts" / "destinations.json"
BLOCK_B = "d032aad6-a203-5ea0-ba9a-3a9257edbfc8"
GATE_ID = "a11ce000-0000-4000-8000-000000000001"
RESIDENT_ID = "b22de000-0000-4000-8000-000000000002"
ROOM_ID = "d4400000-0000-4000-8000-000000000004"
CLINIC_ID = "c11c0000-0000-4000-8000-000000000030"
FORT_ID = "a1500000-0000-4000-8000-000000000031"
CREATED = "2026-09-30T00:00:00Z"


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
            (GATE_ID, "gate", "gate.fatima", "Fatima Khan", role_credential("gate")),
            (RESIDENT_ID, "resident", "24-GLLB-118", "Aisha Khan", role_credential("resident")),
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
        connection.execute(
            """
            INSERT INTO destinations (id, name, is_other, is_active) VALUES
              (?, 'city clinic', 0, 1),
              (?, 'Aligarh Fort', 0, 0)
            """,
            (CLINIC_ID, FORT_ID),
        )
        connection.commit()
    finally:
        connection.close()


def stored_destinations(path: Path) -> list[tuple]:
    connection = sqlite3.connect(path)
    try:
        return connection.execute(
            """
            SELECT id, name, is_other, is_active
            FROM destinations
            ORDER BY name COLLATE NOCASE, id
            """
        ).fetchall()
    finally:
        connection.close()


def audit_actions(path: Path) -> list[str]:
    connection = sqlite3.connect(path)
    try:
        return [
            row[0]
            for row in connection.execute(
                "SELECT action FROM audit_log ORDER BY occurred_at, id"
            )
        ]
    finally:
        connection.close()


def sign_in(client: TestClient, username: str, password: str) -> str:
    response = client.post(
        "/api/v1/auth/login",
        json={"username": username, "password": password},
    )
    assert response.status_code == 200
    return response.json()["access_token"]


def test_list_destinations(database_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    expected = json.loads(ARTIFACT.read_text(encoding="utf-8"))
    from app.shared import clock
    from app.main import app

    monkeypatch.setattr(clock, "utc_now", FrozenClock().utc_now)
    with TestClient(app) as client:
        issue_people(database_path)
        before = stored_destinations(database_path)
        assert_error(
            client.get("/api/v1/destinations"),
            401,
            "unauthenticated",
            "Sign in again.",
        )
        resident = sign_in(client, "24-GLLB-118", role_credential("resident"))
        listed = client.get(
            "/api/v1/destinations",
            headers={"Authorization": f"Bearer {resident}"},
        )
        assert listed.status_code == 200
        assert listed.json() == expected
        gate = sign_in(client, "gate.fatima", role_credential("gate"))
        same = client.get(
            "/api/v1/destinations",
            headers={"Authorization": f"Bearer {gate}"},
        )
        assert same.status_code == 200
        assert same.json() == expected
        assert stored_destinations(database_path) == before
        assert audit_actions(database_path) == ["auth.login", "auth.login"]
