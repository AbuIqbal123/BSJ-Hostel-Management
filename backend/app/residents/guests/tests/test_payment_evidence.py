"""Optional guest-stay payment evidence upload (warden/provost)."""

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
)

ARTIFACT = Path(__file__).resolve().parent / "artifacts" / "guest-payment-evidence.json"
BLOCK_B = "d032aad6-a203-5ea0-ba9a-3a9257edbfc8"
GATE_ID = "a11ce000-0000-4000-8000-000000000001"
WARDEN_ID = "e55fa000-0000-4000-8000-000000000005"
PROVOST_ID = "f66fb000-0000-4000-8000-000000000006"
RESIDENT_ID = "b22de000-0000-4000-8000-000000000002"
ROOM_ID = "d4400000-0000-4000-8000-000000000004"
CREATED = "2026-09-30T00:00:00Z"

UPCOMING = "bb100000-0000-4000-8000-0000000000c1"
IN_HALL = "bb100000-0000-4000-8000-0000000000c2"

# Minimal valid 1x1 PNG
PNG_BYTES = (
    b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
    b"\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDATx\x9cc\xf8\x0f\x00"
    b"\x00\x01\x01\x00\x05\x18\xd8N\x00\x00\x00\x00IEND\xaeB`\x82"
)


class FrozenClock:
    def utc_now(self) -> datetime:
        return datetime(2026, 9, 30, 13, 0, tzinfo=timezone.utc)


@pytest.fixture
def database_path(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Iterator[Path]:
    path = tmp_path / "hostel.db"
    evidence_dir = tmp_path / "payment-evidence"
    evidence_dir.mkdir()
    monkeypatch.setenv("DATABASE_PATH", str(path))
    monkeypatch.setenv("PAYMENT_EVIDENCE_DIR", str(evidence_dir))
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


def sign_in(client: TestClient, username: str, password: str) -> str:
    response = client.post(
        "/api/v1/auth/login",
        json={"username": username, "password": password},
    )
    assert response.status_code == 200
    return response.json()["access_token"]


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
            (GATE_ID, "gate", "gate.fatima", "Fatima Khan", GATE_PHRASE),
            (WARDEN_ID, "warden", "warden.sara", "Sara Malik", WARDEN_PHRASE),
            (PROVOST_ID, "provost", "provost.halima", "Halima Begum", PROVOST_PHRASE),
            (RESIDENT_ID, "resident", "24-GLLB-118", "Aisha Khan", RESIDENT_PHRASE),
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
            ) VALUES (?, '24-GLLB-118', 'B.A. LL.B. (Hons.)', ?, 'Rashid Khan',
              '+919876543210', 'bsj:v1:test-resident-hall-pass', 'inside', ?, ?)
            """,
            (RESIDENT_ID, ROOM_ID, CREATED, CREATED),
        )
        connection.commit()
    finally:
        connection.close()


def seed_stays(path: Path) -> None:
    connection = sqlite3.connect(path)
    try:
        connection.execute("PRAGMA foreign_keys=ON;")
        connection.execute(
            """
            INSERT INTO guest_stays (
              id, host_resident_id, guest_name, relation, guest_start_date, guest_end_date, reason,
              status, payment_status, payment_marked_by, payment_marked_at,
              decided_by, decided_at, decision_note,
              arrived_at, arrived_recorded_by, departed_at, departed_recorded_by,
              created_at, updated_at
            ) VALUES
              (?, ?, 'Upcoming Guest', 'Friend', '2026-10-10', '2026-10-12', 'Later.',
               'approved', 'unpaid', NULL, NULL, ?, '2026-09-29T12:00:00Z', NULL,
               NULL, NULL, NULL, NULL, '2026-09-29T10:00:00Z', '2026-09-29T12:00:00Z'),
              (?, ?, 'In Hall Guest', 'Cousin', '2026-09-28', '2026-10-02', 'Here.',
               'approved', 'paid', ?, '2026-09-28T09:00:00Z', ?, '2026-09-27T12:00:00Z', NULL,
               '2026-09-28T10:00:00Z', ?, NULL, NULL, '2026-09-27T10:00:00Z', '2026-09-28T10:00:00Z')
            """,
            (
                UPCOMING,
                RESIDENT_ID,
                WARDEN_ID,
                IN_HALL,
                RESIDENT_ID,
                WARDEN_ID,
                WARDEN_ID,
                GATE_ID,
            ),
        )
        connection.commit()
    finally:
        connection.close()


def test_optional_payment_evidence_upload(
    database_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from app.shared import clock
    from app.shared.migrate import migrate

    monkeypatch.setattr(clock, "utc_now", FrozenClock().utc_now)
    migrate()
    issue_people(database_path)
    seed_stays(database_path)

    expected = json.loads(ARTIFACT.read_text(encoding="utf-8"))
    evidence_url = f"/api/v1/guest-stays/{UPCOMING}/payment/evidence"

    from app.main import app

    with TestClient(app) as client:
        assert_error(client.post(evidence_url, files={"evidence": ("receipt.png", PNG_BYTES, "image/png")}), 401, "unauthenticated")

        gate = sign_in(client, "gate.fatima", GATE_PHRASE)
        assert_error(
            client.post(
                evidence_url,
                headers={"Authorization": f"Bearer {gate}"},
                files={"evidence": ("receipt.png", PNG_BYTES, "image/png")},
            ),
            403,
            "forbidden",
        )
        resident = sign_in(client, "24-GLLB-118", RESIDENT_PHRASE)
        assert_error(
            client.post(
                evidence_url,
                headers={"Authorization": f"Bearer {resident}"},
                files={"evidence": ("receipt.png", PNG_BYTES, "image/png")},
            ),
            403,
            "forbidden",
        )

        warden = sign_in(client, "warden.sara", WARDEN_PHRASE)
        headers = {"Authorization": f"Bearer {warden}"}

        # Mark paid WITHOUT evidence — must succeed (evidence is optional)
        paid_only = client.post(
            f"/api/v1/guest-stays/{UPCOMING}/payment",
            headers=headers,
            json={"payment_status": "paid", "payment_note": "Cash collected by Sara"},
        )
        assert paid_only.status_code == 200
        assert paid_only.json()["payment_status"] == "paid"
        assert paid_only.json()["payment_evidence_original_name"] is None

        # Reset to unpaid for upload-before-paid path
        unpaid = client.post(
            f"/api/v1/guest-stays/{UPCOMING}/payment",
            headers=headers,
            json={"payment_status": "unpaid"},
        )
        assert unpaid.status_code == 200

        uploaded = client.post(
            evidence_url,
            headers=headers,
            files={"evidence": ("receipt.png", PNG_BYTES, "image/png")},
        )
        assert uploaded.status_code == 200
        body = uploaded.json()
        for key, value in expected["uploaded"].items():
            assert body[key] == value
        assert body["payment_evidence_uploaded_at"] == "2026-09-30T13:00:00Z"
        assert "payment_evidence_path" not in body
        assert "/" not in (body["payment_evidence_original_name"] or "")
        assert not str(body.get("payment_evidence_original_name", "")).startswith("/")

        downloaded = client.get(evidence_url, headers=headers)
        assert downloaded.status_code == 200
        assert downloaded.content == PNG_BYTES
        assert downloaded.headers["content-type"].startswith("image/png")

        # Replace with a tiny PDF-labelled file (content type allowlist; bytes arbitrary for test)
        pdf_bytes = b"%PDF-1.4 minimal"
        replaced = client.post(
            evidence_url,
            headers=headers,
            files={"evidence": ("proof.pdf", pdf_bytes, "application/pdf")},
        )
        assert replaced.status_code == 200
        assert replaced.json()["payment_evidence_original_name"] == "proof.pdf"
        assert replaced.json()["payment_evidence_content_type"] == "application/pdf"
        assert client.get(evidence_url, headers=headers).content == pdf_bytes

        # DELETE clears without changing payment_status
        cleared = client.delete(evidence_url, headers=headers)
        assert cleared.status_code == 200
        assert cleared.json()["payment_status"] == "unpaid"
        for key, value in expected["after_unpaid_clears"].items():
            assert cleared.json()[key] == value
        assert_error(client.get(evidence_url, headers=headers), 404, "not_found")

        # Upload again, then mark unpaid clears evidence
        assert (
            client.post(
                evidence_url,
                headers=headers,
                files={"evidence": ("receipt.png", PNG_BYTES, "image/png")},
            ).status_code
            == 200
        )
        assert (
            client.post(
                f"/api/v1/guest-stays/{UPCOMING}/payment",
                headers=headers,
                json={"payment_status": "paid", "payment_note": "Cash collected by Sara"},
            ).status_code
            == 200
        )
        unpaid2 = client.post(
            f"/api/v1/guest-stays/{UPCOMING}/payment",
            headers=headers,
            json={"payment_status": "unpaid"},
        )
        assert unpaid2.status_code == 200
        for key, value in expected["after_unpaid_clears"].items():
            assert unpaid2.json()[key] == value

        # Locked after arrival
        assert_error(
            client.post(
                f"/api/v1/guest-stays/{IN_HALL}/payment/evidence",
                headers=headers,
                files={"evidence": ("receipt.png", PNG_BYTES, "image/png")},
            ),
            409,
            "payment_locked",
        )

        # Validation: bad type / exe / oversized
        assert_error(
            client.post(
                evidence_url,
                headers=headers,
                files={"evidence": ("note.txt", b"hello", "text/plain")},
            ),
            422,
            "validation_error",
        )
        assert_error(
            client.post(
                evidence_url,
                headers=headers,
                files={"evidence": ("evil.exe", b"MZ", "application/pdf")},
            ),
            422,
            "validation_error",
        )
        oversized = b"x" * (5 * 1024 * 1024 + 1)
        assert_error(
            client.post(
                evidence_url,
                headers=headers,
                files={"evidence": ("big.png", oversized, "image/png")},
            ),
            422,
            "validation_error",
        )

        connection = sqlite3.connect(database_path)
        try:
            actions = [
                row[0]
                for row in connection.execute(
                    "SELECT action FROM audit_log WHERE entity_type = 'guest_stay' ORDER BY occurred_at, id"
                )
            ]
        finally:
            connection.close()
        assert "guest_stay.payment_evidence_uploaded" in actions
        assert "guest_stay.payment_evidence_cleared" in actions
