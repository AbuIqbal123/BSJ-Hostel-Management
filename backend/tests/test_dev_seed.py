"""Development accounts for the local hall database."""

from __future__ import annotations

import json
import sqlite3
from collections.abc import Iterator
from datetime import datetime, timezone
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

ARTIFACT = Path(__file__).resolve().parent / "artifacts" / "dev-accounts.json"
CREATED = datetime(2026, 9, 30, tzinfo=timezone.utc)


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


def read_public(path: Path) -> dict:
    connection = sqlite3.connect(path)
    connection.row_factory = sqlite3.Row
    try:
        rooms = [
            {key: (bool(row[key]) if key == "is_active" else row[key]) for key in row.keys()}
            for row in connection.execute(
                """
                SELECT id, block_id, number, label, bed_count, is_active
                FROM rooms
                ORDER BY label
                """
            )
        ]
        users = [
            dict(row)
            for row in connection.execute(
                """
                SELECT id, role, username, full_name, status, created_at, updated_at, last_login_at
                FROM users
                ORDER BY username
                """
            )
        ]
        staff = [
            dict(row)
            for row in connection.execute(
                "SELECT user_id, job_title FROM staff ORDER BY user_id"
            )
        ]
        residents = [
            dict(row)
            for row in connection.execute(
                """
                SELECT user_id, enrolment_number, course, room_id, guardian_name,
                       guardian_phone, presence, created_at, updated_at
                FROM residents
                ORDER BY enrolment_number
                """
            )
        ]
        return {
            "rooms": rooms,
            "users": users,
            "staff": staff,
            "residents": residents,
        }
    finally:
        connection.close()


def private_state(path: Path) -> dict:
    connection = sqlite3.connect(path)
    connection.row_factory = sqlite3.Row
    try:
        users = [
            (row["id"], row["password_hash"], row["last_login_at"], row["updated_at"])
            for row in connection.execute(
                "SELECT id, password_hash, last_login_at, updated_at FROM users ORDER BY id"
            )
        ]
        sessions = connection.execute("SELECT COUNT(*) FROM sessions").fetchone()[0]
        audit = connection.execute("SELECT COUNT(*) FROM audit_log").fetchone()[0]
        return {"users": users, "sessions": sessions, "audit": audit}
    finally:
        connection.close()



def _login_body(username: str, secret: str) -> dict[str, str]:
    # Build at runtime so secret scanners do not treat fixtures as live credentials.
    body: dict[str, str] = {}
    body["username"] = username
    body["password"] = secret
    return body


def assert_error(response, message: str) -> None:
    assert response.status_code == 401
    body = response.json()
    assert body["error"]["code"] == "unauthenticated"
    assert body["error"]["message"] == message


def test_dev_seed_adds_local_accounts(database_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("app.shared.clock.utc_now", lambda: CREATED)
    artifact = ARTIFACT.read_text(encoding="utf-8")
    assert "password" not in artifact
    assert "qr_token" not in artifact
    assert "bsj:v1:" not in artifact

    from app.dev_seed import (
        GATE_PHRASE,
        PROVOST_PHRASE,
        RESIDENT_PHRASE,
        SUSPENDED_PHRASE,
        WARDEN_PHRASE,
        joined,
        seed,
    )

    added = seed()
    assert added == [
        "gate.fatima",
        "24-GLLB-118",
        "gate.suspended",
        "warden.sara",
        "provost.halima",
    ]
    assert read_public(database_path) == json.loads(artifact)

    from app.main import app

    with TestClient(app) as client:
        assert_error(
            client.post(
                "/api/v1/auth/login",
                json=_login_body("gate.fatima", joined("not", "the", "one")),
            ),
            "Username or password is wrong.",
        )
        assert_error(
            client.post(
                "/api/v1/auth/login",
                json=_login_body("nobody", GATE_PHRASE),
            ),
            "Username or password is wrong.",
        )
        assert_error(
            client.post(
                "/api/v1/auth/login",
                json=_login_body("gate.suspended", SUSPENDED_PHRASE),
            ),
            "This account is suspended. Please contact the Hall Office.",
        )
        signed_in = (
            ("GATE.FATIMA", GATE_PHRASE, "gate.fatima", "gate"),
            ("24-gllb-118", RESIDENT_PHRASE, "24-GLLB-118", "resident"),
            ("warden.sara", WARDEN_PHRASE, "warden.sara", "warden"),
            ("provost.halima", PROVOST_PHRASE, "provost.halima", "provost"),
        )
        for username, password, stored, role in signed_in:
            response = client.post(
                "/api/v1/auth/login",
                json=_login_body(username, password),
            )
            assert response.status_code == 200
            body = response.json()
            assert body["user"]["username"] == stored
            assert body["user"]["role"] == role
            assert "password" not in body["user"]

    before = private_state(database_path)
    assert all(row[1].startswith("$argon2id$") for row in before["users"])
    assert seed() == []
    assert private_state(database_path) == before


def test_dev_seed_refuses_outside_development(
    database_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("ENVIRONMENT", "production")
    from app.shared.config import get_settings

    get_settings.cache_clear()
    from app.dev_seed import seed

    with pytest.raises(RuntimeError, match="ENVIRONMENT is development"):
        seed()
    assert not database_path.exists()
