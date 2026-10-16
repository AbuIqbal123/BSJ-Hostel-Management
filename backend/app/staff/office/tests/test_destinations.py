"""Provost destination list, create, and update."""

from __future__ import annotations

import json
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.shared.testing_env import role_credential

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


def assert_error(
    response,
    status: int,
    code: str,
    message: str | None = None,
    field: str | None = None,
) -> None:
    assert response.status_code == status
    body = response.json()
    assert set(body) == {"detail", "error"}
    assert body["detail"] == body["error"]["message"]
    assert isinstance(body["error"].get("request_id"), str) and body["error"]["request_id"]
    assert body["error"]["code"] == code
    if message is not None:
        assert body["error"]["message"] == message
    if field is not None:
        assert body["error"]["details"] == {"field": field}


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
            (PROVOST_ID, "provost", "provost.halima", "Halima Begum", role_credential("provost"), "Provost"),
            (WARDEN_ID, "warden", "warden.sara", "Sara Malik", role_credential("warden"), "Warden"),
            (RESIDENT_ID, "resident", "24-GLLB-118", "Aisha Khan", role_credential("resident"), None),
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
        resident = sign_in(client, "24-GLLB-118", role_credential("resident"))
        assert_error(
            client.get(
                "/api/v1/admin/destinations",
                headers={"Authorization": f"Bearer {resident}"},
            ),
            403,
            "forbidden",
        )
        warden = sign_in(client, "warden.sara", role_credential("warden"))
        assert_error(
            client.get(
                "/api/v1/admin/destinations",
                headers={"Authorization": f"Bearer {warden}"},
            ),
            403,
            "forbidden",
        )

        provost = sign_in(client, "provost.halima", role_credential("provost"))
        headers = {"Authorization": f"Bearer {provost}"}

        listed = client.get("/api/v1/admin/destinations", headers=headers)
        assert listed.status_code == 200
        names = [item["name"] for item in listed.json()["items"]]
        assert names == expected["seed_names"]
        assert listed.json()["items"][-1]["source"] == "custom"

        created = client.post(
            "/api/v1/admin/destinations",
            headers=headers,
            json={"name": expected["create_name"]},
        )
        assert created.status_code == 201
        body = created.json()
        assert body["name"] == "City Clinic"
        assert body["source"] == "preset"
        assert body["status"] == "active"
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
            json={"name": "Free text", "source": "custom"},
        )
        assert_error(second_other, 409, "other_exists")
        assert second_other.json()["error"]["message"] == expected["other_exists_message"]

        assert_error(
            client.patch(
                "/api/v1/admin/destinations/00000000-0000-4000-8000-000000000099",
                headers=headers,
                json={"status": "inactive"},
            ),
            404,
            "not_found",
        )

        deactivated = client.patch(
            f"/api/v1/admin/destinations/{LIBRARY}",
            headers=headers,
            json={"status": "inactive"},
        )
        assert deactivated.status_code == 200
        assert deactivated.json()["status"] == "inactive"

        after = client.get("/api/v1/admin/destinations", headers=headers)
        after_names = [item["name"] for item in after.json()["items"]]
        assert "City Clinic" in after_names
        assert "Maulana Azad Library" in after_names
        library = next(item for item in after.json()["items"] if item["id"] == LIBRARY)
        assert library["status"] == "inactive"

        flag_other = client.patch(
            f"/api/v1/admin/destinations/{city_id}",
            headers=headers,
            json={"source": "custom"},
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


def test_destination_update_rejects_null(database_path: Path) -> None:
    from app.main import app

    with TestClient(app) as client:
        issue_people(database_path)
        provost = sign_in(client, "provost.halima", role_credential("provost"))
        headers = {"Authorization": f"Bearer {provost}"}

        listed = client.get("/api/v1/admin/destinations", headers=headers)
        assert listed.status_code == 200
        original = next(item for item in listed.json()["items"] if item["id"] == OTHER_ID)
        assert original["name"] == "Other"
        assert original["status"] == "active"
        assert original["source"] == "custom"

        cases = (
            ("name", "Name is required."),
            ("status", "Status is required."),
            ("source", "Source is required."),
        )
        for field, message in cases:
            rejected = client.patch(
                f"/api/v1/admin/destinations/{OTHER_ID}",
                headers=headers,
                json={field: None},
            )
            assert_error(rejected, 422, "validation_error", message, field)
            again = client.get("/api/v1/admin/destinations", headers=headers)
            assert again.status_code == 200
            current = next(item for item in again.json()["items"] if item["id"] == OTHER_ID)
            assert current == original
