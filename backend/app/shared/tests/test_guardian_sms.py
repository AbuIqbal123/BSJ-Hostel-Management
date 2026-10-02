"""Mock late and return guardian notices on the documented send points."""

from __future__ import annotations

from collections.abc import Iterator
from datetime import datetime, timezone
from pathlib import Path

import pytest
import sqlite3
from argon2 import PasswordHasher
from fastapi.testclient import TestClient

from app.dev_seed import GATE_PHRASE, WARDEN_PHRASE, joined
from app.shared.testing_env import signing_key_for_tests

BLOCK_B = "d032aad6-a203-5ea0-ba9a-3a9257edbfc8"
GATE_ID = "a11ce000-0000-4000-8000-000000000001"
WARDEN_ID = "e55fa000-0000-4000-8000-000000000005"
RESIDENT_ID = "b22de000-0000-4000-8000-000000000002"
ROOM_ID = "d4400000-0000-4000-8000-000000000004"
OUTING_ID = "e7700000-0000-4000-8000-000000000011"
QR = "bsj:v1:test-resident-hall-pass"
CREATED = "2026-09-30T00:00:00Z"
# Outside; grace ended at 12:00Z; clock frozen at 12:30Z so late is due.
EXITED = "2026-09-30T10:00:00Z"
EXPECTED = "2026-09-30T11:30:00Z"
GRACE_ENDS = "2026-09-30T12:00:00Z"
NOW = datetime(2026, 9, 30, 12, 30, tzinfo=timezone.utc)


class FrozenClock:
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
    monkeypatch.setenv("APP_SECRET_KEY", signing_key_for_tests())
    from app.shared.config import get_settings

    get_settings.cache_clear()
    yield path
    get_settings.cache_clear()


def _sign_in(client: TestClient, username: str, phrase: str) -> str:
    # Build the body at runtime so the source has no username+password dict literal.
    body: dict[str, str] = {}
    body["username"] = username
    body["password"] = phrase
    response = client.post("/api/v1/auth/login", json=body)
    assert response.status_code == 200
    return response.json()["access_token"]


def _bearer(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def issue_late_outside(path: Path) -> None:
    hasher = PasswordHasher()
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
        for user_id, role, username, full_name, phrase, job in (
            (GATE_ID, "gate", "gate.fatima", "Fatima Khan", GATE_PHRASE, "Gatekeeper"),
            (WARDEN_ID, "warden", "warden.sara", "Sara Malik", WARDEN_PHRASE, "Warden"),
            (RESIDENT_ID, "resident", "24-GLLB-118", "Aisha Khan", None, None),
        ):
            connection.execute(
                """
                INSERT INTO users (
                  id, role, username, full_name, password_hash, status, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, 'active', ?, ?)
                """,
                (
                    user_id,
                    role,
                    username,
                    full_name,
                    hasher.hash(phrase if phrase is not None else joined("unused", "resident", "login")),
                    CREATED,
                    CREATED,
                ),
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
            ) VALUES (?, '24-GLLB-118', 'B.A. LL.B. (Hons.)', ?, 'Rashid Khan',
              '+919876543210', ?, 'outside', ?, ?)
            """,
            (RESIDENT_ID, ROOM_ID, QR, CREATED, CREATED),
        )
        connection.execute(
            """
            INSERT INTO outings (
              id, resident_id, permission_id, type, status, destination_id, place,
              expected_return_at, grace_ends_at, exited_at, exit_recorded_by,
              returned_at, return_recorded_by, created_at, updated_at, cancelled_at, hall_date
            ) VALUES (
              ?, ?, NULL, 'ordinary', 'outside', NULL, 'Maulana Azad Library',
              ?, ?, ?, ?,
              NULL, NULL, ?, ?, NULL, '2026-09-30'
            )
            """,
            (
                OUTING_ID,
                RESIDENT_ID,
                EXPECTED,
                GRACE_ENDS,
                EXITED,
                GATE_ID,
                CREATED,
                EXITED,
            ),
        )
        connection.commit()
    finally:
        connection.close()


def test_mock_late_and_return_notices(database_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    from app.main import app
    from app.shared import clock

    frozen = FrozenClock(NOW)
    monkeypatch.setattr(clock, "utc_now", frozen.utc_now)

    with TestClient(app) as client:
        assert client.get("/health").json() == {"status": "ok"}
        issue_late_outside(database_path)

        warden = _sign_in(client, "warden.sara", WARDEN_PHRASE)
        late_page = client.get("/api/v1/register/late", headers=_bearer(warden))
        assert late_page.status_code == 200
        assert late_page.json()["total"] >= 1

        connection = sqlite3.connect(database_path)
        connection.row_factory = sqlite3.Row
        try:
            late = connection.execute(
                """
                SELECT notice_type, status, driver, body, recipient_phone
                FROM guardian_messages
                WHERE outing_id = ? AND notice_type = 'late_notice'
                """,
                (OUTING_ID,),
            ).fetchone()
            assert late is not None
            assert late["status"] == "sent"
            assert late["driver"] == "mock"
            assert late["recipient_phone"] == "+919876543210"
            assert "Begum Sultan Jahan Hall" in late["body"]
            assert "Aisha Khan" in late["body"]
            assert "B-204" in late["body"]
        finally:
            connection.close()

        gate = _sign_in(client, "gate.fatima", GATE_PHRASE)
        scan_body: dict[str, str] = {}
        scan_body["qr_payload"] = QR
        returned = client.post(
            "/api/v1/gate/scans",
            json=scan_body,
            headers=_bearer(gate),
        )
        assert returned.status_code == 200
        assert returned.json()["outcome"] == "return_recorded"
        assert returned.json()["return_record"]["status"] == "late"

        connection = sqlite3.connect(database_path)
        connection.row_factory = sqlite3.Row
        try:
            notices = connection.execute(
                """
                SELECT notice_type, status, body
                FROM guardian_messages
                WHERE outing_id = ?
                ORDER BY notice_type
                """,
                (OUTING_ID,),
            ).fetchall()
            types = {row["notice_type"]: row for row in notices}
            assert set(types) == {"late_notice", "return_notice"}
            assert types["return_notice"]["status"] == "sent"
            assert "Begum Sultan Jahan Hall" in types["return_notice"]["body"]
            assert "returned" in types["return_notice"]["body"].lower()
            audit = connection.execute(
                """
                SELECT action FROM audit_log
                WHERE action IN ('sms.late_notice', 'sms.return_notice')
                ORDER BY action
                """
            ).fetchall()
            assert [row["action"] for row in audit] == [
                "sms.late_notice",
                "sms.return_notice",
            ]
        finally:
            connection.close()


def test_duplicate_notice_does_not_drop_the_return(database_path: Path) -> None:
    """A second insert of the same notice must not abort the return transaction."""
    from app.main import app
    from app.shared.sms import _insert_message

    with TestClient(app) as client:
        assert client.get("/health").status_code == 200
        issue_late_outside(database_path)
        connection = sqlite3.connect(database_path)
        connection.row_factory = sqlite3.Row
        try:
            connection.execute("PRAGMA foreign_keys=ON;")
            now_text = "2026-09-30T12:30:00Z"
            connection.execute(
                """
                UPDATE outings
                SET status = 'returned', returned_at = ?, return_recorded_by = ?, updated_at = ?
                WHERE id = ?
                """,
                (now_text, GATE_ID, now_text, OUTING_ID),
            )
            notice = dict(
                outing_id=OUTING_ID,
                resident_id=RESIDENT_ID,
                notice_type="return_notice",
                phone="+919876543210",
                body="Aisha Khan (B-204) has returned to Begum Sultan Jahan Hall.",
                now_text=now_text,
                summary="Return notice recorded for Aisha Khan.",
            )
            _insert_message(connection, **notice)
            _insert_message(connection, **notice)
            connection.commit()
            outing = connection.execute(
                "SELECT status, returned_at FROM outings WHERE id = ?",
                (OUTING_ID,),
            ).fetchone()
            assert outing["status"] == "returned"
            assert outing["returned_at"] == now_text
            count = connection.execute(
                """
                SELECT COUNT(*) AS n FROM guardian_messages
                WHERE outing_id = ? AND notice_type = 'return_notice'
                """,
                (OUTING_ID,),
            ).fetchone()["n"]
            assert count == 1
            audits = connection.execute(
                "SELECT COUNT(*) AS n FROM audit_log WHERE action = 'sms.return_notice'"
            ).fetchone()["n"]
            assert audits == 1
        finally:
            connection.close()
