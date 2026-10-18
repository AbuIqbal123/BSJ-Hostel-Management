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

from app.shared.testing_env import role_credential

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
    assert set(body) == {"detail", "error"}
    assert body["detail"] == body["error"]["message"]
    assert isinstance(body["error"].get("request_id"), str) and body["error"]["request_id"]
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
            (GATE_ID, "gate", "gate.fatima", "Fatima Khan", role_credential("gate")),
            (WARDEN_ID, "warden", "warden.sara", "Sara Malik", role_credential("warden")),
            (PROVOST_ID, "provost", "provost.halima", "Halima Begum", role_credential("provost")),
            (RESIDENT_ID, "resident", "24-GLLB-118", "Aisha Khan", role_credential("resident")),
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

        gate = sign_in(client, "gate.fatima", role_credential("gate"))
        assert_error(
            client.post(
                evidence_url,
                headers={"Authorization": f"Bearer {gate}"},
                files={"evidence": ("receipt.png", PNG_BYTES, "image/png")},
            ),
            403,
            "forbidden",
        )
        resident = sign_in(client, "24-GLLB-118", role_credential("resident"))
        assert_error(
            client.post(
                evidence_url,
                headers={"Authorization": f"Bearer {resident}"},
                files={"evidence": ("receipt.png", PNG_BYTES, "image/png")},
            ),
            403,
            "forbidden",
        )

        warden = sign_in(client, "warden.sara", role_credential("warden"))
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
        assert downloaded.headers["cache-control"] == "private, no-store"
        assert downloaded.headers["x-content-type-options"] == "nosniff"
        assert (
            downloaded.headers["content-disposition"]
            == f'attachment; filename="payment-evidence-{UPCOMING}.png"'
        )

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
        gone = sqlite3.connect(database_path)
        try:
            left = gone.execute(
                "SELECT COUNT(*) FROM guest_stay_payment_evidence WHERE guest_stay_id = ?",
                (UPCOMING,),
            ).fetchone()[0]
        finally:
            gone.close()
        assert left == 0

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

        assert_error(
            client.post(
                evidence_url,
                headers=headers,
                files={"evidence": ("note.txt", b"hello", "text/plain")},
            ),
            415,
            "unsupported_media_type",
            "Evidence must be a JPEG, PNG, or PDF.",
        )
        assert_error(
            client.post(
                evidence_url,
                headers=headers,
                files={"evidence": ("evil.exe", b"MZ", "application/pdf")},
            ),
            415,
            "unsupported_media_type",
        )
        oversized = b"\xff\xd8\xff" + (b"x" * (2 * 1024 * 1024))
        assert_error(
            client.post(
                evidence_url,
                headers=headers,
                files={"evidence": ("big.jpg", oversized, "image/jpeg")},
            ),
            413,
            "payload_too_large",
            "Evidence file must be at most 2 MiB.",
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


JPEG_BYTES = b"\xff\xd8\xff" + b"\x00" * 32
PDF_BYTES = b"%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF"


def _open(path: Path) -> sqlite3.Connection:
    connection = sqlite3.connect(path)
    connection.row_factory = sqlite3.Row
    return connection


def test_evidence_bytes_round_trip_and_limits(
    database_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    from app.residents.guests import records
    from app.shared import clock
    from app.shared.migrate import migrate
    from app.staff.gate import guest_routes

    monkeypatch.setattr(clock, "utc_now", FrozenClock().utc_now)
    migrate()
    issue_people(database_path)
    seed_stays(database_path)
    evidence_url = f"/api/v1/guest-stays/{UPCOMING}/payment/evidence"
    from app.main import app

    with TestClient(app) as client:
        warden = sign_in(client, "warden.sara", role_credential("warden"))
        provost = sign_in(client, "provost.halima", role_credential("provost"))
        headers = {"Authorization": f"Bearer {warden}"}
        provost_headers = {"Authorization": f"Bearer {provost}"}

        for name, payload, sent_type, stored_type, ext in (
            ("photo.jpg", JPEG_BYTES, "image/jpeg", "image/jpeg", "jpg"),
            ("shot.png", PNG_BYTES, "image/jpeg", "image/png", "png"),
            ("receipt.pdf", PDF_BYTES, "application/octet-stream", "application/pdf", "pdf"),
        ):
            uploaded = client.post(
                evidence_url,
                headers=headers,
                files={"evidence": (name, payload, sent_type)},
            )
            assert uploaded.status_code == 200
            assert uploaded.json()["payment_evidence_content_type"] == stored_type
            downloaded = client.get(evidence_url, headers=provost_headers)
            assert downloaded.status_code == 200
            assert downloaded.content == payload
            assert downloaded.headers["content-type"].startswith(stored_type)
            assert downloaded.headers["cache-control"] == "private, no-store"
            assert downloaded.headers["x-content-type-options"] == "nosniff"
            assert (
                downloaded.headers["content-disposition"]
                == f'attachment; filename="payment-evidence-{UPCOMING}.{ext}"'
            )

        hidden = client.post(
            evidence_url,
            headers=headers,
            files={"evidence": ("../../receipt.png", PNG_BYTES, "image/png")},
        )
        assert hidden.status_code == 200
        assert hidden.json()["payment_evidence_original_name"] == "receipt.png"

        assert_error(
            client.post(evidence_url, headers=headers, files={"evidence": ("empty.png", b"", "image/png")}),
            422,
            "validation_error",
            "Evidence file is empty.",
        )
        assert_error(
            client.post(
                evidence_url,
                headers=headers,
                files={"evidence": ("cut.jpg", b"\xff\xd8", "image/jpeg")},
            ),
            422,
            "validation_error",
            "Evidence file is incomplete.",
        )

        exact = b"\xff\xd8\xff" + (b"\x00" * (2 * 1024 * 1024 - 3))
        assert len(exact) == 2 * 1024 * 1024
        stored = client.post(
            evidence_url,
            headers=headers,
            files={"evidence": ("full.jpg", exact, "image/jpeg")},
        )
        assert stored.status_code == 200
        fetched = client.get(evidence_url, headers=headers)
        assert fetched.content == exact
        connection = _open(database_path)
        try:
            row = connection.execute(
                "SELECT content, size_bytes, length(content) AS n FROM guest_stay_payment_evidence WHERE guest_stay_id = ?",
                (UPCOMING,),
            ).fetchone()
            assert row["n"] == 2 * 1024 * 1024
            assert row["size_bytes"] == row["n"]
            assert bytes(row["content"]) == exact
            assert connection.execute(
                "SELECT COUNT(*) FROM guest_stay_payment_evidence"
            ).fetchone()[0] == 1
        finally:
            connection.close()

        listed = client.get("/api/v1/guest-stays", headers=headers)
        assert listed.status_code == 200
        assert exact[:20] not in listed.content
        assert b"guest_stay_payment_evidence" not in listed.content
        resident = sign_in(client, "24-GLLB-118", role_credential("resident"))
        own = client.get(
            "/api/v1/me/guest-stays",
            headers={"Authorization": f"Bearer {resident}"},
        )
        assert own.status_code == 200
        assert exact[:20] not in own.content

    assert "guest_stay_payment_evidence" not in Path(records.__file__).read_text(encoding="utf-8")
    assert "guest_stay_payment_evidence" not in Path(guest_routes.__file__).read_text(encoding="utf-8")


def _http_scope(path: str, headers: list[tuple[bytes, bytes]]) -> dict:
    return {
        "type": "http",
        "asgi": {"version": "3.0", "spec_version": "2.3"},
        "http_version": "1.1",
        "method": "POST",
        "scheme": "http",
        "path": path,
        "raw_path": path.encode(),
        "query_string": b"",
        "headers": headers,
        "client": ("127.0.0.1", 12345),
        "server": ("testserver", 80),
    }


def _response_status_and_body(messages: list[dict]) -> tuple[int, dict]:
    start = next(message for message in messages if message["type"] == "http.response.start")
    body = b"".join(
        message.get("body", b"")
        for message in messages
        if message["type"] == "http.response.body"
    )
    return start["status"], json.loads(body)


def test_oversize_receipt_stops_before_the_rest_of_the_body(
    database_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    import anyio

    from app.main import app
    from app.residents.guests.payment_evidence import MAX_EVIDENCE_BYTES
    from app.shared import clock
    from app.shared.migrate import migrate

    monkeypatch.setattr(clock, "utc_now", FrozenClock().utc_now)
    migrate()
    issue_people(database_path)
    with TestClient(app) as client:
        assert client.get("/health").status_code == 200
        token = sign_in(client, "warden.sara", role_credential("warden"))

    url = f"/api/v1/guest-stays/{UPCOMING}/payment/evidence"
    auth_header = (b"authorization", f"Bearer {token}".encode())
    reads = {"n": 0}

    async def receive_nothing():
        reads["n"] += 1
        return {"type": "http.request", "body": b"", "more_body": False}

    messages: list[dict] = []

    async def send(message):
        messages.append(message)

    scope = _http_scope(
        url,
        [
            (b"content-type", b"multipart/form-data; boundary=bound"),
            (b"content-length", str(MAX_EVIDENCE_BYTES + 64 * 1024).encode()),
            auth_header,
        ],
    )
    anyio.run(app, scope, receive_nothing, send)
    status, body = _response_status_and_body(messages)
    assert status == 413
    assert body["error"]["code"] == "payload_too_large"
    assert body["error"]["message"] == "Evidence file must be at most 2 MiB."
    assert body["error"]["details"] == {"field": "evidence"}
    assert reads["n"] == 0

    head = (
        b"--bound\r\n"
        b'Content-Disposition: form-data; name="evidence"; filename="big.jpg"\r\n'
        b"Content-Type: image/jpeg\r\n\r\n"
    )
    chunk_size = 256 * 1024
    payload = head + (b"\xff\xd8\xff" + (b"x" * (MAX_EVIDENCE_BYTES + chunk_size))) + b"\r\n--bound--\r\n"
    pieces = [payload[index : index + chunk_size] for index in range(0, len(payload), chunk_size)]
    assert len(pieces) > 3
    cursor = {"i": 0}

    async def receive_chunks():
        index = cursor["i"]
        cursor["i"] += 1
        if index >= len(pieces):
            return {"type": "http.request", "body": b"", "more_body": False}
        return {
            "type": "http.request",
            "body": pieces[index],
            "more_body": index + 1 < len(pieces),
        }

    streamed: list[dict] = []

    async def send_stream(message):
        streamed.append(message)

    anyio.run(
        app,
        _http_scope(url, [(b"content-type", b"multipart/form-data; boundary=bound"), auth_header]),
        receive_chunks,
        send_stream,
    )
    status, body = _response_status_and_body(streamed)
    assert status == 413
    assert body["error"]["code"] == "payload_too_large"
    assert body["error"]["message"] == "Evidence file must be at most 2 MiB."
    assert cursor["i"] < len(pieces)


def test_metadata_without_a_blob_is_not_a_file(
    database_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    from app.shared import clock
    from app.shared.migrate import migrate

    monkeypatch.setattr(clock, "utc_now", FrozenClock().utc_now)
    migrate()
    issue_people(database_path)
    seed_stays(database_path)
    connection = _open(database_path)
    try:
        connection.execute("PRAGMA foreign_keys=ON;")
        connection.execute(
            """
            UPDATE guest_stays
            SET
              payment_evidence_original_name = 'receipt.png',
              payment_evidence_content_type = 'image/png',
              payment_evidence_uploaded_at = '2026-09-29T12:00:00Z',
              payment_evidence_uploaded_by = ?
            WHERE id = ?
            """,
            (WARDEN_ID, UPCOMING),
        )
        connection.commit()
    finally:
        connection.close()

    from app.main import app

    with TestClient(app) as client:
        warden = sign_in(client, "warden.sara", role_credential("warden"))
        assert_error(
            client.get(
                f"/api/v1/guest-stays/{UPCOMING}/payment/evidence",
                headers={"Authorization": f"Bearer {warden}"},
            ),
            404,
            "not_found",
            "No payment evidence is stored for this stay.",
        )


def test_migration_0019_clears_legacy_evidence_metadata(database_path: Path) -> None:
    from app.shared.migrate import MIGRATIONS, _apply, _BOOKKEEPING

    connection = sqlite3.connect(database_path)
    connection.row_factory = sqlite3.Row
    try:
        connection.execute(_BOOKKEEPING)
        connection.commit()
        connection.execute("PRAGMA foreign_keys=OFF")
        pending = [path for path in MIGRATIONS if path.name != "0019_guest_stay_payment_evidence_blob.sql"]
        for path in pending:
            _apply(connection, path)
        connection.execute("PRAGMA foreign_keys=ON")
    finally:
        connection.close()

    issue_people(database_path)
    seed_stays(database_path)
    connection = _open(database_path)
    try:
        connection.execute("PRAGMA foreign_keys=ON;")
        connection.execute(
            """
            UPDATE guest_stays
            SET
              payment_evidence_path = 'lost/on-render/receipt.png',
              payment_evidence_original_name = 'receipt.png',
              payment_evidence_content_type = 'image/png',
              payment_evidence_uploaded_at = '2026-09-29T12:00:00Z',
              payment_evidence_uploaded_by = ?
            WHERE id = ?
            """,
            (WARDEN_ID, UPCOMING),
        )
        connection.execute(
            """
            INSERT INTO audit_log (
              id, occurred_at, actor_user_id, action, entity_type, entity_id, summary
            ) VALUES (
              'aa100000-0000-4000-8000-0000000000a1',
              '2026-09-29T12:00:00Z',
              ?,
              'guest_stay.payment_evidence_uploaded',
              'guest_stay',
              ?,
              'Sara Malik uploaded payment evidence for Upcoming Guest.'
            )
            """,
            (WARDEN_ID, UPCOMING),
        )
        connection.commit()
        blob_migration = next(
            path for path in MIGRATIONS if path.name == "0019_guest_stay_payment_evidence_blob.sql"
        )
        _apply(connection, blob_migration)
        row = connection.execute(
            """
            SELECT
              payment_status,
              payment_evidence_path,
              payment_evidence_original_name,
              payment_evidence_content_type,
              payment_evidence_uploaded_at,
              payment_evidence_uploaded_by
            FROM guest_stays
            WHERE id = ?
            """,
            (UPCOMING,),
        ).fetchone()
        assert row["payment_status"] == "unpaid"
        assert row["payment_evidence_path"] is None
        assert row["payment_evidence_original_name"] is None
        assert row["payment_evidence_content_type"] is None
        assert row["payment_evidence_uploaded_at"] is None
        assert row["payment_evidence_uploaded_by"] is None
        columns = [info[1] for info in connection.execute("PRAGMA table_info(guest_stays)")]
        assert "payment_evidence_path" in columns
        kept = connection.execute(
            "SELECT summary FROM audit_log WHERE id = 'aa100000-0000-4000-8000-0000000000a1'"
        ).fetchone()
        assert kept["summary"].startswith("Sara Malik uploaded")
        paid = connection.execute(
            "SELECT payment_status FROM guest_stays WHERE id = ?",
            (IN_HALL,),
        ).fetchone()
        assert paid["payment_status"] == "paid"
    finally:
        connection.close()
