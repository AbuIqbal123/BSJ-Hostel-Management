"""Provost resident accounts and hall-pass reissue."""

from __future__ import annotations

import json
import sqlite3
from collections.abc import Iterator
from datetime import datetime, timezone
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.dev_seed import PROVOST_PHRASE, RESIDENT_PHRASE, WARDEN_PHRASE, joined

ARTIFACT = Path(__file__).resolve().parent / "artifacts" / "admin-residents.json"
BLOCK_B = "d032aad6-a203-5ea0-ba9a-3a9257edbfc8"
PROVOST_ID = "f66ab000-0000-4000-8000-000000000006"
WARDEN_ID = "e55fa000-0000-4000-8000-000000000005"
AISHA_ID = "b22de000-0000-4000-8000-000000000002"
ROOM_B204 = "d4400000-0000-4000-8000-000000000004"
ROOM_B205 = "d4400000-0000-4000-8000-000000000005"
CREATED = "2026-09-30T00:00:00Z"
NOW = datetime(2026, 9, 30, 12, 0, tzinfo=timezone.utc)
TEMP_PASSWORD = joined("resident", "20")
AISHA_QR = "bsj:v1:test-resident-hall-pass"


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
            INSERT INTO rooms (id, block_id, number, label, bed_count, is_active) VALUES
              (?, ?, '204', 'B-204', 2, 1),
              (?, ?, '205', 'B-205', 2, 1)
            """,
            (ROOM_B204, BLOCK_B, ROOM_B205, BLOCK_B),
        )
        people = (
            (PROVOST_ID, "provost", "provost.halima", "Halima Begum", PROVOST_PHRASE, "Provost"),
            (WARDEN_ID, "warden", "warden.sara", "Sara Malik", WARDEN_PHRASE, "Warden"),
            (AISHA_ID, "resident", "24-GLLB-118", "Aisha Khan", RESIDENT_PHRASE, None),
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
              '+919876543210', ?, 'inside', ?, ?
            )
            """,
            (AISHA_ID, ROOM_B204, AISHA_QR, CREATED, CREATED),
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


def test_admin_residents(database_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    expected = json.loads(ARTIFACT.read_text(encoding="utf-8"))
    from app.main import app
    from app.shared import clock

    monkeypatch.setattr(clock, "utc_now", FrozenClock().utc_now)
    with TestClient(app) as client:
        issue_people(database_path)

        assert_error(client.get("/api/v1/admin/residents"), 401, "unauthenticated")
        aisha = sign_in(client, "24-GLLB-118", RESIDENT_PHRASE)
        assert_error(
            client.get(
                "/api/v1/admin/residents",
                headers={"Authorization": f"Bearer {aisha['access_token']}"},
            ),
            403,
            "forbidden",
        )
        warden = sign_in(client, "warden.sara", WARDEN_PHRASE)
        assert_error(
            client.get(
                "/api/v1/admin/residents",
                headers={"Authorization": f"Bearer {warden['access_token']}"},
            ),
            403,
            "forbidden",
        )

        provost = sign_in(client, "provost.halima", PROVOST_PHRASE)
        headers = {"Authorization": f"Bearer {provost['access_token']}"}

        listed = client.get("/api/v1/admin/residents", headers=headers)
        assert listed.status_code == 200
        assert listed.json()["total"] == 1
        assert listed.json()["items"][0]["id"] == AISHA_ID
        assert "hall_pass" not in listed.json()["items"][0]
        assert "qr" not in json.dumps(listed.json()).lower()

        created = client.post(
            "/api/v1/admin/residents",
            headers=headers,
            json={
                **expected["create"],
                "room_id": ROOM_B205,
                "temporary_password": TEMP_PASSWORD,
            },
        )
        assert created.status_code == 201
        body = created.json()
        assert set(body) == {"account", "hall_pass"}
        maryam_id = body["account"]["id"]
        assert body["account"]["enrolment_number"] == "26-BA-001"
        assert body["account"]["room_label"] == "B-205"
        assert body["account"]["status"] == "active"
        assert body["account"]["presence"] == "inside"
        assert body["hall_pass"]["qr_payload"].startswith("bsj:v1:")
        assert body["hall_pass"]["full_name"] == "Maryam Siddiqui"
        assert body["hall_pass"]["room_label"] == "B-205"
        first_qr = body["hall_pass"]["qr_payload"]

        dup = client.post(
            "/api/v1/admin/residents",
            headers=headers,
            json={
                **expected["create"],
                "enrolment_number": "26-ba-001",
                "room_id": ROOM_B204,
                "temporary_password": TEMP_PASSWORD,
            },
        )
        assert_error(dup, 409, "duplicate_username")
        assert dup.json()["error"]["message"] == expected["duplicate_message"]

        searched = client.get(
            f"/api/v1/admin/residents?q={expected['search_q']}",
            headers=headers,
        )
        assert searched.status_code == 200
        assert searched.json()["total"] == 1
        assert searched.json()["items"][0]["id"] == maryam_id

        got = client.get(f"/api/v1/admin/residents/{maryam_id}", headers=headers)
        assert got.status_code == 200
        assert got.json()["id"] == maryam_id
        assert "qr" not in json.dumps(got.json()).lower()

        assert_error(
            client.get(
                "/api/v1/admin/residents/00000000-0000-4000-8000-000000000099",
                headers=headers,
            ),
            404,
            "not_found",
        )

        maryam_session = sign_in(client, "26-BA-001", TEMP_PASSWORD)
        maryam_refresh = maryam_session["refresh_token"]

        patched = client.patch(
            f"/api/v1/admin/residents/{maryam_id}",
            headers=headers,
            json={
                "course": None,
                "enrolment_number": "26-BA-002",
                "room_id": ROOM_B204,
            },
        )
        assert patched.status_code == 200
        assert patched.json()["course"] is None
        assert patched.json()["enrolment_number"] == "26-BA-002"
        assert patched.json()["room_label"] == "B-204"

        # Username follows enrolment
        moved_login = sign_in(client, "26-BA-002", TEMP_PASSWORD)
        assert moved_login["access_token"]

        suspended = client.patch(
            f"/api/v1/admin/residents/{maryam_id}",
            headers=headers,
            json={"status": "suspended"},
        )
        assert suspended.status_code == 200
        assert suspended.json()["status"] == "suspended"

        refresh = client.post(
            "/api/v1/auth/refresh",
            json={"refresh_token": maryam_refresh},
        )
        assert_error(refresh, 401, "unauthenticated")

        reinstated = client.patch(
            f"/api/v1/admin/residents/{maryam_id}",
            headers=headers,
            json={"status": "active"},
        )
        assert reinstated.status_code == 200
        assert reinstated.json()["status"] == "active"

        reissued = client.post(
            f"/api/v1/admin/residents/{maryam_id}/hall-pass/reissue",
            headers=headers,
        )
        assert reissued.status_code == 200
        assert reissued.json()["qr_payload"].startswith("bsj:v1:")
        assert reissued.json()["qr_payload"] != first_qr
        new_qr = reissued.json()["qr_payload"]

        connection = sqlite3.connect(database_path)
        try:
            stored = connection.execute(
                "SELECT qr_token, enrolment_number, course FROM residents WHERE user_id = ?",
                (maryam_id,),
            ).fetchone()
            username = connection.execute(
                "SELECT username, status FROM users WHERE id = ?",
                (maryam_id,),
            ).fetchone()
            actions = [
                row[0]
                for row in connection.execute(
                    """
                    SELECT action FROM audit_log
                    WHERE action IN (
                      'resident.created', 'resident.updated',
                      'resident.suspended', 'resident.reinstated',
                      'hall_pass.reissued'
                    )
                    ORDER BY occurred_at, rowid
                    """
                )
            ]
            old_alive = connection.execute(
                "SELECT COUNT(*) FROM residents WHERE qr_token = ?",
                (first_qr,),
            ).fetchone()[0]
        finally:
            connection.close()
        assert stored[0] == new_qr
        assert stored[1] == "26-BA-002"
        assert stored[2] is None
        assert username == ("26-BA-002", "active")
        assert old_alive == 0
        assert actions[0] == "resident.created"
        assert "resident.updated" in actions
        assert "resident.suspended" in actions
        assert "resident.reinstated" in actions
        assert actions[-1] == "hall_pass.reissued"
