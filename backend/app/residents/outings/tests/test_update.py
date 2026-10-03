"""A resident changes an ordinary outing while it is still planned and its window is shut."""

from __future__ import annotations

from app.shared.testing_env import signing_key_for_tests

import json
import sqlite3
from collections.abc import Iterator
from datetime import datetime, timezone
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.dev_seed import GATE_PHRASE, RESIDENT_PHRASE
from app.residents.outings.tests.test_cancel import (
    LIBRARY,
    RESIDENT_ID,
    SHAMSHAD,
    WOMENS,
    assert_error,
    issue_people,
    sign_in,
)


ARTIFACT = Path(__file__).resolve().parent / "artifacts" / "update-outing.json"
OUTSIDE_ID = "e7700000-0000-4000-8000-0000000000bb"
GATE_ID = "a11ce000-0000-4000-8000-000000000001"
MISSING = "00000000-0000-4000-8000-000000000099"
CREATED = "2026-09-30T00:00:00Z"
NOW = "2026-09-30T08:00:00Z"


class FrozenClock:
    def utc_now(self) -> datetime:
        return datetime(2026, 9, 30, 8, 0, tzinfo=timezone.utc)


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


def change(client: TestClient, token: str, outing_id: str, body: dict):
    return client.patch(
        f"/api/v1/me/outings/{outing_id}",
        headers={"Authorization": f"Bearer {token}"},
        json=body,
    )


def plan(client: TestClient, token: str, body: dict):
    return client.post(
        "/api/v1/me/outings",
        headers={"Authorization": f"Bearer {token}"},
        json=body,
    )


def test_update_outing(database_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    expected = json.loads(ARTIFACT.read_text(encoding="utf-8"))
    from app.shared import clock
    from app.main import app

    monkeypatch.setattr(clock, "utc_now", FrozenClock().utc_now)
    with TestClient(app) as client:
        issue_people(database_path)
        assert_error(
            client.patch(
                f"/api/v1/me/outings/{MISSING}",
                json={
                    "destination_id": LIBRARY,
                    "starts_at": "2026-09-30T09:00:00Z",
                    "expected_return_at": "2026-09-30T12:00:00Z",
                },
            ),
            401,
            "unauthenticated",
            "Sign in again.",
        )
        gate = sign_in(client, "gate.fatima", GATE_PHRASE)
        assert_error(
            change(
                client,
                gate,
                MISSING,
                {
                    "destination_id": LIBRARY,
                    "starts_at": "2026-09-30T09:00:00Z",
                    "expected_return_at": "2026-09-30T12:00:00Z",
                },
            ),
            403,
            "forbidden",
            "This account cannot do that.",
        )
        resident = sign_in(client, "24-GLLB-118", RESIDENT_PHRASE)
        assert_error(
            change(
                client,
                resident,
                MISSING,
                {
                    "destination_id": LIBRARY,
                    "starts_at": "2026-09-30T09:00:00Z",
                    "expected_return_at": "2026-09-30T12:00:00Z",
                },
            ),
            404,
            "not_found",
            "That record was not found.",
        )

        created = plan(
            client,
            resident,
            {
                "destination_id": LIBRARY,
                "starts_at": "2026-09-30T09:00:00Z",
                "expected_return_at": "2026-09-30T13:00:00Z",
            },
        )
        assert created.status_code == 201
        outing_id = created.json()["id"]
        later = plan(
            client,
            resident,
            {
                "destination_id": SHAMSHAD,
                "starts_at": "2026-10-02T05:00:00Z",
                "expected_return_at": "2026-10-02T10:30:00Z",
            },
        )
        assert later.status_code == 201

        updated = change(
            client,
            resident,
            outing_id,
            {
                "destination_id": WOMENS,
                "starts_at": "2026-09-30T09:30:00Z",
                "expected_return_at": "2026-09-30T12:00:00Z",
            },
        )
        assert updated.status_code == 200
        body = updated.json()
        assert body["id"] == outing_id
        assert {key: value for key, value in body.items() if key != "id"} == expected["updated"]
        connection = sqlite3.connect(database_path)
        connection.row_factory = sqlite3.Row
        row = connection.execute("SELECT * FROM outings WHERE id = ?", (outing_id,)).fetchone()
        resident_row = connection.execute(
            "SELECT presence, updated_at FROM residents WHERE user_id = ?",
            (RESIDENT_ID,),
        ).fetchone()
        audit = connection.execute(
            """
            SELECT actor_user_id, action, entity_type, summary
            FROM audit_log
            WHERE entity_id = ? AND action = 'outing.updated'
            """,
            (outing_id,),
        ).fetchone()
        connection.close()
        assert row["status"] == "planned"
        assert row["destination_id"] == WOMENS
        assert row["place"] == "Women's College"
        assert row["starts_at"] == "2026-09-30T09:30:00Z"
        assert row["expected_return_at"] == "2026-09-30T12:00:00Z"
        assert row["grace_ends_at"] == "2026-09-30T12:30:00Z"
        assert row["hall_date"] == "2026-09-30"
        assert row["updated_at"] == NOW
        assert row["cancelled_at"] is None
        assert resident_row["presence"] == "inside"
        assert resident_row["updated_at"] == CREATED
        assert audit["actor_user_id"] == RESIDENT_ID
        assert audit["action"] == "outing.updated"
        assert audit["entity_type"] == "outing"
        assert audit["summary"] == "Aisha Khan changed a planned outing to Women's College."

        assert_error(
            change(
                client,
                resident,
                outing_id,
                {
                    "destination_id": LIBRARY,
                    "starts_at": "2026-10-02T05:30:00Z",
                    "expected_return_at": "2026-10-02T10:30:00Z",
                },
            ),
            409,
            "return_already_planned",
            "You already have an outing ending at that time.",
        )
        assert_error(
            change(
                client,
                resident,
                outing_id,
                {
                    "destination_id": WOMENS,
                    "starts_at": "2026-09-30T09:30:00Z",
                    "expected_return_at": "2026-09-30T09:00:00Z",
                },
            ),
            422,
            "validation_error",
            "The expected return must be after the start.",
        )
        connection = sqlite3.connect(database_path)
        connection.row_factory = sqlite3.Row
        unchanged = connection.execute(
            "SELECT place, starts_at, expected_return_at FROM outings WHERE id = ?",
            (outing_id,),
        ).fetchone()
        connection.close()
        assert unchanged["place"] == "Women's College"
        assert unchanged["starts_at"] == "2026-09-30T09:30:00Z"
        assert unchanged["expected_return_at"] == "2026-09-30T12:00:00Z"

        near = plan(
            client,
            resident,
            {
                "destination_id": LIBRARY,
                "starts_at": "2026-09-30T08:04:00Z",
                "expected_return_at": "2026-09-30T10:00:00Z",
            },
        )
        assert near.status_code == 201
        assert near.json()["qr_visible"] is True
        near_id = near.json()["id"]
        assert_error(
            change(
                client,
                resident,
                near_id,
                {
                    "destination_id": SHAMSHAD,
                    "starts_at": "2026-09-30T08:20:00Z",
                    "expected_return_at": "2026-09-30T10:30:00Z",
                },
            ),
            409,
            "outing_window_open",
            "You cannot change this outing while its window is open.",
        )
        kept = change(
            client,
            resident,
            outing_id,
            {
                "destination_id": LIBRARY,
                "starts_at": "2026-09-30T09:45:00Z",
                "expected_return_at": "2026-09-30T12:30:00Z",
            },
        )
        assert kept.status_code == 200
        assert kept.json()["place"] == "Maulana Azad Library"
        assert kept.json()["starts_at"] == "2026-09-30T09:45:00Z"
        assert kept.json()["expected_return_at"] == "2026-09-30T12:30:00Z"

        connection = sqlite3.connect(database_path)
        try:
            connection.execute(
                """
                INSERT INTO outings (
                  id, resident_id, permission_id, type, status, destination_id, place,
                  expected_return_at, grace_ends_at, exited_at, exit_recorded_by,
                  returned_at, return_recorded_by, created_at, updated_at, cancelled_at, hall_date
                ) VALUES (
                  ?, ?, NULL, 'ordinary', 'outside', ?, 'Shamshad Market',
                  '2026-09-30T12:00:00Z', '2026-09-30T13:30:00Z', '2026-09-30T07:00:00Z', ?,
                  NULL, NULL, '2026-09-30T06:30:00Z', '2026-09-30T07:00:00Z', NULL, '2026-09-30'
                )
                """,
                (OUTSIDE_ID, RESIDENT_ID, LIBRARY, GATE_ID),
            )
            connection.execute(
                "UPDATE residents SET presence = 'outside', updated_at = '2026-09-30T07:00:00Z' WHERE user_id = ?",
                (RESIDENT_ID,),
            )
            connection.commit()
        finally:
            connection.close()
        assert_error(
            change(
                client,
                resident,
                OUTSIDE_ID,
                {
                    "destination_id": LIBRARY,
                    "starts_at": "2026-09-30T09:00:00Z",
                    "expected_return_at": "2026-09-30T11:00:00Z",
                },
            ),
            409,
            "already_outside",
            "You are already outside.",
        )
