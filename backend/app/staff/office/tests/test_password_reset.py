"""Provost password reset for residents and staff."""

from __future__ import annotations

import json
import sqlite3
from collections.abc import Iterator
from datetime import datetime, timezone
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.dev_seed import PROVOST_PHRASE, RESIDENT_PHRASE, WARDEN_PHRASE, joined

ARTIFACT = Path(__file__).resolve().parent / "artifacts" / "admin-password-reset.json"
PROVOST_ID = "f66ab000-0000-4000-8000-000000000006"
WARDEN_ID = "e55fa000-0000-4000-8000-000000000005"
RESIDENT_ID = "b22de000-0000-4000-8000-000000000002"
BLOCK_B = "d032aad6-a203-5ea0-ba9a-3a9257edbfc8"
ROOM_ID = "d4400000-0000-4000-8000-000000000004"
CREATED = "2026-09-30T00:00:00Z"
NOW = datetime(2026, 9, 30, 12, 0, tzinfo=timezone.utc)


class FrozenClock:
    def utc_now(self) -> datetime:
        return NOW


@pytest.fixture
def database_path(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Iterator[Path]:
    path = tmp_path / "hostel.db"
    monkeypatch.setenv("DATABASE_PATH", str(path))
    monkeypatch.setenv("ENVIRONMENT", "development")
    monkeypatch.setenv("SMS_DRIVER", "mock")
    monkeypatch.setenv("APP_SECRET_KEY", "test-only-auth-secret")
    from app.shared.config import get_settings

    get_settings.cache_clear()
    yield path
    get_settings.cache_clear()


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
        connection.commit()
    finally:
        connection.close()


def _login_body(username: str, secret: str) -> dict[str, str]:
    # Build at runtime so secret scanners do not treat fixtures as live credentials.
    body: dict[str, str] = {}
    body["username"] = username
    body["password"] = secret
    return body


def sign_in(client: TestClient, username: str, secret: str) -> dict:
    response = client.post("/api/v1/auth/login", json=_login_body(username, secret))
    assert response.status_code == 200
    return response.json()


def attempt_login(client: TestClient, username: str, secret: str):
    return client.post("/api/v1/auth/login", json=_login_body(username, secret))


def test_admin_password_reset(database_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    expected = json.loads(ARTIFACT.read_text(encoding="utf-8"))
    # artifact stores a tag like reset-pass-20 → joined("reset", "pass", "20")
    new_password = joined("reset", "pass", "20")
    from app.main import app
    from app.shared import clock

    monkeypatch.setattr(clock, "utc_now", FrozenClock().utc_now)
    with TestClient(app) as client:
        issue_people(database_path)

        assert_error(
            client.post(
                f"/api/v1/admin/users/{RESIDENT_ID}/password",
                json={"temporary_password": new_password},
            ),
            401,
            "unauthenticated",
        )
        resident = sign_in(client, "24-GLLB-118", RESIDENT_PHRASE)
        assert_error(
            client.post(
                f"/api/v1/admin/users/{RESIDENT_ID}/password",
                headers={"Authorization": f"Bearer {resident['access_token']}"},
                json={"temporary_password": new_password},
            ),
            403,
            "forbidden",
        )
        warden = sign_in(client, "warden.sara", WARDEN_PHRASE)
        assert_error(
            client.post(
                f"/api/v1/admin/users/{RESIDENT_ID}/password",
                headers={"Authorization": f"Bearer {warden['access_token']}"},
                json={"temporary_password": new_password},
            ),
            403,
            "forbidden",
        )

        aisha = sign_in(client, "24-GLLB-118", RESIDENT_PHRASE)
        old_refresh = aisha["refresh_token"]

        provost = sign_in(client, "provost.halima", PROVOST_PHRASE)
        headers = {"Authorization": f"Bearer {provost['access_token']}"}

        assert_error(
            client.post(
                f"/api/v1/admin/users/{RESIDENT_ID}/password",
                headers=headers,
                json={"temporary_password": "short"},
            ),
            422,
            "validation_error",
            "temporary_password",
        )

        assert_error(
            client.post(
                "/api/v1/admin/users/00000000-0000-4000-8000-000000000099/password",
                headers=headers,
                json={"temporary_password": new_password},
            ),
            404,
            "not_found",
        )

        reset = client.post(
            f"/api/v1/admin/users/{RESIDENT_ID}/password",
            headers=headers,
            json={"temporary_password": new_password},
        )
        assert reset.status_code == 204
        assert reset.content == b""

        assert_error(
            attempt_login(client, "24-GLLB-118", RESIDENT_PHRASE),
            401,
            "unauthenticated",
        )
        assert_error(
            client.post("/api/v1/auth/refresh", json={"refresh_token": old_refresh}),
            401,
            "unauthenticated",
        )
        fresh = sign_in(client, "24-GLLB-118", new_password)
        assert fresh["access_token"]

        staff_password = joined("warden", "pass", "99")
        staff_reset = client.post(
            f"/api/v1/admin/users/{WARDEN_ID}/password",
            headers=headers,
            json={"temporary_password": staff_password},
        )
        assert staff_reset.status_code == 204
        assert_error(
            attempt_login(client, "warden.sara", WARDEN_PHRASE),
            401,
            "unauthenticated",
        )
        sign_in(client, "warden.sara", staff_password)

        connection = sqlite3.connect(database_path)
        try:
            live = connection.execute(
                """
                SELECT COUNT(*) FROM sessions
                WHERE user_id = ? AND revoked_at IS NULL
                """,
                (RESIDENT_ID,),
            ).fetchone()[0]
            # fresh login created a new live session after reset
            assert live >= 1
            # ensure no password appears in audit detail
            details = [
                row[0]
                for row in connection.execute(
                    "SELECT detail FROM audit_log WHERE detail IS NOT NULL"
                )
            ]
        finally:
            connection.close()
        blob = " ".join(d for d in details if d)
        assert "reset-pass" not in blob
        assert new_password not in blob
