"""Access tokens carry the account's token_version and nothing else will do."""

from __future__ import annotations

import sqlite3
from pathlib import Path

import jwt
import pytest
from fastapi.testclient import TestClient

from app.shared.testing_env import role_credential
from app.staff.office.tests.test_password_reset import (
    CREATED,
    FrozenClock,
    assert_error,
    attempt_login,
    issue_people,
    sign_in,
)

GATE_ID = "c33ec000-0000-4000-8000-000000000003"
GATE_USERNAME = "gate.fatima"


def _bearer(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _resign(token: str, **claims: object) -> str:
    """Re-sign a real access token with some claims replaced or removed."""
    from app.shared.config import get_settings

    key = get_settings().app_secret_key
    payload = jwt.decode(token, key, algorithms=["HS256"], options={"verify_exp": False})
    for name, value in claims.items():
        if value is None:
            payload.pop(name, None)
        else:
            payload[name] = value
    return jwt.encode(payload, key, algorithm="HS256")


def _issue_gate(path: Path) -> None:
    from app.shared.auth.security import hash_password

    connection = sqlite3.connect(path)
    try:
        connection.execute(
            """
            INSERT INTO users (
              id, role, username, full_name, password_hash, status, created_at, updated_at
            ) VALUES (?, 'gate', ?, 'Fatima Khan', ?, 'active', ?, ?)
            """,
            (GATE_ID, GATE_USERNAME, hash_password(role_credential("gate")), CREATED, CREATED),
        )
        connection.execute(
            "INSERT INTO staff (user_id, job_title) VALUES (?, 'Gatekeeper')",
            (GATE_ID,),
        )
        connection.commit()
    finally:
        connection.close()


def test_access_token_version_claim(database_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    from app.main import app
    from app.shared import clock

    monkeypatch.setattr(clock, "utc_now", FrozenClock().utc_now)
    with TestClient(app) as client:
        issue_people(database_path)
        token = sign_in(client, "24-GLLB-118", role_credential("resident"))["access_token"]

        assert client.get("/api/v1/auth/me", headers=_bearer(_resign(token))).status_code == 200
        for forged in (
            _resign(token, ver=None),
            _resign(token, ver="0"),
            _resign(token, ver=True),
            _resign(token, ver=1),
            _resign(token, iat=None),
        ):
            assert_error(client.get("/api/v1/auth/me", headers=_bearer(forged)), 401, "unauthenticated")


def test_office_reset_of_gate_account(database_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    from app.main import app
    from app.shared import clock

    monkeypatch.setattr(clock, "utc_now", FrozenClock().utc_now)
    with TestClient(app) as client:
        issue_people(database_path)
        _issue_gate(database_path)
        gate_access = sign_in(client, GATE_USERNAME, role_credential("gate"))["access_token"]
        warden = sign_in(client, "warden.sara", role_credential("warden"))
        provost = sign_in(client, "provost.halima", role_credential("provost"))
        body = {"temporary_password": role_credential("reset")}

        assert_error(
            client.post(
                f"/api/v1/admin/users/{GATE_ID}/password",
                headers=_bearer(warden["access_token"]),
                json=body,
            ),
            403,
            "forbidden",
        )
        assert client.get("/api/v1/auth/me", headers=_bearer(gate_access)).status_code == 200

        reset = client.post(
            f"/api/v1/admin/users/{GATE_ID}/password",
            headers=_bearer(provost["access_token"]),
            json=body,
        )
        assert reset.status_code == 204
        assert_error(client.get("/api/v1/auth/me", headers=_bearer(gate_access)), 401, "unauthenticated")
        assert_error(attempt_login(client, GATE_USERNAME, role_credential("gate")), 401, "unauthenticated")
        sign_in(client, GATE_USERNAME, role_credential("reset"))
