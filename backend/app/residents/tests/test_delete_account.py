"""A resident can delete the account she signs in with."""

from __future__ import annotations

import sqlite3
from collections.abc import Iterator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.shared.testing_env import role_credential
from app.shared.auth.rate_limit import login_limiter, refresh_limiter
from app.shared.auth.tests.test_session import (
    RESIDENT_ID,
    ROOM_ID,
    assert_error,
    bearer,
    issue_accounts,
)
from app.shared.testing_env import signing_key_for_tests


@pytest.fixture
def database_path(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Iterator[Path]:
    path = tmp_path / "hostel.db"
    monkeypatch.setenv("DATABASE_PATH", str(path))
    monkeypatch.setenv("ENVIRONMENT", "development")
    monkeypatch.setenv("SMS_DRIVER", "mock")
    monkeypatch.setenv("APP_SECRET_KEY", signing_key_for_tests())
    from app.shared.config import get_settings

    get_settings.cache_clear()
    login_limiter.reset()
    refresh_limiter.reset()
    yield path
    login_limiter.reset()
    refresh_limiter.reset()
    get_settings.cache_clear()


def _delete_body(secret: str) -> dict[str, str]:
    body: dict[str, str] = {}
    body["password"] = secret
    return body


def _login_body(username: str, secret: str) -> dict[str, str]:
    body: dict[str, str] = {}
    body["username"] = username
    body["password"] = secret
    return body


def test_resident_deletes_her_account(database_path: Path) -> None:
    from app.main import app

    with TestClient(app) as client:
        issue_accounts(database_path)
        assert client.get("/health").json() == {"status": "ok"}
        gate = client.post(
            "/api/v1/auth/login",
            json=_login_body("gate.fatima", role_credential("gate")),
        )
        assert gate.status_code == 200
        assert_error(
            client.post(
                "/api/v1/me/account/delete",
                json=_delete_body(role_credential("gate")),
                headers=bearer(gate.json()["access_token"]),
            ),
            403,
            "forbidden",
            "This account cannot do that.",
        )
        resident = client.post(
            "/api/v1/auth/login",
            json=_login_body("24-GLLB-118", role_credential("resident")),
        )
        assert resident.status_code == 200
        token = resident.json()["access_token"]
        assert_error(
            client.post(
                "/api/v1/me/account/delete",
                json=_delete_body("not-her-password"),
                headers=bearer(token),
            ),
            401,
            "unauthenticated",
            "The current password is wrong.",
        )
        deleted = client.post(
            "/api/v1/me/account/delete",
            json=_delete_body(role_credential("resident")),
            headers=bearer(token),
        )
        assert deleted.status_code == 204
        assert deleted.content == b""
        again = client.post(
            "/api/v1/auth/login",
            json=_login_body("24-GLLB-118", role_credential("resident")),
        )
        assert_error(again, 401, "unauthenticated", "Username or password is wrong.")
        connection = sqlite3.connect(database_path)
        connection.row_factory = sqlite3.Row
        try:
            user = connection.execute(
                "SELECT username, full_name, status FROM users WHERE id = ?",
                (RESIDENT_ID,),
            ).fetchone()
            profile = connection.execute(
                """
                SELECT enrolment_number, room_id, phone, guardian_name, qr_token
                FROM residents WHERE user_id = ?
                """,
                (RESIDENT_ID,),
            ).fetchone()
            on_old_room = connection.execute(
                "SELECT COUNT(*) AS n FROM residents WHERE room_id = ?",
                (ROOM_ID,),
            ).fetchone()["n"]
            live = connection.execute(
                """
                SELECT COUNT(*) AS n FROM sessions
                WHERE user_id = ? AND revoked_at IS NULL
                """,
                (RESIDENT_ID,),
            ).fetchone()["n"]
            actions = {
                row["action"]
                for row in connection.execute(
                    "SELECT action FROM audit_log WHERE entity_id = ?",
                    (RESIDENT_ID,),
                )
            }
        finally:
            connection.close()
        assert actions == {"auth.login", "resident.deleted"}
        assert user["full_name"] == "Deleted account"
        assert user["status"] == "suspended"
        assert user["username"].startswith("deleted-")
        assert profile["enrolment_number"] == user["username"]
        assert profile["room_id"] != ROOM_ID
        assert profile["phone"] is None
        assert profile["guardian_name"] == "Deleted"
        assert not str(profile["qr_token"]).endswith("test-resident-hall-pass")
        assert on_old_room == 0
        assert live == 0


def test_delete_is_refused_while_she_is_outside(
    database_path: Path,
) -> None:
    from app.main import app

    with TestClient(app) as client:
        issue_accounts(database_path)
        connection = sqlite3.connect(database_path)
        try:
            connection.execute("PRAGMA foreign_keys=ON;")
            connection.execute(
                "UPDATE residents SET presence = 'outside' WHERE user_id = ?",
                (RESIDENT_ID,),
            )
            connection.commit()
        finally:
            connection.close()
        resident = client.post(
            "/api/v1/auth/login",
            json=_login_body("24-GLLB-118", role_credential("resident")),
        )
        assert resident.status_code == 200
        assert_error(
            client.post(
                "/api/v1/me/account/delete",
                json=_delete_body(role_credential("resident")),
                headers=bearer(resident.json()["access_token"]),
            ),
            409,
            "account_in_use",
            "Return to the hall before deleting your account.",
        )
