"""Provost register CSV export."""

from __future__ import annotations

import csv
import io
import sqlite3
from collections.abc import Iterator
from datetime import datetime, timezone
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.dev_seed import PROVOST_PHRASE, RESIDENT_PHRASE, WARDEN_PHRASE

ARTIFACT = Path(__file__).resolve().parent / "artifacts" / "admin-register-export.csv"
PROVOST_ID = "f66ab000-0000-4000-8000-000000000006"
WARDEN_ID = "e55fa000-0000-4000-8000-000000000005"
RESIDENT_ID = "b22de000-0000-4000-8000-000000000002"
BLOCK_B = "d032aad6-a203-5ea0-ba9a-3a9257edbfc8"
ROOM_ID = "d4400000-0000-4000-8000-000000000004"
LIBRARY = "fc2da7c5-8d65-5680-8034-d8acb69745eb"
OUTING_ID = "e7700000-0000-4000-8000-000000000061"
GUEST_ID = "cc100000-0000-4000-8000-0000000000c1"
CREATED = "2026-09-30T00:00:00Z"
NOW = datetime(2026, 9, 30, 13, 0, tzinfo=timezone.utc)


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
    assert response.json()["error"]["code"] == code


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
              '+919876543210', 'bsj:v1:test-resident-hall-pass', 'outside', ?, ?
            )
            """,
            (RESIDENT_ID, ROOM_ID, CREATED, CREATED),
        )
        connection.execute(
            """
            INSERT INTO outings (
              id, resident_id, permission_id, type, status, destination_id, place,
              expected_return_at, grace_ends_at, exited_at, exit_recorded_by,
              returned_at, return_recorded_by, created_at, updated_at, cancelled_at, hall_date
            ) VALUES (
              ?, ?, NULL, 'ordinary', 'outside', ?, 'Maulana Azad Library',
              '2026-09-30T12:00:00Z', '2026-09-30T12:30:00Z',
              '2026-09-30T10:00:00Z', ?,
              NULL, NULL, ?, ?, NULL, '2026-09-30'
            )
            """,
            (OUTING_ID, RESIDENT_ID, LIBRARY, PROVOST_ID, CREATED, CREATED),
        )
        connection.execute(
            """
            INSERT INTO guest_stays (
              id, host_resident_id, guest_name, relation, start_date, end_date, reason,
              status, payment_status, payment_marked_by, payment_marked_at,
              decided_by, decided_at, decision_note,
              arrived_at, arrived_recorded_by, departed_at, departed_recorded_by,
              created_at, updated_at
            ) VALUES (
              ?, ?, 'Zara Ahmed', 'Cousin', '2026-09-29', '2026-10-01', 'Visit.',
              'approved', 'paid', ?, '2026-09-29T08:00:00Z',
              ?, '2026-09-28T12:00:00Z', NULL,
              '2026-09-29T10:00:00Z', ?, NULL, NULL,
              '2026-09-28T10:00:00Z', '2026-09-28T10:00:00Z'
            )
            """,
            (GUEST_ID, RESIDENT_ID, PROVOST_ID, PROVOST_ID, PROVOST_ID),
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


def test_admin_register_export(database_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    expected_header = ARTIFACT.read_text(encoding="utf-8").strip().splitlines()[0]
    from app.main import app
    from app.shared import clock

    monkeypatch.setattr(clock, "utc_now", FrozenClock().utc_now)
    with TestClient(app) as client:
        issue_people(database_path)

        assert_error(client.get("/api/v1/admin/register/export"), 401, "unauthenticated")
        resident = sign_in(client, "24-GLLB-118", RESIDENT_PHRASE)
        assert_error(
            client.get(
                "/api/v1/admin/register/export",
                headers={"Authorization": f"Bearer {resident}"},
            ),
            403,
            "forbidden",
        )
        warden = sign_in(client, "warden.sara", WARDEN_PHRASE)
        assert_error(
            client.get(
                "/api/v1/admin/register/export",
                headers={"Authorization": f"Bearer {warden}"},
            ),
            403,
            "forbidden",
        )

        provost = sign_in(client, "provost.halima", PROVOST_PHRASE)
        headers = {"Authorization": f"Bearer {provost}"}
        exported = client.get("/api/v1/admin/register/export", headers=headers)
        assert exported.status_code == 200
        assert "text/csv" in exported.headers["content-type"]
        text = exported.text
        rows = list(csv.DictReader(io.StringIO(text)))
        assert text.splitlines()[0] == expected_header
        assert [row["record_type"] for row in rows] == ["resident", "guest"]

        resident_row = rows[0]
        assert resident_row["full_name"] == "Aisha Khan"
        assert resident_row["enrolment_number"] == "24-GLLB-118"
        assert resident_row["room_label"] == "B-204"
        assert resident_row["block_code"] == "B"
        assert resident_row["presence"] == "outside"
        assert resident_row["state"] == "late"
        assert resident_row["place"] == "Maulana Azad Library"
        assert resident_row["outing_type"] == "ordinary"
        assert resident_row["guardian_phone"] == "+919876543210"
        assert resident_row["guest_name"] == ""

        guest_row = rows[1]
        assert guest_row["guest_name"] == "Zara Ahmed"
        assert guest_row["host_name"] == "Aisha Khan"
        assert guest_row["host_room_label"] == "B-204"
        assert guest_row["block_code"] == "B"
        assert guest_row["guest_bucket"] == "in_hall"
        assert guest_row["payment_status"] == "paid"
        assert guest_row["full_name"] == ""
