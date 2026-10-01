"""Provost audit log."""

from __future__ import annotations

from app.shared.testing_env import signing_key_for_tests

import json
import sqlite3
import uuid
from collections.abc import Iterator
from datetime import datetime, timezone
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.dev_seed import PROVOST_PHRASE, RESIDENT_PHRASE, WARDEN_PHRASE

ARTIFACT = Path(__file__).resolve().parent / "artifacts" / "admin-audit.json"
PROVOST_ID = "f66ab000-0000-4000-8000-000000000006"
WARDEN_ID = "e55fa000-0000-4000-8000-000000000005"
RESIDENT_ID = "b22de000-0000-4000-8000-000000000002"
BLOCK_B = "d032aad6-a203-5ea0-ba9a-3a9257edbfc8"
ROOM_ID = "d4400000-0000-4000-8000-000000000004"
CREATED = "2026-09-30T00:00:00Z"
LOGIN_AT = "2026-09-30T11:00:00Z"
SETTINGS_AT = "2026-09-30T12:00:00Z"
NOW = datetime(2026, 9, 30, 12, 1, tzinfo=timezone.utc)  # after SETTINGS_AT so live login sorts first
LOGIN_AUDIT = "aa100000-0000-4000-8000-0000000000a1"
SETTINGS_AUDIT = "aa100000-0000-4000-8000-0000000000a2"


class FrozenClock:
    def utc_now(self) -> datetime:
        return NOW


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
            (PROVOST_ID, "provost", "provost.halima", "Halima Begum", PROVOST_PHRASE, "Provost"),
            (WARDEN_ID, "warden", "warden.sara", "Sara Malik", WARDEN_PHRASE, "Warden"),
            (RESIDENT_ID, "resident", "24-GLLB-118", "Aisha Khan", RESIDENT_PHRASE, None),
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
            INSERT INTO audit_log (
              id, occurred_at, actor_user_id, action, entity_type, entity_id, summary, detail
            ) VALUES
              (?, ?, ?, 'auth.login', 'person', ?, 'Aisha Khan signed in.', NULL),
              (?, ?, ?, 'settings.updated', 'settings', 'hall',
               'Halima Begum updated hall settings.', '{"grace_minutes":30}')
            """,
            (
                LOGIN_AUDIT,
                LOGIN_AT,
                RESIDENT_ID,
                RESIDENT_ID,
                SETTINGS_AUDIT,
                SETTINGS_AT,
                PROVOST_ID,
            ),
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


def test_admin_audit(database_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    expected = json.loads(ARTIFACT.read_text(encoding="utf-8"))
    from app.main import app
    from app.shared import clock

    monkeypatch.setattr(clock, "utc_now", FrozenClock().utc_now)
    with TestClient(app) as client:
        issue_people(database_path)

        assert_error(client.get("/api/v1/admin/audit"), 401, "unauthenticated")
        resident = sign_in(client, "24-GLLB-118", RESIDENT_PHRASE)
        assert_error(
            client.get("/api/v1/admin/audit", headers={"Authorization": f"Bearer {resident}"}),
            403,
            "forbidden",
        )
        warden = sign_in(client, "warden.sara", WARDEN_PHRASE)
        assert_error(
            client.get("/api/v1/admin/audit", headers={"Authorization": f"Bearer {warden}"}),
            403,
            "forbidden",
        )

        # login as provost adds another auth.login
        provost = sign_in(client, "provost.halima", PROVOST_PHRASE)
        headers = {"Authorization": f"Bearer {provost}"}

        listed = client.get("/api/v1/admin/audit?limit=50&offset=0", headers=headers)
        assert listed.status_code == 200
        body = listed.json()
        assert body["total"] >= 3
        assert "detail" not in json.dumps(body)
        actions = [item["action"] for item in body["items"]]
        # newest first: frozen clock is after SETTINGS_AT, so the live provost login leads
        assert actions[0] == "auth.login"
        assert expected["settings_action"] in actions
        settings_row = next(item for item in body["items"] if item["action"] == "settings.updated")
        assert settings_row["entity_type"] == "settings"
        assert settings_row["entity_id"] == "hall"
        assert settings_row["actor_name"] == "Halima Begum"
        assert settings_row["actor_user_id"] == PROVOST_ID

        filtered = client.get(
            "/api/v1/admin/audit?entity_type=settings&entity_id=hall",
            headers=headers,
        )
        assert filtered.status_code == 200
        assert filtered.json()["total"] == 1
        assert filtered.json()["items"][0]["action"] == "settings.updated"

        page = client.get("/api/v1/admin/audit?limit=1&offset=0", headers=headers)
        assert page.status_code == 200
        assert page.json()["limit"] == 1
        assert len(page.json()["items"]) == 1
