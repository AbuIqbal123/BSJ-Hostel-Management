"""Warden/provost guest-stay queue, decisions, and payment."""

from __future__ import annotations

from app.shared.testing_env import signing_key_for_tests

import json
import sqlite3
from collections.abc import Iterator
from datetime import datetime, timezone
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.dev_seed import (
    GATE_PHRASE,
    PROVOST_PHRASE,
    RESIDENT_PHRASE,
    WARDEN_PHRASE,
    joined,
)

ARTIFACT = Path(__file__).resolve().parent / "artifacts" / "guest-stays-staff.json"
BLOCK_B = "d032aad6-a203-5ea0-ba9a-3a9257edbfc8"
GATE_ID = "a11ce000-0000-4000-8000-000000000001"
WARDEN_ID = "e55fa000-0000-4000-8000-000000000005"
PROVOST_ID = "f66fb000-0000-4000-8000-000000000006"
RESIDENT_ID = "b22de000-0000-4000-8000-000000000002"
OTHER_ID = "c44ef000-0000-4000-8000-000000000009"
ROOM_ID = "d4400000-0000-4000-8000-000000000004"
OTHER_ROOM = "d4400000-0000-4000-8000-000000000005"
CREATED = "2026-09-30T00:00:00Z"

PENDING_A = "bb100000-0000-4000-8000-0000000000b1"
PENDING_B = "bb100000-0000-4000-8000-0000000000b2"
UPCOMING = "bb100000-0000-4000-8000-0000000000b3"
IN_HALL = "bb100000-0000-4000-8000-0000000000b4"
SHOULD_LEFT = "bb100000-0000-4000-8000-0000000000b5"
DEPARTED = "bb100000-0000-4000-8000-0000000000b6"
REJECTED = "bb100000-0000-4000-8000-0000000000b7"


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
            (PROVOST_ID, "provost", "provost.halima", "Halima Begum", PROVOST_PHRASE),
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
            "INSERT INTO staff (user_id, job_title) VALUES (?, 'Provost')",
            (PROVOST_ID,),
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
            # pending newest
            (
                PENDING_A,
                RESIDENT_ID,
                "Pending One",
                "Cousin",
                "2026-10-02",
                "2026-10-04",
                "Visit one.",
                "pending",
                "unpaid",
                None,
                None,
                None,
                None,
                None,
                None,
                None,
                None,
                None,
                "2026-09-30T12:00:00Z",
            ),
            (
                PENDING_B,
                OTHER_ID,
                "Pending Two",
                "Aunt",
                "2026-10-03",
                "2026-10-05",
                "Visit two.",
                "pending",
                "unpaid",
                None,
                None,
                None,
                None,
                None,
                None,
                None,
                None,
                None,
                "2026-09-30T11:00:00Z",
            ),
            # approved upcoming (start in future)
            (
                UPCOMING,
                RESIDENT_ID,
                "Upcoming Guest",
                "Friend",
                "2026-10-10",
                "2026-10-12",
                "Later visit.",
                "approved",
                "unpaid",
                None,
                None,
                WARDEN_ID,
                "2026-09-29T12:00:00Z",
                None,
                None,
                None,
                None,
                None,
                "2026-09-29T10:00:00Z",
            ),
            # in hall (arrived, end today or later) — today 2026-09-30
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
            # should have left
            (
                SHOULD_LEFT,
                OTHER_ID,
                "Overstay Guest",
                "Niece",
                "2026-09-20",
                "2026-09-25",
                "Should leave.",
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
            # departed
            (
                DEPARTED,
                RESIDENT_ID,
                "Departed Guest",
                "Cousin",
                "2026-09-20",
                "2026-09-22",
                "Left.",
                "departed",
                "paid",
                WARDEN_ID,
                "2026-09-20T08:00:00Z",
                WARDEN_ID,
                "2026-09-19T12:00:00Z",
                None,
                "2026-09-20T10:00:00Z",
                GATE_ID,
                "2026-09-22T08:00:00Z",
                GATE_ID,
                "2026-09-19T08:00:00Z",
            ),
            # rejected
            (
                REJECTED,
                RESIDENT_ID,
                "Rejected Guest",
                "Friend",
                "2026-10-08",
                "2026-10-09",
                "No.",
                "rejected",
                "unpaid",
                None,
                None,
                WARDEN_ID,
                "2026-09-30T09:00:00Z",
                "Not this week.",
                None,
                None,
                None,
                None,
                "2026-09-30T08:00:00Z",
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


def test_guest_stays_staff(database_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    expected = json.loads(ARTIFACT.read_text(encoding="utf-8"))
    from app.main import app
    from app.shared import clock

    monkeypatch.setattr(clock, "utc_now", FrozenClock().utc_now)
    with TestClient(app) as client:
        issue_people(database_path)
        seed_stays(database_path)

        assert_error(
            client.get("/api/v1/guest-stays"),
            401,
            "unauthenticated",
            "Sign in again.",
        )
        gate = sign_in(client, "gate.fatima", GATE_PHRASE)
        assert_error(
            client.get("/api/v1/guest-stays", headers={"Authorization": f"Bearer {gate}"}),
            403,
            "forbidden",
            "This account cannot do that.",
        )
        resident = sign_in(client, "24-GLLB-118", RESIDENT_PHRASE)
        assert_error(
            client.get(
                "/api/v1/guest-stays",
                headers={"Authorization": f"Bearer {resident}"},
            ),
            403,
            "forbidden",
            "This account cannot do that.",
        )

        warden = sign_in(client, "warden.sara", WARDEN_PHRASE)
        headers = {"Authorization": f"Bearer {warden}"}

        pending = client.get("/api/v1/guest-stays?bucket=pending", headers=headers)
        assert pending.status_code == 200
        pending_body = pending.json()
        assert pending_body["total"] == 2
        assert [item["id"] for item in pending_body["items"]] == expected["pending_ids"]
        summary_keys = {
            "id",
            "guest_name",
            "host_name",
            "host_room_label",
            "guest_start_date",
            "guest_end_date",
            "status",
            "payment_status",
            "bucket",
        }
        for item in pending_body["items"]:
            assert set(item) == summary_keys

        dining = client.get("/api/v1/guest-stays?bucket=in_hall", headers=headers)
        assert dining.status_code == 200
        dining_ids = {item["id"] for item in dining.json()["items"]}
        assert dining_ids == {IN_HALL, SHOULD_LEFT}

        left_only = client.get(
            "/api/v1/guest-stays?bucket=should_have_left",
            headers=headers,
        )
        assert [item["id"] for item in left_only.json()["items"]] == [SHOULD_LEFT]

        upcoming = client.get("/api/v1/guest-stays?bucket=upcoming", headers=headers)
        assert [item["id"] for item in upcoming.json()["items"]] == [UPCOMING]

        got = client.get(f"/api/v1/guest-stays/{PENDING_A}", headers=headers)
        assert got.status_code == 200
        assert got.json()["guest_name"] == "Pending One"
        assert got.json()["host_name"] == "Aisha Khan"

        assert_error(
            client.get(
                "/api/v1/guest-stays/00000000-0000-4000-8000-000000000099",
                headers=headers,
            ),
            404,
            "not_found",
            "That record was not found.",
        )

        approved = client.post(
            f"/api/v1/guest-stays/{PENDING_A}/decision",
            headers=headers,
            json={"decision": "approved", "note": ""},
        )
        assert approved.status_code == 200
        assert approved.json()["status"] == expected["approved_empty_note"]["status"]
        assert approved.json()["payment_status"] == expected["approved_empty_note"]["payment_status"]
        assert approved.json()["decision_note"] is None
        assert approved.json()["decided_by"] == WARDEN_ID
        assert approved.json()["bucket"] == expected["approved_empty_note"]["bucket"]

        assert_error(
            client.post(
                f"/api/v1/guest-stays/{PENDING_A}/decision",
                headers=headers,
                json={"decision": "rejected"},
            ),
            409,
            "not_pending",
        )

        rejected = client.post(
            f"/api/v1/guest-stays/{PENDING_B}/decision",
            headers=headers,
            json={"decision": "rejected", "note": "Not this week."},
        )
        assert rejected.status_code == 200
        assert rejected.json()["status"] == "rejected"
        assert rejected.json()["decision_note"] == "Not this week."
        assert rejected.json()["bucket"] == "rejected"

        paid = client.post(
            f"/api/v1/guest-stays/{UPCOMING}/payment",
            headers=headers,
            json={"payment_status": "paid"},
        )
        assert paid.status_code == 200
        assert paid.json()["payment_status"] == "paid"
        assert paid.json()["status"] == "approved"

        unpaid = client.post(
            f"/api/v1/guest-stays/{UPCOMING}/payment",
            headers=headers,
            json={"payment_status": "unpaid"},
        )
        assert unpaid.status_code == 200
        assert unpaid.json()["payment_status"] == "unpaid"

        # payment on pending (approve path already used PENDING_A; mark payment on approved empty)
        # re-seed a fresh pending via direct insert for payment-before-decision
        connection = sqlite3.connect(database_path)
        try:
            connection.execute("PRAGMA foreign_keys=ON;")
            fresh = "bb100000-0000-4000-8000-0000000000b8"
            connection.execute(
                """
                INSERT INTO guest_stays (
                  id, host_resident_id, guest_name, relation, guest_start_date, guest_end_date, reason,
                  status, payment_status, created_at, updated_at
                ) VALUES (?, ?, 'Pay First', 'Cousin', '2026-10-15', '2026-10-16', 'Pay then decide.',
                  'pending', 'unpaid', '2026-09-30T13:00:00Z', '2026-09-30T13:00:00Z')
                """,
                (fresh, RESIDENT_ID),
            )
            connection.commit()
        finally:
            connection.close()
        pay_pending = client.post(
            f"/api/v1/guest-stays/{fresh}/payment",
            headers=headers,
            json={"payment_status": "paid"},
        )
        assert pay_pending.status_code == 200
        assert pay_pending.json()["status"] == "pending"
        assert pay_pending.json()["payment_status"] == "paid"

        assert_error(
            client.post(
                f"/api/v1/guest-stays/{IN_HALL}/payment",
                headers=headers,
                json={"payment_status": "unpaid"},
            ),
            409,
            "payment_locked",
        )
        assert_error(
            client.post(
                f"/api/v1/guest-stays/{DEPARTED}/payment",
                headers=headers,
                json={"payment_status": "paid"},
            ),
            409,
            "payment_locked",
        )
        assert_error(
            client.post(
                f"/api/v1/guest-stays/{REJECTED}/payment",
                headers=headers,
                json={"payment_status": "paid"},
            ),
            409,
            "payment_locked",
        )

        # Post-arrival date edit by resident → pending; staff re-approves; reject refused.
        resident = sign_in(client, "24-GLLB-118", RESIDENT_PHRASE)
        resident_headers = {"Authorization": f"Bearer {resident}"}
        # IN_HALL is hosted by Aisha
        date_edit = client.patch(
            f"/api/v1/me/guest-stays/{IN_HALL}",
            headers=resident_headers,
            json={"guest_end_date": "2026-10-05"},
        )
        assert date_edit.status_code == 200
        assert date_edit.json()["status"] == "pending"
        assert date_edit.json()["arrived_at"] is not None
        assert_error(
            client.post(
                f"/api/v1/guest-stays/{IN_HALL}/decision",
                headers=headers,
                json={"decision": "rejected", "note": "No"},
            ),
            409,
            "not_pending",
        )
        reapproved = client.post(
            f"/api/v1/guest-stays/{IN_HALL}/decision",
            headers=headers,
            json={"decision": "approved", "note": ""},
        )
        assert reapproved.status_code == 200
        assert reapproved.json()["status"] == "approved"
        assert reapproved.json()["arrived_at"] is not None
        assert reapproved.json()["decided_by"] == WARDEN_ID

        # A second date edit returns the stay to pending. Gate can still record
        # departure so the guest is not held for re-approval.
        second_edit = client.patch(
            f"/api/v1/me/guest-stays/{IN_HALL}",
            headers=resident_headers,
            json={"guest_end_date": "2026-10-04"},
        )
        assert second_edit.status_code == 200
        assert second_edit.json()["status"] == "pending"
        assert second_edit.json()["decided_by"] is None
        gate_token = sign_in(client, "gate.fatima", GATE_PHRASE)
        left = client.post(
            f"/api/v1/gate/guests/{IN_HALL}/departure",
            headers={"Authorization": f"Bearer {gate_token}"},
        )
        assert left.status_code == 200
        assert left.json()["message"] == "The guest has left the hall."
        after_leave = client.get(f"/api/v1/guest-stays/{IN_HALL}", headers=headers)
        assert after_leave.status_code == 200
        assert after_leave.json()["status"] == "departed"
        assert after_leave.json()["decided_by"] is None
        assert after_leave.json()["departed_at"] is not None

        provost = sign_in(client, "provost.halima", PROVOST_PHRASE)
        provost_headers = {"Authorization": f"Bearer {provost}"}
        provost_list = client.get(
            "/api/v1/guest-stays?bucket=upcoming",
            headers=provost_headers,
        )
        assert provost_list.status_code == 200
        assert [item["id"] for item in provost_list.json()["items"]] == [PENDING_A, UPCOMING]

        connection = sqlite3.connect(database_path)
        try:
            actions = [
                row[0]
                for row in connection.execute(
                    """
                    SELECT action FROM audit_log
                    WHERE action LIKE 'guest_stay.%'
                    ORDER BY occurred_at, rowid
                    """
                )
            ]
        finally:
            connection.close()
        assert actions == [
            "guest_stay.approved",
            "guest_stay.rejected",
            "guest_stay.payment_marked",
            "guest_stay.payment_marked",
            "guest_stay.payment_marked",
            "guest_stay.edited",
            "guest_stay.approved",
            "guest_stay.edited",
            "guest_stay.departed",
        ]
