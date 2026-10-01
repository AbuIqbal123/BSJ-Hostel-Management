"""Provost block list, create, and update."""

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

ARTIFACT = Path(__file__).resolve().parent / "artifacts" / "admin-blocks.json"
BLOCK_B = "d032aad6-a203-5ea0-ba9a-3a9257edbfc8"
PROVOST_ID = "f66ab000-0000-4000-8000-000000000006"
WARDEN_ID = "e55fa000-0000-4000-8000-000000000005"
RESIDENT_ID = "b22de000-0000-4000-8000-000000000002"
ROOM_ID = "d4400000-0000-4000-8000-000000000004"
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
            (ROOM_ID, BLOCK_B),
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


def test_admin_blocks(database_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    expected = json.loads(ARTIFACT.read_text(encoding="utf-8"))
    from app.main import app
    from app.shared import clock

    monkeypatch.setattr(clock, "utc_now", FrozenClock().utc_now)
    with TestClient(app) as client:
        issue_people(database_path)

        assert_error(client.get("/api/v1/admin/blocks"), 401, "unauthenticated")
        resident = sign_in(client, "24-GLLB-118", RESIDENT_PHRASE)
        assert_error(
            client.get(
                "/api/v1/admin/blocks",
                headers={"Authorization": f"Bearer {resident}"},
            ),
            403,
            "forbidden",
        )
        warden = sign_in(client, "warden.sara", WARDEN_PHRASE)
        assert_error(
            client.get(
                "/api/v1/admin/blocks",
                headers={"Authorization": f"Bearer {warden}"},
            ),
            403,
            "forbidden",
        )

        provost = sign_in(client, "provost.halima", PROVOST_PHRASE)
        headers = {"Authorization": f"Bearer {provost}"}

        listed = client.get("/api/v1/admin/blocks", headers=headers)
        assert listed.status_code == 200
        codes = [item["code"] for item in listed.json()]
        assert codes == expected["seed_codes"]
        block_b = next(item for item in listed.json() if item["id"] == BLOCK_B)
        assert block_b["name"] == "Block-B"
        assert block_b["is_active"] is True
        utility = next(item for item in listed.json() if item["code"] == "Utility")
        assert utility["floors"] is None

        created = client.post(
            "/api/v1/admin/blocks",
            headers=headers,
            json=expected["create"],
        )
        assert created.status_code == 201
        body = created.json()
        assert body["code"] == "E"
        assert body["name"] == "Block-E"
        assert body["floors"] == 4
        assert body["room_count"] == 1
        assert body["beds_per_room"] == 2
        assert body["is_active"] is True
        assert "id" in body
        new_id = body["id"]

        dup = client.post(
            "/api/v1/admin/blocks",
            headers=headers,
            json={**expected["create"], "code": "e", "name": "Other E"},
        )
        assert_error(dup, 409, "duplicate_block")
        assert dup.json()["error"]["message"] == expected["duplicate_message"]

        assert_error(
            client.patch(
                "/api/v1/admin/blocks/00000000-0000-4000-8000-000000000099",
                headers=headers,
                json={"name": "Missing"},
            ),
            404,
            "not_found",
        )

        assert_error(
            client.patch(
                f"/api/v1/admin/blocks/{BLOCK_B}",
                headers=headers,
                json={"code": "Z"},
            ),
            422,
            "validation_error",
        )

        updated = client.patch(
            f"/api/v1/admin/blocks/{BLOCK_B}",
            headers=headers,
            json={"name": "Block B West", "is_active": False, "room_count": 60},
        )
        assert updated.status_code == 200
        assert updated.json()["name"] == "Block B West"
        assert updated.json()["is_active"] is False
        assert updated.json()["room_count"] == 60
        assert updated.json()["code"] == "B"

        after = client.get("/api/v1/admin/blocks", headers=headers)
        assert after.status_code == 200
        after_codes = [item["code"] for item in after.json()]
        assert after_codes == ["A", "B", "C", "D", "E", "Utility"]
        inactive_b = next(item for item in after.json() if item["id"] == BLOCK_B)
        assert inactive_b["is_active"] is False

        clear_floors = client.patch(
            f"/api/v1/admin/blocks/{new_id}",
            headers=headers,
            json={"floors": None},
        )
        assert clear_floors.status_code == 200
        assert clear_floors.json()["floors"] is None

        connection = sqlite3.connect(database_path)
        try:
            room = connection.execute(
                "SELECT label, is_active FROM rooms WHERE id = ?",
                (ROOM_ID,),
            ).fetchone()
            actions = [
                row[0]
                for row in connection.execute(
                    """
                    SELECT action FROM audit_log
                    WHERE action IN ('block.created', 'block.updated')
                    ORDER BY occurred_at, rowid
                    """
                )
            ]
        finally:
            connection.close()
        assert room == ("B-204", 1)
        assert actions == ["block.created", "block.updated", "block.updated"]


def test_block_patch_rejects_null_except_floors(
    database_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    from app.main import app
    from app.shared import clock

    monkeypatch.setattr(clock, "utc_now", FrozenClock().utc_now)
    with TestClient(app) as client:
        issue_people(database_path)
        provost = sign_in(client, "provost.halima", PROVOST_PHRASE)
        headers = {"Authorization": f"Bearer {provost}"}

        listed = client.get("/api/v1/admin/blocks", headers=headers)
        assert listed.status_code == 200
        block_b = next(item for item in listed.json() if item["id"] == BLOCK_B)
        assert block_b["is_active"] is True
        assert block_b["floors"] == 4
        assert block_b["name"] == "Block-B"
        assert block_b["room_count"] == 58

        refused = (
            ("is_active", "Is active is required."),
            ("name", "Name is required."),
            ("room_count", "Room count is required."),
        )
        for field_name, message in refused:
            response = client.patch(
                f"/api/v1/admin/blocks/{BLOCK_B}",
                headers=headers,
                json={field_name: None},
            )
            assert_error(response, 422, "validation_error")
            error = response.json()["error"]
            assert error["message"] == message
            assert error["details"] == {"field": field_name}

        after = client.get("/api/v1/admin/blocks", headers=headers)
        assert after.status_code == 200
        stayed = next(item for item in after.json() if item["id"] == BLOCK_B)
        assert stayed["is_active"] is True
        assert stayed["name"] == "Block-B"
        assert stayed["room_count"] == 58
        assert stayed["floors"] == 4

        cleared = client.patch(
            f"/api/v1/admin/blocks/{BLOCK_B}",
            headers=headers,
            json={"floors": None},
        )
        assert cleared.status_code == 200
        assert cleared.json()["floors"] is None
        assert cleared.json()["is_active"] is True
