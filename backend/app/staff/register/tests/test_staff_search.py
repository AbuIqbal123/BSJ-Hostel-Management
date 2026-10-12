"""Staff search and sort: permissions, guest stays, and the register."""

from __future__ import annotations

import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.dev_seed import WARDEN_PHRASE
from app.staff.register.tests.staff_desk_records import (
    STAY_A,
    STAY_B,
    store_guest_stays,
    store_outings,
)
from app.staff.register.tests.test_permission_queue import (
    AISHA_ID,
    BLOCK_A,
    PERM_HOME_A,
    PERM_HOME_B,
    PERM_LATE_A,
    PERM_LATE_B,
    ZARA_ID,
    FrozenClock,
    auth,
    issue_people,
    sign_in,
    store_pending_permissions,
)

ARTIFACT = Path(__file__).resolve().parent / "artifacts" / "staff-search.json"


def test_staff_search_and_sort(database_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    from app.shared import clock
    from app.shared.migrate import migrate

    monkeypatch.setattr(clock, "utc_now", FrozenClock().utc_now)
    migrate()

    from app.main import app

    with TestClient(app) as client:
        issue_people(database_path)
        store_pending_permissions(database_path)
        store_guest_stays(database_path)
        store_outings(database_path)
        warden = sign_in(client, "warden.sara", WARDEN_PHRASE)

        def ids(path: str, **params) -> list[str]:
            response = client.get(path, params=params, headers=auth(warden))
            assert response.status_code == 200, response.text
            body = response.json()
            assert body["total"] == len(body["items"])
            return [item["id"] for item in body["items"]]

        got = {
            "permissions_q_name": ids("/api/v1/permissions", q="zara"),
            "permissions_q_room": ids("/api/v1/permissions", q="b-20"),
            "permissions_departure": ids("/api/v1/permissions", order="departure"),
            "permissions_q_percent": ids("/api/v1/permissions", q="' OR 1=1 --"),
            "guests_q_guest": ids("/api/v1/guest-stays", q="noor"),
            "guests_q_host": ids("/api/v1/guest-stays", q="Zara"),
            "guests_block_a": ids("/api/v1/guest-stays", block_id=BLOCK_A),
            "register_out": ids("/api/v1/register/residents", state="out"),
            "register_back_by": ids("/api/v1/register/residents", order="back_by"),
        }
        expected = {
            "permissions_q_name": [PERM_HOME_A, PERM_LATE_A],
            "permissions_q_room": [PERM_HOME_B, PERM_LATE_B],
            "permissions_departure": [PERM_LATE_B, PERM_LATE_A, PERM_HOME_B, PERM_HOME_A],
            "permissions_q_percent": [],
            "guests_q_guest": [STAY_B],
            "guests_q_host": [STAY_A],
            "guests_block_a": [STAY_A],
            "register_out": [AISHA_ID],
            "register_back_by": [AISHA_ID, ZARA_ID],
        }
        rows = client.get(
            "/api/v1/register/residents", params={"state": "out"}, headers=auth(warden)
        ).json()["items"]
        assert [(row["outing_type"], row["state"]) for row in rows] == [("ordinary", "late")]
        assert rows[0]["block_name"]
        assert got == expected
        assert client.get(
            "/api/v1/permissions", params={"q": "x" * 81}, headers=auth(warden)
        ).status_code == 422

    ARTIFACT.write_text(json.dumps(expected, indent=2) + "\n", encoding="utf-8")
    assert json.loads(ARTIFACT.read_text(encoding="utf-8")) == expected
