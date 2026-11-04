"""A roommate lists stays awaiting her and records her yes or no."""

from __future__ import annotations

import json
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.shared.testing_env import role_credential

ARTIFACT = Path(__file__).resolve().parent / "artifacts" / "guest-stay-roommate-decide.json"
BLOCK_B = "d032aad6-a203-5ea0-ba9a-3a9257edbfc8"
GATE_ID = "a11ce000-0000-4000-8000-000000000001"
PROVOST_ID = "f66fb000-0000-4000-8000-000000000006"
HOST_ID = "b22de000-0000-4000-8000-000000000002"
ROOMMATE_ID = "b22de000-0000-4000-8000-000000000012"
SUSPENDED_ID = "b22de000-0000-4000-8000-000000000013"
OTHER_ID = "c44ef000-0000-4000-8000-000000000009"
ROOM_ID = "d4400000-0000-4000-8000-000000000004"
OTHER_ROOM = "d4400000-0000-4000-8000-000000000005"
SPARE_ROOM = "d4400000-0000-4000-8000-000000000006"
CREATED = "2026-09-30T00:00:00Z"
NOW = "2026-09-30T13:00:00Z"

NEWEST = "bb200000-0000-4000-8000-0000000000c1"
PROVOST_FIRST = "bb200000-0000-4000-8000-0000000000c2"
REJECT_STAY = "bb200000-0000-4000-8000-0000000000c3"
SOLO = "bb200000-0000-4000-8000-0000000000c4"
ALREADY = "bb200000-0000-4000-8000-0000000000c5"
MISSING = "bb200000-0000-4000-8000-000000000099"
TOKEN = "ExponentPushToken[zaynab-phone]"

SUMMARY_KEYS = {
    "id",
    "guest_name",
    "host_name",
    "host_room_label",
    "guest_start_date",
    "guest_end_date",
    "status",
    "payment_status",
    "bucket",
}


class FrozenClock:
    def utc_now(self) -> datetime:
        return datetime(2026, 9, 30, 13, 0, tzinfo=timezone.utc)


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


def auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def issue_people(path: Path) -> None:
    from app.shared.auth.security import hash_password

    connection = sqlite3.connect(path)
    try:
        connection.execute("PRAGMA foreign_keys=ON;")
        connection.execute(
            """
            INSERT INTO rooms (id, block_id, number, label, bed_count, is_active)
            VALUES
              (?, ?, '204', 'B-204', 3, 1),
              (?, ?, '205', 'B-205', 2, 1),
              (?, ?, '206', 'B-206', 2, 1)
            """,
            (ROOM_ID, BLOCK_B, OTHER_ROOM, BLOCK_B, SPARE_ROOM, BLOCK_B),
        )
        people = (
            (GATE_ID, "gate", "gate.fatima", "Fatima Khan", role_credential("gate"), "active"),
            (PROVOST_ID, "provost", "provost.halima", "Halima Begum", role_credential("provost"), "active"),
            (HOST_ID, "resident", "24-GLLB-118", "Aisha Khan", role_credential("resident"), "active"),
            (ROOMMATE_ID, "resident", "24-BA-014", "Zaynab Ali", role_credential("roommate"), "active"),
            (SUSPENDED_ID, "resident", "24-BA-015", "Hiba Noor", role_credential("suspended"), "suspended"),
            (OTHER_ID, "resident", "24-BA-002", "Maryam Siddiqui", role_credential("resident-20"), "active"),
        )
        for user_id, role, username, full_name, password, status in people:
            connection.execute(
                """
                INSERT INTO users (
                  id, role, username, full_name, password_hash, status, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    user_id,
                    role,
                    username,
                    full_name,
                    hash_password(password),
                    status,
                    CREATED,
                    CREATED,
                ),
            )
        connection.execute(
            "INSERT INTO staff (user_id, job_title) VALUES (?, 'Gatekeeper')",
            (GATE_ID,),
        )
        connection.execute(
            "INSERT INTO staff (user_id, job_title) VALUES (?, 'Provost')",
            (PROVOST_ID,),
        )
        residents = (
            (HOST_ID, "24-GLLB-118", ROOM_ID, "Rashid Khan", "+919876543210", "bsj:v1:test-aisha-room"),
            (ROOMMATE_ID, "24-BA-014", ROOM_ID, "Imran Ali", "+919876543212", "bsj:v1:test-zaynab-room"),
            (SUSPENDED_ID, "24-BA-015", ROOM_ID, "Farhan Noor", "+919876543213", "bsj:v1:test-hiba-room"),
            (OTHER_ID, "24-BA-002", OTHER_ROOM, "Yusuf Siddiqui", "+919876543211", "bsj:v1:test-maryam-room"),
        )
        for user_id, enrolment, room_id, guardian, phone, token in residents:
            connection.execute(
                """
                INSERT INTO residents (
                  user_id, enrolment_number, course, room_id, guardian_name, guardian_phone,
                  qr_token, presence, created_at, updated_at
                ) VALUES (?, ?, 'B.A.', ?, ?, ?, ?, 'inside', ?, ?)
                """,
                (user_id, enrolment, room_id, guardian, phone, token, CREATED, CREATED),
            )
        connection.commit()
    finally:
        connection.close()


def insert_stay(
    path: Path,
    stay_id: str,
    host_id: str,
    guest_name: str,
    created_at: str,
    *,
    status: str = "pending",
    decided_by: str | None = None,
    decided_at: str | None = None,
) -> None:
    connection = sqlite3.connect(path)
    try:
        connection.execute("PRAGMA foreign_keys=ON;")
        connection.execute(
            """
            INSERT INTO guest_stays (
              id, host_resident_id, guest_name, relation, guest_start_date, guest_end_date, reason,
              status, payment_status, decided_by, decided_at, created_at, updated_at
            ) VALUES (
              ?, ?, ?, 'Cousin', '2026-10-12', '2026-10-14', 'Family visit.',
              ?, 'unpaid', ?, ?, ?, ?
            )
            """,
            (stay_id, host_id, guest_name, status, decided_by, decided_at, created_at, created_at),
        )
        connection.commit()
    finally:
        connection.close()


def decision_rows(path: Path, stay_id: str) -> list[dict[str, str | None]]:
    connection = sqlite3.connect(path)
    connection.row_factory = sqlite3.Row
    try:
        rows = connection.execute(
            """
            SELECT actor_user_id, role, decision, note, decided_at
            FROM guest_stay_decisions
            WHERE guest_stay_id = ?
            ORDER BY decided_at, role, actor_user_id
            """,
            (stay_id,),
        ).fetchall()
        return [dict(row) for row in rows]
    finally:
        connection.close()


def notices(path: Path, stay_id: str) -> list[list[str]]:
    connection = sqlite3.connect(path)
    try:
        return [
            [row[0], row[1], row[2]]
            for row in connection.execute(
                """
                SELECT resident_id, kind, decision
                FROM resident_notifications
                WHERE record_id = ?
                ORDER BY created_at, resident_id
                """,
                (stay_id,),
            )
        ]
    finally:
        connection.close()


def audit_actions(path: Path, stay_id: str) -> list[str]:
    connection = sqlite3.connect(path)
    try:
        return [
            row[0]
            for row in connection.execute(
                """
                SELECT action FROM audit_log
                WHERE entity_id = ?
                ORDER BY occurred_at, rowid
                """,
                (stay_id,),
            )
        ]
    finally:
        connection.close()


def move_roommate(path: Path) -> None:
    connection = sqlite3.connect(path)
    try:
        connection.execute("PRAGMA foreign_keys=ON;")
        connection.execute(
            """
            UPDATE residents
            SET room_id = ?, updated_at = ?
            WHERE user_id = ?
            """,
            (SPARE_ROOM, NOW, ROOMMATE_ID),
        )
        connection.commit()
    finally:
        connection.close()


def test_roommate_lists_and_decides(database_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    expected = json.loads(ARTIFACT.read_text(encoding="utf-8"))
    from app.main import app
    from app.shared import clock, push

    monkeypatch.setattr(clock, "utc_now", FrozenClock().utc_now)
    push.SENT.clear()
    with TestClient(app) as client:
        issue_people(database_path)
        insert_stay(database_path, NEWEST, HOST_ID, "Newest Guest", "2026-09-30T12:00:00Z")
        insert_stay(database_path, PROVOST_FIRST, HOST_ID, "Provost First", "2026-09-30T11:00:00Z")
        insert_stay(database_path, REJECT_STAY, HOST_ID, "Reject Guest", "2026-09-30T10:00:00Z")
        insert_stay(database_path, SOLO, OTHER_ID, "Solo Guest", "2026-09-30T09:00:00Z")
        insert_stay(
            database_path,
            ALREADY,
            HOST_ID,
            "Already Approved",
            "2026-09-30T08:00:00Z",
            status="approved",
            decided_by=PROVOST_ID,
            decided_at=CREATED,
        )

        waiting = "/api/v1/me/guest-stays/awaiting-my-approval"
        assert_error(client.get(waiting), 401, "unauthenticated", "Sign in again.")

        gate = sign_in(client, "gate.fatima", role_credential("gate"))
        host = sign_in(client, "24-GLLB-118", role_credential("resident"))
        roommate = sign_in(client, "24-BA-014", role_credential("roommate"))
        other = sign_in(client, "24-BA-002", role_credential("resident-20"))
        provost = sign_in(client, "provost.halima", role_credential("provost"))

        assert_error(
            client.get(waiting, headers=auth(gate)),
            403,
            "forbidden",
            "This account cannot do that.",
        )
        assert client.get(waiting, headers=auth(host)).json()["items"] == []
        assert client.get(waiting, headers=auth(other)).json()["items"] == []

        listed = client.get(waiting, headers=auth(roommate))
        assert listed.status_code == 200
        page = listed.json()
        assert page["total"] == 3
        assert page["limit"] == 50
        assert page["offset"] == 0
        assert [item["id"] for item in page["items"]] == expected["awaiting_ids"]
        for item in page["items"]:
            assert set(item) == SUMMARY_KEYS
            assert item["host_name"] == "Aisha Khan"
            assert item["host_room_label"] == "B-204"
            assert item["status"] == "pending"
            assert item["bucket"] == "pending"
        first = client.get(f"{waiting}?limit=1&offset=0", headers=auth(roommate))
        assert first.status_code == 200
        assert first.json()["total"] == 3
        assert [item["id"] for item in first.json()["items"]] == [NEWEST]
        second = client.get(f"{waiting}?limit=1&offset=1", headers=auth(roommate))
        assert [item["id"] for item in second.json()["items"]] == [PROVOST_FIRST]

        decide = f"/api/v1/me/guest-stays/{SOLO}/roommate-decision"
        assert_error(
            client.post(decide, headers=auth(gate), json={"decision": "approved"}),
            403,
            "forbidden",
            "This account cannot do that.",
        )
        assert_error(
            client.post(decide, headers=auth(roommate), json={"decision": "approved"}),
            403,
            "forbidden",
            expected["not_roommate"],
        )
        assert_error(
            client.post(
                f"/api/v1/me/guest-stays/{MISSING}/roommate-decision",
                headers=auth(roommate),
                json={"decision": "rejected"},
            ),
            404,
            "not_found",
            "That record was not found.",
        )
        assert_error(
            client.post(
                f"/api/v1/me/guest-stays/{ALREADY}/roommate-decision",
                headers=auth(roommate),
                json={"decision": "rejected"},
            ),
            409,
            "not_pending",
            "Only a pending guest stay can be approved or rejected (current status: approved).",
        )

        waiting_yes = client.post(
            f"/api/v1/me/guest-stays/{NEWEST}/roommate-decision",
            headers=auth(roommate),
            json={"decision": "approved", "note": "Sounds fine."},
        )
        assert waiting_yes.status_code == 200
        body = waiting_yes.json()
        assert body["status"] == "pending"
        assert body["bucket"] == "pending"
        assert body["decided_by"] is None
        assert body["decision_note"] is None
        assert body["host_name"] == "Aisha Khan"
        assert body["guest_name"] == "Newest Guest"
        assert "reason" in body
        assert decision_rows(database_path, NEWEST) == [expected["approve_while_waiting"]]
        host_waiting = client.get(f"/api/v1/me/guest-stays/{NEWEST}", headers=auth(host))
        assert host_waiting.status_code == 200
        assert host_waiting.json()["decisions"] == [
            {
                "role": "roommate",
                "actor_user_id": ROOMMATE_ID,
                "actor_name": "Zaynab Ali",
                "decision": "approved",
                "decided_at": NOW,
                "note": "Sounds fine.",
            }
        ]
        assert host_waiting.json()["roommate_approval_required"] is True
        assert host_waiting.json()["waiting_on_roommate"] is False
        assert host_waiting.json()["waiting_on_provost"] is True
        assert notices(database_path, NEWEST) == []
        assert audit_actions(database_path, NEWEST) == []
        after = client.get(waiting, headers=auth(roommate)).json()
        assert [item["id"] for item in after["items"]] == [PROVOST_FIRST, REJECT_STAY]

        assert_error(
            client.post(
                f"/api/v1/me/guest-stays/{NEWEST}/roommate-decision",
                headers=auth(roommate),
                json={"decision": "rejected"},
            ),
            409,
            "already_decided",
            expected["duplicate_message"],
        )
        assert decision_rows(database_path, NEWEST) == [expected["approve_while_waiting"]]

        provost_yes = client.post(
            f"/api/v1/guest-stays/{PROVOST_FIRST}/decision",
            headers=auth(provost),
            json={"decision": "approved", "note": "Fine with me."},
        )
        assert provost_yes.status_code == 200
        assert provost_yes.json()["status"] == "pending"
        assert provost_yes.json()["decided_by"] is None
        assert notices(database_path, PROVOST_FIRST) == []

        completed = client.post(
            f"/api/v1/me/guest-stays/{PROVOST_FIRST}/roommate-decision",
            headers=auth(roommate),
            json={"decision": "approved", "note": "  "},
        )
        assert completed.status_code == 200
        done = completed.json()
        assert done["status"] == "approved"
        assert done["bucket"] == "upcoming"
        assert done["payment_status"] == "unpaid"
        assert done["decided_by"] == PROVOST_ID
        assert done["decision_note"] == "Fine with me."
        assert decision_rows(database_path, PROVOST_FIRST) == expected["approved_decisions"]
        host_approved = client.get(
            f"/api/v1/me/guest-stays/{PROVOST_FIRST}", headers=auth(host)
        )
        assert host_approved.status_code == 200
        assert host_approved.json()["decisions"] == [
            {
                "role": "provost",
                "actor_user_id": PROVOST_ID,
                "actor_name": "Halima Begum",
                "decision": "approved",
                "decided_at": NOW,
                "note": "Fine with me.",
            },
            {
                "role": "roommate",
                "actor_user_id": ROOMMATE_ID,
                "actor_name": "Zaynab Ali",
                "decision": "approved",
                "decided_at": NOW,
                "note": None,
            },
        ]
        assert host_approved.json()["roommate_approval_required"] is True
        assert host_approved.json()["waiting_on_roommate"] is False
        assert host_approved.json()["waiting_on_provost"] is False
        assert notices(database_path, PROVOST_FIRST) == [[HOST_ID, "guest_stay_decided", "approved"]]
        assert audit_actions(database_path, PROVOST_FIRST) == ["guest_stay.approved"]

        rejected = client.post(
            f"/api/v1/me/guest-stays/{REJECT_STAY}/roommate-decision",
            headers=auth(roommate),
            json={"decision": "rejected", "note": "Not this week."},
        )
        assert rejected.status_code == 200
        refused = rejected.json()
        assert refused["status"] == "rejected"
        assert refused["bucket"] == "rejected"
        assert refused["decided_by"] is None
        assert refused["decision_note"] is None
        assert decision_rows(database_path, REJECT_STAY) == [expected["rejected_decision"]]
        host_rejected = client.get(f"/api/v1/me/guest-stays/{REJECT_STAY}", headers=auth(host))
        assert host_rejected.status_code == 200
        assert host_rejected.json()["decisions"] == [
            {
                "role": "roommate",
                "actor_user_id": ROOMMATE_ID,
                "actor_name": "Zaynab Ali",
                "decision": "rejected",
                "decided_at": NOW,
                "note": "Not this week.",
            }
        ]
        assert host_rejected.json()["roommate_approval_required"] is True
        assert host_rejected.json()["waiting_on_roommate"] is False
        assert host_rejected.json()["waiting_on_provost"] is False
        assert notices(database_path, REJECT_STAY) == [[HOST_ID, "guest_stay_decided", "rejected"]]
        assert audit_actions(database_path, REJECT_STAY) == ["guest_stay.rejected"]
        assert client.get(waiting, headers=auth(roommate)).json()["items"] == []

        registered = client.post(
            "/api/v1/devices/push-token",
            headers=auth(roommate),
            json={"token": TOKEN, "platform": "ios"},
        )
        assert registered.status_code == 204
        push.SENT.clear()
        applied = client.post(
            "/api/v1/me/guest-stays",
            headers=auth(host),
            json={
                "guest_name": "Noor Khan",
                "relation": "Cousin",
                "guest_start_date": "2026-10-02",
                "guest_end_date": "2026-10-04",
                "reason": "Family wedding in Aligarh.",
            },
        )
        assert applied.status_code == 201, applied.text
        new_id = applied.json()["id"]
        roommate_pushes = [
            message
            for message in push.SENT
            if message["data"]["kind"] == "guest_stay_roommate_requested"
        ]
        assert len(roommate_pushes) == 1
        assert roommate_pushes[0]["to"] == TOKEN
        assert roommate_pushes[0]["title"] == "Your roommate has requested a guest stay"
        assert roommate_pushes[0]["body"] == "Noor Khan, 2026-10-02 to 2026-10-04"
        assert roommate_pushes[0]["data"]["record_id"] == new_id
        assert [item["id"] for item in client.get(waiting, headers=auth(roommate)).json()["items"]] == [
            new_id
        ]

        move_roommate(database_path)
        assert client.get(waiting, headers=auth(roommate)).json()["items"] == []
        assert_error(
            client.post(
                f"/api/v1/me/guest-stays/{new_id}/roommate-decision",
                headers=auth(roommate),
                json={"decision": "approved"},
            ),
            403,
            "forbidden",
            expected["not_roommate"],
        )
