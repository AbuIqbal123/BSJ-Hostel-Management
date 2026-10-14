"""Push tokens, the pushes each event sends, and her inbox rows that go with them.

The mock driver records each message it would send (push.SENT); nothing
reaches Expo. The Expo ticket handling is checked in isolation below.
"""

from __future__ import annotations

import json
from pathlib import Path

import httpx
import pytest
from fastapi.testclient import TestClient

from app.dev_seed import GATE_PHRASE, PROVOST_PHRASE, RESIDENT_PHRASE, WARDEN_PHRASE
from app.staff.register.tests.staff_desk_records import (
    OUT_LATE_NOW,
    STAY_B,
    store_guest_stays,
    store_outings,
)
from app.staff.register.tests.test_permission_queue import (
    AISHA_ID,
    FrozenClock,
    auth,
    issue_people,
    sign_in,
)

ARTIFACT = Path(__file__).resolve().parent / "artifacts" / "push-messages.json"
TOKEN = {
    "warden": "ExponentPushToken[warden-phone]",
    "provost": "ExponentPushToken[provost-phone]",
    "aisha": "ExponentPushToken[aisha-phone]",
    "gate": "ExpoPushToken[gate-phone]",
}


def brief(messages: list[dict]) -> list[list]:
    return [[m["to"], m["title"], m["badge"], m["data"]] for m in messages]


def test_push_tokens_and_messages(database_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    from app.shared import clock, push
    from app.shared.migrate import migrate

    monkeypatch.setattr(clock, "utc_now", FrozenClock().utc_now)
    push.SENT.clear()
    migrate()

    from app.main import app

    with TestClient(app) as client:
        issue_people(database_path)
        store_outings(database_path)
        store_guest_stays(database_path)
        warden = sign_in(client, "warden.sara", WARDEN_PHRASE)
        provost = sign_in(client, "provost.halima", PROVOST_PHRASE)
        gate = sign_in(client, "gate.fatima", GATE_PHRASE)
        aisha = sign_in(client, "24-GLLB-118", RESIDENT_PHRASE)
        url = "/api/v1/devices/push-token"

        assert client.post(url, json={"token": TOKEN["aisha"], "platform": "ios"}).status_code == 401
        for bad in ("not-a-token", "ExponentPushToken[]", "ExponentPushToken[a b]"):
            refused = client.post(url, headers=auth(aisha), json={"token": bad, "platform": "ios"})
            assert refused.status_code == 422
        assert client.post(
            url, headers=auth(aisha), json={"token": TOKEN["aisha"], "platform": "windows"}
        ).status_code == 422

        # The phone was the warden's; Aisha signs in on it and the token moves.
        for token, who, platform in (
            (TOKEN["aisha"], warden, "android"),
            (TOKEN["aisha"], aisha, "ios"),
            (TOKEN["aisha"], aisha, "ios"),
            (TOKEN["warden"], warden, "android"),
            (TOKEN["provost"], provost, "ios"),
            (TOKEN["gate"], gate, "android"),
        ):
            done = client.post(url, headers=auth(who), json={"token": token, "platform": platform})
            assert done.status_code == 204
        # Someone else cannot delete her token.
        assert client.request(
            "DELETE", url, headers=auth(warden), json={"token": TOKEN["aisha"]}
        ).status_code == 204

        # Opening the register finds Aisha late: her row, her push, and staff pushes, once.
        assert client.get("/api/v1/register/summary", headers=auth(warden)).status_code == 200
        late = list(push.SENT)
        push.SENT.clear()
        assert client.get("/api/v1/register/summary", headers=auth(provost)).status_code == 200
        assert push.SENT == []

        inbox = client.get("/api/v1/me/notifications", headers=auth(aisha)).json()
        late_row = inbox["items"][0]
        assert late_row["kind"] == "resident_late"
        assert late_row["record_id"] == OUT_LATE_NOW
        assert late_row["needs_action"] is True
        assert late_row["outcome"] is None
        assert late_row["occurred_at"] == "2026-09-30T12:15:00Z"

        # The warden declines her guest stay.
        decided = client.post(
            f"/api/v1/guest-stays/{STAY_B}/decision",
            headers=auth(warden),
            json={"decision": "rejected"},
        )
        assert decided.status_code == 200
        stay = list(push.SENT)
        push.SENT.clear()

        # She asks for a permission: wardens and the provost hear of it.
        asked = client.post(
            "/api/v1/me/permissions",
            headers=auth(aisha),
            json={
                "permission_type": "late_night",
                "short_place": "Women's College",
                "reason": "Seminar.",
                "departure_at": "2026-10-01T14:00:00Z",
                "expected_return_at": "2026-10-01T18:00:00Z",
            },
        )
        assert asked.status_code == 201, asked.text
        permission_id = asked.json()["id"]
        requested = list(push.SENT)
        push.SENT.clear()

        # Gate records her return: the late row shows it.
        returned = client.post(
            "/api/v1/gate/scans", headers=auth(gate), json={"qr_payload": "bsj:v1:test-aisha"}
        )
        assert returned.status_code == 200, returned.text
        assert push.SENT == []
        items = client.get("/api/v1/me/notifications", headers=auth(aisha)).json()["items"]
        by_kind = {item["kind"]: item for item in items}
        assert by_kind["resident_late"]["outcome"] == "returned"
        assert by_kind["resident_late"]["needs_action"] is False
        assert by_kind["resident_late"]["decided_by_name"] == "Fatima Khan"
        assert by_kind["guest_stay_decided"]["outcome"] == "declined"
        assert by_kind["guest_stay_decided"]["decided_by_name"] == "Sara Malik"
        assert by_kind["guest_stay_decided"]["guest_name"]
        home = client.get("/api/v1/me/home", headers=auth(aisha)).json()
        assert home["notifications_unread_count"] == 2
        assert client.get(
            "/api/v1/me/notifications?filter=needs_action", headers=auth(aisha)
        ).json()["items"] == []

        # Per item, and a row that is not hers.
        read_one = client.post(
            f"/api/v1/me/notifications/{by_kind['resident_late']['id']}/read", headers=auth(aisha)
        )
        assert read_one.json() == {"unread_count": 1}
        assert client.post(
            "/api/v1/me/notifications/00000000-0000-4000-8000-000000000000/read",
            headers=auth(aisha),
        ).status_code == 404

        # Sign-out removes her token; nothing more goes to that phone.
        assert client.request(
            "DELETE", url, headers=auth(aisha), json={"token": TOKEN["aisha"]}
        ).status_code == 204
        client.post(
            f"/api/v1/permissions/{permission_id}/decision",
            headers=auth(warden),
            json={"decision": "approved"},
        )
        assert push.SENT == []

    notification_id = late_row["id"]
    stay_note = by_kind["guest_stay_decided"]["id"]
    staff_late = {
        "notification_id": f"resident_late:{OUT_LATE_NOW}",
        "kind": "resident_late",
        "record_id": OUT_LATE_NOW,
        "resident_id": AISHA_ID,
    }
    asked_data = {
        "notification_id": f"permission_requested:{permission_id}",
        "kind": "permission_requested",
        "record_id": permission_id,
        "resident_id": AISHA_ID,
    }
    assert sorted(brief(late), key=str) == sorted(
        [
            [TOKEN["aisha"], "You are late", 1, {**staff_late, "notification_id": notification_id}],
            [TOKEN["warden"], "Resident late", 3, staff_late],
            [TOKEN["provost"], "Resident late", 3, staff_late],
        ],
        key=str,
    )
    assert brief(stay) == [
        [
            TOKEN["aisha"],
            "Guest stay for Noor Khan declined",
            2,
            {
                "notification_id": stay_note,
                "kind": "guest_stay_decided",
                "record_id": STAY_B,
                "resident_id": AISHA_ID,
            },
        ]
    ]
    assert sorted(brief(requested), key=str) == sorted(
        [
            [TOKEN["warden"], "New request", 4, asked_data],
            [TOKEN["provost"], "New request", 4, asked_data],
        ],
        key=str,
    )
    expected = {"late": brief(late), "stay": brief(stay), "requested": brief(requested)}
    text = json.dumps(expected, indent=2, sort_keys=True) + "\n"
    # Her inbox row ids and the permission id are new each run.
    for varying in (notification_id, stay_note, permission_id):
        text = text.replace(varying, "<generated id>")
    ARTIFACT.parent.mkdir(exist_ok=True)
    ARTIFACT.write_text(text, encoding="utf-8")
    assert ARTIFACT.read_text(encoding="utf-8") == text


# Isolated: the Expo HTTP API. Failure cases first (docs/tests/tests.md).
EXPO_TICKETS = {
    "data": [
        {"status": "ok", "id": "XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX"},
        {
            "status": "error",
            "message": '"ExponentPushToken[gone]" is not a registered push notification recipient',
            "details": {"error": "DeviceNotRegistered"},
        },
        {"status": "error", "message": "Too big", "details": {"error": "MessageTooBig"}},
    ]
}


def _messages() -> list[dict]:
    return [
        {"to": f"ExponentPushToken[{name}]", "title": "t", "body": "b", "data": {}}
        for name in ("ok", "gone", "big")
    ]


def test_expo_tickets_name_dead_tokens() -> None:
    from app.shared.push import EXPO_PUSH_URL, send_expo

    seen: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        return httpx.Response(200, json=EXPO_TICKETS)

    with httpx.Client(transport=httpx.MockTransport(handler)) as client:
        assert send_expo(client, _messages()) == ["ExponentPushToken[gone]"]
    assert str(seen[0].url) == EXPO_PUSH_URL


@pytest.mark.parametrize(
    "failure",
    [
        lambda request: httpx.Response(500, text="oops"),
        lambda request: httpx.Response(200, text="not json"),
        lambda request: (_ for _ in ()).throw(httpx.ReadTimeout("slow", request=request)),
    ],
)
def test_expo_failure_never_raises(failure) -> None:
    from app.shared.push import send_expo

    with httpx.Client(transport=httpx.MockTransport(failure)) as client:
        assert send_expo(client, _messages()) == []


def test_expo_driver_refused_outside_production(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.shared.config import Settings
    from app.shared.testing_env import signing_key_for_tests

    monkeypatch.setenv("APP_SECRET_KEY", signing_key_for_tests())
    with pytest.raises(RuntimeError, match="PUSH_DRIVER must be mock"):
        Settings(environment="development", push_driver="expo").reject_unsafe_push()
    Settings(environment="production", push_driver="expo").reject_unsafe_push()
