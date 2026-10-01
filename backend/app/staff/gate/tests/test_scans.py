"""Gate hall-pass scan and recent activity."""

from __future__ import annotations

import json
import sqlite3
from collections.abc import Iterator
from datetime import datetime, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

import pytest
from fastapi.testclient import TestClient

from app.dev_seed import GATE_PHRASE, RESIDENT_PHRASE, WARDEN_PHRASE

ARTIFACT = Path(__file__).resolve().parent / "artifacts" / "gate-scans.json"
BLOCK_B = "d032aad6-a203-5ea0-ba9a-3a9257edbfc8"
LIBRARY = "fc2da7c5-8d65-5680-8034-d8acb69745eb"
GATE_ID = "a11ce000-0000-4000-8000-000000000001"
WARDEN_ID = "e55fa000-0000-4000-8000-000000000005"
RESIDENT_ID = "b22de000-0000-4000-8000-000000000002"
ROOM_ID = "d4400000-0000-4000-8000-000000000004"
CREATED = "2026-09-30T00:00:00Z"
OUTING_ID = "e7700000-0000-4000-8000-000000000011"
QR = "bsj:v1:test-resident-hall-pass"
NOW = datetime(2026, 9, 30, 12, 0, tzinfo=timezone.utc)  # 17:30 IST, inside summer hours


class MovableClock:
    def __init__(self, moment: datetime) -> None:
        self.moment = moment

    def utc_now(self) -> datetime:
        return self.moment


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


def assert_error(response, status: int, code: str) -> dict:
    assert response.status_code == status
    body = response.json()
    assert set(body) == {"error"}
    assert body["error"]["code"] == code
    return body["error"]


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
        for user_id, role, username, full_name, password in (
            (GATE_ID, "gate", "gate.fatima", "Fatima Khan", GATE_PHRASE),
            (WARDEN_ID, "warden", "warden.sara", "Sara Malik", WARDEN_PHRASE),
            (RESIDENT_ID, "resident", "24-GLLB-118", "Aisha Khan", RESIDENT_PHRASE),
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
            "INSERT INTO staff (user_id, job_title) VALUES (?, 'Gatekeeper')",
            (GATE_ID,),
        )
        connection.execute(
            "INSERT INTO staff (user_id, job_title) VALUES (?, 'Warden')",
            (WARDEN_ID,),
        )
        connection.execute(
            """
            INSERT INTO residents (
              user_id, enrolment_number, course, room_id, guardian_name, guardian_phone,
              qr_token, presence, created_at, updated_at
            ) VALUES (?, '24-GLLB-118', 'B.A. LL.B. (Hons.)', ?, 'Rashid Khan',
              '+919876543210', ?, 'inside', ?, ?)
            """,
            (RESIDENT_ID, ROOM_ID, QR, CREATED, CREATED),
        )
        connection.commit()
    finally:
        connection.close()


def plan_library(path: Path) -> None:
    connection = sqlite3.connect(path)
    try:
        connection.execute("PRAGMA foreign_keys=ON;")
        expected = "2026-09-30T12:30:00Z"
        grace = "2026-09-30T13:00:00Z"
        hall_date = (
            datetime.strptime(expected, "%Y-%m-%dT%H:%M:%SZ")
            .replace(tzinfo=timezone.utc)
            .astimezone(ZoneInfo("Asia/Kolkata"))
            .date()
            .isoformat()
        )
        connection.execute(
            """
            INSERT INTO outings (
              id, resident_id, permission_id, type, status, destination_id, place,
              expected_return_at, grace_ends_at, exited_at, exit_recorded_by,
              returned_at, return_recorded_by, created_at, updated_at, cancelled_at, hall_date
            ) VALUES (
              ?, ?, NULL, 'ordinary', 'planned', ?, 'Maulana Azad Library',
              ?, ?, NULL, NULL,
              NULL, NULL, ?, ?, NULL, ?
            )
            """,
            (OUTING_ID, RESIDENT_ID, LIBRARY, expected, grace, CREATED, CREATED, hall_date),
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


def test_gate_scans_and_activity(
    database_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    expected = json.loads(ARTIFACT.read_text(encoding="utf-8"))
    from app.main import app
    from app.shared import clock

    movable = MovableClock(NOW)
    monkeypatch.setattr(clock, "utc_now", movable.utc_now)
    with TestClient(app) as client:
        issue_people(database_path)
        assert_error(client.post("/api/v1/gate/scans", json={"qr_payload": QR}), 401, "unauthenticated")
        resident = sign_in(client, "24-GLLB-118", RESIDENT_PHRASE)
        assert_error(
            client.post(
                "/api/v1/gate/scans",
                headers={"Authorization": f"Bearer {resident}"},
                json={"qr_payload": QR},
            ),
            403,
            "forbidden",
        )

        gate = sign_in(client, "gate.fatima", GATE_PHRASE)
        headers = {"Authorization": f"Bearer {gate}"}
        assert_error(
            client.post(
                "/api/v1/gate/scans",
                headers=headers,
                json={"qr_payload": "bsj:v1:unknown-token"},
            ),
            404,
            "unknown_hall_pass",
        )
        err = assert_error(
            client.post("/api/v1/gate/scans", headers=headers, json={"qr_payload": QR}),
            409,
            "no_outing_planned",
        )
        assert err["details"]["full_name"] == "Aisha Khan"
        assert err["details"]["room_label"] == "B-204"

        plan_library(database_path)
        # bare token also accepted
        exit_scan = client.post(
            "/api/v1/gate/scans",
            headers=headers,
            json={"qr_payload": "test-resident-hall-pass"},
        )
        assert exit_scan.status_code == 200
        exit_body = exit_scan.json()
        assert exit_body["outcome"] == "exit_recorded"
        assert exit_body["message"] == expected["exit_message"]
        assert exit_body["full_name"] == "Aisha Khan"
        assert exit_body["room_label"] == "B-204"
        assert exit_body["outing"]["id"] == OUTING_ID
        assert exit_body["outing"]["status"] == "outside"
        assert exit_body["outing"]["exited_at"] == "2026-09-30T12:00:00Z"
        assert exit_body["outing"]["exit_recorded_by_name"] == "Fatima Khan"
        assert exit_body["on_time"] is None

        dup = assert_error(
            client.post("/api/v1/gate/scans", headers=headers, json={"qr_payload": QR}),
            409,
            "duplicate_scan",
        )
        assert dup["details"]["presence"] == "outside"
        assert "already recorded as outside" in dup["message"]

        # after duplicate window, return on time (before grace 13:00Z)
        movable.moment = datetime(2026, 9, 30, 12, 1, tzinfo=timezone.utc)
        returned = client.post("/api/v1/gate/scans", headers=headers, json={"qr_payload": QR})
        assert returned.status_code == 200
        ret_body = returned.json()
        assert ret_body["outcome"] == "return_recorded"
        assert ret_body["message"] == expected["return_message"]
        assert ret_body["on_time"] is True
        assert ret_body["outing"]["status"] == "returned"
        assert ret_body["outing"]["returned_at"] == "2026-09-30T12:01:00Z"
        assert ret_body["outing"]["return_recorded_by_name"] == "Fatima Khan"

        activity = client.get("/api/v1/gate/activity", headers=headers)
        assert activity.status_code == 200
        page = activity.json()
        assert page["total"] == 2
        assert [item["event"] for item in page["items"]] == expected["activity_events"]
        assert page["items"][0]["title"] == "Aisha Khan"
        assert page["items"][0]["subtitle"] == "B-204"

        warden = sign_in(client, "warden.sara", WARDEN_PHRASE)
        warden_activity = client.get(
            "/api/v1/gate/activity",
            headers={"Authorization": f"Bearer {warden}"},
        )
        assert warden_activity.status_code == 200
        assert warden_activity.json()["total"] == 2

        connection = sqlite3.connect(database_path)
        try:
            presence = connection.execute(
                "SELECT presence FROM residents WHERE user_id = ?",
                (RESIDENT_ID,),
            ).fetchone()[0]
            actions = [
                row[0]
                for row in connection.execute(
                    """
                    SELECT action FROM audit_log
                    WHERE action IN ('outing.exit', 'outing.return')
                    ORDER BY occurred_at, rowid
                    """
                )
            ]
        finally:
            connection.close()
        assert presence == "inside"
        assert actions == ["outing.exit", "outing.return"]


CLASH_OUTING = "e7700000-0000-4000-8000-000000000021"
CLASH_PERMISSION = "f8800000-0000-4000-8000-000000000021"
CLASH_RETURN = "2026-09-30T16:00:00Z"
# 19:30 Asia/Kolkata, after the summer ordinary end at 18:30.
EVENING = datetime(2026, 9, 30, 14, 0, tzinfo=timezone.utc)


def seed_clashing_return(path: Path) -> None:
    connection = sqlite3.connect(path)
    try:
        connection.execute("PRAGMA foreign_keys=ON;")
        grace = "2026-09-30T16:30:00Z"
        hall_date = (
            datetime.strptime(CLASH_RETURN, "%Y-%m-%dT%H:%M:%SZ")
            .replace(tzinfo=timezone.utc)
            .astimezone(ZoneInfo("Asia/Kolkata"))
            .date()
            .isoformat()
        )
        connection.execute(
            """
            INSERT INTO outings (
              id, resident_id, permission_id, type, status, destination_id, place,
              expected_return_at, grace_ends_at, exited_at, exit_recorded_by,
              returned_at, return_recorded_by, created_at, updated_at, cancelled_at, hall_date
            ) VALUES (
              ?, ?, NULL, 'ordinary', 'planned', ?, 'Maulana Azad Library',
              ?, ?, NULL, NULL,
              NULL, NULL, ?, ?, NULL, ?
            )
            """,
            (CLASH_OUTING, RESIDENT_ID, LIBRARY, CLASH_RETURN, grace, CREATED, CREATED, hall_date),
        )
        connection.execute(
            """
            INSERT INTO permissions (
              id, resident_id, type, status, short_place, destination_detail, address,
              reason, departure_at, expected_return_at, decided_by, decided_at,
              decision_note, created_at, updated_at
            ) VALUES (
              ?, ?, 'late_night', 'approved', 'Women''s College', NULL, NULL,
              'Late return the same evening.', '2026-09-30T13:00:00Z', ?,
              ?, ?, NULL, ?, ?
            )
            """,
            (
                CLASH_PERMISSION,
                RESIDENT_ID,
                CLASH_RETURN,
                WARDEN_ID,
                CREATED,
                CREATED,
                CREATED,
            ),
        )
        connection.commit()
    finally:
        connection.close()


def test_permission_exit_refuses_when_return_already_planned(
    database_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    from app.main import app
    from app.shared import clock

    monkeypatch.setattr(clock, "utc_now", MovableClock(EVENING).utc_now)
    with TestClient(app) as client:
        issue_people(database_path)
        seed_clashing_return(database_path)
        gate = sign_in(client, "gate.fatima", GATE_PHRASE)
        response = client.post(
            "/api/v1/gate/scans",
            headers={"Authorization": f"Bearer {gate}"},
            json={"qr_payload": QR},
        )
        error = assert_error(response, 409, "return_already_planned")
        assert error["message"] == "This resident already has an outing ending at that time."
        assert error["details"]["full_name"] == "Aisha Khan"
        assert error["details"]["room_label"] == "B-204"
        connection = sqlite3.connect(database_path)
        try:
            outside = connection.execute(
                "SELECT COUNT(*) FROM outings WHERE resident_id = ? AND status = 'outside'",
                (RESIDENT_ID,),
            ).fetchone()[0]
        finally:
            connection.close()
        assert outside == 0
