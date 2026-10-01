"""Staff permission queue: sort by created_at and optional filters."""

from __future__ import annotations

from app.shared.testing_env import signing_key_for_tests

import json
import sqlite3
from collections.abc import Iterator
from datetime import datetime, timezone
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.dev_seed import (
    GATE_PHRASE,
    PROVOST_PHRASE,
    RESIDENT_PHRASE,
    WARDEN_PHRASE,
    joined,
)


ARTIFACT = Path(__file__).resolve().parent / "artifacts" / "permission-queue.json"
BLOCK_A = "01b885ad-e40d-56a4-81ab-2371f654f558"
BLOCK_B = "d032aad6-a203-5ea0-ba9a-3a9257edbfc8"
GATE_ID = "a11ce000-0000-4000-8000-000000000001"
WARDEN_ID = "e55fa000-0000-4000-8000-000000000005"
PROVOST_ID = "f66ab000-0000-4000-8000-000000000006"
AISHA_ID = "b22de000-0000-4000-8000-000000000002"
ZARA_ID = "d55fa000-0000-4000-8000-00000000000a"
ROOM_B204 = "d4400000-0000-4000-8000-000000000004"
ROOM_A101 = "d4400000-0000-4000-8000-000000000006"
PERM_LATE_B = "f8800000-0000-4000-8000-000000000041"
PERM_HOME_B = "f8800000-0000-4000-8000-000000000042"
PERM_LATE_A = "f8800000-0000-4000-8000-000000000043"
PERM_HOME_A = "f8800000-0000-4000-8000-000000000044"
CREATED = "2026-09-30T00:00:00Z"


class FrozenClock:
    def utc_now(self) -> datetime:
        return datetime(2026, 9, 30, 13, 0, tzinfo=timezone.utc)


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


def assert_error(response, status: int, code: str, message: str) -> None:
    assert response.status_code == status
    body = response.json()
    assert set(body) == {"error"}
    assert body["error"] == {"code": code, "message": message}


def sign_in(client: TestClient, username: str, password: str) -> str:
    response = client.post(
        "/api/v1/auth/login",
        json={"username": username, "password": password},
    )
    assert response.status_code == 200
    return response.json()["access_token"]


def auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def issue_people(path: Path) -> None:
    from app.shared.auth.security import hash_password

    connection = sqlite3.connect(path)
    try:
        connection.execute("PRAGMA foreign_keys=ON;")
        for user_id, role, username, full_name, password, job_title in (
            (GATE_ID, "gate", "gate.fatima", "Fatima Khan", GATE_PHRASE, "Gatekeeper"),
            (WARDEN_ID, "warden", "warden.sara", "Sara Malik", WARDEN_PHRASE, "Warden"),
            (PROVOST_ID, "provost", "provost.halima", "Halima Begum", PROVOST_PHRASE, "Provost"),
        ):
            connection.execute(
                """
                INSERT INTO users (
                  id, role, username, full_name, password_hash, status, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, 'active', ?, ?)
                """,
                (user_id, role, username, full_name, hash_password(password), CREATED, CREATED),
            )
            connection.execute(
                "INSERT INTO staff (user_id, job_title) VALUES (?, ?)",
                (user_id, job_title),
            )
        for room_id, block_id, number, label in (
            (ROOM_B204, BLOCK_B, "204", "B-204"),
            (ROOM_A101, BLOCK_A, "101", "A-101"),
        ):
            connection.execute(
                """
                INSERT INTO rooms (id, block_id, number, label, bed_count, is_active)
                VALUES (?, ?, ?, ?, 2, 1)
                """,
                (room_id, block_id, number, label),
            )
        for user_id, username, full_name, password, room_id, course, guardian, phone, token in (
            (
                AISHA_ID,
                "24-GLLB-118",
                "Aisha Khan",
                RESIDENT_PHRASE,
                ROOM_B204,
                "B.A. LL.B. (Hons.)",
                "Rashid Khan",
                "+919876543210",
                "bsj:v1:test-aisha",
            ),
            (
                ZARA_ID,
                "24-BA-003",
                "Zara Ahmed",
                joined("resident", "30"),
                ROOM_A101,
                "B.A.",
                "Imran Ahmed",
                "+919876543212",
                "bsj:v1:test-zara",
            ),
        ):
            connection.execute(
                """
                INSERT INTO users (
                  id, role, username, full_name, password_hash, status, created_at, updated_at
                ) VALUES (?, 'resident', ?, ?, ?, 'active', ?, ?)
                """,
                (user_id, username, full_name, hash_password(password), CREATED, CREATED),
            )
            connection.execute(
                """
                INSERT INTO residents (
                  user_id, enrolment_number, course, room_id, guardian_name, guardian_phone,
                  qr_token, presence, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, 'inside', ?, ?)
                """,
                (user_id, username, course, room_id, guardian, phone, token, CREATED, CREATED),
            )
        connection.commit()
    finally:
        connection.close()


def store_pending_permissions(path: Path) -> None:
    connection = sqlite3.connect(path)
    try:
        connection.execute("PRAGMA foreign_keys=ON;")
        rows = (
            (
                PERM_LATE_B,
                AISHA_ID,
                "late_night",
                "Women's College",
                "Seminar Hall",
                None,
                "Faculty seminar.",
                "2026-09-30T14:00:00Z",
                "2026-09-30T16:00:00Z",
                "2026-09-30T10:00:00Z",
            ),
            (
                PERM_HOME_B,
                AISHA_ID,
                "home_going",
                "Lucknow",
                None,
                "14 Civil Lines",
                "Family visit.",
                "2026-09-30T15:00:00Z",
                "2026-10-02T13:30:00Z",
                "2026-09-30T11:00:00Z",
            ),
            (
                PERM_LATE_A,
                ZARA_ID,
                "late_night",
                "City library",
                None,
                None,
                "Late study.",
                "2026-09-30T14:30:00Z",
                "2026-09-30T17:00:00Z",
                "2026-09-30T12:00:00Z",
            ),
            (
                PERM_HOME_A,
                ZARA_ID,
                "home_going",
                "Delhi",
                None,
                "7 Ring Road",
                "Weekend home.",
                "2026-09-30T16:00:00Z",
                "2026-10-01T13:30:00Z",
                "2026-09-30T12:30:00Z",
            ),
        )
        for row in rows:
            connection.execute(
                """
                INSERT INTO permissions (
                  id, resident_id, type, status, short_place, destination_detail, address,
                  reason, departure_at, expected_return_at, decided_by, decided_at,
                  decision_note, created_at, updated_at
                ) VALUES (
                  ?, ?, ?, 'pending', ?, ?, ?,
                  ?, ?, ?, NULL, NULL,
                  NULL, ?, ?
                )
                """,
                (*row, row[-1]),
            )
        connection.commit()
    finally:
        connection.close()


def page_summary(body: dict) -> dict:
    return {
        "total": body["total"],
        "limit": body["limit"],
        "offset": body["offset"],
        "items": [
            {
                "id": item["id"],
                "type": item["type"],
                "status": item["status"],
                "short_place": item["short_place"],
                "created_at": item["created_at"],
                "resident_id": item["resident_id"],
                "resident_name": item["resident_name"],
                "room_label": item["room_label"],
            }
            for item in body["items"]
        ],
    }


def expected_artifact() -> dict:
    newest = [
        {
            "id": PERM_HOME_A,
            "type": "home_going",
            "status": "pending",
            "short_place": "Delhi",
            "created_at": "2026-09-30T12:30:00Z",
            "resident_id": ZARA_ID,
            "resident_name": "Zara Ahmed",
            "room_label": "A-101",
        },
        {
            "id": PERM_LATE_A,
            "type": "late_night",
            "status": "pending",
            "short_place": "City library",
            "created_at": "2026-09-30T12:00:00Z",
            "resident_id": ZARA_ID,
            "resident_name": "Zara Ahmed",
            "room_label": "A-101",
        },
        {
            "id": PERM_HOME_B,
            "type": "home_going",
            "status": "pending",
            "short_place": "Lucknow",
            "created_at": "2026-09-30T11:00:00Z",
            "resident_id": AISHA_ID,
            "resident_name": "Aisha Khan",
            "room_label": "B-204",
        },
        {
            "id": PERM_LATE_B,
            "type": "late_night",
            "status": "pending",
            "short_place": "Women's College",
            "created_at": "2026-09-30T10:00:00Z",
            "resident_id": AISHA_ID,
            "resident_name": "Aisha Khan",
            "room_label": "B-204",
        },
    ]
    oldest = list(reversed(newest))
    return {
        "default": {"total": 4, "limit": 50, "offset": 0, "items": newest},
        "oldest": {"total": 4, "limit": 50, "offset": 0, "items": oldest},
        "home_going": {
            "total": 2,
            "limit": 50,
            "offset": 0,
            "items": [newest[0], newest[2]],
        },
        "block_a": {
            "total": 2,
            "limit": 50,
            "offset": 0,
            "items": [newest[0], newest[1]],
        },
        "created_range": {
            "total": 2,
            "limit": 50,
            "offset": 0,
            "items": [newest[1], newest[2]],
        },
        "home_going_block_a": {
            "total": 1,
            "limit": 50,
            "offset": 0,
            "items": [newest[0]],
        },
    }


def test_permission_queue_filters_and_sort(
    database_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    from app.shared import clock
    from app.shared.migrate import migrate

    monkeypatch.setattr(clock, "utc_now", FrozenClock().utc_now)
    migrate()

    from app.main import app

    expected = expected_artifact()
    with TestClient(app) as client:
        assert_error(
            client.get("/api/v1/permissions"),
            401,
            "unauthenticated",
            "Sign in again.",
        )

        issue_people(database_path)
        store_pending_permissions(database_path)

        gate = sign_in(client, "gate.fatima", GATE_PHRASE)
        resident = sign_in(client, "24-GLLB-118", RESIDENT_PHRASE)
        warden = sign_in(client, "warden.sara", WARDEN_PHRASE)
        provost = sign_in(client, "provost.halima", PROVOST_PHRASE)

        assert_error(
            client.get("/api/v1/permissions", headers=auth(gate)),
            403,
            "forbidden",
            "This account cannot do that.",
        )
        assert_error(
            client.get("/api/v1/permissions", headers=auth(resident)),
            403,
            "forbidden",
            "This account cannot do that.",
        )

        default = client.get("/api/v1/permissions", headers=auth(warden))
        assert default.status_code == 200
        assert page_summary(default.json()) == expected["default"]

        oldest = client.get(
            "/api/v1/permissions",
            params={"order": "oldest"},
            headers=auth(warden),
        )
        assert oldest.status_code == 200
        assert page_summary(oldest.json()) == expected["oldest"]

        home_going = client.get(
            "/api/v1/permissions",
            params={"type": "home_going"},
            headers=auth(warden),
        )
        assert home_going.status_code == 200
        assert page_summary(home_going.json()) == expected["home_going"]

        block_a = client.get(
            "/api/v1/permissions",
            params={"block_id": BLOCK_A},
            headers=auth(warden),
        )
        assert block_a.status_code == 200
        assert page_summary(block_a.json()) == expected["block_a"]

        created_range = client.get(
            "/api/v1/permissions",
            params={
                "created_from": "2026-09-30T11:00:00Z",
                "created_to": "2026-09-30T12:00:00Z",
            },
            headers=auth(warden),
        )
        assert created_range.status_code == 200
        assert page_summary(created_range.json()) == expected["created_range"]

        combined = client.get(
            "/api/v1/permissions",
            params={"type": "home_going", "block_id": BLOCK_A},
            headers=auth(warden),
        )
        assert combined.status_code == 200
        assert page_summary(combined.json()) == expected["home_going_block_a"]

        provost_default = client.get("/api/v1/permissions", headers=auth(provost))
        assert provost_default.status_code == 200
        assert page_summary(provost_default.json()) == expected["default"]

    ARTIFACT.write_text(json.dumps(expected, indent=2) + "\n", encoding="utf-8")
    assert json.loads(ARTIFACT.read_text(encoding="utf-8")) == expected
