"""Gate guest dining occupancy read."""

from __future__ import annotations

import json
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.shared.testing_env import role_credential

ARTIFACT = Path(__file__).resolve().parent / "artifacts" / "gate-occupancy.json"
BLOCK_B = "d032aad6-a203-5ea0-ba9a-3a9257edbfc8"
GATE_ID = "a11ce000-0000-4000-8000-000000000001"
WARDEN_ID = "e55fa000-0000-4000-8000-000000000005"
RESIDENT_ID = "b22de000-0000-4000-8000-000000000002"
OTHER_ID = "c44ef000-0000-4000-8000-000000000009"
ROOM_ID = "d4400000-0000-4000-8000-000000000004"
OTHER_ROOM = "d4400000-0000-4000-8000-000000000005"
CREATED = "2026-09-30T00:00:00Z"
IN_HALL = "cc200000-0000-4000-8000-0000000000d1"
SHOULD_LEFT = "cc200000-0000-4000-8000-0000000000d2"
EXPECTED = "cc200000-0000-4000-8000-0000000000d3"
UNPAID = "cc200000-0000-4000-8000-0000000000d4"
DEPARTED = "cc200000-0000-4000-8000-0000000000d5"
NOW = datetime(2026, 9, 30, 12, 0, tzinfo=timezone.utc)


class FrozenClock:
    def utc_now(self) -> datetime:
        return NOW


def assert_error(response, status: int, code: str) -> None:
    assert response.status_code == status
    body = response.json()
    assert set(body) == {"error"}
    assert body["error"]["code"] == code


def issue_people(path: Path) -> None:
    from app.shared.auth.security import hash_password
    from app.shared.testing_env import role_credential

    connection = sqlite3.connect(path)
    try:
        connection.execute("PRAGMA foreign_keys=ON;")
        connection.execute(
            """
            INSERT INTO rooms (id, block_id, number, label, bed_count, is_active)
            VALUES (?, ?, '204', 'B-204', 2, 1), (?, ?, '205', 'B-205', 2, 1)
            """,
            (ROOM_ID, BLOCK_B, OTHER_ROOM, BLOCK_B),
        )
        people = (
            (GATE_ID, "gate", "gate.fatima", "Fatima Khan", role_credential("gate")),
            (WARDEN_ID, "warden", "warden.sara", "Sara Malik", role_credential("warden")),
            (RESIDENT_ID, "resident", "24-GLLB-118", "Aisha Khan", role_credential("resident")),
            (OTHER_ID, "resident", "24-BA-002", "Maryam Siddiqui", role_credential("resident-20")),
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
            ) VALUES
              (?, '24-GLLB-118', 'B.A. LL.B. (Hons.)', ?, 'Rashid Khan',
               '+919876543210', 'bsj:v1:test-resident-hall-pass', 'inside', ?, ?),
              (?, '24-BA-002', 'B.A.', ?, 'Yusuf Siddiqui',
               '+919876543211', 'bsj:v1:test-other-resident', 'inside', ?, ?)
            """,
            (RESIDENT_ID, ROOM_ID, CREATED, CREATED, OTHER_ID, OTHER_ROOM, CREATED, CREATED),
        )
        connection.commit()
    finally:
        connection.close()


def seed_stays(path: Path) -> None:
    connection = sqlite3.connect(path)
    try:
        connection.execute("PRAGMA foreign_keys=ON;")
        rows = (
            # in hall within dates
            (
                IN_HALL,
                RESIDENT_ID,
                "In Hall Guest",
                "Sister",
                "2026-09-29",
                "2026-10-01",
                "In hall.",
                "approved",
                "paid",
                WARDEN_ID,
                "2026-09-29T08:00:00Z",
                WARDEN_ID,
                "2026-09-28T12:00:00Z",
                None,
                "2026-09-29T10:00:00Z",
                GATE_ID,
                None,
                None,
                "2026-09-28T09:00:00Z",
            ),
            # should have left (still dining)
            (
                SHOULD_LEFT,
                OTHER_ID,
                "Overstay Guest",
                "Niece",
                "2026-09-20",
                "2026-09-25",
                "Overstay.",
                "approved",
                "paid",
                WARDEN_ID,
                "2026-09-20T08:00:00Z",
                WARDEN_ID,
                "2026-09-19T12:00:00Z",
                None,
                "2026-09-20T10:00:00Z",
                GATE_ID,
                None,
                None,
                "2026-09-19T09:00:00Z",
            ),
            # expected today — not dining
            (
                EXPECTED,
                RESIDENT_ID,
                "Expected Guest",
                "Cousin",
                "2026-09-29",
                "2026-10-01",
                "Visit.",
                "approved",
                "paid",
                WARDEN_ID,
                "2026-09-29T08:00:00Z",
                WARDEN_ID,
                "2026-09-28T12:00:00Z",
                None,
                None,
                None,
                None,
                None,
                "2026-09-28T10:00:00Z",
            ),
            # unpaid within stay — not dining
            (
                UNPAID,
                RESIDENT_ID,
                "Unpaid Guest",
                "Friend",
                "2026-09-29",
                "2026-10-01",
                "Unpaid.",
                "approved",
                "unpaid",
                None,
                None,
                WARDEN_ID,
                "2026-09-28T12:00:00Z",
                None,
                None,
                None,
                None,
                None,
                "2026-09-28T11:00:00Z",
            ),
            # already departed — not dining
            (
                DEPARTED,
                OTHER_ID,
                "Departed Guest",
                "Aunt",
                "2026-09-22",
                "2026-09-28",
                "Left.",
                "departed",
                "paid",
                WARDEN_ID,
                "2026-09-22T08:00:00Z",
                WARDEN_ID,
                "2026-09-21T12:00:00Z",
                None,
                "2026-09-22T10:00:00Z",
                GATE_ID,
                "2026-09-28T16:00:00Z",
                GATE_ID,
                "2026-09-21T09:00:00Z",
            ),
        )
        connection.executemany(
            """
            INSERT INTO guest_stays (
              id, host_resident_id, guest_name, relation, guest_start_date, guest_end_date, reason,
              status, payment_status, payment_marked_by, payment_marked_at,
              decided_by, decided_at, decision_note,
              arrived_at, arrived_recorded_by, departed_at, departed_recorded_by,
              created_at, updated_at
            ) VALUES (
              ?, ?, ?, ?, ?, ?, ?,
              ?, ?, ?, ?,
              ?, ?, ?,
              ?, ?, ?, ?,
              ?, ?
            )
            """,
            [(*row, row[-1]) for row in rows],
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


def test_gate_occupancy(database_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    expected = json.loads(ARTIFACT.read_text(encoding="utf-8"))
    from app.main import app
    from app.shared import clock

    monkeypatch.setattr(clock, "utc_now", FrozenClock().utc_now)
    with TestClient(app) as client:
        issue_people(database_path)
        seed_stays(database_path)

        assert_error(client.get("/api/v1/gate/occupancy"), 401, "unauthenticated")
        resident = sign_in(client, "24-GLLB-118", role_credential("resident"))
        assert_error(
            client.get(
                "/api/v1/gate/occupancy",
                headers={"Authorization": f"Bearer {resident}"},
            ),
            403,
            "forbidden",
        )

        gate = sign_in(client, "gate.fatima", role_credential("gate"))
        headers = {"Authorization": f"Bearer {gate}"}
        response = client.get("/api/v1/gate/occupancy", headers=headers)
        assert response.status_code == 200
        assert response.json() == expected

        warden = sign_in(client, "warden.sara", role_credential("warden"))
        warden_response = client.get(
            "/api/v1/gate/occupancy",
            headers={"Authorization": f"Bearer {warden}"},
        )
        assert warden_response.status_code == 200
        assert warden_response.json() == expected
