"""The onboard form lists resident blocks A–D and their free active rooms."""

from __future__ import annotations

import json
import sqlite3
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.shared.auth.rate_limit import login_limiter, options_limiter
from app.shared.auth.security import hash_password
from app.shared.auth.tests.test_session import assert_error
from app.shared.testing_env import role_credential

ARTIFACT = Path(__file__).resolve().parent / "artifacts" / "auth-onboard-options.json"
BLOCK_A = "01b885ad-e40d-56a4-81ab-2371f654f558"
BLOCK_B = "d032aad6-a203-5ea0-ba9a-3a9257edbfc8"
BLOCK_C = "dad52ee9-0b9a-53e2-a792-1dbee295ada9"
BLOCK_D = "f75a0c4d-cf9e-5b03-9ba5-13f77337453d"
BLOCK_UTILITY = "916c689d-598e-55b4-b3dc-fcf7120ca3b1"
RESIDENT_TAKEN = "b22de000-0000-4000-8000-000000000205"
CREATED = "2026-09-30T00:00:00Z"


def room_id_for(path: Path, label: str) -> str:
    connection = sqlite3.connect(path)
    try:
        row = connection.execute(
            "SELECT id FROM rooms WHERE label = ?",
            (label,),
        ).fetchone()
        assert row is not None, label
        return row[0]
    finally:
        connection.close()


def active_room_counts(path: Path) -> dict[str, int]:
    connection = sqlite3.connect(path)
    try:
        return dict(
            connection.execute(
                """
                SELECT blocks.name, COUNT(*)
                FROM rooms JOIN blocks ON blocks.id = rooms.block_id
                WHERE rooms.is_active = 1
                GROUP BY blocks.name
                """
            ).fetchall()
        )
    finally:
        connection.close()


def assign_resident(path: Path, room_label: str, username: str) -> None:
    connection = sqlite3.connect(path)
    try:
        connection.execute("PRAGMA foreign_keys=ON;")
        room_id = connection.execute(
            "SELECT id FROM rooms WHERE label = ?",
            (room_label,),
        ).fetchone()[0]
        phrase = hash_password(role_credential("resident-options-10"))
        connection.execute(
            """
            INSERT INTO users (
              id, role, username, full_name, password_hash, status, created_at, updated_at
            ) VALUES (?, 'resident', ?, 'Aisha Khan', ?, 'active', ?, ?)
            """,
            (RESIDENT_TAKEN, username, phrase, CREATED, CREATED),
        )
        connection.execute(
            """
            INSERT INTO residents (
              user_id, enrolment_number, course, room_id, guardian_name, guardian_phone,
              qr_token, presence, created_at, updated_at
            ) VALUES (?, ?, NULL, ?, 'Rashid Khan', '+919876543210', ?, 'inside', ?, ?)
            """,
            (RESIDENT_TAKEN, username, room_id, f"bsj:v1:{username}", CREATED, CREATED),
        )
        connection.commit()
    finally:
        connection.close()


def deactivate_room(path: Path, label: str) -> None:
    connection = sqlite3.connect(path)
    try:
        connection.execute(
            "UPDATE rooms SET is_active = 0 WHERE label = ?",
            (label,),
        )
        connection.commit()
    finally:
        connection.close()


def assign_every_room_in_block(path: Path, block_id: str) -> None:
    connection = sqlite3.connect(path)
    try:
        connection.execute("PRAGMA foreign_keys=ON;")
        rooms = connection.execute(
            "SELECT id, label, bed_count FROM rooms WHERE block_id = ? ORDER BY CAST(number AS INTEGER)",
            (block_id,),
        ).fetchall()
        phrase = hash_password(role_credential("resident-full-10"))
        seat = 0
        for room_id, label, bed_count in rooms:
            for _bed in range(int(bed_count)):
                seat += 1
                user_id = f"b22de000-0000-4000-8000-{seat:012d}"
                username = f"24-FULL-{seat:03d}"
                connection.execute(
                    """
                    INSERT INTO users (
                      id, role, username, full_name, password_hash, status, created_at, updated_at
                    ) VALUES (?, 'resident', ?, ?, ?, 'active', ?, ?)
                    """,
                    (user_id, username, f"Resident {label}", phrase, CREATED, CREATED),
                )
                connection.execute(
                    """
                    INSERT INTO residents (
                      user_id, enrolment_number, course, room_id, guardian_name, guardian_phone,
                      qr_token, presence, created_at, updated_at
                    ) VALUES (?, ?, NULL, ?, 'Rashid Khan', '+919876543210', ?, 'inside', ?, ?)
                    """,
                    (user_id, username, room_id, f"bsj:v1:{username}", CREATED, CREATED),
                )
        connection.commit()
    finally:
        connection.close()


def test_onboard_options(database_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    expected = json.loads(ARTIFACT.read_text(encoding="utf-8"))
    from app.main import app

    with TestClient(app) as client:
        assert client.get("/health").json() == {"status": "ok"}

        listed = client.get("/api/v1/auth/onboard/options")
        assert listed.status_code == 200
        body = listed.json()
        assert [block["name"] for block in body] == [
            "Block-A",
            "Block-B",
            "Block-C",
            "Block-D",
        ]
        assert [block["id"] for block in body] == [BLOCK_A, BLOCK_B, BLOCK_C, BLOCK_D]
        assert all(name != "Utility" for name in (block["name"] for block in body))
        assert BLOCK_UTILITY not in {block["id"] for block in body}

        counts = active_room_counts(database_path)
        for block in body:
            assert set(block) == {"id", "name", "rooms"}
            assert len(block["rooms"]) == counts[block["name"]]
            code = block["name"].removeprefix("Block-")
            assert code in ("A", "B", "C", "D")
            for index, room in enumerate(block["rooms"], start=1):
                assert set(room) == {"id", "label"}
                assert room["label"] == f"{code}-{index}"
                assert room["id"] == room_id_for(database_path, room["label"])

        assert body == expected["fresh"]

        deactivate_room(database_path, "A-1")
        assign_resident(database_path, "B-1", "24-GLLB-205")
        assign_every_room_in_block(database_path, BLOCK_C)

        filtered = client.get("/api/v1/auth/onboard/options")
        assert filtered.status_code == 200
        filtered_body = filtered.json()
        assert [block["id"] for block in filtered_body] == [
            BLOCK_A,
            BLOCK_B,
            BLOCK_C,
            BLOCK_D,
        ]
        by_name = {block["name"]: block for block in filtered_body}
        assert "A-1" not in {room["label"] for room in by_name["Block-A"]["rooms"]}
        assert len(by_name["Block-A"]["rooms"]) == counts["Block-A"] - 1
        assert "B-1" in {room["label"] for room in by_name["Block-B"]["rooms"]}
        assert len(by_name["Block-B"]["rooms"]) == counts["Block-B"]
        assert by_name["Block-C"]["rooms"] == []
        assert len(by_name["Block-D"]["rooms"]) == counts["Block-D"]
        assert filtered_body == expected["filtered"]

        login_limiter.reset()
        options_limiter.reset()
        monkeypatch.setattr(login_limiter, "limit", 1)
        monkeypatch.setattr(options_limiter, "limit", 2)
        for _ in range(2):
            again = client.get("/api/v1/auth/onboard/options")
            assert again.status_code == 200
        blocked = client.get("/api/v1/auth/onboard/options")
        assert_error(
            blocked,
            429,
            "rate_limited",
            "Too many attempts. Try again shortly.",
        )
        sign_in_budget = client.post(
            "/api/v1/auth/onboard/enrolment",
            json={"enrolment_number": "24-NEW-001"},
        )
        assert sign_in_budget.status_code == 204


def _seat(path: Path, room_label: str, username: str, bed_count: int | None = None) -> None:
    connection = sqlite3.connect(path)
    try:
        connection.execute("PRAGMA foreign_keys=ON;")
        room_id = connection.execute(
            "SELECT id FROM rooms WHERE label = ?",
            (room_label,),
        ).fetchone()[0]
        if bed_count is not None:
            connection.execute(
                "UPDATE rooms SET bed_count = ? WHERE id = ?",
                (bed_count, room_id),
            )
        user_id = f"b22de100-0000-4000-8000-{int(username.rsplit('-', 1)[-1]):012d}"
        phrase = hash_password(role_credential("resident-options-10"))
        connection.execute(
            """
            INSERT INTO users (
              id, role, username, full_name, password_hash, status, created_at, updated_at
            ) VALUES (?, 'resident', ?, 'Aisha Khan', ?, 'active', ?, ?)
            """,
            (user_id, username, phrase, CREATED, CREATED),
        )
        connection.execute(
            """
            INSERT INTO residents (
              user_id, enrolment_number, course, room_id, guardian_name, guardian_phone,
              qr_token, presence, created_at, updated_at
            ) VALUES (?, ?, NULL, ?, 'Rashid Khan', '+919876543210', ?, 'inside', ?, ?)
            """,
            (user_id, username, room_id, f"bsj:v1:{username}", CREATED, CREATED),
        )
        connection.commit()
    finally:
        connection.close()


def _block_labels(client: TestClient, name: str) -> set[str]:
    listed = client.get("/api/v1/auth/onboard/options")
    assert listed.status_code == 200
    block = next(item for item in listed.json() if item["name"] == name)
    return {room["label"] for room in block["rooms"]}


def test_onboard_options_are_closed_with_signup(
    database_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    from app.main import app
    from app.shared.config import get_settings

    message = "Ask the hall office to create your account."
    monkeypatch.setenv("ONBOARD_ENABLED", "false")
    get_settings.cache_clear()
    try:
        with TestClient(app) as client:
            closed = client.get("/api/v1/auth/onboard/options")
            assert_error(closed, 403, "onboard_closed", message)
            assert "Block-A" not in closed.text
            assert "rooms" not in closed.text
    finally:
        monkeypatch.setenv("ONBOARD_ENABLED", "true")
        get_settings.cache_clear()

    with TestClient(app) as client:
        opened = client.get("/api/v1/auth/onboard/options")
        assert opened.status_code == 200
        assert any(block["name"] == "Block-A" and block["rooms"] for block in opened.json())


def test_onboard_options_follow_bed_count(database_path: Path) -> None:
    from app.main import app

    with TestClient(app) as client:
        _seat(database_path, "A-2", "24-BED-001")
        assert "A-2" in _block_labels(client, "Block-A")

        _seat(database_path, "A-2", "24-BED-002")
        assert "A-2" not in _block_labels(client, "Block-A")

        _seat(database_path, "A-3", "24-BED-003", bed_count=1)
        assert "A-3" not in _block_labels(client, "Block-A")
