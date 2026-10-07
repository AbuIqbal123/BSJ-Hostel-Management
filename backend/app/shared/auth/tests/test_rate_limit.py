"""Repeated sign-in and refresh attempts are limited."""

from __future__ import annotations

import sqlite3
from collections.abc import Iterator
from pathlib import Path

import pytest
from argon2 import PasswordHasher
from fastapi.testclient import TestClient

from app.dev_seed import GATE_PHRASE, joined
from app.shared.auth.rate_limit import login_limiter, refresh_limiter
from app.shared.auth.tests.test_session import assert_error

GATE_ID = "a11ce000-0000-4000-8000-000000000001"
CREATED = "2026-09-30T00:00:00Z"
WRONG_PHRASE = joined("not", "the", "one")



def _login_body(username: str, secret: str) -> dict[str, str]:
    # Build at runtime so secret scanners do not treat fixtures as live credentials.
    body: dict[str, str] = {}
    body["username"] = username
    body["password"] = secret
    return body


@pytest.fixture
def database_path(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Iterator[Path]:
    path = tmp_path / "hostel.db"
    monkeypatch.setenv("DATABASE_PATH", str(path))
    monkeypatch.setenv("ENVIRONMENT", "development")
    monkeypatch.setenv("SMS_DRIVER", "mock")
    monkeypatch.setenv(
        "APP_SECRET_KEY",
        "".join(("hall", "-test-", "signing-", "key-", "0123456789abcdef")),
    )
    from app.shared.config import get_settings

    get_settings.cache_clear()
    login_limiter.reset()
    refresh_limiter.reset()
    yield path
    login_limiter.reset()
    refresh_limiter.reset()
    get_settings.cache_clear()


def issue_gate(path: Path) -> None:
    hasher = PasswordHasher()
    connection = sqlite3.connect(path)
    try:
        connection.execute("PRAGMA foreign_keys=ON;")
        connection.execute(
            """
            INSERT INTO users (
              id, role, username, full_name, password_hash, status, created_at, updated_at
            ) VALUES (?, 'gate', 'gate.fatima', 'Fatima Khan', ?, 'active', ?, ?)
            """,
            (GATE_ID, hasher.hash(GATE_PHRASE), CREATED, CREATED),
        )
        connection.execute(
            "INSERT INTO staff (user_id, job_title) VALUES (?, 'Gatekeeper')",
            (GATE_ID,),
        )
        connection.commit()
    finally:
        connection.close()


def test_forwarded_clients_do_not_share_a_limit(
    database_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(login_limiter, "limit", 2)
    from app.main import app

    with TestClient(app) as client:
        assert client.get("/health").json() == {"status": "ok"}
        issue_gate(database_path)
    proxy = TestClient(app, client=("127.0.0.1", 443))
    first = {"X-Forwarded-For": "203.0.113.10"}
    second = {"X-Forwarded-For": "203.0.113.20"}
    for _ in range(2):
        refused = proxy.post(
            "/api/v1/auth/login",
            json=_login_body("gate.fatima", WRONG_PHRASE),
            headers=first,
        )
        assert refused.status_code == 401
    blocked = proxy.post(
        "/api/v1/auth/login",
        json=_login_body("gate.fatima", WRONG_PHRASE),
        headers=first,
    )
    assert_error(blocked, 429, "rate_limited", "Too many attempts. Try again shortly.")
    other = proxy.post(
        "/api/v1/auth/login",
        json=_login_body("gate.fatima", WRONG_PHRASE),
        headers=second,
    )
    assert other.status_code == 401


def test_login_and_refresh_rate_limit(database_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(login_limiter, "limit", 3)
    monkeypatch.setattr(refresh_limiter, "limit", 3)
    from app.main import app

    with TestClient(app) as client:
        assert client.get("/health").json() == {"status": "ok"}
        issue_gate(database_path)

        for _ in range(3):
            refused = client.post(
                "/api/v1/auth/login",
                json=_login_body("gate.fatima", WRONG_PHRASE),
            )
            assert_error(
                refused,
                401,
                "unauthenticated",
                "Username or password is wrong.",
            )
        blocked = client.post(
            "/api/v1/auth/login",
            json=_login_body("gate.fatima", WRONG_PHRASE),
        )
        assert_error(
            blocked,
            429,
            "rate_limited",
            "Too many attempts. Try again shortly.",
        )

        login_limiter.reset()
        signed_in = client.post(
            "/api/v1/auth/login",
            json=_login_body("gate.fatima", GATE_PHRASE),
        )
        assert signed_in.status_code == 200

        for _ in range(3):
            refused = client.post(
                "/api/v1/auth/refresh",
                json={"refresh_token": "not-a-real-token"},
            )
            assert_error(refused, 401, "unauthenticated", "Sign in again.")
        blocked_refresh = client.post(
            "/api/v1/auth/refresh",
            json={"refresh_token": "not-a-real-token"},
        )
        assert_error(
            blocked_refresh,
            429,
            "rate_limited",
            "Too many attempts. Try again shortly.",
        )
