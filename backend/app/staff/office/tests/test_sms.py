"""Provost SMS log."""

from __future__ import annotations

import json
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.shared.testing_env import role_credential

ARTIFACT = Path(__file__).resolve().parent / "artifacts" / "admin-sms.json"
PROVOST_ID = "f66ab000-0000-4000-8000-000000000006"
WARDEN_ID = "e55fa000-0000-4000-8000-000000000005"
RESIDENT_ID = "b22de000-0000-4000-8000-000000000002"
BLOCK_B = "d032aad6-a203-5ea0-ba9a-3a9257edbfc8"
ROOM_ID = "d4400000-0000-4000-8000-000000000004"
LIBRARY = "fc2da7c5-8d65-5680-8034-d8acb69745eb"
OUTING_ID = "e7700000-0000-4000-8000-000000000051"
LATE_SMS = "bb100000-0000-4000-8000-0000000000b1"
RETURN_SMS = "bb100000-0000-4000-8000-0000000000b2"
CREATED = "2026-09-30T00:00:00Z"
NOW = datetime(2026, 9, 30, 12, 0, tzinfo=timezone.utc)


class FrozenClock:
    def utc_now(self) -> datetime:
        return NOW


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
        people = (
            (PROVOST_ID, "provost", "provost.halima", "Halima Begum", role_credential("provost"), "Provost"),
            (WARDEN_ID, "warden", "warden.sara", "Sara Malik", role_credential("warden"), "Warden"),
            (RESIDENT_ID, "resident", "24-GLLB-118", "Aisha Khan", role_credential("resident"), None),
        )
        for user_id, role, username, full_name, password, job in people:
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
            ) VALUES (
              ?, '24-GLLB-118', 'B.A. LL.B. (Hons.)', ?, 'Rashid Khan',
              '+919876543210', 'bsj:v1:test-resident-hall-pass', 'inside', ?, ?
            )
            """,
            (RESIDENT_ID, ROOM_ID, CREATED, CREATED),
        )
        connection.execute(
            """
            INSERT INTO outings (
              id, resident_id, permission_id, type, status, destination_id, place,
              expected_return_at, grace_ends_at, exited_at, exit_recorded_by,
              returned_at, return_recorded_by, created_at, updated_at, cancelled_at, hall_date
            ) VALUES (
              ?, ?, NULL, 'ordinary', 'returned', ?, 'Maulana Azad Library',
              '2026-09-30T12:00:00Z', '2026-09-30T12:30:00Z',
              '2026-09-30T10:00:00Z', ?,
              '2026-09-30T12:45:00Z', ?, ?, ?, NULL, '2026-09-30'
            )
            """,
            (OUTING_ID, RESIDENT_ID, LIBRARY, PROVOST_ID, PROVOST_ID, CREATED, CREATED),
        )
        connection.execute(
            """
            INSERT INTO guardian_messages (
              id, outing_id, resident_id, notice_type, recipient_phone, body,
              driver, status, provider_reference, error, created_at
            ) VALUES
              (?, ?, ?, 'late_notice', '+919876543210', 'Late body.', 'mock', 'sent',
               'mock-late', NULL, '2026-09-30T12:31:00Z'),
              (?, ?, ?, 'return_notice', '+919876543210', 'Return body.', 'mock', 'sent',
               'mock-return', NULL, '2026-09-30T12:46:00Z')
            """,
            (LATE_SMS, OUTING_ID, RESIDENT_ID, RETURN_SMS, OUTING_ID, RESIDENT_ID),
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


def test_admin_sms(database_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    expected = json.loads(ARTIFACT.read_text(encoding="utf-8"))
    from app.main import app
    from app.shared import clock

    monkeypatch.setattr(clock, "utc_now", FrozenClock().utc_now)
    with TestClient(app) as client:
        issue_people(database_path)

        assert_error(client.get("/api/v1/admin/sms"), 401, "unauthenticated")
        resident = sign_in(client, "24-GLLB-118", role_credential("resident"))
        assert_error(
            client.get("/api/v1/admin/sms", headers={"Authorization": f"Bearer {resident}"}),
            403,
            "forbidden",
        )
        warden = sign_in(client, "warden.sara", role_credential("warden"))
        assert_error(
            client.get("/api/v1/admin/sms", headers={"Authorization": f"Bearer {warden}"}),
            403,
            "forbidden",
        )

        provost = sign_in(client, "provost.halima", role_credential("provost"))
        headers = {"Authorization": f"Bearer {provost}"}

        listed = client.get("/api/v1/admin/sms", headers=headers)
        assert listed.status_code == 200
        body = listed.json()
        assert body["total"] == 2
        types = [item["notice_type"] for item in body["items"]]
        assert types == expected["notice_types_newest_first"]
        assert body["items"][0]["resident_name"] == expected["resident_name"]
        assert body["items"][0]["outing_id"] == OUTING_ID
        assert "driver" not in body["items"][0]
        assert body["items"][0]["status"] == "sent"

        page = client.get("/api/v1/admin/sms?limit=1&offset=1", headers=headers)
        assert page.status_code == 200
        assert page.json()["total"] == 2
        assert len(page.json()["items"]) == 1
        assert page.json()["items"][0]["notice_type"] == "late_notice"
