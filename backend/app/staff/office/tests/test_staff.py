"""Provost staff account list, create, and update."""

from __future__ import annotations

import json
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.shared.testing_env import role_credential

ARTIFACT = Path(__file__).resolve().parent / "artifacts" / "admin-staff.json"
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


def assert_error(response, status: int, code: str) -> None:
    assert response.status_code == status
    body = response.json()
    assert set(body) == {"detail", "error"}
    assert body["detail"] == body["error"]["message"]
    assert isinstance(body["error"].get("request_id"), str) and body["error"]["request_id"]
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


def sign_in(client: TestClient, username: str, password: str) -> dict:
    response = client.post(
        "/api/v1/auth/login",
        json={"username": username, "password": password},
    )
    assert response.status_code == 200
    return response.json()


def test_admin_staff(database_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    expected = json.loads(ARTIFACT.read_text(encoding="utf-8"))
    from app.main import app
    from app.shared import clock

    monkeypatch.setattr(clock, "utc_now", FrozenClock().utc_now)
    with TestClient(app) as client:
        issue_people(database_path)

        assert_error(client.get("/api/v1/admin/staff"), 401, "unauthenticated")
        resident = sign_in(client, "24-GLLB-118", role_credential("resident"))
        assert_error(
            client.get(
                "/api/v1/admin/staff",
                headers={"Authorization": f"Bearer {resident['access_token']}"},
            ),
            403,
            "forbidden",
        )
        warden = sign_in(client, "warden.sara", role_credential("warden"))
        assert_error(
            client.get(
                "/api/v1/admin/staff",
                headers={"Authorization": f"Bearer {warden['access_token']}"},
            ),
            403,
            "forbidden",
        )

        provost = sign_in(client, "provost.halima", role_credential("provost"))
        headers = {"Authorization": f"Bearer {provost['access_token']}"}

        listed = client.get("/api/v1/admin/staff", headers=headers)
        assert listed.status_code == 200
        assert listed.json()["total"] == 2
        usernames = {item["username"] for item in listed.json()["items"]}
        assert usernames == {"provost.halima", "warden.sara"}
        assert all(item["role"] in {"gate", "warden", "provost"} for item in listed.json()["items"])

        created = client.post(
            "/api/v1/admin/staff",
            headers=headers,
            json={**expected["create"], "temporary_password": role_credential("gate-temp")},
        )
        assert created.status_code == 201
        body = created.json()
        assert body["username"] == "imran.qureshi"
        assert body["role"] == "gate"
        assert body["job_title"] == "Gatekeeper"
        assert body["status"] == "active"
        assert "password" not in json.dumps(body).lower()
        staff_id = body["id"]

        dup = client.post(
            "/api/v1/admin/staff",
            headers=headers,
            json={
                **expected["create"],
                "username": "IMRAN.QURESHI",
                "temporary_password": role_credential("gate-temp"),
            },
        )
        assert_error(dup, 409, "duplicate_username")
        assert dup.json()["error"]["message"] == expected["duplicate_message"]

        assert_error(
            client.patch(
                f"/api/v1/admin/staff/{staff_id}",
                headers=headers,
                json={"role": "warden"},
            ),
            422,
            "validation_error",
        )

        assert_error(
            client.patch(
                "/api/v1/admin/staff/00000000-0000-4000-8000-000000000099",
                headers=headers,
                json={"job_title": "Missing"},
            ),
            404,
            "not_found",
        )

        assert_error(
            client.patch(
                f"/api/v1/admin/staff/{RESIDENT_ID}",
                headers=headers,
                json={"job_title": "Nope"},
            ),
            404,
            "not_found",
        )

        session = sign_in(client, "imran.qureshi", role_credential("gate-temp"))
        refresh = session["refresh_token"]

        updated = client.patch(
            f"/api/v1/admin/staff/{staff_id}",
            headers=headers,
            json={"job_title": "Night gatekeeper", "status": "suspended"},
        )
        assert updated.status_code == 200
        assert updated.json()["job_title"] == "Night gatekeeper"
        assert updated.json()["status"] == "suspended"
        assert updated.json()["role"] == "gate"

        assert_error(
            client.post("/api/v1/auth/refresh", json={"refresh_token": refresh}),
            401,
            "unauthenticated",
        )

        reinstated = client.patch(
            f"/api/v1/admin/staff/{staff_id}",
            headers=headers,
            json={"status": "active"},
        )
        assert reinstated.status_code == 200
        assert reinstated.json()["status"] == "active"

        after = client.get("/api/v1/admin/staff?limit=50&offset=0", headers=headers)
        assert after.status_code == 200
        assert after.json()["total"] == 3

        connection = sqlite3.connect(database_path)
        try:
            actions = [
                row[0]
                for row in connection.execute(
                    """
                    SELECT action FROM audit_log
                    WHERE action IN ('staff.created', 'staff.updated')
                    ORDER BY occurred_at, rowid
                    """
                )
            ]
            role = connection.execute(
                "SELECT role FROM users WHERE id = ?",
                (staff_id,),
            ).fetchone()[0]
        finally:
            connection.close()
        assert actions[0] == "staff.created"
        assert actions.count("staff.updated") >= 2
        assert role == "gate"
