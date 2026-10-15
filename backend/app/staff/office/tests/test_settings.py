"""Provost hall settings read and update."""

from __future__ import annotations

import json
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.shared.testing_env import role_credential

ARTIFACT = Path(__file__).resolve().parent / "artifacts" / "admin-settings.json"
BLOCK_B = "d032aad6-a203-5ea0-ba9a-3a9257edbfc8"
PROVOST_ID = "f66ab000-0000-4000-8000-000000000006"
WARDEN_ID = "e55fa000-0000-4000-8000-000000000005"
RESIDENT_ID = "b22de000-0000-4000-8000-000000000002"
ROOM_ID = "d4400000-0000-4000-8000-000000000004"
OUTING_ID = "e7700000-0000-4000-8000-000000000041"
LIBRARY = "fc2da7c5-8d65-5680-8034-d8acb69745eb"
CREATED = "2026-09-30T00:00:00Z"
GRACE_ENDS = "2026-09-30T13:00:00Z"
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
              ?, ?, NULL, 'ordinary', 'planned', ?, 'Maulana Azad Library',
              '2026-09-30T12:30:00Z', ?, NULL, NULL,
              NULL, NULL, ?, ?, NULL, '2026-09-30'
            )
            """,
            (OUTING_ID, RESIDENT_ID, LIBRARY, GRACE_ENDS, CREATED, CREATED),
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


def test_admin_settings(database_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    expected = json.loads(ARTIFACT.read_text(encoding="utf-8"))
    from app.main import app
    from app.shared import clock

    monkeypatch.setattr(clock, "utc_now", FrozenClock().utc_now)
    with TestClient(app) as client:
        issue_people(database_path)

        assert_error(client.get("/api/v1/admin/settings"), 401, "unauthenticated")
        resident = sign_in(client, "24-GLLB-118", role_credential("resident"))
        assert_error(
            client.get(
                "/api/v1/admin/settings",
                headers={"Authorization": f"Bearer {resident}"},
            ),
            403,
            "forbidden",
        )
        warden = sign_in(client, "warden.sara", role_credential("warden"))
        assert_error(
            client.get(
                "/api/v1/admin/settings",
                headers={"Authorization": f"Bearer {warden}"},
            ),
            403,
            "forbidden",
        )

        provost = sign_in(client, "provost.halima", role_credential("provost"))
        headers = {"Authorization": f"Bearer {provost}"}

        listed = client.get("/api/v1/admin/settings", headers=headers)
        assert listed.status_code == 200
        body_defaults = listed.json()
        assert body_defaults == expected["defaults"]
        forbidden_names = {
            "summer_hours_start",
            "summer_hours_end",
            "winter_hours_start",
            "winter_hours_end",
            "permission_early_minutes",
            "late_sms_template",
            "return_sms_template",
        }
        assert forbidden_names.isdisjoint(body_defaults.keys())
        for key in (
            "summer_outing_start",
            "summer_outing_end",
            "winter_outing_start",
            "winter_outing_end",
            "permission_lead_minutes",
        ):
            assert key in body_defaults

        assert_error(
            client.patch(
                "/api/v1/admin/settings",
                headers=headers,
                json={"timezone": "UTC"},
            ),
            422,
            "validation_error",
            "timezone",
        )
        assert_error(
            client.patch(
                "/api/v1/admin/settings",
                headers=headers,
                json={"summer_outing_start": "18:30", "summer_outing_end": "06:30"},
            ),
            422,
            "validation_error",
            "summer_outing_end",
        )
        assert_error(
            client.patch(
                "/api/v1/admin/settings",
                headers=headers,
                json={"summer_season_start": "04-01", "winter_season_start": "04-01"},
            ),
            422,
            "validation_error",
            "winter_season_start",
        )
        assert_error(
            client.patch(
                "/api/v1/admin/settings",
                headers=headers,
                json={"late_sms_template": "Late without placeholders."},
            ),
            422,
            "validation_error",
        )

        empty = client.patch("/api/v1/admin/settings", headers=headers, json={})
        assert empty.status_code == 200
        assert empty.json() == expected["defaults"]

        patched = client.patch(
            "/api/v1/admin/settings",
            headers=headers,
            json=expected["patched"],
        )
        assert patched.status_code == 200
        body = patched.json()
        assert body["grace_minutes"] == 45
        assert body["guest_min_lead_days"] == 2
        assert body["timezone"] == "Asia/Kolkata"
        for key, value in expected["defaults"].items():
            if key not in expected["patched"]:
                assert body[key] == value

        reread = client.get("/api/v1/admin/settings", headers=headers)
        assert reread.status_code == 200
        assert reread.json() == body

        connection = sqlite3.connect(database_path)
        try:
            grace = connection.execute(
                "SELECT grace_ends_at FROM outings WHERE id = ?",
                (OUTING_ID,),
            ).fetchone()[0]
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
            updated_at = connection.execute(
                "SELECT updated_at FROM hall_settings WHERE id = 'hall'"
            ).fetchone()[0]
        finally:
            connection.close()
        assert grace == GRACE_ENDS
        assert actions == ["settings.updated"]
        assert updated_at == "2026-09-30T12:00:00Z"
