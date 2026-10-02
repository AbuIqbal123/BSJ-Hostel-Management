"""Provost room list, create, and update."""

from __future__ import annotations

from app.shared.testing_env import signing_key_for_tests

import json
import sqlite3
from collections.abc import Iterator
from datetime import datetime, timezone
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.dev_seed import PROVOST_PHRASE, RESIDENT_PHRASE, WARDEN_PHRASE

ARTIFACT = Path(__file__).resolve().parent / "artifacts" / "admin-rooms.json"
BLOCK_B = "d032aad6-a203-5ea0-ba9a-3a9257edbfc8"
BLOCK_A = "01b885ad-e40d-56a4-81ab-2371f654f558"
PROVOST_ID = "f66ab000-0000-4000-8000-000000000006"
WARDEN_ID = "e55fa000-0000-4000-8000-000000000005"
RESIDENT_ID = "b22de000-0000-4000-8000-000000000002"
ROOM_B204 = "d4400000-0000-4000-8000-000000000004"
CREATED = "2026-09-30T00:00:00Z"
NOW = datetime(2026, 9, 30, 12, 0, tzinfo=timezone.utc)


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
    yield path
    get_settings.cache_clear()


def assert_error(response, status: int, code: str) -> None:
    assert response.status_code == status
    body = response.json()
    assert set(body) == {"error"}
    assert body["error"]["code"] == code


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
            (ROOM_B204, BLOCK_B),
        )
        people = (
            (PROVOST_ID, "provost", "provost.halima", "Halima Begum", PROVOST_PHRASE, "Provost"),
            (WARDEN_ID, "warden", "warden.sara", "Sara Malik", WARDEN_PHRASE, "Warden"),
            (RESIDENT_ID, "resident", "24-GLLB-118", "Aisha Khan", RESIDENT_PHRASE, None),
        )
        for user_id, role, username, full_name, password, job in people:
            connection.execute(
                """
                INSERT INTO users (
                  id, role, username, full_name, password_hash, status, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, 'active', ?, ?)
                """,
                (user_id, role, username, full_name, hash_password(password), CREATED, CREATED),
            )
            if job is not None:
                connection.execute(
                    "INSERT INTO staff (user_id, job_title) VALUES (?, ?)",
                    (user_id, job),
                )
        connection.execute(
            """
            INSERT INTO residents (
              user_id, enrolment_number, course, room_id, guardian_name, guardian_phone,
              qr_token, presence, created_at, updated_at
            ) VALUES (
              ?, '24-GLLB-118', 'B.A. LL.B. (Hons.)', ?, 'Rashid Khan',
              '+919876543210', 'bsj:v1:test-resident-hall-pass', 'inside', ?, ?
            )
            """,
            (RESIDENT_ID, ROOM_B204, CREATED, CREATED),
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


def test_admin_rooms(database_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    expected = json.loads(ARTIFACT.read_text(encoding="utf-8"))
    from app.main import app
    from app.shared import clock

    monkeypatch.setattr(clock, "utc_now", FrozenClock().utc_now)
    with TestClient(app) as client:
        issue_people(database_path)

        assert_error(client.get("/api/v1/admin/rooms"), 401, "unauthenticated")
        resident = sign_in(client, "24-GLLB-118", RESIDENT_PHRASE)
        assert_error(
            client.get(
                "/api/v1/admin/rooms",
                headers={"Authorization": f"Bearer {resident}"},
            ),
            403,
            "forbidden",
        )
        warden = sign_in(client, "warden.sara", WARDEN_PHRASE)
        assert_error(
            client.get(
                "/api/v1/admin/rooms",
                headers={"Authorization": f"Bearer {warden}"},
            ),
            403,
            "forbidden",
        )

        provost = sign_in(client, "provost.halima", PROVOST_PHRASE)
        headers = {"Authorization": f"Bearer {provost}"}

        listed = client.get(
            f"/api/v1/admin/rooms?block_id={BLOCK_B}",
            headers=headers,
        )
        assert listed.status_code == 200
        assert [item["label"] for item in listed.json()] == ["B-204"]
        assert listed.json()[0]["bed_count"] == 2

        empty_a = client.get(
            f"/api/v1/admin/rooms?block_id={BLOCK_A}",
            headers=headers,
        )
        assert empty_a.status_code == 200
        assert empty_a.json() == []

        created = client.post(
            "/api/v1/admin/rooms",
            headers=headers,
            json={"block_id": BLOCK_B, "number": expected["create_number"]},
        )
        assert created.status_code == 201
        body = created.json()
        assert body["label"] == expected["create_label"]
        assert body["number"] == "205"
        assert body["block_id"] == BLOCK_B
        assert body["bed_count"] == 2
        assert body["status"] == "active"
        room_205 = body["id"]

        leading = client.post(
            "/api/v1/admin/rooms",
            headers=headers,
            json={"block_id": BLOCK_B, "number": expected["leading_zero_number"]},
        )
        assert leading.status_code == 201
        assert leading.json()["number"] == "087"
        assert leading.json()["label"] == expected["leading_zero_label"]
        room_087 = leading.json()["id"]

        dup = client.post(
            "/api/v1/admin/rooms",
            headers=headers,
            json={"block_id": BLOCK_B, "number": "204"},
        )
        assert_error(dup, 409, "duplicate_room")
        assert dup.json()["error"]["message"] == expected["duplicate_message"]

        assert_error(
            client.patch(
                "/api/v1/admin/rooms/00000000-0000-4000-8000-000000000099",
                headers=headers,
                json={"bed_count": 1},
            ),
            404,
            "not_found",
        )

        refuse_deactivate = client.patch(
            f"/api/v1/admin/rooms/{ROOM_B204}",
            headers=headers,
            json={"status": "inactive"},
        )
        assert_error(refuse_deactivate, 409, "room_in_use")
        assert refuse_deactivate.json()["error"]["message"] == expected["room_in_use_message"]

        renamed = client.patch(
            f"/api/v1/admin/rooms/{room_205}",
            headers=headers,
            json={"number": "206", "bed_count": 1},
        )
        assert renamed.status_code == 200
        assert renamed.json()["number"] == "206"
        assert renamed.json()["label"] == "B-206"
        assert renamed.json()["bed_count"] == 1

        deactivated = client.patch(
            f"/api/v1/admin/rooms/{room_087}",
            headers=headers,
            json={"status": "inactive"},
        )
        assert deactivated.status_code == 200
        assert deactivated.json()["status"] == "inactive"

        all_rooms = client.get("/api/v1/admin/rooms", headers=headers)
        assert all_rooms.status_code == 200
        labels = [item["label"] for item in all_rooms.json()]
        assert labels == ["B-087", "B-204", "B-206"]
        inactive = next(item for item in all_rooms.json() if item["id"] == room_087)
        assert inactive["status"] == "inactive"

        connection = sqlite3.connect(database_path)
        try:
            actions = [
                row[0]
                for row in connection.execute(
                    """
                    SELECT action FROM audit_log
                    WHERE action IN ('room.created', 'room.updated')
                    ORDER BY occurred_at, rowid
                    """
                )
            ]
        finally:
            connection.close()
        assert actions == [
            "room.created",
            "room.created",
            "room.updated",
            "room.updated",
        ]


def test_room_rejects_null_fields_and_unknown_block(
    database_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    from app.main import app
    from app.shared import clock

    monkeypatch.setattr(clock, "utc_now", FrozenClock().utc_now)
    with TestClient(app) as client:
        issue_people(database_path)
        provost = sign_in(client, "provost.halima", PROVOST_PHRASE)
        headers = {"Authorization": f"Bearer {provost}"}

        for field_name, label in (
            ("status", "Status"),
            ("number", "Number"),
            ("bed_count", "Bed count"),
        ):
            response = client.patch(
                f"/api/v1/admin/rooms/{ROOM_B204}",
                headers=headers,
                json={field_name: None},
            )
            assert response.status_code == 422
            body = response.json()
            assert body["error"]["code"] == "validation_error"
            assert body["error"]["message"] == f"{label} is required."
            assert body["error"]["details"] == {"field": field_name}
            listed = client.get(
                f"/api/v1/admin/rooms?block_id={BLOCK_B}",
                headers=headers,
            )
            assert listed.status_code == 200
            room = next(item for item in listed.json() if item["id"] == ROOM_B204)
            assert room["status"] == "active"
            assert room["number"] == "204"

        missing_block = client.post(
            "/api/v1/admin/rooms",
            headers=headers,
            json={
                "block_id": "00000000-0000-4000-8000-000000000099",
                "number": "301",
            },
        )
        assert_error(missing_block, 404, "not_found")
        assert missing_block.json()["error"]["message"] == "That record was not found."
