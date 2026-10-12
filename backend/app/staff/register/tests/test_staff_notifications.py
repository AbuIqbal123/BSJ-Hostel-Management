"""Warden inbox: requests and late outings, one read call, unread on the summary."""

from __future__ import annotations

import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.dev_seed import GATE_PHRASE, PROVOST_PHRASE, WARDEN_PHRASE
from app.staff.register.tests.staff_desk_records import (
    OUT_LATE_NOW,
    OUT_LATE_PAST,
    STAY_A,
    STAY_B,
    store_guest_stays,
    store_outings,
)
from app.staff.register.tests.test_permission_queue import (
    PERM_HOME_A,
    PERM_HOME_B,
    PERM_LATE_A,
    PERM_LATE_B,
    FrozenClock,
    auth,
    issue_people,
    sign_in,
    store_pending_permissions,
)
from app.staff.register.tests.staff_desk_records import PERM_USED

ARTIFACT = Path(__file__).resolve().parent / "artifacts" / "staff-notifications.json"


def brief(body: dict) -> list[list]:
    return [
        [item["kind"], item["record_id"], item["resident_name"], item["occurred_at"], item["unread"]]
        for item in body["items"]
    ]


def test_staff_notifications(database_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    from app.shared import clock
    from app.shared.migrate import migrate

    monkeypatch.setattr(clock, "utc_now", FrozenClock().utc_now)
    migrate()

    from app.main import app

    with TestClient(app) as client:
        issue_people(database_path)
        store_pending_permissions(database_path)
        store_outings(database_path)
        store_guest_stays(database_path)

        gate = sign_in(client, "gate.fatima", GATE_PHRASE)
        assert client.get("/api/v1/register/notifications", headers=auth(gate)).status_code == 403
        assert (
            client.post("/api/v1/register/notifications/read", headers=auth(gate)).status_code
            == 403
        )
        warden = sign_in(client, "warden.sara", WARDEN_PHRASE)
        provost = sign_in(client, "provost.halima", PROVOST_PHRASE)

        summary = client.get("/api/v1/register/summary", headers=auth(warden)).json()
        assert summary["notifications_unread"] is True

        listed = client.get("/api/v1/register/notifications", headers=auth(warden))
        assert listed.status_code == 200
        first = listed.json()
        sample = first["items"][0]
        assert set(sample) == {
            "kind", "record_id", "resident_name", "room_label", "occurred_at", "unread",
        }
        expected_before = [
            ["permission_requested", PERM_HOME_A, "Zara Ahmed", "2026-09-30T12:30:00Z", True],
            ["resident_late", OUT_LATE_NOW, "Aisha Khan", "2026-09-30T12:15:00Z", True],
            ["permission_requested", PERM_LATE_A, "Zara Ahmed", "2026-09-30T12:00:00Z", True],
            ["permission_requested", PERM_HOME_B, "Aisha Khan", "2026-09-30T11:00:00Z", True],
            ["permission_requested", PERM_LATE_B, "Aisha Khan", "2026-09-30T10:00:00Z", True],
            ["guest_stay_requested", STAY_B, "Aisha Khan", "2026-09-30T09:30:00Z", True],
            ["guest_stay_requested", STAY_A, "Zara Ahmed", "2026-09-30T08:30:00Z", True],
            ["resident_late", OUT_LATE_PAST, "Zara Ahmed", "2026-09-29T16:15:00Z", True],
            ["permission_requested", PERM_USED, "Zara Ahmed", "2026-09-28T09:00:00Z", True],
        ]
        assert brief(first) == expected_before

        marked = client.post("/api/v1/register/notifications/read", headers=auth(warden))
        assert marked.status_code == 200
        assert marked.json() == {"marked": 9}

        after = client.get("/api/v1/register/notifications", headers=auth(warden)).json()
        assert all(item["unread"] is False for item in after["items"])
        assert client.get("/api/v1/register/summary", headers=auth(warden)).json()[
            "notifications_unread"
        ] is False
        again = client.post("/api/v1/register/notifications/read", headers=auth(warden))
        assert again.json() == {"marked": 0}

        # Each staff member reads her own inbox.
        assert client.get("/api/v1/register/summary", headers=auth(provost)).json()[
            "notifications_unread"
        ] is True

    expected = {"before": expected_before, "marked": 9}
    ARTIFACT.write_text(json.dumps(expected, indent=2) + "\n", encoding="utf-8")
    assert json.loads(ARTIFACT.read_text(encoding="utf-8")) == expected
