"""Provost destination list, create, and update."""

from __future__ import annotations

import json
import sqlite3
from collections.abc import Iterator
from datetime import datetime, timezone
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.dev_seed import PROVOST_PHRASE, RESIDENT_PHRASE, WARDEN_PHRASE

ARTIFACT = Path(__file__).resolve().parent / "artifacts" / "admin-destinations.json"
OTHER_ID = "f2008ef3-a1df-5ff0-b936-3466d0914781"
LIBRARY = "fc2da7c5-8d65-5680-8034-d8acb69745eb"
PROVOST_ID = "f66ab000-0000-4000-8000-000000000006"
WARDEN_ID = "e55fa000-0000-4000-8000-000000000005"
RESIDENT_ID = "b22de000-0000-4000-8000-000000000002"
BLOCK_B = "d032aad6-a203-5ea0-ba9a-3a9257edbfc8"
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
    monkeypatch.setenv("APP_SECRET_KEY", "test-only-auth-secret")
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


def test_admin_destinations(database_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    expected = json.loads(ARTIFACT.read_text(encoding="utf-8"))
    from app.main import app
    from app.shared import clock

    monkeypatch.setattr(clock, "utc_now", FrozenClock().utc_now)
    with TestClient(app) as client:
        issue_people(database_path)

        assert_error(client.get("/api/v1/admin/destinations"), 401, "unauthenticated")
        resident = sign_in(client, "24-GLLB-118", RESIDENT_PHRASE)
        assert_error(
            client.get(
                "/api/v1/admin/destinations",
                headers={"Authorization": f"Bearer {resident}"},
            ),
            403,
            "forbidden",
        )
        warden = sign_in(client, "warden.sara", WARDEN_PHRASE)
        assert_error(
            client.get(
                "/api/v1/admin/destinations",
                headers={"Authorization": f"Bearer {warden}"},
            ),
            403,
            "forbidden",
        )

        provost = sign_in(client, "provost.halima", PROVOST_PHRASE)
        headers = {"Authorization": f"Bearer {provost}"}

        listed = client.get("/api/v1/admin/destinations", headers=headers)
        assert listed.status_code == 200
        names = [item["name"] for item in listed.json()["items"]]
        assert names == expected["seed_names"]
        assert listed.json()["items"][-1]["is_other"] is True

        created = client.post(
            "/api/v1/admin/destinations",
            headers=headers,
            json={"name": expected["create_name"]},
        )
        assert created.status_code == 201
        body = created.json()
        assert body["name"] == "City Clinic"
        assert body["is_other"] is False
        assert body["is_active"] is True
        city_id = body["id"]

        dup = client.post(
            "/api/v1/admin/destinations",
            headers=headers,
            json={"name": "city clinic"},
        )
        assert_error(dup, 409, "duplicate_destination")
        assert dup.json()["error"]["message"] == expected["duplicate_message"]

        second_other = client.post(
            "/api/v1/admin/destinations",
            headers=headers,
            json={"name": "Free text", "is_other": True},
        )
        assert_error(second_other, 409, "other_exists")
        assert second_other.json()["error"]["message"] == expected["other_exists_message"]

        assert_error(
            client.patch(
                "/api/v1/admin/destinations/00000000-0000-4000-8000-000000000099",
                headers=headers,
                json={"is_active": False},
            ),
            404,
            "not_found",
        )

        deactivated = client.patch(
            f"/api/v1/admin/destinations/{LIBRARY}",
            headers=headers,
            json={"is_active": False},
        )
        assert deactivated.status_code == 200
        assert deactivated.json()["is_active"] is False

        after = client.get("/api/v1/admin/destinations", headers=headers)
        after_names = [item["name"] for item in after.json()["items"]]
        assert "City Clinic" in after_names
        assert "Maulana Azad Library" in after_names
        library = next(item for item in after.json()["items"] if item["id"] == LIBRARY)
        assert library["is_active"] is False

        flag_other = client.patch(
            f"/api/v1/admin/destinations/{city_id}",
            headers=headers,
            json={"is_other": True},
        )
        assert_error(flag_other, 409, "other_exists")
        assert flag_other.json()["error"]["message"] == expected["other_exists_message"]

        renamed = client.patch(
            f"/api/v1/admin/destinations/{city_id}",
            headers=headers,
            json={"name": "City Bookshop"},
        )
        assert renamed.status_code == 200
        assert renamed.json()["name"] == "City Bookshop"

        connection = sqlite3.connect(database_path)
        try:
            actions = [
                row[0]
                for row in connection.execute(
                    """
                    SELECT action FROM audit_log
                    WHERE action IN ('destination.created', 'destination.updated')
                    ORDER BY occurred_at, rowid
                    """
                )
            ]
            other_active = connection.execute(
                "SELECT is_active FROM destinations WHERE id = ?",
                (OTHER_ID,),
            ).fetchone()[0]
        finally:
            connection.close()
        assert actions == [
            "destination.created",
            "destination.updated",
            "destination.updated",
        ]
        assert other_active == 1
