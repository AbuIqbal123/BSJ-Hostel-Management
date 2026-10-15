"""Provost hall notification templates read and update."""

from __future__ import annotations

import json
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.shared.testing_env import role_credential

ARTIFACT = Path(__file__).resolve().parent / "artifacts" / "admin-notifications.json"
BLOCK_B = "d032aad6-a203-5ea0-ba9a-3a9257edbfc8"
PROVOST_ID = "f66ab000-0000-4000-8000-000000000006"
WARDEN_ID = "e55fa000-0000-4000-8000-000000000005"
GATE_ID = "c44fa000-0000-4000-8000-000000000004"
RESIDENT_ID = "b22de000-0000-4000-8000-000000000002"
ROOM_ID = "d4400000-0000-4000-8000-000000000004"
CREATED = "2026-09-30T00:00:00Z"
NOW = datetime(2026, 9, 30, 12, 0, tzinfo=timezone.utc)


class FrozenClock:
    def utc_now(self) -> datetime:
        return NOW


def assert_error(response, status: int, code: str, field: str | None = None) -> None:
    assert response.status_code == status
    body = response.json()
    assert set(body) == {"error"}
    assert body["error"]["code"] == code
    if field is not None:
        assert body["error"]["details"] == {"field": field}


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
            (GATE_ID, "gate", "gate.fatima", "Fatima Khan", role_credential("gate"), "Gate"),
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


def test_admin_notifications(database_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    expected = json.loads(ARTIFACT.read_text(encoding="utf-8"))
    from app.main import app
    from app.shared import clock

    monkeypatch.setattr(clock, "utc_now", FrozenClock().utc_now)
    with TestClient(app) as client:
        issue_people(database_path)

        assert_error(client.get("/api/v1/admin/notifications"), 401, "unauthenticated")
        resident = sign_in(client, "24-GLLB-118", role_credential("resident"))
        assert_error(
            client.get(
                "/api/v1/admin/notifications",
                headers={"Authorization": f"Bearer {resident}"},
            ),
            403,
            "forbidden",
        )
        warden = sign_in(client, "warden.sara", role_credential("warden"))
        assert_error(
            client.get(
                "/api/v1/admin/notifications",
                headers={"Authorization": f"Bearer {warden}"},
            ),
            403,
            "forbidden",
        )
        gate = sign_in(client, "gate.fatima", role_credential("gate"))
        assert_error(
            client.get(
                "/api/v1/admin/notifications",
                headers={"Authorization": f"Bearer {gate}"},
            ),
            403,
            "forbidden",
        )

        provost = sign_in(client, "provost.halima", role_credential("provost"))
        headers = {"Authorization": f"Bearer {provost}"}

        listed = client.get("/api/v1/admin/notifications", headers=headers)
        assert listed.status_code == 200
        assert listed.json() == expected["defaults"]

        assert_error(
            client.patch(
                "/api/v1/admin/notifications",
                headers=headers,
                json={"late_sms_template": "Late without placeholders."},
            ),
            422,
            "validation_error",
            "late_sms_template",
        )

        empty = client.patch("/api/v1/admin/notifications", headers=headers, json={})
        assert empty.status_code == 200
        assert empty.json() == expected["defaults"]

        patched = client.patch(
            "/api/v1/admin/notifications",
            headers=headers,
            json=expected["patched"],
        )
        assert patched.status_code == 200
        body = patched.json()
        assert body["late_sms_template"] == expected["patched"]["late_sms_template"]
        assert body["return_sms_template"] == expected["defaults"]["return_sms_template"]

        reread = client.get("/api/v1/admin/notifications", headers=headers)
        assert reread.status_code == 200
        assert reread.json() == body

        settings = client.get("/api/v1/admin/settings", headers=headers)
        assert settings.status_code == 200
        assert "late_sms_template" not in settings.json()
        assert "return_sms_template" not in settings.json()

        connection = sqlite3.connect(database_path)
        try:
            actions = [
                row[0]
                for row in connection.execute(
                    """
                    SELECT action FROM audit_log
                    WHERE action = 'settings.updated'
                    ORDER BY occurred_at, rowid
                    """
                )
            ]
            summaries = [
                row[0]
                for row in connection.execute(
                    """
                    SELECT summary FROM audit_log
                    WHERE action = 'settings.updated'
                    ORDER BY occurred_at, rowid
                    """
                )
            ]
            updated_at = connection.execute(
                "SELECT updated_at FROM hall_settings WHERE id = 'hall'"
            ).fetchone()[0]
            stored_late = connection.execute(
                "SELECT late_sms_template FROM hall_settings WHERE id = 'hall'"
            ).fetchone()[0]
        finally:
            connection.close()
        assert actions == ["settings.updated"]
        assert "notification" in summaries[0].lower()
        assert updated_at == "2026-09-30T12:00:00Z"
        assert stored_late == expected["patched"]["late_sms_template"]
