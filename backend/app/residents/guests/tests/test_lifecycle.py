"""Resident guest stay apply, list, read, and cancel."""

from __future__ import annotations

from app.shared.testing_env import signing_key_for_tests

import json
import sqlite3
from collections.abc import Iterator
from datetime import datetime, timezone
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.dev_seed import GATE_PHRASE, RESIDENT_PHRASE, WARDEN_PHRASE, joined

ARTIFACT = Path(__file__).resolve().parent / "artifacts" / "guest-stays-resident.json"
BLOCK_B = "d032aad6-a203-5ea0-ba9a-3a9257edbfc8"
GATE_ID = "a11ce000-0000-4000-8000-000000000001"
WARDEN_ID = "e55fa000-0000-4000-8000-000000000005"
RESIDENT_ID = "b22de000-0000-4000-8000-000000000002"
OTHER_ID = "c44ef000-0000-4000-8000-000000000009"
ROOM_ID = "d4400000-0000-4000-8000-000000000004"
OTHER_ROOM = "d4400000-0000-4000-8000-000000000005"
CREATED = "2026-09-30T00:00:00Z"
APPROVED_STAY = "aa100000-0000-4000-8000-0000000000a1"
ARRIVED_STAY = "aa100000-0000-4000-8000-0000000000a2"
OTHER_STAY = "aa100000-0000-4000-8000-0000000000a3"
REJECTED_STAY = "aa100000-0000-4000-8000-0000000000a4"
PAID_INSIDE_STAY = "aa100000-0000-4000-8000-0000000000b1"
UNPAID_INSIDE_STAY = "aa100000-0000-4000-8000-0000000000b2"
PAID_PAST_STAY = "aa100000-0000-4000-8000-0000000000b3"


class FrozenClock:
    def utc_now(self) -> datetime:
        return datetime(2026, 9, 30, 13, 0, tzinfo=timezone.utc)


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


def assert_error(response, status: int, code: str, message: str | None = None) -> None:
    assert response.status_code == status
    body = response.json()
    assert set(body) == {"error"}
    assert body["error"]["code"] == code
    if message is not None:
        assert body["error"]["message"] == message


def issue_people(path: Path) -> None:
    from app.shared.auth.security import hash_password

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


def seed_staff_shaped_stays(path: Path) -> None:
    """Approved / arrived / other-host / rejected rows the resident API cannot create alone."""
    connection = sqlite3.connect(path)
    try:
        connection.execute("PRAGMA foreign_keys=ON;")
        connection.execute(
            """
            INSERT INTO guest_stays (
              id, host_resident_id, guest_name, relation, start_date, end_date, reason,
              status, payment_status, payment_marked_by, payment_marked_at,
              decided_by, decided_at, decision_note,
              arrived_at, arrived_recorded_by, departed_at, departed_recorded_by,
              created_at, updated_at
            ) VALUES
              (?, ?, 'Approved Guest', 'Aunt', '2026-10-10', '2026-10-12', 'Visit.',
               'approved', 'unpaid', NULL, NULL,
               ?, '2026-09-30T12:00:00Z', NULL,
               NULL, NULL, NULL, NULL,
               '2026-09-30T11:00:00Z', '2026-09-30T12:00:00Z'),
              (?, ?, 'Arrived Guest', 'Sister', '2026-09-29', '2026-10-02', 'Visit.',
               'approved', 'paid', ?, '2026-09-29T10:00:00Z',
               ?, '2026-09-28T12:00:00Z', NULL,
               '2026-09-30T09:00:00Z', ?, NULL, NULL,
               '2026-09-28T11:00:00Z', '2026-09-30T09:00:00Z'),
              (?, ?, 'Other Host Guest', 'Friend', '2026-10-03', '2026-10-04', 'Visit.',
               'pending', 'unpaid', NULL, NULL,
               NULL, NULL, NULL,
               NULL, NULL, NULL, NULL,
               '2026-09-30T10:00:00Z', '2026-09-30T10:00:00Z'),
              (?, ?, 'Rejected Guest', 'Cousin', '2026-10-06', '2026-10-07', 'Visit.',
               'rejected', 'unpaid', NULL, NULL,
               ?, '2026-09-30T12:30:00Z', 'Not this week.',
               NULL, NULL, NULL, NULL,
               '2026-09-30T09:30:00Z', '2026-09-30T12:30:00Z')
            """,
            (
                APPROVED_STAY,
                RESIDENT_ID,
                WARDEN_ID,
                ARRIVED_STAY,
                RESIDENT_ID,
                WARDEN_ID,
                WARDEN_ID,
                GATE_ID,
                OTHER_STAY,
                OTHER_ID,
                REJECTED_STAY,
                RESIDENT_ID,
                WARDEN_ID,
            ),
        )
        connection.commit()
    finally:
        connection.close()


def seed_expected_boundary_stays(path: Path) -> None:
    """Approved, not-yet-arrived stays used only to read the expected bucket."""
    connection = sqlite3.connect(path)
    try:
        connection.execute("PRAGMA foreign_keys=ON;")
        # 20 September through 28 September is 9 days, over the default maximum of 7.
        connection.execute(
            "UPDATE hall_settings SET guest_max_inclusive_days = 9 WHERE id = 'hall'"
        )
        connection.execute(
            """
            INSERT INTO guest_stays (
              id, host_resident_id, guest_name, relation, start_date, end_date, reason,
              status, payment_status, payment_marked_by, payment_marked_at,
              decided_by, decided_at, decision_note,
              arrived_at, arrived_recorded_by, departed_at, departed_recorded_by,
              created_at, updated_at
            ) VALUES
              (?, ?, 'Paid Inside Guest', 'Aunt', '2026-09-30', '2026-10-02', 'Visit.',
               'approved', 'paid', ?, '2026-09-29T10:00:00Z',
               ?, '2026-09-29T12:00:00Z', NULL,
               NULL, NULL, NULL, NULL,
               '2026-09-29T08:00:00Z', '2026-09-29T12:00:00Z'),
              (?, ?, 'Unpaid Inside Guest', 'Aunt', '2026-09-30', '2026-10-02', 'Visit.',
               'approved', 'unpaid', NULL, NULL,
               ?, '2026-09-29T12:00:00Z', NULL,
               NULL, NULL, NULL, NULL,
               '2026-09-29T08:01:00Z', '2026-09-29T12:00:00Z'),
              (?, ?, 'Paid Past Guest', 'Aunt', '2026-09-20', '2026-09-28', 'Visit.',
               'approved', 'paid', ?, '2026-09-20T10:00:00Z',
               ?, '2026-09-19T12:00:00Z', NULL,
               NULL, NULL, NULL, NULL,
               '2026-09-19T08:00:00Z', '2026-09-20T10:00:00Z')
            """,
            (
                PAID_INSIDE_STAY,
                RESIDENT_ID,
                WARDEN_ID,
                WARDEN_ID,
                UNPAID_INSIDE_STAY,
                RESIDENT_ID,
                WARDEN_ID,
                PAID_PAST_STAY,
                RESIDENT_ID,
                WARDEN_ID,
                WARDEN_ID,
            ),
        )
        connection.execute(
            "UPDATE hall_settings SET guest_max_inclusive_days = 7 WHERE id = 'hall'"
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


def without_id(body: dict) -> dict:
    return {key: value for key, value in body.items() if key != "id"}


def test_guest_stays_resident(database_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    expected = json.loads(ARTIFACT.read_text(encoding="utf-8"))
    from app.main import app
    from app.shared import clock

    monkeypatch.setattr(clock, "utc_now", FrozenClock().utc_now)
    with TestClient(app) as client:
        issue_people(database_path)
        assert_error(
            client.get("/api/v1/me/guest-stays"),
            401,
            "unauthenticated",
            "Sign in again.",
        )
        gate = sign_in(client, "gate.fatima", GATE_PHRASE)
        assert_error(
            client.get("/api/v1/me/guest-stays", headers={"Authorization": f"Bearer {gate}"}),
            403,
            "forbidden",
            "This account cannot do that.",
        )
        resident = sign_in(client, "24-GLLB-118", RESIDENT_PHRASE)
        headers = {"Authorization": f"Bearer {resident}"}

        payload = {
            "guest_name": "Zara Ahmed",
            "relation": "Cousin",
            "start_date": "2026-10-02",
            "end_date": "2026-10-05",
            "reason": "Family wedding in Aligarh. Staying with Aisha, B-204.",
        }
        assert_error(
            client.post(
                "/api/v1/me/guest-stays",
                headers=headers,
                json={**payload, "start_date": "2026-09-30", "end_date": "2026-10-01"},
            ),
            422,
            "validation_error",
        )
        assert_error(
            client.post(
                "/api/v1/me/guest-stays",
                headers=headers,
                json={**payload, "start_date": "2026-10-05", "end_date": "2026-10-02"},
            ),
            422,
            "validation_error",
        )
        assert_error(
            client.post(
                "/api/v1/me/guest-stays",
                headers=headers,
                json={**payload, "start_date": "2026-10-01", "end_date": "2026-10-08"},
            ),
            422,
            "validation_error",
        )

        created = client.post("/api/v1/me/guest-stays", headers=headers, json=payload)
        assert created.status_code == 201
        created_body = created.json()
        assert without_id(created_body) == expected["submitted"]
        stay_id = created_body["id"]

        seed_staff_shaped_stays(database_path)

        listed = client.get("/api/v1/me/guest-stays", headers=headers)
        assert listed.status_code == 200
        page = listed.json()
        assert page["total"] == 4
        assert page["limit"] == 50
        assert page["offset"] == 0
        assert [item["id"] for item in page["items"]] == [
            stay_id,
            APPROVED_STAY,
            REJECTED_STAY,
            ARRIVED_STAY,
        ]
        assert all(item["host_resident_id"] == RESIDENT_ID for item in page["items"])
        assert all(item["id"] != OTHER_STAY for item in page["items"])

        got = client.get(f"/api/v1/me/guest-stays/{stay_id}", headers=headers)
        assert got.status_code == 200
        assert got.json() == created_body
        assert_error(
            client.get(f"/api/v1/me/guest-stays/{OTHER_STAY}", headers=headers),
            404,
            "not_found",
            "That record was not found.",
        )

        cancelled = client.post(f"/api/v1/me/guest-stays/{stay_id}/cancel", headers=headers)
        assert cancelled.status_code == 200
        assert cancelled.json()["status"] == "cancelled"
        assert cancelled.json()["bucket"] == "cancelled"
        assert_error(
            client.post(f"/api/v1/me/guest-stays/{stay_id}/cancel", headers=headers),
            409,
            "not_cancellable",
        )
        assert_error(
            client.post(f"/api/v1/me/guest-stays/{REJECTED_STAY}/cancel", headers=headers),
            409,
            "not_cancellable",
        )

        approved_cancel = client.post(
            f"/api/v1/me/guest-stays/{APPROVED_STAY}/cancel",
            headers=headers,
        )
        assert approved_cancel.status_code == 200
        assert approved_cancel.json()["status"] == "cancelled"
        assert approved_cancel.json()["decided_by_name"] is None

        assert_error(
            client.post(f"/api/v1/me/guest-stays/{ARRIVED_STAY}/cancel", headers=headers),
            409,
            "not_cancellable",
        )
        assert_error(
            client.post(f"/api/v1/me/guest-stays/{OTHER_STAY}/cancel", headers=headers),
            404,
            "not_found",
            "That record was not found.",
        )

        second = client.post(
            "/api/v1/me/guest-stays",
            headers=headers,
            json={
                "guest_name": "Second Guest",
                "relation": "Friend",
                "start_date": "2026-10-03",
                "end_date": "2026-10-03",
                "reason": "A one-day visit.",
            },
        )
        assert second.status_code == 201
        assert second.json()["inclusive_days"] == 1
        assert second.json()["bucket"] == "pending"

        connection = sqlite3.connect(database_path)
        try:
            actions = [
                row[0]
                for row in connection.execute(
                    """
                    SELECT action FROM audit_log
                    WHERE actor_user_id = ?
                    ORDER BY occurred_at, rowid
                    """,
                    (RESIDENT_ID,),
                )
            ]
        finally:
            connection.close()
        assert actions == [
            "auth.login",
            "guest_stay.submitted",
            "guest_stay.cancelled",
            "guest_stay.cancelled",
            "guest_stay.submitted",
        ]


def test_expected_means_paid_inside_dates(
    database_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    from app.main import app
    from app.shared import clock

    monkeypatch.setattr(clock, "utc_now", FrozenClock().utc_now)
    with TestClient(app) as client:
        issue_people(database_path)
        seed_expected_boundary_stays(database_path)
        resident = sign_in(client, "24-GLLB-118", RESIDENT_PHRASE)
        headers = {"Authorization": f"Bearer {resident}"}
        cases = (
            (PAID_INSIDE_STAY, "expected"),
            (UNPAID_INSIDE_STAY, "not_expected"),
            (PAID_PAST_STAY, "not_expected"),
        )
        for stay_id, bucket in cases:
            got = client.get(f"/api/v1/me/guest-stays/{stay_id}", headers=headers)
            assert got.status_code == 200
            assert got.json()["bucket"] == bucket
