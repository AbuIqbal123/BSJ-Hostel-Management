"""Applying tells every roommate. A roommate's yes or no tells the host and lasts."""

from __future__ import annotations

import sqlite3
from datetime import datetime, timezone
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.shared.testing_env import role_credential


BLOCK_B = "d032aad6-a203-5ea0-ba9a-3a9257edbfc8"
HOST_ID = "b22de000-0000-4000-8000-000000000002"
ZAYNAB_ID = "b22de000-0000-4000-8000-000000000012"
NADIRA_ID = "b22de000-0000-4000-8000-000000000014"
PROVOST_ID = "f66fb000-0000-4000-8000-000000000006"
ROOM_ID = "d4400000-0000-4000-8000-000000000004"
CREATED = "2026-09-30T00:00:00Z"


class FrozenClock:
    def utc_now(self) -> datetime:
        return datetime(2026, 9, 30, 13, 0, tzinfo=timezone.utc)


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
            VALUES (?, ?, '204', 'B-204', 3, 1)
            """,
            (ROOM_ID, BLOCK_B),
        )
        people = (
            (PROVOST_ID, "provost", "provost.halima", "Halima Begum", role_credential("provost")),
            (HOST_ID, "resident", "24-GLLB-118", "Aisha Khan", role_credential("resident")),
            (ZAYNAB_ID, "resident", "24-BA-014", "Zaynab Ali", role_credential("roommate")),
            (NADIRA_ID, "resident", "24-BA-016", "Nadira Qureshi", role_credential("roommate-2")),
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
            "INSERT INTO staff (user_id, job_title) VALUES (?, 'Provost')",
            (PROVOST_ID,),
        )
        for user_id, enrolment, phone, token in (
            (HOST_ID, "24-GLLB-118", "+919876543210", "bsj:v1:test-aisha-notice"),
            (ZAYNAB_ID, "24-BA-014", "+919876543212", "bsj:v1:test-zaynab-notice"),
            (NADIRA_ID, "24-BA-016", "+919876543214", "bsj:v1:test-nadira-notice"),
        ):
            connection.execute(
                """
                INSERT INTO residents (
                  user_id, enrolment_number, course, room_id, guardian_name, guardian_phone,
                  qr_token, presence, created_at, updated_at
                ) VALUES (?, ?, 'B.A.', ?, 'Guardian', ?, ?, 'inside', ?, ?)
                """,
                (user_id, enrolment, ROOM_ID, phone, token, CREATED, CREATED),
            )
        connection.commit()
    finally:
        connection.close()


def apply_stay(client: TestClient, token: str) -> str:
    response = client.post(
        "/api/v1/me/guest-stays",
        headers=auth(token),
        json={
            "guest_name": "Noor Khan",
            "relation": "Cousin",
            "guest_start_date": "2026-10-02",
            "guest_end_date": "2026-10-04",
            "reason": "Family wedding in Aligarh.",
        },
    )
    assert response.status_code == 201, response.text
    return response.json()["id"]


def inbox(client: TestClient, token: str) -> list[dict]:
    response = client.get("/api/v1/me/notifications", headers=auth(token))
    assert response.status_code == 200, response.text
    return response.json()["items"]


def notice_rows(path: Path, stay_id: str) -> list[tuple]:
    connection = sqlite3.connect(path)
    try:
        return connection.execute(
            """
            SELECT resident_id, kind, decision
            FROM resident_notifications
            WHERE record_id = ?
            ORDER BY resident_id, kind
            """,
            (stay_id,),
        ).fetchall()
    finally:
        connection.close()


def test_apply_writes_one_inbox_row_per_roommate(
    database_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    from app.main import app
    from app.shared import clock

    monkeypatch.setattr(clock, "utc_now", FrozenClock().utc_now)
    with TestClient(app) as client:
        issue_people(database_path)
        host = sign_in(client, "24-GLLB-118", role_credential("resident"))
        zaynab = sign_in(client, "24-BA-014", role_credential("roommate"))
        nadira = sign_in(client, "24-BA-016", role_credential("roommate-2"))
        stay_id = apply_stay(client, host)

        assert notice_rows(database_path, stay_id) == [
            (ZAYNAB_ID, "guest_stay_roommate_requested", None),
            (NADIRA_ID, "guest_stay_roommate_requested", None),
        ]
        assert inbox(client, host) == []
        for token in (zaynab, nadira):
            items = inbox(client, token)
            assert len(items) == 1
            item = items[0]
            assert item["kind"] == "guest_stay_roommate_requested"
            assert item["record_id"] == stay_id
            assert item["guest_name"] == "Noor Khan"
            assert item["guest_start_date"] == "2026-10-02"
            assert item["guest_end_date"] == "2026-10-04"
            assert item["host_name"] == "Aisha Khan"
            assert item["outcome"] is None
            assert item["needs_action"] is True
            assert item["unread"] is True


def test_roommate_decision_tells_the_host_and_lasts_for_both(
    database_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    from app.main import app
    from app.shared import clock

    monkeypatch.setattr(clock, "utc_now", FrozenClock().utc_now)
    with TestClient(app) as client:
        issue_people(database_path)
        host = sign_in(client, "24-GLLB-118", role_credential("resident"))
        zaynab = sign_in(client, "24-BA-014", role_credential("roommate"))
        provost = sign_in(client, "provost.halima", role_credential("provost"))
        stay_id = apply_stay(client, host)

        decided = client.post(
            f"/api/v1/me/guest-stays/{stay_id}/roommate-decision",
            headers=auth(zaynab),
            json={"decision": "approved", "note": "Fine with me."},
        )
        assert decided.status_code == 200, decided.text
        assert decided.json()["status"] == "pending"

        assert notice_rows(database_path, stay_id) == [
            (HOST_ID, "guest_stay_roommate_decided", "approved"),
            (ZAYNAB_ID, "guest_stay_roommate_recorded", "approved"),
            (ZAYNAB_ID, "guest_stay_roommate_requested", None),
            (NADIRA_ID, "guest_stay_roommate_requested", None),
        ]
        host_items = inbox(client, host)
        assert len(host_items) == 1
        told = host_items[0]
        assert told["kind"] == "guest_stay_roommate_decided"
        assert told["record_id"] == stay_id
        assert told["outcome"] == "approved"
        assert told["actor_name"] == "Zaynab Ali"
        assert told["guest_name"] == "Noor Khan"
        assert told["guest_start_date"] == "2026-10-02"
        assert told["guest_end_date"] == "2026-10-04"
        assert told["host_name"] == "Aisha Khan"

        lasting = [
            item
            for item in inbox(client, zaynab)
            if item["kind"] == "guest_stay_roommate_recorded"
        ]
        assert len(lasting) == 1
        assert lasting[0]["outcome"] == "approved"
        assert lasting[0]["host_name"] == "Aisha Khan"
        assert lasting[0]["guest_name"] == "Noor Khan"
        assert lasting[0]["record_id"] == stay_id
        requested = [
            item
            for item in inbox(client, zaynab)
            if item["kind"] == "guest_stay_roommate_requested"
        ]
        assert requested[0]["needs_action"] is False

        host_history = client.get("/api/v1/me/history", headers=auth(host))
        assert host_history.status_code == 200
        host_lines = [
            item
            for item in host_history.json()["items"]
            if item["notice_kind"] == "guest_stay_roommate_decided"
        ]
        assert len(host_lines) == 1
        assert host_lines[0]["guest_stay_id"] == stay_id
        assert host_lines[0]["kind"] == "guest_stay"
        assert host_lines[0]["who"] == "Noor Khan"
        assert host_lines[0]["actor_name"] == "Zaynab Ali"
        assert host_lines[0]["host_name"] == "Aisha Khan"
        assert host_lines[0]["decision"] == "approved"
        assert host_lines[0]["id"] == told["id"]

        roommate_history = client.get("/api/v1/me/history", headers=auth(zaynab))
        own_lines = [
            item
            for item in roommate_history.json()["items"]
            if item["notice_kind"] == "guest_stay_roommate_recorded"
        ]
        assert len(own_lines) == 1
        assert own_lines[0]["who"] == "Noor Khan"
        assert own_lines[0]["host_name"] == "Aisha Khan"
        assert own_lines[0]["decision"] == "approved"
        assert own_lines[0]["id"] == lasting[0]["id"]

        provost_yes = client.post(
            f"/api/v1/guest-stays/{stay_id}/decision",
            headers=auth(provost),
            json={"decision": "approved", "note": "Fine with me."},
        )
        assert provost_yes.status_code == 200, provost_yes.text
        assert provost_yes.json()["status"] == "pending"
        assert "guest_stay_decided" not in [row[1] for row in notice_rows(database_path, stay_id)]

        nadira = sign_in(client, "24-BA-016", role_credential("roommate-2"))
        nadira_yes = client.post(
            f"/api/v1/me/guest-stays/{stay_id}/roommate-decision",
            headers=auth(nadira),
            json={"decision": "approved"},
        )
        assert nadira_yes.status_code == 200, nadira_yes.text
        assert nadira_yes.json()["status"] == "approved"

        kinds = [row[1] for row in notice_rows(database_path, stay_id)]
        assert "guest_stay_decided" in kinds
        assert kinds.count("guest_stay_roommate_decided") == 2
        host_after = inbox(client, host)
        provost_lines = [item for item in host_after if item["kind"] == "guest_stay_decided"]
        roommate_lines = [
            item for item in host_after if item["kind"] == "guest_stay_roommate_decided"
        ]
        assert len(provost_lines) == 1
        assert provost_lines[0]["outcome"] == "approved"
        assert provost_lines[0]["decided_by_name"] == "Halima Begum"
        assert len(roommate_lines) == 2
        assert {item["actor_name"] for item in roommate_lines} == {"Zaynab Ali", "Nadira Qureshi"}

        host_history_after = client.get("/api/v1/me/history", headers=auth(host)).json()["items"]
        assert any(item["notice_kind"] == "guest_stay_decided" for item in host_history_after)
        assert (
            sum(item["notice_kind"] == "guest_stay_roommate_decided" for item in host_history_after)
            == 2
        )
