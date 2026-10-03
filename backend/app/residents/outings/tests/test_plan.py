"""A resident plans an ordinary outing before she reaches the gate."""

from __future__ import annotations

from app.shared.testing_env import signing_key_for_tests

import json
import re
import sqlite3
from collections.abc import Iterator
from datetime import datetime, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

import pytest
from fastapi.testclient import TestClient

from app.dev_seed import (
    GATE_PHRASE,
    RESIDENT_PHRASE,
)


ARTIFACT = Path(__file__).resolve().parent / "artifacts" / "plan-outing.json"
BLOCK_B = "d032aad6-a203-5ea0-ba9a-3a9257edbfc8"
LIBRARY = "fc2da7c5-8d65-5680-8034-d8acb69745eb"
SHAMSHAD = "924e5c75-e9b6-57a9-bb04-720028253526"
OTHER = "f2008ef3-a1df-5ff0-b936-3466d0914781"
WOMENS = "df29c4b7-63c5-525d-a9ec-798a980c64c8"
GATE_ID = "a11ce000-0000-4000-8000-000000000001"
RESIDENT_ID = "b22de000-0000-4000-8000-000000000002"
ROOM_ID = "d4400000-0000-4000-8000-000000000004"
STALE_ID = "e7700000-0000-4000-8000-0000000000aa"
UNKNOWN = "00000000-0000-4000-8000-000000000099"
CREATED = "2026-09-30T00:00:00Z"
NOW = "2026-09-30T00:30:00Z"
UUID = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$"
)


class FrozenClock:
    def utc_now(self) -> datetime:
        return datetime(2026, 9, 30, 0, 30, tzinfo=timezone.utc)


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


def hall_day(instant: str) -> str:
    moment = datetime.strptime(instant, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc)
    return moment.astimezone(ZoneInfo("Asia/Kolkata")).date().isoformat()


def insert_stale_plan(path: Path) -> None:
    connection = sqlite3.connect(path)
    try:
        connection.execute("PRAGMA foreign_keys=ON;")
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


def clear_planned(path: Path) -> None:
    connection = sqlite3.connect(path)
    try:
        connection.execute("PRAGMA foreign_keys=ON;")
        connection.execute(
            """
            UPDATE outings
            SET status = 'cancelled', cancelled_at = ?, updated_at = ?
            WHERE resident_id = ? AND status = 'planned'
            """,
            (NOW, NOW, RESIDENT_ID),
        )
        connection.commit()
    finally:
        connection.close()


def outing_row(path: Path, outing_id: str) -> sqlite3.Row:
    connection = sqlite3.connect(path)
    connection.row_factory = sqlite3.Row
    try:
        row = connection.execute("SELECT * FROM outings WHERE id = ?", (outing_id,)).fetchone()
        assert row is not None
        return row
    finally:
        connection.close()


def outing_audits(path: Path) -> list[tuple]:
    connection = sqlite3.connect(path)
    try:
        return connection.execute(
            """
            SELECT actor_user_id, action, entity_type, entity_id, summary
            FROM audit_log
            WHERE action LIKE 'outing.%'
            ORDER BY occurred_at, id
            """
        ).fetchall()
    finally:
        connection.close()


def sign_in(client: TestClient, username: str, password: str) -> str:
    response = client.post(
        "/api/v1/auth/login",
        json={"username": username, "password": password},
    )
    assert response.status_code == 200
    return response.json()["access_token"]


def plan(client: TestClient, token: str, body: dict):
    return client.post(
        "/api/v1/me/outings",
        headers={"Authorization": f"Bearer {token}"},
        json=body,
    )


def assert_planned(response, expected: dict, path: Path, destination_id: str | None) -> str:
    assert response.status_code == 201
    body = response.json()
    assert UUID.fullmatch(body["id"])
    assert {key: value for key, value in body.items() if key != "id"} == expected
    row = outing_row(path, body["id"])
    assert row["destination_id"] == destination_id
    assert row["place"] == expected["place"]
    assert row["status"] == "planned"
    assert row["type"] == "ordinary"
    assert row["permission_id"] is None
    assert row["exited_at"] is None
    assert row["exit_recorded_by"] is None
    assert row["returned_at"] is None
    assert row["return_recorded_by"] is None
    assert row["cancelled_at"] is None
    assert row["hall_date"] == hall_day(expected["expected_return_at"])
    assert row["expected_return_at"] == expected["expected_return_at"]
    assert row["starts_at"] == expected["starts_at"]
    assert row["grace_ends_at"] == expected["grace_ends_at"]
    assert row["created_at"] == NOW
    assert row["updated_at"] == NOW
    return body["id"]


def test_plan_outing(database_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    expected = json.loads(ARTIFACT.read_text(encoding="utf-8"))
    from app.shared import clock
    from app.main import app

    monkeypatch.setattr(clock, "utc_now", FrozenClock().utc_now)
    with TestClient(app) as client:
        issue_people(database_path)
        assert_error(
            client.post("/api/v1/me/outings", json={"destination_id": LIBRARY, "starts_at": "2026-09-30T08:00:00Z", "expected_return_at": "2026-09-30T13:00:00Z"}),
            401,
            "unauthenticated",
            "Sign in again.",
        )
        gate = sign_in(client, "gate.fatima", GATE_PHRASE)
        assert_error(
            plan(client, gate, {"destination_id": LIBRARY, "starts_at": "2026-09-30T08:00:00Z", "expected_return_at": "2026-09-30T13:00:00Z"}),
            403,
            "forbidden",
            "This account cannot do that.",
        )
        resident = sign_in(client, "24-GLLB-118", RESIDENT_PHRASE)
        library = {"destination_id": LIBRARY, "starts_at": "2026-09-30T08:00:00Z", "expected_return_at": "2026-09-30T13:00:00Z"}
        assert_error(
            plan(client, resident, {"destination_id": LIBRARY, "starts_at": "2026-09-30T00:00:00Z", "expected_return_at": NOW}),
            422,
            "validation_error",
            "The expected return must be in the future.",
        )
        assert_error(
            plan(client, resident, {"destination_id": LIBRARY, "starts_at": "2026-09-30T00:45:00Z", "expected_return_at": "2026-09-30T01:00:00Z"}),
            409,
            "outside_ordinary_hours",
            "That return is outside ordinary hours.",
        )
        assert_error(
            plan(client, resident, {"destination_id": LIBRARY, "starts_at": "2026-09-30T08:00:00Z", "expected_return_at": "2026-09-30T13:00:01Z"}),
            409,
            "permission_required",
            "That return is outside ordinary hours. Please submit a permission request.",
        )
        assert_error(
            plan(client, resident, {"destination_id": WOMENS, "starts_at": "2026-10-01T06:00:00Z", "expected_return_at": "2026-10-01T13:00:00Z"}),
            409,
            "permission_required",
            "That return is outside ordinary hours. Please submit a permission request.",
        )
        assert_error(
            plan(client, resident, {"destination_id": UNKNOWN, "starts_at": "2026-09-30T08:00:00Z", "expected_return_at": "2026-09-30T13:00:00Z"}),
            422,
            "validation_error",
            "Choose a destination from the list.",
        )
        assert_error(
            plan(client, resident, {"destination_id": OTHER, "starts_at": "2026-09-30T07:00:00Z", "expected_return_at": "2026-09-30T12:00:00Z"}),
            422,
            "validation_error",
            "Destination text is required.",
        )
        assert_error(
            plan(client, resident, {"destination_id": LIBRARY, "starts_at": "2026-09-30T00:00:00Z", "expected_return_at": "2026-09-30T13:00:00Z"}),
            422,
            "validation_error",
            "The outing start must be in the future.",
        )
        assert_error(
            plan(client, resident, {"destination_id": LIBRARY, "starts_at": "2026-09-30T12:00:00Z", "expected_return_at": "2026-09-30T08:00:00Z"}),
            422,
            "validation_error",
            "The expected return must be after the start.",
        )
        assert_error(
            plan(client, resident, {"destination_id": LIBRARY, "starts_at": "2026-09-30T01:00:00Z", "expected_return_at": "2026-09-30T13:00:00Z"}),
            409,
            "outside_ordinary_hours",
            "That start is outside ordinary hours.",
        )
        assert_error(
            plan(client, resident, {"destination_id": LIBRARY, "starts_at": "2026-09-30T08:00:00Z", "expected_return_at": "2026-10-01T12:00:00Z"}),
            422,
            "validation_error",
            "An ordinary outing starts and returns on the same hall day.",
        )
        connection = sqlite3.connect(database_path)
        connection.execute(
            "UPDATE residents SET presence = 'outside', updated_at = ? WHERE user_id = ?",
            (NOW, RESIDENT_ID),
        )
        connection.commit()
        connection.close()
        ahead_id = assert_planned(
            plan(client, resident, {"destination_id": SHAMSHAD, "starts_at": "2026-10-02T05:00:00Z", "expected_return_at": "2026-10-02T10:30:00Z"}),
            expected["ahead"],
            database_path,
            SHAMSHAD,
        )
        connection = sqlite3.connect(database_path)
        connection.execute(
            "UPDATE residents SET presence = 'inside', updated_at = ? WHERE user_id = ?",
            (CREATED, RESIDENT_ID),
        )
        connection.commit()
        connection.close()

        insert_stale_plan(database_path)
        created = assert_planned(
            plan(client, resident, {**library, "destination_text": "should be ignored"}),
            expected["library"],
            database_path,
            LIBRARY,
        )
        assert created != STALE_ID
        stale = outing_row(database_path, STALE_ID)
        assert stale["status"] == "cancelled"
        assert stale["cancelled_at"] == NOW
        same_day_id = assert_planned(
            plan(client, resident, {"destination_id": WOMENS, "starts_at": "2026-09-30T02:00:00Z", "expected_return_at": "2026-09-30T06:30:00Z"}),
            expected["same_day"],
            database_path,
            WOMENS,
        )
        assert_error(
            plan(client, resident, library),
            409,
            "return_already_planned",
            "You already have an outing ending at that time.",
        )
        listed = client.get(
            "/api/v1/me/outings",
            headers={"Authorization": f"Bearer {resident}"},
        )
        assert listed.status_code == 200
        assert listed.json()["total"] == 3
        assert listed.json()["limit"] == 50
        assert listed.json()["offset"] == 0
        assert [item["id"] for item in listed.json()["items"]] == [same_day_id, created, ahead_id]
        current = client.get(
            "/api/v1/me/outings/current",
            headers={"Authorization": f"Bearer {resident}"},
        )
        assert current.status_code == 200
        assert current.json()["outing"]["id"] == same_day_id

        clear_planned(database_path)
        winter_id = assert_planned(
            plan(client, resident, {"destination_id": WOMENS, "starts_at": "2026-10-01T06:00:00Z", "expected_return_at": "2026-10-01T12:00:00Z"}),
            expected["winter_end"],
            database_path,
            WOMENS,
        )
        clear_planned(database_path)
        other_id = assert_planned(
            plan(
                client,
                resident,
                {
                    "destination_id": OTHER,
                    "destination_text": "  City bookshop  ",
                    "starts_at": "2026-09-30T07:00:00Z", "expected_return_at": "2026-09-30T12:00:00Z",
                },
            ),
            expected["other"],
            database_path,
            None,
        )

        connection = sqlite3.connect(database_path)
        connection.execute("UPDATE hall_settings SET grace_minutes = 60 WHERE id = 'hall'")
        connection.commit()
        presence = connection.execute(
            "SELECT presence, updated_at FROM residents WHERE user_id = ?",
            (RESIDENT_ID,),
        ).fetchone()
        connection.close()
        assert presence == ("inside", CREATED)
        assert outing_row(database_path, other_id)["grace_ends_at"] == "2026-09-30T12:30:00Z"
        recorded = outing_audits(database_path)
        expected_audits = [
            (
                None,
                "outing.cancelled",
                "outing",
                STALE_ID,
                "A planned outing to Maulana Azad Library was cancelled because the expected return passed.",
            ),
            (
                RESIDENT_ID,
                "outing.planned",
                "outing",
                ahead_id,
                "Aisha Khan planned an outing to Shamshad Market.",
            ),
            (
                RESIDENT_ID,
                "outing.planned",
                "outing",
                created,
                "Aisha Khan planned an outing to Maulana Azad Library.",
            ),
            (
                RESIDENT_ID,
                "outing.planned",
                "outing",
                same_day_id,
                "Aisha Khan planned an outing to Women's College.",
            ),
            (
                RESIDENT_ID,
                "outing.planned",
                "outing",
                winter_id,
                "Aisha Khan planned an outing to Women's College.",
            ),
            (
                RESIDENT_ID,
                "outing.planned",
                "outing",
                other_id,
                "Aisha Khan planned an outing to City bookshop.",
            ),
        ]
        assert sorted(recorded, key=lambda row: (row[1], row[3])) == sorted(
            expected_audits, key=lambda row: (row[1], row[3])
        )


class LaterClock:
    def utc_now(self) -> datetime:
        return datetime(2026, 9, 30, 2, 0, tzinfo=timezone.utc)


def test_cannot_plan_while_an_outing_window_is_open(
    database_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    from app.shared import clock
    from app.main import app

    monkeypatch.setattr(clock, "utc_now", LaterClock().utc_now)
    with TestClient(app) as client:
        issue_people(database_path)
        resident = sign_in(client, "24-GLLB-118", RESIDENT_PHRASE)
        first = plan(
            client,
            resident,
            {
                "destination_id": LIBRARY,
                "starts_at": "2026-09-30T02:04:00Z",
                "expected_return_at": "2026-09-30T06:00:00Z",
            },
        )
        assert first.status_code == 201
        body = first.json()
        assert body["qr_visible"] is True
        assert body["qr_visible_from"] == "2026-09-30T01:34:00Z"
        assert body["qr_visible_until"] == "2026-09-30T06:00:00Z"
        assert body["starts_at"] == "2026-09-30T02:04:00Z"
        assert_error(
            plan(
                client,
                resident,
                {
                    "destination_id": SHAMSHAD,
                    "starts_at": "2026-09-30T04:00:00Z",
                    "expected_return_at": "2026-09-30T08:00:00Z",
                },
            ),
            409,
            "outing_window_open",
            "You cannot start another outing while one is inside its window.",
        )
        cancelled = client.post(
            f"/api/v1/me/outings/{body['id']}/cancel",
            headers={"Authorization": f"Bearer {resident}"},
        )
        assert cancelled.status_code == 200
        second = plan(
            client,
            resident,
            {
                "destination_id": SHAMSHAD,
                "starts_at": "2026-09-30T04:00:00Z",
                "expected_return_at": "2026-09-30T08:00:00Z",
            },
        )
        assert second.status_code == 201
        assert second.json()["qr_visible"] is False
