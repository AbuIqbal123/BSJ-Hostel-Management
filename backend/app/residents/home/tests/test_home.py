"""What the resident sees when she opens the phone."""

from __future__ import annotations

import json
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

import pytest
from fastapi.testclient import TestClient

from app.shared.testing_env import joined
from app.shared.testing_env import role_credential


ARTIFACT = Path(__file__).resolve().parent / "artifacts" / "resident-home.json"
BLOCK_B = "d032aad6-a203-5ea0-ba9a-3a9257edbfc8"
LIBRARY = "fc2da7c5-8d65-5680-8034-d8acb69745eb"
GATE_ID = "a11ce000-0000-4000-8000-000000000001"
WARDEN_ID = "e55fa000-0000-4000-8000-000000000005"
RESIDENT_ID = "b22de000-0000-4000-8000-000000000002"
OTHER_ID = "c44ef000-0000-4000-8000-000000000009"
ROOM_ID = "d4400000-0000-4000-8000-000000000004"
OPEN_OUTING = "e7700000-0000-4000-8000-000000000011"
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
            (GATE_ID, "gate", "gate.fatima", "Fatima Khan", role_credential("gate")),
            (WARDEN_ID, "warden", "warden.sara", "Sara Malik", role_credential("warden")),
            (RESIDENT_ID, "resident", "24-GLLB-118", "Aisha Khan", role_credential("resident")),
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
            ) VALUES (?, '24-GLLB-118', 'B.A. LL.B. (Hons.)', ?, 'Rashid Khan',
              '+919876543210', 'bsj:v1:test-resident-hall-pass', 'inside', ?, ?)
            """,
            (RESIDENT_ID, ROOM_ID, CREATED, CREATED),
        )
        connection.execute(
            """
            INSERT INTO residents (
              user_id, enrolment_number, course, room_id, guardian_name, guardian_phone,
              qr_token, presence, created_at, updated_at
            ) VALUES (?, '24-BA-002', 'B.A.', ?, 'Yusuf Siddiqui',
              '+919876543211', 'bsj:v1:test-other-resident', 'outside', ?, ?)
            """,
            (OTHER_ID, ROOM_ID, CREATED, CREATED),
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
    starts_at: str | None = None,
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
          starts_at, expected_return_at, grace_ends_at, exited_at, exit_recorded_by,
          returned_at, return_recorded_by, created_at, updated_at, cancelled_at, hall_date
        ) VALUES (?, ?, NULL, 'ordinary', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            outing_id,
            resident_id,
            status,
            destination_id,
            place,
            starts_at,
            expected_return_at,
            grace_ends_at,
            exited_at,
            GATE_ID if exited_at else None,
            returned_at,
            GATE_ID if returned_at else None,
            created_at,
            created_at,
            cancelled_at,
            datetime.strptime(expected_return_at, "%Y-%m-%dT%H:%M:%SZ")
            .replace(tzinfo=timezone.utc)
            .astimezone(ZoneInfo("Asia/Kolkata"))
            .date()
            .isoformat(),
        ),
    )


def store_open_day(path: Path) -> None:
    connection = sqlite3.connect(path)
    try:
        connection.execute("PRAGMA foreign_keys=ON;")
        returned = (
            ("e7700000-0000-4000-8000-000000000001", "Shamshad Market", "07:00:00", "08:00:00"),
            ("e7700000-0000-4000-8000-000000000002", "Women's College", "09:00:00", "10:00:00"),
            ("e7700000-0000-4000-8000-000000000003", "J.N. Medical College", "11:00:00", "12:00:00"),
            ("e7700000-0000-4000-8000-000000000004", "City bookshop", "13:00:00", "14:00:00"),
            ("e7700000-0000-4000-8000-000000000005", "Maulana Azad Library", "15:00:00", "16:00:00"),
        )
        for outing_id, place, left, back in returned:
            insert_outing(
                connection,
                outing_id,
                RESIDENT_ID,
                "returned",
                place,
                destination_id=LIBRARY if place == "Maulana Azad Library" else None,
                expected_return_at=f"2026-09-29T{back}Z",
                grace_ends_at=f"2026-09-29T{back}Z",
                exited_at=f"2026-09-29T{left}Z",
                returned_at=f"2026-09-29T{back}Z",
                created_at=f"2026-09-29T{left}Z",
            )
        insert_outing(
            connection,
            "e7700000-0000-4000-8000-000000000006",
            RESIDENT_ID,
            "cancelled",
            "Cancelled plan",
            expected_return_at="2026-09-28T12:00:00Z",
            grace_ends_at="2026-09-28T12:30:00Z",
            created_at="2026-09-28T08:00:00Z",
            cancelled_at="2026-09-28T09:00:00Z",
        )
        insert_outing(
            connection,
            OPEN_OUTING,
            RESIDENT_ID,
            "outside",
            "Maulana Azad Library",
            destination_id=LIBRARY,
            expected_return_at="2026-09-30T12:00:00Z",
            grace_ends_at="2026-09-30T12:30:00Z",
            exited_at="2026-09-30T08:00:00Z",
            created_at="2026-09-30T07:00:00Z",
        )
        insert_outing(
            connection,
            "e7700000-0000-4000-8000-000000000099",
            OTHER_ID,
            "outside",
            "Other hall",
            expected_return_at="2026-09-30T18:00:00Z",
            grace_ends_at="2026-09-30T18:30:00Z",
            exited_at="2026-09-30T12:00:00Z",
            created_at="2026-09-30T11:00:00Z",
        )
        connection.execute(
            """
            UPDATE residents SET presence = 'outside', updated_at = ?
            WHERE user_id = ?
            """,
            ("2026-09-30T08:00:00Z", RESIDENT_ID),
        )
        permissions = (
            (
                "f8800000-0000-4000-8000-000000000020",
                RESIDENT_ID,
                "home_going",
                "approved",
                "Lucknow",
                None,
                "12 Park Road",
                "Going home.",
                "2026-10-02T02:30:00Z",
                "2026-10-04T12:00:00Z",
                WARDEN_ID,
                "2026-09-28T11:00:00Z",
                None,
                "2026-09-28T10:00:00Z",
            ),
            (
                "f8800000-0000-4000-8000-000000000021",
                RESIDENT_ID,
                "late_night",
                "pending",
                "Women's College",
                "Seminar Hall",
                None,
                "A seminar after ordinary hours.",
                "2026-09-30T14:00:00Z",
                "2026-09-30T16:00:00Z",
                None,
                None,
                None,
                "2026-09-30T07:30:00Z",
            ),
            (
                "f8800000-0000-4000-8000-000000000022",
                RESIDENT_ID,
                "late_night",
                "rejected",
                "Shamshad Market",
                None,
                None,
                "A later request that was refused.",
                "2026-09-30T14:30:00Z",
                "2026-09-30T16:30:00Z",
                WARDEN_ID,
                "2026-09-30T09:10:00Z",
                "Not this evening.",
                "2026-09-30T09:00:00Z",
            ),
            (
                "f8800000-0000-4000-8000-000000000023",
                RESIDENT_ID,
                "late_night",
                "completed",
                "J.N. Medical College",
                None,
                None,
                "Already used.",
                "2026-09-29T14:00:00Z",
                "2026-09-29T16:00:00Z",
                WARDEN_ID,
                "2026-09-29T10:00:00Z",
                None,
                "2026-09-30T10:00:00Z",
            ),
            (
                "f8800000-0000-4000-8000-000000000099",
                OTHER_ID,
                "late_night",
                "pending",
                "Other hall",
                None,
                None,
                "Another resident is waiting.",
                "2026-09-30T15:00:00Z",
                "2026-09-30T17:00:00Z",
                None,
                None,
                None,
                "2026-09-30T12:00:00Z",
            ),
        )
        connection.executemany(
            """
            INSERT INTO permissions (
              id, resident_id, type, status, short_place, destination_detail, address,
              reason, departure_at, expected_return_at, decided_by, decided_at,
              decision_note, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            [(*row, row[-1]) for row in permissions],
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


def test_resident_home(database_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    expected = json.loads(ARTIFACT.read_text(encoding="utf-8"))
    from app.shared import clock
    from app.main import app

    monkeypatch.setattr(clock, "utc_now", FrozenClock().utc_now)
    with TestClient(app) as client:
        issue_people(database_path)
        assert_error(
            client.get("/api/v1/me/home"),
            401,
            "unauthenticated",
            "Sign in again.",
        )
        gate = sign_in(client, "gate.fatima", role_credential("gate"))
        assert_error(
            client.get("/api/v1/me/home", headers={"Authorization": f"Bearer {gate}"}),
            403,
            "forbidden",
            "This account cannot do that.",
        )
        resident = sign_in(client, "24-GLLB-118", role_credential("resident"))
        headers = {"Authorization": f"Bearer {resident}"}
        empty = client.get("/api/v1/me/home", headers=headers)
        assert empty.status_code == 200
        assert empty.json() == expected["empty"]

        store_open_day(database_path)
        outside = client.get("/api/v1/me/home", headers=headers)
        assert outside.status_code == 200
        assert outside.json() == expected["outside"]

        connection = sqlite3.connect(database_path)
        try:
            connection.execute("PRAGMA foreign_keys=ON;")
            connection.execute(
                "UPDATE outings SET grace_ends_at = ? WHERE id = ?",
                (NOW, OPEN_OUTING),
            )
            connection.commit()
        finally:
            connection.close()
        on_grace = client.get("/api/v1/me/home", headers=headers).json()
        assert on_grace["current_outing"]["lateness"] == "on_time"
        assert on_grace["current_outing"]["grace_ends_at"] == NOW

        connection = sqlite3.connect(database_path)
        try:
            connection.execute("PRAGMA foreign_keys=ON;")
            connection.execute(
                "UPDATE outings SET grace_ends_at = '2026-09-30T12:59:59Z' WHERE id = ?",
                (OPEN_OUTING,),
            )
            connection.commit()
            after_grace = client.get("/api/v1/me/home", headers=headers).json()
            assert after_grace["current_outing"]["lateness"] == "late"
            audit = [
                row[0]
                for row in connection.execute(
                    "SELECT action FROM audit_log ORDER BY occurred_at, rowid"
                )
            ]
            stored = connection.execute(
                """
                SELECT residents.presence, residents.updated_at, outings.status
                FROM residents
                JOIN outings ON outings.resident_id = residents.user_id
                WHERE residents.user_id = ? AND outings.id = ?
                """,
                (RESIDENT_ID, OPEN_OUTING),
            ).fetchone()
        finally:
            connection.close()
        assert audit == ["auth.login", "auth.login"]
        assert stored == ("outside", "2026-09-30T08:00:00Z", "outside")

        connection = sqlite3.connect(database_path)
        try:
            connection.execute("PRAGMA foreign_keys=ON;")
            insert_outing(
                connection,
                "e7700000-0000-4000-8000-000000000014",
                RESIDENT_ID,
                "planned",
                "Maulana Azad Library",
                destination_id=LIBRARY,
                starts_at="2026-09-30T13:20:00Z",
                expected_return_at="2026-09-30T14:00:00Z",
                grace_ends_at="2026-09-30T14:30:00Z",
                created_at="2026-09-30T12:00:00Z",
            )
            insert_outing(
                connection,
                "e7700000-0000-4000-8000-000000000012",
                RESIDENT_ID,
                "planned",
                "Women's College",
                starts_at="2026-10-01T02:00:00Z",
                expected_return_at="2026-10-01T08:00:00Z",
                grace_ends_at="2026-10-01T08:30:00Z",
                created_at="2026-09-30T12:00:00Z",
            )
            insert_outing(
                connection,
                "e7700000-0000-4000-8000-000000000013",
                RESIDENT_ID,
                "planned",
                "Shamshad Market",
                starts_at="2026-10-02T05:00:00Z",
                expected_return_at="2026-10-02T10:30:00Z",
                grace_ends_at="2026-10-02T11:00:00Z",
                created_at="2026-09-30T12:00:00Z",
            )
            insert_outing(
                connection,
                "e7700000-0000-4000-8000-000000000015",
                RESIDENT_ID,
                "planned",
                "Passed plan",
                starts_at="2026-09-30T08:00:00Z",
                expected_return_at="2026-09-30T11:00:00Z",
                grace_ends_at="2026-09-30T11:30:00Z",
                created_at="2026-09-30T07:00:00Z",
            )
            connection.commit()
        finally:
            connection.close()
        listed = client.get("/api/v1/me/home", headers=headers)
        assert listed.status_code == 200
        assert listed.json()["upcoming_outings"] == [
            {
                "id": "e7700000-0000-4000-8000-000000000014",
                "place": "Maulana Azad Library",
                "starts_at": "2026-09-30T13:20:00Z",
                "expected_return_at": "2026-09-30T14:00:00Z",
                "can_modify": False,
            },
            {
                "id": "e7700000-0000-4000-8000-000000000012",
                "place": "Women's College",
                "starts_at": "2026-10-01T02:00:00Z",
                "expected_return_at": "2026-10-01T08:00:00Z",
                "can_modify": True,
            },
            {
                "id": "e7700000-0000-4000-8000-000000000013",
                "place": "Shamshad Market",
                "starts_at": "2026-10-02T05:00:00Z",
                "expected_return_at": "2026-10-02T10:30:00Z",
                "can_modify": True,
            },
        ]
