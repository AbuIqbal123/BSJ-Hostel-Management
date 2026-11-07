"""Suspension blocks new exits; return and outside visibility stay."""

from __future__ import annotations

import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

import pytest
from fastapi.testclient import TestClient

from app.shared.testing_env import role_credential

BLOCK_B = "d032aad6-a203-5ea0-ba9a-3a9257edbfc8"
LIBRARY = "fc2da7c5-8d65-5680-8034-d8acb69745eb"
GATE_ID = "a11ce000-0000-4000-8000-000000000001"
WARDEN_ID = "e55fa000-0000-4000-8000-000000000005"
PROVOST_ID = "f66ab000-0000-4000-8000-000000000006"
RESIDENT_ID = "b22de000-0000-4000-8000-000000000002"
ROOM_ID = "d4400000-0000-4000-8000-000000000004"
CREATED = "2026-09-30T00:00:00Z"
QR = "bsj:v1:test-resident-hall-pass"
NOW = datetime(2026, 9, 30, 12, 0, tzinfo=timezone.utc)


class MovableClock:
    def __init__(self, moment: datetime) -> None:
        self.moment = moment

    def utc_now(self) -> datetime:
        return self.moment


def assert_error(response, status: int, code: str) -> None:
    assert response.status_code == status
    assert response.json()["error"]["code"] == code


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
        for user_id, role, username, full_name, password, job in (
            (GATE_ID, "gate", "gate.fatima", "Fatima Khan", role_credential("gate"), "Gatekeeper"),
            (WARDEN_ID, "warden", "warden.sara", "Sara Malik", role_credential("warden"), "Warden"),
            (
                PROVOST_ID,
                "provost",
                "provost.halima",
                "Halima Begum",
                role_credential("provost"),
                "Provost",
            ),
            (RESIDENT_ID, "resident", "24-GLLB-118", "Aisha Khan", role_credential("resident"), None),
        ):
            connection.execute(
                """
                INSERT INTO users (
                  id, role, username, full_name, password_hash, status, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, 'active', ?, ?)
                """,
                (user_id, role, username, full_name, hash_password(password), CREATED, CREATED),
            )
            if job is not None:
                connection.execute(
                    "INSERT INTO staff (user_id, job_title) VALUES (?, ?)",
                    (user_id, job),
                )
        connection.execute(
            """
            INSERT INTO residents (
              user_id, enrolment_number, course, room_id, guardian_name, guardian_phone,
              qr_token, presence, created_at, updated_at
            ) VALUES (?, '24-GLLB-118', 'B.A. LL.B. (Hons.)', ?, 'Rashid Khan',
              '+919876543210', ?, 'inside', ?, ?)
            """,
            (RESIDENT_ID, ROOM_ID, QR, CREATED, CREATED),
        )
        connection.execute(
            "UPDATE hall_settings SET scan_duplicate_window_seconds = 0 WHERE id = 'hall'"
        )
        connection.commit()
    finally:
        connection.close()


def insert_planned_outing(path: Path, outing_id: str, *, expected: str, grace: str) -> None:
    hall_date = (
        datetime.strptime(expected, "%Y-%m-%dT%H:%M:%SZ")
        .replace(tzinfo=timezone.utc)
        .astimezone(ZoneInfo("Asia/Kolkata"))
        .date()
        .isoformat()
    )
    connection = sqlite3.connect(path)
    try:
        connection.execute("PRAGMA foreign_keys=ON;")
        connection.execute(
            """
            INSERT INTO outings (
              id, resident_id, permission_id, type, status, destination_id, place,
              starts_at, expected_return_at, grace_ends_at, exited_at, exit_recorded_by,
              returned_at, return_recorded_by, created_at, updated_at, cancelled_at, hall_date
            ) VALUES (
              ?, ?, NULL, 'ordinary', 'planned', ?, 'Maulana Azad Library',
              '2026-09-30T11:30:00Z', ?, ?, NULL, NULL,
              NULL, NULL, ?, ?, NULL, ?
            )
            """,
            (outing_id, RESIDENT_ID, LIBRARY, expected, grace, CREATED, CREATED, hall_date),
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


def auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def resident_state(path: Path) -> sqlite3.Row:
    connection = sqlite3.connect(path)
    connection.row_factory = sqlite3.Row
    try:
        return connection.execute(
            """
            SELECT users.status, residents.presence,
                   (
                     SELECT status FROM outings
                     WHERE resident_id = residents.user_id AND status = 'outside'
                     LIMIT 1
                   ) AS outing_status
            FROM residents
            JOIN users ON users.id = residents.user_id
            WHERE residents.user_id = ?
            """,
            (RESIDENT_ID,),
        ).fetchone()
    finally:
        connection.close()


def outside_outing_count(path: Path) -> int:
    connection = sqlite3.connect(path)
    try:
        return connection.execute(
            "SELECT COUNT(*) FROM outings WHERE resident_id = ? AND status = 'outside'",
            (RESIDENT_ID,),
        ).fetchone()[0]
    finally:
        connection.close()


def test_suspension_keeps_outside_visible_and_allows_return(
    database_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    from app.main import app
    from app.shared import clock

    movable = MovableClock(NOW)
    monkeypatch.setattr(clock, "utc_now", movable.utc_now)
    first_outing = "e7700000-0000-4000-8000-000000000011"
    second_outing = "e7700000-0000-4000-8000-000000000012"

    with TestClient(app) as client:
        issue_people(database_path)
        insert_planned_outing(
            database_path,
            first_outing,
            expected="2026-09-30T12:05:00Z",
            grace="2026-09-30T12:10:00Z",
        )
        gate = sign_in(client, "gate.fatima", role_credential("gate"))
        warden = sign_in(client, "warden.sara", role_credential("warden"))
        provost = sign_in(client, "provost.halima", role_credential("provost"))
        gate_headers = auth(gate)

        exit_scan = client.post(
            "/api/v1/gate/scans",
            headers=gate_headers,
            json={"qr_payload": QR},
        )
        assert exit_scan.status_code == 200
        assert exit_scan.json()["outcome"] == "exit_recorded"

        connection = sqlite3.connect(database_path)
        try:
            connection.execute(
                "UPDATE hall_settings SET scan_duplicate_window_seconds = 45 WHERE id = 'hall'"
            )
            connection.commit()
        finally:
            connection.close()
        assert_error(
            client.post(
                "/api/v1/gate/scans",
                headers=gate_headers,
                json={"qr_payload": QR},
            ),
            409,
            "duplicate_scan",
        )
        assert_error(
            client.post(
                "/api/v1/gate/scans",
                headers=gate_headers,
                json={"qr_payload": "bsj:v1:unknown-token"},
            ),
            404,
            "unknown_hall_pass",
        )
        connection = sqlite3.connect(database_path)
        try:
            connection.execute(
                "UPDATE hall_settings SET scan_duplicate_window_seconds = 0 WHERE id = 'hall'"
            )
            connection.commit()
        finally:
            connection.close()

        suspended = client.patch(
            f"/api/v1/admin/residents/{RESIDENT_ID}",
            headers=auth(provost),
            json={"status": "suspended"},
        )
        assert suspended.status_code == 200
        assert suspended.json()["status"] == "suspended"
        state = resident_state(database_path)
        assert state["status"] == "suspended"
        assert state["presence"] == "outside"
        assert state["outing_status"] == "outside"

        summary = client.get("/api/v1/register/summary", headers=auth(warden)).json()
        assert summary["outside_count"] == 1
        assert summary["inside_count"] == 0
        assert summary["late_count"] == 0
        listed = client.get(
            "/api/v1/register/residents",
            headers=auth(warden),
            params={"state": "outside"},
        ).json()
        assert listed["total"] == 1
        assert listed["items"][0]["id"] == RESIDENT_ID

        # Past grace, still inside the 15-minute access-token lifetime.
        movable.moment = datetime(2026, 9, 30, 12, 10, 1, tzinfo=timezone.utc)
        late_summary = client.get("/api/v1/register/summary", headers=auth(warden)).json()
        assert late_summary["late_count"] == 1
        assert late_summary["outside_count"] == 0
        late_list = client.get(
            "/api/v1/register/residents",
            headers=auth(warden),
            params={"state": "late"},
        ).json()
        assert late_list["total"] == 1
        assert late_list["items"][0]["id"] == RESIDENT_ID

        returned = client.post(
            "/api/v1/gate/scans",
            headers=gate_headers,
            json={"qr_payload": QR},
        )
        assert returned.status_code == 200
        assert returned.json()["outcome"] == "return_recorded"
        after_return = resident_state(database_path)
        assert after_return["status"] == "suspended"
        assert after_return["presence"] == "inside"
        assert after_return["outing_status"] is None

        insert_planned_outing(
            database_path,
            second_outing,
            expected="2026-09-30T14:30:00Z",
            grace="2026-09-30T15:00:00Z",
        )
        blocked_exit = client.post(
            "/api/v1/gate/scans",
            headers=gate_headers,
            json={"qr_payload": QR},
        )
        assert_error(blocked_exit, 409, "resident_suspended")
        still = resident_state(database_path)
        assert still["presence"] == "inside"
        assert still["outing_status"] is None
        assert outside_outing_count(database_path) == 0

        reinstated = client.patch(
            f"/api/v1/admin/residents/{RESIDENT_ID}",
            headers=auth(provost),
            json={"status": "active"},
        )
        assert reinstated.status_code == 200
        assert reinstated.json()["status"] == "active"
        exit_again = client.post(
            "/api/v1/gate/scans",
            headers=gate_headers,
            json={"qr_payload": QR},
        )
        assert exit_again.status_code == 200
        assert exit_again.json()["outcome"] == "exit_recorded"
