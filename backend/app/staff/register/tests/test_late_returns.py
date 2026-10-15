"""Warden late-returns record: current and past late returns with filters."""

from __future__ import annotations

import json
import sqlite3
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.shared.testing_env import role_credential
from app.staff.register.tests.staff_desk_records import (
    OUT_LATE_NOW,
    OUT_LATE_PAST,
    store_outings,
)
from app.staff.register.tests.test_permission_queue import (
    AISHA_ID,
    BLOCK_A,
    BLOCK_B,
    ZARA_ID,
    FrozenClock,
    auth,
    issue_people,
    sign_in,
)

ARTIFACT = Path(__file__).resolve().parent / "artifacts" / "late-returns.json"
PATH = "/api/v1/register/late-returns"


def block_names(path: Path) -> dict[str, str]:
    connection = sqlite3.connect(path)
    try:
        return dict(connection.execute("SELECT id, name FROM blocks").fetchall())
    finally:
        connection.close()


def test_late_returns_record(database_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    from app.shared import clock
    from app.shared.migrate import migrate

    monkeypatch.setattr(clock, "utc_now", FrozenClock().utc_now)
    migrate()

    from app.main import app

    with TestClient(app) as client:
        issue_people(database_path)
        store_outings(database_path)
        names = block_names(database_path)
        now_row = {
            "id": OUT_LATE_NOW,
            "resident_id": AISHA_ID,
            "resident_name": "Aisha Khan",
            "room_label": "B-204",
            "block_id": BLOCK_B,
            "block_name": names[BLOCK_B],
            "source": "ordinary",
            "due_at": "2026-09-30T12:00:00Z",
            "returned_at": None,
            "minutes_late": 60,
        }
        past_row = {
            "id": OUT_LATE_PAST,
            "resident_id": ZARA_ID,
            "resident_name": "Zara Ahmed",
            "room_label": "A-101",
            "block_id": BLOCK_A,
            "block_name": names[BLOCK_A],
            "source": "late_night",
            "due_at": "2026-09-29T16:00:00Z",
            "returned_at": "2026-09-29T16:45:00Z",
            "minutes_late": 45,
        }

        gate = sign_in(client, "gate.fatima", role_credential("gate"))
        assert client.get(PATH, headers=auth(gate)).status_code == 403
        warden = sign_in(client, "warden.sara", role_credential("warden"))
        provost = sign_in(client, "provost.halima", role_credential("provost"))

        def page(token: str, **params) -> dict:
            response = client.get(PATH, params=params, headers=auth(token))
            assert response.status_code == 200, response.text
            return response.json()

        expected = {
            "all": {"total": 2, "limit": 50, "offset": 0, "items": [now_row, past_row]},
            "now": {"total": 1, "limit": 50, "offset": 0, "items": [now_row]},
            "past": {"total": 1, "limit": 50, "offset": 0, "items": [past_row]},
            "late_night": {"total": 1, "limit": 50, "offset": 0, "items": [past_row]},
            "on_30th": {"total": 1, "limit": 50, "offset": 0, "items": [now_row]},
            "second_page": {"total": 2, "limit": 1, "offset": 1, "items": [past_row]},
        }
        got = {
            "all": page(warden),
            "now": page(warden, state="now"),
            "past": page(provost, state="past"),
            "late_night": page(warden, source="late_night"),
            "on_30th": page(warden, **{"from": "2026-09-30", "to": "2026-09-30"}),
            "second_page": page(warden, limit=1, offset=1),
        }
        assert got == expected

        backwards = client.get(
            PATH, params={"from": "2026-09-30", "to": "2026-09-29"}, headers=auth(warden)
        )
        assert backwards.status_code == 422
        assert backwards.json()["error"]["code"] == "validation_error"
        assert client.get(PATH, params={"source": "guest"}, headers=auth(warden)).status_code == 422

    ARTIFACT.write_text(json.dumps(expected, indent=2) + "\n", encoding="utf-8")
    assert json.loads(ARTIFACT.read_text(encoding="utf-8")) == expected
