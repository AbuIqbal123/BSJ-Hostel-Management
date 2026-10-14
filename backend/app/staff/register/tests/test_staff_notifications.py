"""Warden inbox: requests and late outings, one read call, unread on the summary."""

from __future__ import annotations

import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.dev_seed import GATE_PHRASE, PROVOST_PHRASE, WARDEN_PHRASE, joined
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
        [
            item["kind"], item["record_id"], item["resident_name"], item["occurred_at"],
            item["read_at"], item["needs_action"], item["outcome"], item["decided_by_name"],
        ]
        for item in body["items"]
    ]


def walk(client: TestClient, token: str, query: str) -> list[dict]:
    items: list[dict] = []
    cursor = None
    while True:
        url = f"/api/v1/register/notifications?{query}" + (f"&cursor={cursor}" if cursor else "")
        page = client.get(url, headers=auth(token)).json()
        items.extend(page["items"])
        cursor = page["next_cursor"]
        if cursor is None:
            return items


START = "2026-09-30T00:00:00Z"  # the staff accounts were created then


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
        assert summary["notifications_unread_count"] == 7

        listed = client.get("/api/v1/register/notifications", headers=auth(warden))
        assert listed.status_code == 200
        first = listed.json()
        assert first["next_cursor"] is None
        assert set(first["items"][0]) == {
            "id", "kind", "record_id", "resident_id", "resident_name", "room_label",
            "block_name", "occurred_at", "read_at", "unread", "needs_action", "outcome",
            "decided_at", "decided_by_name",
        }
        assert first["items"][0]["id"] == f"permission_requested:{PERM_HOME_A}"
        expected_before = [
            ["permission_requested", PERM_HOME_A, "Zara Ahmed", "2026-09-30T12:30:00Z", None, True, None, None],
            ["resident_late", OUT_LATE_NOW, "Aisha Khan", "2026-09-30T12:15:00Z", None, True, None, None],
            ["permission_requested", PERM_LATE_A, "Zara Ahmed", "2026-09-30T12:00:00Z", None, True, None, None],
            ["permission_requested", PERM_HOME_B, "Aisha Khan", "2026-09-30T11:00:00Z", None, True, None, None],
            ["permission_requested", PERM_LATE_B, "Aisha Khan", "2026-09-30T10:00:00Z", None, True, None, None],
            ["guest_stay_requested", STAY_B, "Aisha Khan", "2026-09-30T09:30:00Z", None, True, None, None],
            ["guest_stay_requested", STAY_A, "Zara Ahmed", "2026-09-30T08:30:00Z", None, True, None, None],
            # Before her account: read from the start. Decided items keep their outcome.
            ["resident_late", OUT_LATE_PAST, "Zara Ahmed", "2026-09-29T16:15:00Z", START, False, "returned", "Fatima Khan"],
            ["permission_requested", PERM_USED, "Zara Ahmed", "2026-09-28T09:00:00Z", START, False, "approved", "Sara Malik"],
        ]
        assert brief(first) == expected_before

        # Pages of three walk the same list; a bad cursor is refused.
        assert walk(client, warden, "limit=3") == first["items"]
        assert client.get(
            "/api/v1/register/notifications?cursor=nope", headers=auth(warden)
        ).status_code == 422

        # Filters.
        def ids(query: str) -> list[str]:
            return [item["record_id"] for item in walk(client, warden, query)]

        assert ids("filter=unread") == [row[1] for row in expected_before[:7]]
        assert ids("filter=needs_action") == [row[1] for row in expected_before[:7]]
        assert ids("q=b-204") == [OUT_LATE_NOW, PERM_HOME_B, PERM_LATE_B, STAY_B]
        assert ids("q=zara&from=2026-09-29&to=2026-09-29") == [OUT_LATE_PAST]

        # A decision shows on the event; it no longer needs action.
        decided = client.post(
            f"/api/v1/permissions/{PERM_HOME_A}/decision",
            headers=auth(provost),
            json={"decision": "rejected"},
        )
        assert decided.status_code == 200
        top = client.get("/api/v1/register/notifications?limit=1", headers=auth(warden)).json()
        assert top["items"][0]["outcome"] == "declined"
        assert top["items"][0]["decided_by_name"] == "Halima Begum"
        assert top["items"][0]["decided_at"] == "2026-09-30T13:00:00Z"
        assert top["items"][0]["needs_action"] is False
        assert top["next_cursor"] is not None

        # One by one.
        one = client.post(
            f"/api/v1/register/notifications/resident_late:{OUT_LATE_NOW}/read",
            headers=auth(warden),
        )
        assert one.json() == {"unread_count": 6}
        again = client.post(
            f"/api/v1/register/notifications/resident_late:{OUT_LATE_NOW}/read",
            headers=auth(warden),
        )
        assert again.json() == {"unread_count": 6}
        assert client.post(
            f"/api/v1/register/notifications/resident_late:{PERM_HOME_A}/read",
            headers=auth(warden),
        ).status_code == 404

        # Mark up to the page she saw: newer events stay unread.
        up_to = client.post(
            "/api/v1/register/notifications/read",
            headers=auth(warden),
            json={"up_to": "2026-09-30T11:00:00Z"},
        )
        assert up_to.json() == {"marked": 4, "unread_count": 2}

        marked = client.post("/api/v1/register/notifications/read", headers=auth(warden))
        assert marked.status_code == 200
        assert marked.json() == {"marked": 2, "unread_count": 0}

        after = client.get("/api/v1/register/notifications", headers=auth(warden)).json()
        assert all(item["unread"] is False for item in after["items"])
        summary = client.get("/api/v1/register/summary", headers=auth(warden)).json()
        assert summary["notifications_unread"] is False
        assert summary["notifications_unread_count"] == 0
        assert client.post(
            "/api/v1/register/notifications/read", headers=auth(warden)
        ).json() == {"marked": 0, "unread_count": 0}

        # Each staff member reads her own inbox.
        assert client.get("/api/v1/register/summary", headers=auth(provost)).json()[
            "notifications_unread_count"
        ] == 7

    expected = {"before": expected_before, "marked": [4, 2]}
    ARTIFACT.write_text(json.dumps(expected, indent=2) + "\n", encoding="utf-8")
    assert json.loads(ARTIFACT.read_text(encoding="utf-8")) == expected


def test_new_staff_inbox_starts_read(database_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    """A warden created today does not inherit the hall's past events as unread."""
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
        provost = sign_in(client, "provost.halima", PROVOST_PHRASE)
        first_phrase = joined("Nadia", "desk", "41")
        created = client.post(
            "/api/v1/admin/staff",
            headers=auth(provost),
            json={
                "full_name": "Nadia Rahman",
                "username": "warden.nadia",
                "role": "warden",
                "job_title": "Warden",
                "temporary_password": first_phrase,
            },
        )
        assert created.status_code == 201
        nadia = sign_in(client, "warden.nadia", first_phrase)
        summary = client.get("/api/v1/register/summary", headers=auth(nadia)).json()
        assert summary["notifications_unread"] is False
        listed = client.get("/api/v1/register/notifications", headers=auth(nadia)).json()
        assert listed["items"]
        assert all(item["unread"] is False for item in listed["items"])
