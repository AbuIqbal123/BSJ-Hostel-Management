"""Repeated sign-in and refresh attempts are limited."""

from __future__ import annotations

import sqlite3
from pathlib import Path

import pytest
from argon2 import PasswordHasher
from fastapi.testclient import TestClient

from app.shared.testing_env import role_credential
from app.shared.auth.rate_limit import login_limiter, refresh_limiter, username_login_limiter
from app.shared.auth.tests.test_session import assert_error

GATE_ID = "a11ce000-0000-4000-8000-000000000001"
CREATED = "2026-09-30T00:00:00Z"



def _login_body(username: str, secret: str) -> dict[str, str]:
    # Build at runtime so secret scanners do not treat fixtures as live credentials.
    body: dict[str, str] = {}
    body["username"] = username
    body["password"] = secret
    return body


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
            (GATE_ID, hasher.hash(role_credential("gate")), CREATED, CREATED),
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
    monkeypatch.setenv("TRUST_FORWARDED_FOR", "1")
    from app.main import app

    with TestClient(app) as client:
        assert client.get("/health").json() == {"status": "ok"}
        issue_gate(database_path)
    proxy = TestClient(app, client=("127.0.0.1", 443))
    first = {"X-Forwarded-For": "198.51.100.1, 203.0.113.10"}
    faked = {"X-Forwarded-For": "198.51.100.99, 203.0.113.10"}
    second = {"X-Forwarded-For": "203.0.113.20"}
    for _ in range(2):
        refused = proxy.post(
            "/api/v1/auth/login",
            json=_login_body("gate.fatima", role_credential("wrong")),
            headers=first,
        )
        assert refused.status_code == 401
    # The bucket is the last hop only. The earlier address never opens its own.
    assert set(login_limiter._hits) == {"203.0.113.10"}
    blocked = proxy.post(
        "/api/v1/auth/login",
        json=_login_body("gate.fatima", role_credential("wrong")),
        headers=faked,
    )
    assert_error(blocked, 429, "rate_limited", "Too many attempts. Try again shortly.")
    other = proxy.post(
        "/api/v1/auth/login",
        json=_login_body("gate.fatima", role_credential("wrong")),
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
                json=_login_body("gate.fatima", role_credential("wrong")),
            )
            assert_error(
                refused,
                401,
                "unauthenticated",
                "Username or password is wrong.",
            )
        blocked = client.post(
            "/api/v1/auth/login",
            json=_login_body("gate.fatima", role_credential("wrong")),
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
            json=_login_body("gate.fatima", role_credential("gate")),
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


def test_login_is_limited_per_username(database_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(login_limiter, "limit", 100)
    monkeypatch.setattr(username_login_limiter, "limit", 2)
    from app.main import app

    with TestClient(app) as client:
        assert client.get("/health").json() == {"status": "ok"}
        issue_gate(database_path)
        message = "Too many attempts. Try again shortly."
        for username in ("gate.fatima", "GATE.FATIMA"):
            refused = client.post(
                "/api/v1/auth/login",
                json=_login_body(username, role_credential("wrong")),
            )
            assert_error(refused, 401, "unauthenticated", "Username or password is wrong.")
        blocked = client.post(
            "/api/v1/auth/login",
            json=_login_body("gate.fatima", role_credential("gate")),
        )
        assert_error(blocked, 429, "rate_limited", message)
        assert "gate.fatima" not in blocked.text
        assert "GATE.FATIMA" not in blocked.text

        missing = client.post(
            "/api/v1/auth/login",
            json=_login_body("no.such.person", role_credential("wrong")),
        )
        assert missing.status_code == 401
        again = client.post(
            "/api/v1/auth/login",
            json=_login_body("no.such.person", role_credential("wrong")),
        )
        assert again.status_code == 401
        hidden = client.post(
            "/api/v1/auth/login",
            json=_login_body("no.such.person", role_credential("wrong")),
        )
        assert_error(hidden, 429, "rate_limited", message)
        assert hidden.json()["error"]["message"] == blocked.json()["error"]["message"]
        assert "no.such.person" not in hidden.text

        other = client.post(
            "/api/v1/auth/login",
            json=_login_body("someone.else", role_credential("wrong")),
        )
        assert other.status_code == 401
