"""A resident can self-onboard and sign in immediately."""

from __future__ import annotations

import json
import sqlite3
from collections.abc import Iterator
from datetime import datetime, timezone
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.dev_seed import joined
from app.shared.auth.rate_limit import login_limiter, refresh_limiter
from app.shared.auth.security import password_matches
from app.shared.auth.tests.test_session import assert_error
from app.shared.testing_env import signing_key_for_tests

ARTIFACT = Path(__file__).resolve().parent / "artifacts" / "auth-resident-onboard.json"
BLOCK_A = "01b885ad-e40d-56a4-81ab-2371f654f558"
BLOCK_B = "d032aad6-a203-5ea0-ba9a-3a9257edbfc8"
ROOM_B = "d4400000-0000-4000-8000-000000000204"
ROOM_A = "d4400000-0000-4000-8000-000000000104"
NOW = datetime(2026, 9, 30, 12, 0, tzinfo=timezone.utc)
PHRASE = joined("Resident", "onboard", "10")
SHORT_PHRASE = "short"  # intentionally under 10 characters


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
    login_limiter.reset()
    refresh_limiter.reset()
    yield path
    login_limiter.reset()
    refresh_limiter.reset()
    get_settings.cache_clear()


def issue_rooms(path: Path) -> None:
    connection = sqlite3.connect(path)
    try:
        connection.execute("PRAGMA foreign_keys=ON;")
        connection.execute(
            """
            INSERT INTO rooms (id, block_id, number, label, bed_count, is_active) VALUES
              (?, ?, '204', 'B-204', 2, 1),
              (?, ?, '104', 'A-104', 1, 1)
            """,
            (ROOM_B, BLOCK_B, ROOM_A, BLOCK_A),
        )
        connection.commit()
    finally:
        connection.close()


def _body(**overrides: object) -> dict:
    payload: dict = {
        "full_name": "Fatima Noor",
        "enrolment_number": "24-GLLB-220",
        "password": PHRASE,
        "course": "B.A. LL.B. (Hons.)",
        "phone": "+919811112222",
        "block_id": BLOCK_B,
        "room_id": ROOM_B,
        "guardian_name": "Rashid Khan",
        "guardian_phone": "+919876543210",
    }
    payload.update(overrides)
    return payload


def read_resident(path: Path) -> dict:
    connection = sqlite3.connect(path)
    connection.row_factory = sqlite3.Row
    try:
        row = connection.execute(
            """
            SELECT
              users.role,
              users.username,
              users.full_name,
              users.status,
              users.password_hash,
              users.created_at,
              users.updated_at,
              users.last_login_at,
              residents.course,
              residents.phone,
              residents.guardian_name,
              residents.guardian_phone,
              residents.presence,
              residents.qr_token,
              rooms.label AS room_label,
              blocks.name AS block_name
            FROM users
            JOIN residents ON residents.user_id = users.id
            JOIN rooms ON rooms.id = residents.room_id
            JOIN blocks ON blocks.id = rooms.block_id
            """
        ).fetchone()
        assert row is not None
        return dict(row)
    finally:
        connection.close()


def test_resident_onboard(database_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    expected = json.loads(ARTIFACT.read_text(encoding="utf-8"))
    from app.main import app
    from app.shared import clock

    monkeypatch.setattr(clock, "utc_now", FrozenClock().utc_now)
    with TestClient(app) as client:
        assert client.get("/health").json() == {"status": "ok"}
        issue_rooms(database_path)

        missing = dict(_body())
        missing.pop("phone")
        refused_phone = client.post("/api/v1/auth/onboard", json=missing)
        assert_error(
            refused_phone,
            422,
            "validation_error",
            expected["missing_phone_message"],
            "phone",
        )

        short = client.post("/api/v1/auth/onboard", json=_body(password=SHORT_PHRASE))
        assert_error(
            short,
            422,
            "validation_error",
            expected["short_password_message"],
            "password",
        )

        for weak_password in ("lowercase1!", "UPPERCASE1!", "NoDigits!!!", "NoSymbol123"):
            weak = client.post("/api/v1/auth/onboard", json=_body(password=weak_password))
            assert_error(
                weak,
                422,
                "validation_error",
                expected["weak_password_message"],
                "password",
            )

        for bad_phone in ("+14155552671", "+91987654321", "+9198765432101", "919876543210"):
            refused = client.post("/api/v1/auth/onboard", json=_body(phone=bad_phone))
            assert_error(
                refused,
                422,
                "validation_error",
                expected["indian_mobile_message"],
                "phone",
            )
        refused_guardian = client.post(
            "/api/v1/auth/onboard",
            json=_body(guardian_phone="+447911123456"),
        )
        assert_error(
            refused_guardian,
            422,
            "validation_error",
            expected["indian_mobile_message"],
            "guardian_phone",
        )

        wrong_block = client.post(
            "/api/v1/auth/onboard",
            json=_body(block_id=BLOCK_A),
        )
        assert_error(
            wrong_block,
            422,
            "validation_error",
            expected["room_message"],
            "room_id",
        )
        assert wrong_block.status_code != 409

        created = client.post("/api/v1/auth/onboard", json=_body())
        assert created.status_code == 201
        body = created.json()
        assert body == expected["response"]
        assert "access_token" not in body
        assert "refresh_token" not in body
        assert "token" not in json.dumps(body)

        signed_in = client.post(
            "/api/v1/auth/login",
            json={"username": "24-GLLB-220", "password": PHRASE},
        )
        assert signed_in.status_code == 200
        token = signed_in.json()
        assert token["token_type"] == "bearer"
        assert token["user"]["role"] == "resident"
        assert token["user"]["username"] == "24-GLLB-220"
        assert token["user"]["status"] == "active"

        taken = client.post(
            "/api/v1/auth/onboard",
            json=_body(enrolment_number="24-gllb-220", full_name="Someone Else"),
        )
        assert_error(
            taken,
            422,
            "validation_error",
            expected["taken_message"],
            "enrolment_number",
        )
        dumped = json.dumps(taken.json())
        assert "duplicate" not in dumped

        stored = read_resident(database_path)
        assert stored["qr_token"].startswith("bsj:v1:")
        assert password_matches(stored["password_hash"], PHRASE)
        public = {
            key: stored[key]
            for key in expected["stored"]
        }
        assert public == expected["stored"]
        assert "qr_token" not in expected["stored"]
        connection = sqlite3.connect(database_path)
        try:
            onboarded = connection.execute(
                """
                SELECT users.username, audit_log.entity_type
                FROM audit_log
                JOIN users ON users.id = audit_log.entity_id
                  AND users.id = audit_log.actor_user_id
                WHERE audit_log.action = 'auth.onboard'
                """
            ).fetchall()
        finally:
            connection.close()
        assert onboarded == [(stored["username"], "person")]
        assert "password_hash" not in json.dumps(expected)

        login_limiter.reset()
        monkeypatch.setattr(login_limiter, "limit", 3)
        for _ in range(3):
            again = client.post(
                "/api/v1/auth/onboard",
                json=_body(enrolment_number="24-gllb-220"),
            )
            assert_error(
                again,
                422,
                "validation_error",
                expected["taken_message"],
                "enrolment_number",
            )
        blocked = client.post(
            "/api/v1/auth/onboard",
            json=_body(enrolment_number="24-gllb-220"),
        )
        assert_error(
            blocked,
            429,
            "rate_limited",
            "Too many attempts. Try again shortly.",
        )


def test_taken_enrolment_is_not_a_password_error(
    database_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    from app.shared import clock
    from app.main import app

    old_message = "Username or password is wrong."
    monkeypatch.setattr(clock, "utc_now", FrozenClock().utc_now)
    with TestClient(app) as client:
        issue_rooms(database_path)
        free = client.post(
            "/api/v1/auth/onboard/enrolment",
            json={"enrolment_number": "24-GLLB-220"},
        )
        assert free.status_code == 204
        assert free.content == b""
        created = client.post("/api/v1/auth/onboard", json=_body())
        assert created.status_code == 201
        taken = client.post(
            "/api/v1/auth/onboard/enrolment",
            json={"enrolment_number": "24-gllb-220"},
        )
        assert_error(
            taken,
            422,
            "validation_error",
            "That enrolment number is already an account.",
            "enrolment_number",
        )
        assert old_message not in json.dumps(taken.json())
        finished = client.post(
            "/api/v1/auth/onboard",
            json=_body(enrolment_number="24-gllb-220", full_name="Someone Else"),
        )
        assert_error(
            finished,
            422,
            "validation_error",
            "That enrolment number is already an account.",
            "enrolment_number",
        )
        assert old_message not in json.dumps(finished.json())
