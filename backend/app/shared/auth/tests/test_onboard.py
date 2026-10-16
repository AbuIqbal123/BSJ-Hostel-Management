"""A resident can self-onboard and sign in immediately."""

from __future__ import annotations

import json
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.shared.testing_env import role_credential
from app.shared.auth.rate_limit import login_limiter
from app.shared.auth.security import hash_password, password_matches
from app.shared.auth.tests.test_session import assert_error

ARTIFACT = Path(__file__).resolve().parent / "artifacts" / "auth-resident-onboard.json"
BLOCK_A = "01b885ad-e40d-56a4-81ab-2371f654f558"
BLOCK_B = "d032aad6-a203-5ea0-ba9a-3a9257edbfc8"
ROOM_B = "d4400000-0000-4000-8000-000000000204"
ROOM_A = "d4400000-0000-4000-8000-000000000104"
NOW = datetime(2026, 9, 30, 12, 0, tzinfo=timezone.utc)


class FrozenClock:
    def utc_now(self) -> datetime:
        return NOW


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
        "password": role_credential("onboard"),
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

        short = client.post("/api/v1/auth/onboard", json=_body(password="short"))
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
            json={"username": "24-GLLB-220", "password": role_credential("onboard")},
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
        assert password_matches(stored["password_hash"], role_credential("onboard"))
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


def _fill_room(path: Path, room_id: str, count: int) -> None:
    connection = sqlite3.connect(path)
    try:
        connection.execute("PRAGMA foreign_keys=ON;")
        phrase = hash_password(role_credential("resident-options-10"))
        for index in range(count):
            user_id = f"b22de200-0000-4000-8000-{index + 1:012d}"
            username = f"24-FULL-{index + 1:03d}"
            connection.execute(
                """
                INSERT INTO users (
                  id, role, username, full_name, password_hash, status, created_at, updated_at
                ) VALUES (?, 'resident', ?, 'Aisha Khan', ?, 'active', ?, ?)
                """,
                (user_id, username, phrase, "2026-09-30T00:00:00Z", "2026-09-30T00:00:00Z"),
            )
            connection.execute(
                """
                INSERT INTO residents (
                  user_id, enrolment_number, course, room_id, guardian_name, guardian_phone,
                  qr_token, presence, created_at, updated_at
                ) VALUES (?, ?, NULL, ?, 'Rashid Khan', '+919876543210', ?, 'inside', ?, ?)
                """,
                (
                    user_id,
                    username,
                    room_id,
                    f"bsj:v1:{username}",
                    "2026-09-30T00:00:00Z",
                    "2026-09-30T00:00:00Z",
                ),
            )
        connection.commit()
    finally:
        connection.close()


def test_signup_race_returns_room_full(database_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    """The bed check and the insert can disagree for one moment. The insert still refuses."""
    from app.main import app
    from app.shared import clock
    from app.shared.auth import routes as auth_routes

    monkeypatch.setattr(clock, "utc_now", FrozenClock().utc_now)
    monkeypatch.setattr(auth_routes, "room_has_capacity", lambda *_args, **_kwargs: True)
    with TestClient(app) as client:
        issue_rooms(database_path)
        _fill_room(database_path, ROOM_B, 2)
        refused = client.post("/api/v1/auth/onboard", json=_body())
        assert_error(
            refused,
            422,
            "validation_error",
            "This room already has as many residents as it has beds.",
            "room_id",
        )
        connection = sqlite3.connect(database_path)
        try:
            taken = connection.execute(
                "SELECT COUNT(*) FROM residents WHERE room_id = ?",
                (ROOM_B,),
            ).fetchone()[0]
        finally:
            connection.close()
        assert taken == 2


def test_closed_signup_asks_for_the_hall_office(
    database_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    from app.main import app
    from app.shared import clock
    from app.shared.config import get_settings

    monkeypatch.setenv("ONBOARD_ENABLED", "false")
    get_settings.cache_clear()
    monkeypatch.setattr(clock, "utc_now", FrozenClock().utc_now)
    message = "Ask the hall office to create your account."
    try:
        with TestClient(app) as client:
            issue_rooms(database_path)
            _fill_room(database_path, ROOM_A, 1)
            counted = sqlite3.connect(database_path)
            try:
                before = counted.execute("SELECT COUNT(*) FROM users").fetchone()[0]
            finally:
                counted.close()
            fresh = client.post("/api/v1/auth/onboard", json=_body())
            taken = client.post(
                "/api/v1/auth/onboard",
                json=_body(enrolment_number="24-FULL-001"),
            )
            fresh_check = client.post(
                "/api/v1/auth/onboard/enrolment",
                json={"enrolment_number": "24-NEW-001"},
            )
            taken_check = client.post(
                "/api/v1/auth/onboard/enrolment",
                json={"enrolment_number": "24-FULL-001"},
            )
            for response in (fresh, taken, fresh_check, taken_check):
                assert_error(response, 403, "onboard_closed", message)
                assert "24-FULL-001" not in response.text
                assert "already" not in response.text.lower()
            assert fresh.json()["error"]["message"] == taken.json()["error"]["message"]
            counted = sqlite3.connect(database_path)
            try:
                after = counted.execute("SELECT COUNT(*) FROM users").fetchone()[0]
            finally:
                counted.close()
            assert after == before

            office = client.post(
                "/api/v1/auth/login",
                json={"username": "24-FULL-001", "password": role_credential("resident-options-10")},
            )
            assert office.status_code == 200
            assert office.json()["user"]["role"] == "resident"
    finally:
        monkeypatch.setenv("ONBOARD_ENABLED", "true")
        get_settings.cache_clear()

    with TestClient(app) as client:
        opened = client.post(
            "/api/v1/auth/onboard/enrolment",
            json={"enrolment_number": "24-NEW-009"},
        )
        assert opened.status_code == 204
