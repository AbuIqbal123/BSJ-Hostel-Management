"""Sign-in, refresh, sign-out, and a password change."""

from __future__ import annotations

import json
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

import pytest
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError
from fastapi.testclient import TestClient

from app.shared.testing_env import role_credential

ARTIFACT = Path(__file__).resolve().parent / "artifacts" / "auth-session.json"
BLOCK_B = "d032aad6-a203-5ea0-ba9a-3a9257edbfc8"
GATE_ID = "a11ce000-0000-4000-8000-000000000001"
RESIDENT_ID = "b22de000-0000-4000-8000-000000000002"
SUSPENDED_ID = "c33ef000-0000-4000-8000-000000000003"
ROOM_ID = "d4400000-0000-4000-8000-000000000004"
CREATED = "2026-09-30T00:00:00Z"
LEAK_CHECK_VALUES = (
    role_credential("gate"),
    role_credential("gate-new"),
    role_credential("resident"),
    role_credential("suspended"),
)



def _login_body(username: str, secret: str) -> dict[str, str]:
    # Build at runtime so secret scanners do not treat fixtures as live credentials.
    body: dict[str, str] = {}
    body["username"] = username
    body["password"] = secret
    return body


class FrozenClock:
    def __init__(self) -> None:
        self.moment = datetime(2026, 9, 30, 0, 1, tzinfo=timezone.utc)

    def utc_now(self) -> datetime:
        return self.moment

    def set(self, minute: int, second: int = 0, *, day: int = 30, month: int = 9) -> None:
        self.moment = datetime(2026, month, day, 0, minute, second, tzinfo=timezone.utc)


def issue_accounts(path: Path) -> None:
    hasher = PasswordHasher()
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
        accounts = (
            (GATE_ID, "gate", "gate.fatima", "Fatima Khan", role_credential("gate"), "active"),
            (RESIDENT_ID, "resident", "24-GLLB-118", "Aisha Khan", role_credential("resident"), "active"),
            (SUSPENDED_ID, "gate", "gate.suspended", "Noor Ali", role_credential("suspended"), "suspended"),
        )
        for user_id, role, username, full_name, password, status in accounts:
            connection.execute(
                """
                INSERT INTO users (
                  id, role, username, full_name, password_hash, status, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    user_id,
                    role,
                    username,
                    full_name,
                    hasher.hash(password),
                    status,
                    CREATED,
                    CREATED,
                ),
            )
        connection.execute(
            "INSERT INTO staff (user_id, job_title) VALUES (?, 'Gatekeeper')",
            (GATE_ID,),
        )
        connection.execute(
            "INSERT INTO staff (user_id, job_title) VALUES (?, 'Gatekeeper')",
            (SUSPENDED_ID,),
        )
        connection.execute(
            """
            INSERT INTO residents (
              user_id, enrolment_number, course, room_id, guardian_name, guardian_phone,
              qr_token, presence, created_at, updated_at
            ) VALUES (?, '24-GLLB-118', 'B.A. LL.B. (Hons.)', ?, 'Rashid Khan',
              '+919876543210', 'bsj:v1:test-resident-hall-pass', 'inside', ?, ?)
            """,
            (RESIDENT_ID, ROOM_ID, CREATED, CREATED),
        )
        connection.commit()
    finally:
        connection.close()


def assert_error(response, status: int, code: str, message: str, field: str | None = None) -> None:
    assert response.status_code == status
    body = response.json()
    assert set(body) == {"detail", "error"}
    assert body["detail"] == body["error"]["message"]
    assert isinstance(body["error"].get("request_id"), str) and body["error"]["request_id"]
    error = body["error"]
    assert error["code"] == code
    assert error["message"] == message
    if field is None:
        assert "details" not in error
    else:
        assert error["details"] == {"field": field}


def assert_token(body: dict, user_id: str, role: str, full_name: str, username: str) -> None:
    assert set(body) == {"access_token", "token_type", "expires_in", "refresh_token", "user"}
    assert body["token_type"] == "bearer"
    assert body["expires_in"] == 900
    assert body["access_token"].count(".") == 2
    assert body["refresh_token"]
    assert body["user"] == {
        "id": user_id,
        "role": role,
        "full_name": full_name,
        "username": username,
        "status": "active",
    }


def bearer(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def read_auth_state(path: Path) -> dict:
    connection = sqlite3.connect(path)
    connection.row_factory = sqlite3.Row
    try:
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
        sessions = [
            dict(row)
            for row in connection.execute(
                """
                SELECT user_id, created_at, expires_at, revoked_at
                FROM sessions
                ORDER BY created_at
                """
            )
        ]
        audit_log = [
            dict(row)
            for row in connection.execute(
                """
                SELECT occurred_at, actor_user_id, action, entity_type, entity_id, summary, detail
                FROM audit_log
                ORDER BY occurred_at
                """
            )
        ]
        return {"users": users, "sessions": sessions, "audit_log": audit_log}
    finally:
        connection.close()


def test_logout_does_not_succeed_when_the_commit_fails(
    database_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    from app.main import app

    with TestClient(app) as client:
        issue_accounts(database_path)
        signed = client.post(
            "/api/v1/auth/login",
            json=_login_body("gate.fatima", role_credential("gate")),
        )
        assert signed.status_code == 200
        token = signed.json()["access_token"]

        def fail_commit(scope: object) -> None:
            raise sqlite3.OperationalError("disk I/O error")

        monkeypatch.setattr("app.main.commit_request", fail_commit)
        try:
            response = client.post("/api/v1/auth/logout", headers=bearer(token))
        finally:
            monkeypatch.undo()
        assert response.status_code == 500
        connection = sqlite3.connect(database_path)
        try:
            connection.row_factory = sqlite3.Row
            live = connection.execute(
                "SELECT COUNT(*) AS n FROM sessions WHERE revoked_at IS NULL"
            ).fetchone()["n"]
        finally:
            connection.close()
        assert live == 1


def test_auth_session(database_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    expected = json.loads(ARTIFACT.read_text(encoding="utf-8"))
    from app.shared import clock
    from app.main import app

    frozen = FrozenClock()
    monkeypatch.setattr(clock, "utc_now", frozen.utc_now)

    with TestClient(app) as client:
        assert client.get("/health").json() == {"status": "ok"}
        issue_accounts(database_path)
        frozen.set(1)

        wrong = client.post(
            "/api/v1/auth/login",
            json=_login_body("gate.fatima", role_credential("wrong")),
        )
        assert_error(
            wrong,
            401,
            "unauthenticated",
            "Username or password is wrong.",
        )
        unknown = client.post(
            "/api/v1/auth/login",
            json=_login_body("nobody", role_credential("gate")),
        )
        assert_error(unknown, 401, "unauthenticated", "Username or password is wrong.")
        suspended = client.post(
            "/api/v1/auth/login",
            json=_login_body("gate.suspended", role_credential("suspended")),
        )
        assert_error(
            suspended,
            401,
            "unauthenticated",
            "This account is suspended. Please contact the Hall Office.",
        )
        missing = client.post("/api/v1/auth/login", json={"username": "gate.fatima"})
        assert_error(missing, 422, "validation_error", "Password is required.", "password")

        signed_in = client.post(
            "/api/v1/auth/login",
            json=_login_body("GATE.FATIMA", role_credential("gate")),
        )
        assert signed_in.status_code == 200
        first = signed_in.json()
        assert_token(first, GATE_ID, "gate", "Fatima Khan", "gate.fatima")

        me = client.get("/api/v1/auth/me", headers=bearer(first["access_token"]))
        assert me.status_code == 200
        assert me.json() == {
            "id": GATE_ID,
            "role": "gate",
            "full_name": "Fatima Khan",
            "username": "gate.fatima",
            "status": "active",
            "resident": None,
            "staff": {"job_title": "Gatekeeper"},
        }
        assert_error(
            client.get("/api/v1/auth/me"),
            401,
            "unauthenticated",
            "Sign in again.",
        )
        assert_error(
            client.get("/api/v1/auth/me", headers=bearer("not-a-token")),
            401,
            "unauthenticated",
            "Sign in again.",
        )
        assert_error(
            client.post("/api/v1/auth/logout"),
            401,
            "unauthenticated",
            "Sign in again.",
        )

        frozen.set(2)
        rotated = client.post(
            "/api/v1/auth/refresh",
            json={"refresh_token": first["refresh_token"]},
        )
        assert rotated.status_code == 200
        second = rotated.json()
        assert_token(second, GATE_ID, "gate", "Fatima Khan", "gate.fatima")
        assert second["refresh_token"] != first["refresh_token"]
        assert_error(
            client.post("/api/v1/auth/refresh", json={"refresh_token": first["refresh_token"]}),
            401,
            "unauthenticated",
            "Sign in again.",
        )
        assert_error(
            client.post("/api/v1/auth/refresh", json={}),
            422,
            "validation_error",
            "Refresh token is required.",
            "refresh_token",
        )

        frozen.set(3)
        other_phone = client.post(
            "/api/v1/auth/login",
            json=_login_body("gate.fatima", role_credential("gate")),
        )
        assert other_phone.status_code == 200
        third = other_phone.json()

        frozen.set(4)
        signed_out = client.post(
            "/api/v1/auth/logout",
            headers=bearer(second["access_token"]),
        )
        assert signed_out.status_code == 204
        assert signed_out.content == b""
        assert_error(
            client.post("/api/v1/auth/refresh", json={"refresh_token": second["refresh_token"]}),
            401,
            "unauthenticated",
            "Sign in again.",
        )
        assert_error(
            client.post("/api/v1/auth/refresh", json={"refresh_token": third["refresh_token"]}),
            401,
            "unauthenticated",
            "Sign in again.",
        )
        still_open = client.get("/api/v1/auth/me", headers=bearer(second["access_token"]))
        assert still_open.status_code == 200

        frozen.set(5)
        again = client.post(
            "/api/v1/auth/login",
            json=_login_body("gate.fatima", role_credential("gate")),
        )
        assert again.status_code == 200
        fourth = again.json()
        assert_error(
            client.post(
                "/api/v1/auth/change-password",
                headers=bearer(fourth["access_token"]),
                json={"current_password": role_credential("wrong"), "new_password": role_credential("gate-new")},
            ),
            401,
            "unauthenticated",
            "The current password is wrong.",
        )
        assert_error(
            client.post(
                "/api/v1/auth/change-password",
                headers=bearer(fourth["access_token"]),
                json={"current_password": role_credential("gate"), "new_password": "short"},
            ),
            422,
            "validation_error",
            "Use at least 10 characters.",
            "new_password",
        )
        for weak_password in ("lowercase1!", "UPPERCASE1!", "NoDigits!!!", "NoSymbol123"):
            assert_error(
                client.post(
                    "/api/v1/auth/change-password",
                    headers=bearer(fourth["access_token"]),
                    json={"current_password": role_credential("gate"), "new_password": weak_password},
                ),
                422,
                "validation_error",
                "Include an uppercase letter, a lowercase letter, a number, and a symbol.",
                "new_password",
            )
        assert_error(
            client.post(
                "/api/v1/auth/change-password",
                json={"current_password": role_credential("gate"), "new_password": role_credential("gate-new")},
            ),
            401,
            "unauthenticated",
            "Sign in again.",
        )

        frozen.set(6)
        changed = client.post(
            "/api/v1/auth/change-password",
            headers=bearer(fourth["access_token"]),
            json={"current_password": role_credential("gate"), "new_password": role_credential("gate-new")},
        )
        assert changed.status_code == 204
        assert changed.content == b""
        assert_error(
            client.post("/api/v1/auth/refresh", json={"refresh_token": fourth["refresh_token"]}),
            401,
            "unauthenticated",
            "Sign in again.",
        )
        assert client.get("/api/v1/auth/me", headers=bearer(fourth["access_token"])).status_code == 200
        assert_error(
            client.post(
                "/api/v1/auth/login",
                json=_login_body("gate.fatima", role_credential("gate")),
            ),
            401,
            "unauthenticated",
            "Username or password is wrong.",
        )

        frozen.set(7)
        replaced = client.post(
            "/api/v1/auth/login",
            json=_login_body("gate.fatima", role_credential("gate-new")),
        )
        assert replaced.status_code == 200
        fifth = replaced.json()
        assert_token(fifth, GATE_ID, "gate", "Fatima Khan", "gate.fatima")

        frozen.set(8)
        resident = client.post(
            "/api/v1/auth/login",
            json=_login_body("24-gllb-118", role_credential("resident")),
        )
        assert resident.status_code == 200
        resident_body = resident.json()
        assert_token(resident_body, RESIDENT_ID, "resident", "Aisha Khan", "24-GLLB-118")
        resident_me = client.get(
            "/api/v1/auth/me",
            headers=bearer(resident_body["access_token"]),
        )
        assert resident_me.status_code == 200
        assert resident_me.json() == {
            "id": RESIDENT_ID,
            "role": "resident",
            "full_name": "Aisha Khan",
            "username": "24-GLLB-118",
            "status": "active",
            "resident": {
                "enrolment_number": "24-GLLB-118",
                "course": "B.A. LL.B. (Hons.)",
                "room_label": "B-204",
                "block_name": "Block-B",
                "presence": "inside",
            },
            "staff": None,
        }

        frozen.set(9)
        latest = client.post(
            "/api/v1/auth/login",
            json=_login_body("gate.fatima", role_credential("gate-new")),
        )
        assert latest.status_code == 200
        sixth = latest.json()

        frozen.set(25)
        assert_error(
            client.get("/api/v1/auth/me", headers=bearer(fifth["access_token"])),
            401,
            "unauthenticated",
            "Sign in again.",
        )

        frozen.set(9, 1, day=30, month=10)
        assert_error(
            client.post("/api/v1/auth/refresh", json={"refresh_token": sixth["refresh_token"]}),
            401,
            "unauthenticated",
            "Sign in again.",
        )

    raw = database_path.read_bytes()
    for secret in LEAK_CHECK_VALUES:
        assert secret.encode() not in raw
    for token in (
        first["refresh_token"],
        second["refresh_token"],
        third["refresh_token"],
        fourth["refresh_token"],
        fifth["refresh_token"],
        sixth["refresh_token"],
        first["access_token"],
        fifth["access_token"],
    ):
        assert token.encode() not in raw

    connection = sqlite3.connect(database_path)
    try:
        gate_hash = connection.execute(
            "SELECT password_hash FROM users WHERE id = ?",
            (GATE_ID,),
        ).fetchone()[0]
        resident_hash = connection.execute(
            "SELECT password_hash FROM users WHERE id = ?",
            (RESIDENT_ID,),
        ).fetchone()[0]
    finally:
        connection.close()
    assert gate_hash.startswith("$argon2id$")
    assert resident_hash.startswith("$argon2id$")
    checker = PasswordHasher()
    checker.verify(gate_hash, role_credential("gate-new"))
    with pytest.raises(VerifyMismatchError):
        checker.verify(gate_hash, role_credential("gate"))

    assert read_auth_state(database_path) == expected
