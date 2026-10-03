"""A resident cancels an ordinary outing while it is still planned."""

from __future__ import annotations

from app.shared.testing_env import signing_key_for_tests

import json
import re
import sqlite3
from collections.abc import Iterator
from datetime import datetime, timezone
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.dev_seed import (
    GATE_PHRASE,
    RESIDENT_PHRASE,
)


ARTIFACT = Path(__file__).resolve().parent / "artifacts" / "cancel-outing.json"
BLOCK_B = "d032aad6-a203-5ea0-ba9a-3a9257edbfc8"
LIBRARY = "fc2da7c5-8d65-5680-8034-d8acb69745eb"
WOMENS = "df29c4b7-63c5-525d-a9ec-798a980c64c8"
GATE_ID = "a11ce000-0000-4000-8000-000000000001"
RESIDENT_ID = "b22de000-0000-4000-8000-000000000002"
ROOM_ID = "d4400000-0000-4000-8000-000000000004"
SHAMSHAD = "924e5c75-e9b6-57a9-bb04-720028253526"
STALE_ID = "e7700000-0000-4000-8000-0000000000aa"
OUTSIDE_ID = "e7700000-0000-4000-8000-0000000000bb"
MISSING = "00000000-0000-4000-8000-000000000099"
CREATED = "2026-09-30T00:00:00Z"
NOW = "2026-09-30T08:00:00Z"
UUID = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$"
)


class FrozenClock:
    def utc_now(self) -> datetime:
        return datetime(2026, 9, 30, 8, 0, tzinfo=timezone.utc)


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
            (GATE_ID, "gate", "gate.fatima", "Fatima Khan", GATE_PHRASE),
            (RESIDENT_ID, "resident", "24-GLLB-118", "Aisha Khan", RESIDENT_PHRASE),
        )
        for user_id, role, username, full_name, password in people:
            connection.execute(
                """
                INSERT INTO users (
                  id, role, username, full_name, password_hash, status, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, 'active', ?, ?)
                """,
                (user_id, role, username, full_name, hash_password(password), CREATED, CREATED),
            )
        connection.execute(
            "INSERT INTO staff (user_id, job_title) VALUES (?, 'Gatekeeper')",
            (GATE_ID,),
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


def sign_in(client: TestClient, username: str, password: str) -> str:
    response = client.post(
        "/api/v1/auth/login",
        json={"username": username, "password": password},
    )
    assert response.status_code == 200
    return response.json()["access_token"]


def cancel(client: TestClient, token: str, outing_id: str):
    return client.post(
        f"/api/v1/me/outings/{outing_id}/cancel",
        headers={"Authorization": f"Bearer {token}"},
    )


def insert_stale_plan(path: Path) -> None:
    connection = sqlite3.connect(path)
    try:
        connection.execute(
            """
            INSERT INTO outings (
              id, resident_id, permission_id, type, status, destination_id, place,
              expected_return_at, grace_ends_at, exited_at, exit_recorded_by,
              returned_at, return_recorded_by, created_at, updated_at, cancelled_at, hall_date
            ) VALUES (
              ?, ?, NULL, 'ordinary', 'planned', ?, 'Maulana Azad Library',
              '2026-09-29T12:00:00Z', '2026-09-29T12:30:00Z', NULL, NULL,
              NULL, NULL, '2026-09-29T08:00:00Z', '2026-09-29T08:00:00Z', NULL, '2026-09-29'
            )
            """,
            (STALE_ID, RESIDENT_ID, LIBRARY),
        )
        connection.commit()
    finally:
        connection.close()


def insert_outside(path: Path) -> None:
    connection = sqlite3.connect(path)
    try:
        connection.execute(
            """
            INSERT INTO outings (
              id, resident_id, permission_id, type, status, destination_id, place,
              expected_return_at, grace_ends_at, exited_at, exit_recorded_by,
              returned_at, return_recorded_by, created_at, updated_at, cancelled_at, hall_date
            ) VALUES (
              ?, ?, NULL, 'ordinary', 'outside', ?, 'Shamshad Market',
              '2026-09-30T12:00:00Z', '2026-09-30T13:30:00Z', '2026-09-30T07:00:00Z', ?,
              NULL, NULL, '2026-09-30T06:30:00Z', '2026-09-30T07:00:00Z', NULL, '2026-09-30'
            )
            """,
            (OUTSIDE_ID, RESIDENT_ID, LIBRARY, GATE_ID),
        )
        connection.execute(
            "UPDATE residents SET presence = 'outside', updated_at = '2026-09-30T07:00:00Z' WHERE user_id = ?",
            (RESIDENT_ID,),
        )
        connection.commit()
    finally:
        connection.close()


def test_cancel_outing(database_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    expected = json.loads(ARTIFACT.read_text(encoding="utf-8"))
    from app.shared import clock
    from app.main import app

    monkeypatch.setattr(clock, "utc_now", FrozenClock().utc_now)
    with TestClient(app) as client:
        issue_people(database_path)
        assert_error(
            client.post(f"/api/v1/me/outings/{MISSING}/cancel"),
            401,
            "unauthenticated",
            "Sign in again.",
        )
        gate = sign_in(client, "gate.fatima", GATE_PHRASE)
        assert_error(cancel(client, gate, MISSING), 403, "forbidden", "This account cannot do that.")
        resident = sign_in(client, "24-GLLB-118", RESIDENT_PHRASE)
        assert_error(cancel(client, resident, MISSING), 404, "not_found", "That record was not found.")

        insert_stale_plan(database_path)
        assert_error(cancel(client, resident, STALE_ID), 409, "no_outing_planned", "There is no planned outing.")
        connection = sqlite3.connect(database_path)
        connection.row_factory = sqlite3.Row
        stale = connection.execute(
            "SELECT status, cancelled_at FROM outings WHERE id = ?",
            (STALE_ID,),
        ).fetchone()
        stale_audit = connection.execute(
            """
            SELECT actor_user_id, action, summary
            FROM audit_log
            WHERE entity_id = ? AND action = 'outing.cancelled'
            """,
            (STALE_ID,),
        ).fetchone()
        connection.close()
        assert stale["status"] == "cancelled"
        assert stale["cancelled_at"] == NOW
        assert stale_audit["actor_user_id"] is None
        assert stale_audit["summary"] == (
            "A planned outing to Maulana Azad Library was cancelled because the expected return passed."
        )

        planned = client.post(
            "/api/v1/me/outings",
            headers={"Authorization": f"Bearer {resident}"},
            json={"destination_id": LIBRARY, "starts_at": "2026-09-30T09:00:00Z", "expected_return_at": "2026-09-30T13:00:00Z"},
        )
        assert planned.status_code == 201
        outing_id = planned.json()["id"]
        later = client.post(
            "/api/v1/me/outings",
            headers={"Authorization": f"Bearer {resident}"},
            json={"destination_id": SHAMSHAD, "starts_at": "2026-10-02T05:00:00Z", "expected_return_at": "2026-10-02T10:30:00Z"},
        )
        assert later.status_code == 201
        later_id = later.json()["id"]
        afternoon = client.post(
            "/api/v1/me/outings",
            headers={"Authorization": f"Bearer {resident}"},
            json={"destination_id": WOMENS, "starts_at": "2026-09-30T09:00:00Z", "expected_return_at": "2026-09-30T10:30:00Z"},
        )
        assert afternoon.status_code == 201
        afternoon_id = afternoon.json()["id"]
        cancelled = cancel(client, resident, outing_id)
        assert cancelled.status_code == 200
        assert cancelled.content != b""
        body = cancelled.json()
        assert body["id"] == outing_id
        assert UUID.fullmatch(body["id"])
        assert {key: value for key, value in body.items() if key != "id"} == expected["cancelled"]
        connection = sqlite3.connect(database_path)
        connection.row_factory = sqlite3.Row
        row = connection.execute("SELECT * FROM outings WHERE id = ?", (outing_id,)).fetchone()
        resident_row = connection.execute(
            "SELECT presence, updated_at FROM residents WHERE user_id = ?",
            (RESIDENT_ID,),
        ).fetchone()
        audit = connection.execute(
            """
            SELECT actor_user_id, action, entity_type, summary
            FROM audit_log
            WHERE entity_id = ? AND action = 'outing.cancelled'
            """,
            (outing_id,),
        ).fetchone()
        connection.close()
        assert row["status"] == "cancelled"
        assert row["cancelled_at"] == NOW
        assert row["updated_at"] == NOW
        assert row["destination_id"] == LIBRARY
        assert row["exited_at"] is None
        assert row["exit_recorded_by"] is None
        assert resident_row["presence"] == "inside"
        assert resident_row["updated_at"] == CREATED
        assert audit["actor_user_id"] == RESIDENT_ID
        assert audit["action"] == "outing.cancelled"
        assert audit["entity_type"] == "outing"
        assert audit["summary"] == "Aisha Khan cancelled a planned outing to Maulana Azad Library."

        opened = client.get(
            "/api/v1/me/outings/current",
            headers={"Authorization": f"Bearer {resident}"},
        )
        assert opened.status_code == 200
        assert opened.json()["outing"]["id"] == afternoon_id
        assert opened.json()["outing"]["place"] == "Women's College"
        kept = client.get(
            "/api/v1/me/outings",
            headers={"Authorization": f"Bearer {resident}"},
        )
        assert kept.status_code == 200
        assert kept.json()["total"] == 2
        assert kept.json()["limit"] == 50
        assert kept.json()["offset"] == 0
        assert [item["id"] for item in kept.json()["items"]] == [afternoon_id, later_id]
        assert_error(cancel(client, resident, outing_id), 409, "no_outing_planned", "There is no planned outing.")
        same_day = cancel(client, resident, afternoon_id)
        assert same_day.status_code == 200
        assert same_day.json()["status"] == "cancelled"
        opened_again = client.get(
            "/api/v1/me/outings/current",
            headers={"Authorization": f"Bearer {resident}"},
        )
        assert opened_again.status_code == 200
        assert opened_again.json() == {"outing": None}
        kept_again = client.get(
            "/api/v1/me/outings",
            headers={"Authorization": f"Bearer {resident}"},
        )
        assert kept_again.status_code == 200
        assert [item["id"] for item in kept_again.json()["items"]] == [later_id]
        other_day = cancel(client, resident, later_id)
        assert other_day.status_code == 200
        assert other_day.json()["id"] == later_id
        assert other_day.json()["status"] == "cancelled"

        near = client.post(
            "/api/v1/me/outings",
            headers={"Authorization": f"Bearer {resident}"},
            json={
                "destination_id": LIBRARY,
                "starts_at": "2026-09-30T08:04:00Z",
                "expected_return_at": "2026-09-30T10:00:00Z",
            },
        )
        assert near.status_code == 201
        assert near.json()["qr_visible"] is True
        near_id = near.json()["id"]
        assert_error(
            cancel(client, resident, near_id),
            409,
            "outing_window_open",
            "You cannot change this outing while its window is open.",
        )
        connection = sqlite3.connect(database_path)
        connection.row_factory = sqlite3.Row
        still = connection.execute(
            "SELECT status, cancelled_at FROM outings WHERE id = ?",
            (near_id,),
        ).fetchone()
        connection.close()
        assert still["status"] == "planned"
        assert still["cancelled_at"] is None

        insert_outside(database_path)
        assert_error(cancel(client, resident, OUTSIDE_ID), 409, "already_outside", "You are already outside.")
        connection = sqlite3.connect(database_path)
        connection.row_factory = sqlite3.Row
        outside = connection.execute(
            "SELECT status, cancelled_at FROM outings WHERE id = ?",
            (OUTSIDE_ID,),
        ).fetchone()
        presence = connection.execute(
            "SELECT presence, updated_at FROM residents WHERE user_id = ?",
            (RESIDENT_ID,),
        ).fetchone()
        outside_audit = connection.execute(
            """
            SELECT actor_user_id FROM audit_log
            WHERE entity_id = ? AND action = 'outing.cancelled'
            """,
            (OUTSIDE_ID,),
        ).fetchone()
        connection.close()
        assert outside["status"] == "outside"
        assert outside["cancelled_at"] is None
        assert presence["presence"] == "outside"
        assert presence["updated_at"] == "2026-09-30T07:00:00Z"
        assert outside_audit is None
