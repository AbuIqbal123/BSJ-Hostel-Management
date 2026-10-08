"""Warden and provost register presence board."""

from __future__ import annotations

import json
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

import pytest
from fastapi.testclient import TestClient

from app.dev_seed import (
    GATE_PHRASE,
    PROVOST_PHRASE,
    RESIDENT_PHRASE,
    WARDEN_PHRASE,
    joined,
)


ARTIFACT = Path(__file__).resolve().parent / "artifacts" / "register-presence.json"
BLOCK_A = "01b885ad-e40d-56a4-81ab-2371f654f558"
BLOCK_B = "d032aad6-a203-5ea0-ba9a-3a9257edbfc8"
LIBRARY = "fc2da7c5-8d65-5680-8034-d8acb69745eb"
GATE_ID = "a11ce000-0000-4000-8000-000000000001"
WARDEN_ID = "e55fa000-0000-4000-8000-000000000005"
PROVOST_ID = "f66ab000-0000-4000-8000-000000000006"
AISHA_ID = "b22de000-0000-4000-8000-000000000002"
MARYAM_ID = "c44ef000-0000-4000-8000-000000000009"
ZARA_ID = "d55fa000-0000-4000-8000-00000000000a"
NOOR_ID = "e66fb000-0000-4000-8000-00000000000b"
ROOM_B204 = "d4400000-0000-4000-8000-000000000004"
ROOM_B205 = "d4400000-0000-4000-8000-000000000005"
ROOM_A101 = "d4400000-0000-4000-8000-000000000006"
ROOM_A102 = "d4400000-0000-4000-8000-000000000007"
AISHA_RETURNED = "e7700000-0000-4000-8000-000000000031"
AISHA_CANCELLED = "e7700000-0000-4000-8000-000000000034"
MARYAM_OUTING = "e7700000-0000-4000-8000-000000000032"
ZARA_OUTING = "e7700000-0000-4000-8000-000000000033"
CREATED = "2026-09-30T00:00:00Z"
NOW = "2026-09-30T13:00:00Z"


class FrozenClock:
    def utc_now(self) -> datetime:
        return datetime(2026, 9, 30, 13, 0, tzinfo=timezone.utc)


def assert_error(response, status: int, code: str, message: str) -> None:
    assert response.status_code == status
    body = response.json()
    assert set(body) == {"error"}
    assert body["error"] == {"code": code, "message": message}


def sign_in(client: TestClient, username: str, password: str) -> str:
    response = client.post("/api/v1/auth/login", json={"username": username, "password": password})
    assert response.status_code == 200
    return response.json()["access_token"]


def auth_headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def hall_date(instant: str) -> str:
    return (
        datetime.strptime(instant, "%Y-%m-%dT%H:%M:%SZ")
        .replace(tzinfo=timezone.utc)
        .astimezone(ZoneInfo("Asia/Kolkata"))
        .date()
        .isoformat()
    )


def issue_staff(path: Path) -> None:
    from app.shared.auth.security import hash_password

    connection = sqlite3.connect(path)
    try:
        connection.execute("PRAGMA foreign_keys=ON;")
        people = (
            (GATE_ID, "gate", "gate.fatima", "Fatima Khan", GATE_PHRASE, "active", "Gatekeeper"),
            (WARDEN_ID, "warden", "warden.sara", "Sara Malik", WARDEN_PHRASE, "active", "Warden"),
            (PROVOST_ID, "provost", "provost.halima", "Halima Begum", PROVOST_PHRASE, "active", "Provost"),
        )
        for user_id, role, username, full_name, password, status, job_title in people:
            connection.execute(
                """
                INSERT INTO users (
                  id, role, username, full_name, password_hash, status, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (user_id, role, username, full_name, hash_password(password), status, CREATED, CREATED),
            )
            connection.execute(
                "INSERT INTO staff (user_id, job_title) VALUES (?, ?)",
                (user_id, job_title),
            )
        connection.commit()
    finally:
        connection.close()


def issue_residents(path: Path) -> None:
    from app.shared.auth.security import hash_password

    connection = sqlite3.connect(path)
    try:
        connection.execute("PRAGMA foreign_keys=ON;")
        rooms = (
            (ROOM_B204, BLOCK_B, "204", "B-204"),
            (ROOM_B205, BLOCK_B, "205", "B-205"),
            (ROOM_A101, BLOCK_A, "101", "A-101"),
            (ROOM_A102, BLOCK_A, "102", "A-102"),
        )
        for room_id, block_id, number, label in rooms:
            connection.execute(
                """
                INSERT INTO rooms (id, block_id, number, label, bed_count, is_active)
                VALUES (?, ?, ?, ?, 2, 1)
                """,
                (room_id, block_id, number, label),
            )
        people = (
            (AISHA_ID, "24-GLLB-118", "Aisha Khan", RESIDENT_PHRASE, "active"),
            (MARYAM_ID, "24-BA-002", "Maryam Siddiqui", joined("resident", "20"), "active"),
            (ZARA_ID, "24-BA-003", "Zara Ahmed", joined("resident", "30"), "active"),
            (NOOR_ID, "24-BA-004", "Noor Fatima", joined("resident", "40"), "suspended"),
        )
        for user_id, username, full_name, password, status in people:
            connection.execute(
                """
                INSERT INTO users (
                  id, role, username, full_name, password_hash, status, created_at, updated_at
                ) VALUES (?, 'resident', ?, ?, ?, ?, ?, ?)
                """,
                (user_id, username, full_name, hash_password(password), status, CREATED, CREATED),
            )
        residents = (
            (
                AISHA_ID,
                "24-GLLB-118",
                "B.A. LL.B. (Hons.)",
                ROOM_B204,
                "Rashid Khan",
                "+919876543210",
                "bsj:v1:test-aisha",
                "inside",
            ),
            (
                MARYAM_ID,
                "24-BA-002",
                "B.A.",
                ROOM_B205,
                "Yusuf Siddiqui",
                "+919876543211",
                "bsj:v1:test-maryam",
                "outside",
            ),
            (
                ZARA_ID,
                "24-BA-003",
                "B.A.",
                ROOM_A101,
                "Imran Ahmed",
                "+919876543212",
                "bsj:v1:test-zara",
                "outside",
            ),
            (
                NOOR_ID,
                "24-BA-004",
                "B.A.",
                ROOM_A102,
                "Karim Fatima",
                "+919876543213",
                "bsj:v1:test-noor",
                "inside",
            ),
        )
        for row in residents:
            connection.execute(
                """
                INSERT INTO residents (
                  user_id, enrolment_number, course, room_id, guardian_name, guardian_phone,
                  qr_token, presence, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (*row, CREATED, CREATED),
            )
        connection.commit()
    finally:
        connection.close()


def insert_outing(
    connection: sqlite3.Connection,
    outing_id: str,
    resident_id: str,
    status: str,
    place: str,
    *,
    destination_id: str | None = None,
    expected_return_at: str,
    grace_ends_at: str,
    exited_at: str | None = None,
    returned_at: str | None = None,
    created_at: str,
    cancelled_at: str | None = None,
) -> None:
    connection.execute(
        """
        INSERT INTO outings (
          id, resident_id, permission_id, type, status, destination_id, place,
          expected_return_at, grace_ends_at, exited_at, exit_recorded_by,
          returned_at, return_recorded_by, created_at, updated_at, cancelled_at, hall_date
        ) VALUES (?, ?, NULL, 'ordinary', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            outing_id,
            resident_id,
            status,
            destination_id,
            place,
            expected_return_at,
            grace_ends_at,
            exited_at,
            GATE_ID if exited_at else None,
            returned_at,
            GATE_ID if returned_at else None,
            created_at,
            created_at,
            cancelled_at,
            hall_date(expected_return_at),
        ),
    )


def store_register_day(path: Path) -> None:
    connection = sqlite3.connect(path)
    try:
        connection.execute("PRAGMA foreign_keys=ON;")
        insert_outing(
            connection,
            AISHA_CANCELLED,
            AISHA_ID,
            "cancelled",
            "Women's College",
            expected_return_at="2026-09-28T12:00:00Z",
            grace_ends_at="2026-09-28T12:30:00Z",
            created_at="2026-09-28T08:00:00Z",
            cancelled_at="2026-09-28T09:00:00Z",
        )
        insert_outing(
            connection,
            AISHA_RETURNED,
            AISHA_ID,
            "returned",
            "Maulana Azad Library",
            destination_id=LIBRARY,
            expected_return_at="2026-09-29T12:00:00Z",
            grace_ends_at="2026-09-29T12:30:00Z",
            exited_at="2026-09-29T08:00:00Z",
            returned_at="2026-09-29T11:00:00Z",
            created_at="2026-09-29T07:00:00Z",
        )
        insert_outing(
            connection,
            MARYAM_OUTING,
            MARYAM_ID,
            "outside",
            "Maulana Azad Library",
            destination_id=LIBRARY,
            expected_return_at="2026-09-30T13:30:00Z",
            grace_ends_at="2026-09-30T14:00:00Z",
            exited_at="2026-09-30T10:00:00Z",
            created_at="2026-09-30T09:00:00Z",
        )
        insert_outing(
            connection,
            ZARA_OUTING,
            ZARA_ID,
            "outside",
            "Shamshad Market",
            expected_return_at="2026-09-30T12:00:00Z",
            grace_ends_at="2026-09-30T12:30:00Z",
            exited_at="2026-09-30T08:00:00Z",
            created_at="2026-09-30T07:30:00Z",
        )
        connection.execute(
            """
            INSERT INTO guardian_messages (
              id, outing_id, resident_id, notice_type, recipient_phone, body,
              driver, status, provider_reference, error, created_at
            ) VALUES (
              'aa100000-0000-4000-8000-000000000001', ?, ?, 'late_notice',
              '+919876543212', 'Late notice for Zara.', 'mock', 'sent', 'mock-1', NULL,
              '2026-09-30T12:31:00Z'
            )
            """,
            (ZARA_OUTING, ZARA_ID),
        )
        permissions = (
            (
                "f8800000-0000-4000-8000-000000000040",
                AISHA_ID,
                "late_night",
                "Women's College",
                "Seminar Hall",
                "A seminar after ordinary hours.",
                "2026-09-30T14:00:00Z",
                "2026-09-30T16:00:00Z",
                "2026-09-30T07:30:00Z",
            ),
            (
                "f8800000-0000-4000-8000-000000000041",
                ZARA_ID,
                "late_night",
                "J.N. Medical College",
                None,
                "Clinic after hours.",
                "2026-09-30T14:30:00Z",
                "2026-09-30T16:30:00Z",
                "2026-09-30T08:00:00Z",
            ),
        )
        for row in permissions:
            connection.execute(
                """
                INSERT INTO permissions (
                  id, resident_id, type, status, short_place, destination_detail, address,
                  reason, departure_at, expected_return_at, decided_by, decided_at,
                  decision_note, created_at, updated_at
                ) VALUES (?, ?, ?, 'pending', ?, ?, NULL, ?, ?, ?, NULL, NULL, NULL, ?, ?)
                """,
                (*row, row[-1]),
            )
        guests = (
            (
                "bb200000-0000-4000-8000-000000000001",
                AISHA_ID,
                "Amina Hostess",
                "Mother",
                "2026-10-01",
                "2026-10-03",
                "Family visit.",
                "pending",
                None,
                None,
                "2026-09-30T09:00:00Z",
            ),
            (
                "bb200000-0000-4000-8000-000000000002",
                AISHA_ID,
                "Sana Guest",
                "Sister",
                "2026-09-27",
                "2026-09-29",
                "Should have left.",
                "approved",
                "2026-09-27T10:00:00Z",
                None,
                "2026-09-26T12:00:00Z",
            ),
            (
                "bb200000-0000-4000-8000-000000000003",
                MARYAM_ID,
                "Hina Guest",
                "Cousin",
                "2026-09-30",
                "2026-10-01",
                "Still in hall.",
                "approved",
                "2026-09-30T08:00:00Z",
                None,
                "2026-09-29T12:00:00Z",
            ),
        )
        for (
            guest_id,
            host_id,
            name,
            relation,
            start,
            end,
            reason,
            status,
            arrived_at,
            departed_at,
            created_at,
        ) in guests:
            payment_status = "paid" if arrived_at else "unpaid"
            connection.execute(
                """
                INSERT INTO guest_stays (
                  id, host_resident_id, guest_name, relation, guest_start_date, guest_end_date, reason,
                  status, payment_status, payment_marked_by, payment_marked_at,
                  decided_by, decided_at, decision_note, arrived_at, arrived_recorded_by,
                  departed_at, departed_recorded_by, created_at, updated_at
                ) VALUES (
                  ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                  ?, ?, NULL, ?, ?, ?, NULL, ?, ?
                )
                """,
                (
                    guest_id,
                    host_id,
                    name,
                    relation,
                    start,
                    end,
                    reason,
                    status,
                    payment_status,
                    WARDEN_ID if payment_status == "paid" else None,
                    "2026-09-26T14:00:00Z" if payment_status == "paid" else None,
                    WARDEN_ID if status == "approved" else None,
                    "2026-09-26T13:00:00Z" if status == "approved" else None,
                    arrived_at,
                    GATE_ID if arrived_at else None,
                    departed_at,
                    created_at,
                    created_at,
                ),
            )
        connection.commit()
    finally:
        connection.close()


def zero_blocks() -> list[dict]:
    return [
        {
            "block_id": BLOCK_A,
            "code": "A",
            "name": "Block-A",
            "inside_count": 0,
            "outside_count": 0,
            "late_count": 0,
            "pending_permission_count": 0,
            "guests_in_hall_count": 0,
            "guests_should_have_left_count": 0,
            "pending_guest_stay_count": 0,
        },
        {
            "block_id": BLOCK_B,
            "code": "B",
            "name": "Block-B",
            "inside_count": 0,
            "outside_count": 0,
            "late_count": 0,
            "pending_permission_count": 0,
            "guests_in_hall_count": 0,
            "guests_should_have_left_count": 0,
            "pending_guest_stay_count": 0,
        },
        {
            "block_id": "dad52ee9-0b9a-53e2-a792-1dbee295ada9",
            "code": "C",
            "name": "Block-C",
            "inside_count": 0,
            "outside_count": 0,
            "late_count": 0,
            "pending_permission_count": 0,
            "guests_in_hall_count": 0,
            "guests_should_have_left_count": 0,
            "pending_guest_stay_count": 0,
        },
        {
            "block_id": "f75a0c4d-cf9e-5b03-9ba5-13f77337453d",
            "code": "D",
            "name": "Block-D",
            "inside_count": 0,
            "outside_count": 0,
            "late_count": 0,
            "pending_permission_count": 0,
            "guests_in_hall_count": 0,
            "guests_should_have_left_count": 0,
            "pending_guest_stay_count": 0,
        },
        {
            "block_id": "916c689d-598e-55b4-b3dc-fcf7120ca3b1",
            "code": "Utility",
            "name": "Utility",
            "inside_count": 0,
            "outside_count": 0,
            "late_count": 0,
            "pending_permission_count": 0,
            "guests_in_hall_count": 0,
            "guests_should_have_left_count": 0,
            "pending_guest_stay_count": 0,
        },
    ]


def filled_blocks() -> list[dict]:
    blocks = zero_blocks()
    by_code = {block["code"]: block for block in blocks}
    by_code["A"].update(
        {
            "late_count": 1,
            "pending_permission_count": 1,
        }
    )
    by_code["B"].update(
        {
            "inside_count": 1,
            "outside_count": 1,
            "pending_permission_count": 1,
            "guests_in_hall_count": 2,
            "guests_should_have_left_count": 1,
            "pending_guest_stay_count": 1,
        }
    )
    return blocks


def expected_artifact() -> dict:
    blocks = filled_blocks()
    summary = {
        "inside_count": sum(block["inside_count"] for block in blocks),
        "outside_count": sum(block["outside_count"] for block in blocks),
        "late_count": sum(block["late_count"] for block in blocks),
        "pending_permission_count": sum(block["pending_permission_count"] for block in blocks),
        "guests_in_hall_count": sum(block["guests_in_hall_count"] for block in blocks),
        "guests_should_have_left_count": sum(
            block["guests_should_have_left_count"] for block in blocks
        ),
        "pending_guest_stay_count": sum(block["pending_guest_stay_count"] for block in blocks),
        "blocks": blocks,
    }
    aisha_row = {
        "id": AISHA_ID,
        "full_name": "Aisha Khan",
        "room_label": "B-204",
        "presence": "inside",
        "state": "inside",
        "outside_destination": None,
        "expected_return_at": None,
    }
    maryam_row = {
        "id": MARYAM_ID,
        "full_name": "Maryam Siddiqui",
        "room_label": "B-205",
        "presence": "outside",
        "state": "outside",
        "outside_destination": "Maulana Azad Library",
        "expected_return_at": "2026-09-30T13:30:00Z",
    }
    zara_row = {
        "id": ZARA_ID,
        "full_name": "Zara Ahmed",
        "room_label": "A-101",
        "presence": "outside",
        "state": "late",
        "outside_destination": "Shamshad Market",
        "expected_return_at": "2026-09-30T12:00:00Z",
    }
    return {
        "empty": {
            "inside_count": 0,
            "outside_count": 0,
            "late_count": 0,
            "pending_permission_count": 0,
            "guests_in_hall_count": 0,
            "guests_should_have_left_count": 0,
            "pending_guest_stay_count": 0,
            "blocks": zero_blocks(),
        },
        "summary": summary,
        "residents": {
            "total": 3,
            "limit": 50,
            "offset": 0,
            "items": [aisha_row, maryam_row, zara_row],
        },
        "search_aisha": {
            "total": 1,
            "limit": 50,
            "offset": 0,
            "items": [aisha_row],
        },
        "state_late": {
            "total": 1,
            "limit": 50,
            "offset": 0,
            "items": [zara_row],
        },
        "block_a": {
            "total": 1,
            "limit": 50,
            "offset": 0,
            "items": [zara_row],
        },
        "late": {
            "total": 1,
            "limit": 50,
            "offset": 0,
            "items": [zara_row],
        },
        "aisha": {
            "id": AISHA_ID,
            "full_name": "Aisha Khan",
            "enrolment_number": "24-GLLB-118",
            "course": "B.A. LL.B. (Hons.)",
            "room_label": "B-204",
            "presence": "inside",
            "state": "inside",
            "outing": None,
            "guardian_name": "Rashid Khan",
            "guardian_notice": "not_due",
        },
        "maryam": {
            "id": MARYAM_ID,
            "full_name": "Maryam Siddiqui",
            "enrolment_number": "24-BA-002",
            "course": "B.A.",
            "room_label": "B-205",
            "presence": "outside",
            "state": "outside",
            "outing": {
                "id": MARYAM_OUTING,
                "permission_id": None,
                "outing_type": "ordinary",
                "status": "outside",
                "place": "Maulana Azad Library",
                "expected_return_at": "2026-09-30T13:30:00Z",
                "grace_ends_at": "2026-09-30T14:00:00Z",
                "exited_at": "2026-09-30T10:00:00Z",
                "exit_recorded_by_name": "Fatima Khan",
                "returned_at": None,
                "return_recorded_by_name": None,
                "lateness": "on_time",
                "created_at": "2026-09-30T09:00:00Z",
                "starts_at": None,
                "qr_visible": True,
                "qr_visible_from": "2026-09-30T10:00:00Z",
                "qr_visible_until": None,
            },
            "guardian_name": "Yusuf Siddiqui",
            "guardian_notice": "not_due",
        },
        "zara": {
            "id": ZARA_ID,
            "full_name": "Zara Ahmed",
            "enrolment_number": "24-BA-003",
            "course": "B.A.",
            "room_label": "A-101",
            "presence": "outside",
            "state": "late",
            "outing": {
                "id": ZARA_OUTING,
                "permission_id": None,
                "outing_type": "ordinary",
                "status": "outside",
                "place": "Shamshad Market",
                "expected_return_at": "2026-09-30T12:00:00Z",
                "grace_ends_at": "2026-09-30T12:30:00Z",
                "exited_at": "2026-09-30T08:00:00Z",
                "exit_recorded_by_name": "Fatima Khan",
                "returned_at": None,
                "return_recorded_by_name": None,
                "lateness": "late",
                "created_at": "2026-09-30T07:30:00Z",
                "starts_at": None,
                "qr_visible": True,
                "qr_visible_from": "2026-09-30T08:00:00Z",
                "qr_visible_until": None,
            },
            "guardian_name": "Imran Ahmed",
            "guardian_notice": "sent",
        },
    }


def test_register_presence(database_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    from app.shared import clock
    from app.shared.migrate import migrate

    monkeypatch.setattr(clock, "utc_now", FrozenClock().utc_now)
    migrate()

    from app.main import app

    expected = expected_artifact()
    with TestClient(app) as client:
        assert_error(
            client.get("/api/v1/register/summary"),
            401,
            "unauthenticated",
            "Sign in again.",
        )

        issue_staff(database_path)
        gate = sign_in(client, "gate.fatima", GATE_PHRASE)
        warden = sign_in(client, "warden.sara", WARDEN_PHRASE)
        provost = sign_in(client, "provost.halima", PROVOST_PHRASE)

        assert_error(
            client.get("/api/v1/register/summary", headers=auth_headers(gate)),
            403,
            "forbidden",
            "This account cannot do that.",
        )

        empty = client.get("/api/v1/register/summary", headers=auth_headers(warden))
        assert empty.status_code == 200
        assert empty.json() == expected["empty"]

        issue_residents(database_path)
        resident = sign_in(client, "24-GLLB-118", RESIDENT_PHRASE)
        assert_error(
            client.get("/api/v1/register/summary", headers=auth_headers(resident)),
            403,
            "forbidden",
            "This account cannot do that.",
        )
        store_register_day(database_path)

        summary = client.get("/api/v1/register/summary", headers=auth_headers(warden))
        assert summary.status_code == 200
        assert summary.json() == expected["summary"]

        provost_summary = client.get("/api/v1/register/summary", headers=auth_headers(provost))
        assert provost_summary.status_code == 200
        assert provost_summary.json() == expected["summary"]

        residents = client.get("/api/v1/register/residents", headers=auth_headers(warden))
        assert residents.status_code == 200
        assert residents.json() == expected["residents"]

        search = client.get(
            "/api/v1/register/residents",
            params={"q": "aisha"},
            headers=auth_headers(warden),
        )
        assert search.status_code == 200
        assert search.json() == expected["search_aisha"]

        late_state = client.get(
            "/api/v1/register/residents",
            params={"state": "late"},
            headers=auth_headers(warden),
        )
        assert late_state.status_code == 200
        assert late_state.json() == expected["state_late"]

        block_a = client.get(
            "/api/v1/register/residents",
            params={"block_id": BLOCK_A},
            headers=auth_headers(warden),
        )
        assert block_a.status_code == 200
        assert block_a.json() == expected["block_a"]

        late = client.get("/api/v1/register/late", headers=auth_headers(warden))
        assert late.status_code == 200
        assert late.json() == expected["late"]

        aisha = client.get(
            f"/api/v1/register/residents/{AISHA_ID}",
            headers=auth_headers(warden),
        )
        assert aisha.status_code == 200
        assert aisha.json() == expected["aisha"]

        maryam = client.get(
            f"/api/v1/register/residents/{MARYAM_ID}",
            headers=auth_headers(warden),
        )
        assert maryam.status_code == 200
        assert maryam.json() == expected["maryam"]

        zara = client.get(
            f"/api/v1/register/residents/{ZARA_ID}",
            headers=auth_headers(warden),
        )
        assert zara.status_code == 200
        assert zara.json() == expected["zara"]

        assert_error(
            client.get(
                "/api/v1/register/residents/00000000-0000-4000-8000-000000000099",
                headers=auth_headers(warden),
            ),
            404,
            "not_found",
            "That record was not found.",
        )

        connection = sqlite3.connect(database_path)
        try:
            audit_count = connection.execute("SELECT COUNT(*) FROM audit_log").fetchone()[0]
        finally:
            connection.close()
        assert audit_count == 4  # four sign-ins; register reads write none

    ARTIFACT.write_text(json.dumps(expected, indent=2) + "\n", encoding="utf-8")
    assert json.loads(ARTIFACT.read_text(encoding="utf-8")) == expected
