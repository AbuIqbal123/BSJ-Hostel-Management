"""Gate guest list, arrival, and departure."""

from __future__ import annotations

from app.shared.testing_env import signing_key_for_tests

import json
import sqlite3
from collections.abc import Iterator
from datetime import datetime, timezone
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.dev_seed import GATE_PHRASE, RESIDENT_PHRASE, WARDEN_PHRASE

ARTIFACT = Path(__file__).resolve().parent / "artifacts" / "gate-guests.json"
BLOCK_B = "d032aad6-a203-5ea0-ba9a-3a9257edbfc8"
GATE_ID = "a11ce000-0000-4000-8000-000000000001"
WARDEN_ID = "e55fa000-0000-4000-8000-000000000005"
RESIDENT_ID = "b22de000-0000-4000-8000-000000000002"
OTHER_ID = "c44ef000-0000-4000-8000-000000000009"
ROOM_ID = "d4400000-0000-4000-8000-000000000004"
OTHER_ROOM = "d4400000-0000-4000-8000-000000000005"
CREATED = "2026-09-30T00:00:00Z"
EXPECTED = "cc100000-0000-4000-8000-0000000000c1"
IN_HALL = "cc100000-0000-4000-8000-0000000000c2"
SHOULD_LEFT = "cc100000-0000-4000-8000-0000000000c3"
UNPAID = "cc100000-0000-4000-8000-0000000000c4"
UPCOMING = "cc100000-0000-4000-8000-0000000000c5"
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
    from app.dev_seed import joined

    connection = sqlite3.connect(path)
    try:
        connection.execute("PRAGMA foreign_keys=ON;")
        connection.execute(
            """
            INSERT INTO rooms (id, block_id, number, label, bed_count, is_active)
            VALUES (?, ?, '204', 'B-204', 2, 1), (?, ?, '205', 'B-205', 2, 1)
            """,
            (ROOM_ID, BLOCK_B, OTHER_ROOM, BLOCK_B),
        )
        people = (
            (GATE_ID, "gate", "gate.fatima", "Fatima Khan", GATE_PHRASE),
            (WARDEN_ID, "warden", "warden.sara", "Sara Malik", WARDEN_PHRASE),
            (RESIDENT_ID, "resident", "24-GLLB-118", "Aisha Khan", RESIDENT_PHRASE),
            (OTHER_ID, "resident", "24-BA-002", "Maryam Siddiqui", joined("resident", "20")),
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
            "INSERT INTO staff (user_id, job_title) VALUES (?, 'Warden')",
            (WARDEN_ID,),
        )
        connection.execute(
            """
            INSERT INTO residents (
              user_id, enrolment_number, course, room_id, guardian_name, guardian_phone,
              qr_token, presence, created_at, updated_at
            ) VALUES
              (?, '24-GLLB-118', 'B.A. LL.B. (Hons.)', ?, 'Rashid Khan',
               '+919876543210', 'bsj:v1:test-resident-hall-pass', 'inside', ?, ?),
              (?, '24-BA-002', 'B.A.', ?, 'Yusuf Siddiqui',
               '+919876543211', 'bsj:v1:test-other-resident', 'inside', ?, ?)
            """,
            (RESIDENT_ID, ROOM_ID, CREATED, CREATED, OTHER_ID, OTHER_ROOM, CREATED, CREATED),
        )
        connection.commit()
    finally:
        connection.close()


def seed_stays(path: Path) -> None:
    connection = sqlite3.connect(path)
    try:
        connection.execute("PRAGMA foreign_keys=ON;")
        rows = (
            # expected today: approved paid within stay, not arrived
            (
                EXPECTED,
                RESIDENT_ID,
                "Expected Guest",
                "Cousin",
                "2026-09-29",
                "2026-10-01",
                "Visit.",
                "approved",
                "paid",
                WARDEN_ID,
                "2026-09-29T08:00:00Z",
                WARDEN_ID,
                "2026-09-28T12:00:00Z",
                None,
                None,
                None,
                None,
                None,
                "2026-09-28T10:00:00Z",
            ),
            # in hall
            (
                IN_HALL,
                RESIDENT_ID,
                "In Hall Guest",
                "Sister",
                "2026-09-29",
                "2026-10-01",
                "In hall.",
                "approved",
                "paid",
                WARDEN_ID,
                "2026-09-29T08:00:00Z",
                WARDEN_ID,
                "2026-09-28T12:00:00Z",
                None,
                "2026-09-29T10:00:00Z",
                GATE_ID,
                None,
                None,
                "2026-09-28T09:00:00Z",
            ),
            # should have left (still dining)
            (
                SHOULD_LEFT,
                OTHER_ID,
                "Overstay Guest",
                "Niece",
                "2026-09-20",
                "2026-09-25",
                "Overstay.",
                "approved",
                "paid",
                WARDEN_ID,
                "2026-09-20T08:00:00Z",
                WARDEN_ID,
                "2026-09-19T12:00:00Z",
                None,
                "2026-09-20T10:00:00Z",
                GATE_ID,
                None,
                None,
                "2026-09-19T09:00:00Z",
            ),
            # unpaid within stay — timing-expected; arrival still refused until paid
            (
                UNPAID,
                RESIDENT_ID,
                "Unpaid Guest",
                "Friend",
                "2026-09-29",
                "2026-10-01",
                "Unpaid.",
                "approved",
                "unpaid",
                None,
                None,
                WARDEN_ID,
                "2026-09-28T12:00:00Z",
                None,
                None,
                None,
                None,
                None,
                "2026-09-28T11:00:00Z",
            ),
            # upcoming paid
            (
                UPCOMING,
                OTHER_ID,
                "Upcoming Guest",
                "Aunt",
                "2026-10-10",
                "2026-10-12",
                "Later.",
                "approved",
                "paid",
                WARDEN_ID,
                "2026-09-28T08:00:00Z",
                WARDEN_ID,
                "2026-09-28T12:00:00Z",
                None,
                None,
                None,
                None,
                None,
                "2026-09-28T08:00:00Z",
            ),
        )
        connection.executemany(
            """
            INSERT INTO guest_stays (
              id, host_resident_id, guest_name, relation, guest_start_date, guest_end_date, reason,
              status, payment_status, payment_marked_by, payment_marked_at,
              decided_by, decided_at, decision_note,
              arrived_at, arrived_recorded_by, departed_at, departed_recorded_by,
              created_at, updated_at
            ) VALUES (
              ?, ?, ?, ?, ?, ?, ?,
              ?, ?, ?, ?,
              ?, ?, ?,
              ?, ?, ?, ?,
              ?, ?
            )
            """,
            [(*row, row[-1]) for row in rows],
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


def test_gate_guests(database_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    expected = json.loads(ARTIFACT.read_text(encoding="utf-8"))
    from app.main import app
    from app.shared import clock

    monkeypatch.setattr(clock, "utc_now", FrozenClock().utc_now)
    with TestClient(app) as client:
        issue_people(database_path)
        seed_stays(database_path)

        assert_error(client.get("/api/v1/gate/guests?bucket=expected"), 401, "unauthenticated")
        resident = sign_in(client, "24-GLLB-118", RESIDENT_PHRASE)
        assert_error(
            client.get(
                "/api/v1/gate/guests?bucket=expected",
                headers={"Authorization": f"Bearer {resident}"},
            ),
            403,
            "forbidden",
        )

        gate = sign_in(client, "gate.fatima", GATE_PHRASE)
        headers = {"Authorization": f"Bearer {gate}"}

        listed = client.get("/api/v1/gate/guests?bucket=expected", headers=headers)
        assert listed.status_code == 200
        assert [item["id"] for item in listed.json()["items"]] == expected["expected_ids"]
        assert listed.json()["items"][0]["bucket"] == "expected"
        assert listed.json()["items"][0]["payment_status"] == "paid"
        assert {item["payment_status"] for item in listed.json()["items"]} == {"paid", "unpaid"}

        paid_only = client.get(
            "/api/v1/gate/guests?bucket=expected&payment_status=paid",
            headers=headers,
        )
        assert paid_only.status_code == 200
        assert [item["id"] for item in paid_only.json()["items"]] == expected["expected_paid_ids"]
        assert all(item["payment_status"] == "paid" for item in paid_only.json()["items"])

        unpaid_only = client.get(
            "/api/v1/gate/guests?bucket=expected&payment_status=unpaid",
            headers=headers,
        )
        assert unpaid_only.status_code == 200
        assert [item["id"] for item in unpaid_only.json()["items"]] == expected["expected_unpaid_ids"]
        assert all(item["payment_status"] == "unpaid" for item in unpaid_only.json()["items"])

        dining = client.get("/api/v1/gate/guests?bucket=in_hall", headers=headers)
        assert dining.status_code == 200
        assert [item["id"] for item in dining.json()["items"]] == expected["in_hall_ids"]
        buckets = {item["id"]: item["bucket"] for item in dining.json()["items"]}
        assert buckets[IN_HALL] == "in_hall"
        assert buckets[SHOULD_LEFT] == "should_have_left"

        assert_error(
            client.post(f"/api/v1/gate/guests/{UNPAID}/arrival", headers=headers),
            409,
            "payment_required",
        )
        assert_error(
            client.post(f"/api/v1/gate/guests/{UPCOMING}/arrival", headers=headers),
            409,
            "guest_not_expected",
        )
        assert_error(
            client.post(f"/api/v1/gate/guests/{IN_HALL}/arrival", headers=headers),
            409,
            "guest_not_expected",
        )

        arrived = client.post(f"/api/v1/gate/guests/{EXPECTED}/arrival", headers=headers)
        assert arrived.status_code == 200
        body = arrived.json()
        assert body["message"] == expected["arrival_message"]
        assert body["guest_name"] == "Expected Guest"
        assert body["host_name"] == "Aisha Khan"
        assert body["host_room_label"] == "B-204"
        assert "guests_in_hall_count" not in body

        activity = client.get("/api/v1/gate/activity", headers=headers)
        assert activity.status_code == 200
        arrival_line = next(
            item for item in activity.json()["items"] if item["event"] == "guest_arrival"
        )
        assert arrival_line["guest_name"] == "Expected Guest"
        assert arrival_line["host_name"] == "Aisha Khan"
        assert arrival_line["host_room_label"] == "B-204"
        assert arrival_line["resident_name"] is None
        assert arrival_line["room_label"] is None

        assert_error(
            client.post(f"/api/v1/gate/guests/{EXPECTED}/arrival", headers=headers),
            409,
            "guest_not_expected",
        )

        assert_error(
            client.post(f"/api/v1/gate/guests/{UPCOMING}/departure", headers=headers),
            409,
            "guest_not_in_hall",
        )

        departed = client.post(f"/api/v1/gate/guests/{SHOULD_LEFT}/departure", headers=headers)
        assert departed.status_code == 200
        dep = departed.json()
        assert dep["message"] == expected["departure_message"]
        assert "guests_in_hall_count" not in dep

        dining_after = client.get("/api/v1/gate/guests?bucket=in_hall", headers=headers)
        assert {item["id"] for item in dining_after.json()["items"]} == {IN_HALL, EXPECTED}

        expected_after = client.get("/api/v1/gate/guests?bucket=expected", headers=headers)
        assert [item["id"] for item in expected_after.json()["items"]] == expected["expected_unpaid_ids"]

        warden = sign_in(client, "warden.sara", WARDEN_PHRASE)
        warden_list = client.get(
            "/api/v1/gate/guests?bucket=in_hall",
            headers={"Authorization": f"Bearer {warden}"},
        )
        assert warden_list.status_code == 200

        connection = sqlite3.connect(database_path)
        try:
            actions = [
                row[0]
                for row in connection.execute(
                    """
                    SELECT action FROM audit_log
                    WHERE action IN ('guest_stay.arrived', 'guest_stay.departed')
                    ORDER BY occurred_at, rowid
                    """
                )
            ]
            status = connection.execute(
                "SELECT status, departed_at IS NOT NULL FROM guest_stays WHERE id = ?",
                (SHOULD_LEFT,),
            ).fetchone()
        finally:
            connection.close()
        assert actions == ["guest_stay.arrived", "guest_stay.departed"]
        assert status == ("departed", 1)
