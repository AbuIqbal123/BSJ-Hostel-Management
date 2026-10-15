"""Gate hall-pass scan and recent activity."""

from __future__ import annotations

import json
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

import pytest
from fastapi.testclient import TestClient

from app.shared.testing_env import role_credential

ARTIFACT = Path(__file__).resolve().parent / "artifacts" / "gate-scans.json"
BLOCK_B = "d032aad6-a203-5ea0-ba9a-3a9257edbfc8"
LIBRARY = "fc2da7c5-8d65-5680-8034-d8acb69745eb"
GATE_ID = "a11ce000-0000-4000-8000-000000000001"
WARDEN_ID = "e55fa000-0000-4000-8000-000000000005"
RESIDENT_ID = "b22de000-0000-4000-8000-000000000002"
ROOM_ID = "d4400000-0000-4000-8000-000000000004"
CREATED = "2026-09-30T00:00:00Z"
OUTING_ID = "e7700000-0000-4000-8000-000000000011"
QR = "bsj:v1:test-resident-hall-pass"
NOW = datetime(2026, 9, 30, 12, 0, tzinfo=timezone.utc)  # 17:30 IST, inside summer hours


class MovableClock:
    def __init__(self, moment: datetime) -> None:
        self.moment = moment

    def utc_now(self) -> datetime:
        return self.moment


def assert_error(response, status: int, code: str) -> dict:
    assert response.status_code == status
    body = response.json()
    assert set(body) == {"error"}
    assert body["error"]["code"] == code
    return body["error"]


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
        for user_id, role, username, full_name, password in (
            (GATE_ID, "gate", "gate.fatima", "Fatima Khan", role_credential("gate")),
            (WARDEN_ID, "warden", "warden.sara", "Sara Malik", role_credential("warden")),
            (RESIDENT_ID, "resident", "24-GLLB-118", "Aisha Khan", role_credential("resident")),
        ):
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
            """
            INSERT INTO residents (
              user_id, enrolment_number, course, room_id, guardian_name, guardian_phone,
              qr_token, presence, created_at, updated_at
            ) VALUES (?, '24-GLLB-118', 'B.A. LL.B. (Hons.)', ?, 'Rashid Khan',
              '+919876543210', ?, 'inside', ?, ?)
            """,
            (RESIDENT_ID, ROOM_ID, QR, CREATED, CREATED),
        )
        connection.commit()
    finally:
        connection.close()


def plan_library(path: Path) -> None:
    connection = sqlite3.connect(path)
    try:
        connection.execute("PRAGMA foreign_keys=ON;")
        expected = "2026-09-30T12:30:00Z"
        grace = "2026-09-30T13:00:00Z"
        hall_date = (
            datetime.strptime(expected, "%Y-%m-%dT%H:%M:%SZ")
            .replace(tzinfo=timezone.utc)
            .astimezone(ZoneInfo("Asia/Kolkata"))
            .date()
            .isoformat()
        )
        connection.execute(
            """
            INSERT INTO outings (
              id, resident_id, permission_id, type, status, destination_id, place,
              expected_return_at, grace_ends_at, exited_at, exit_recorded_by,
              returned_at, return_recorded_by, created_at, updated_at, cancelled_at, hall_date
            ) VALUES (
              ?, ?, NULL, 'ordinary', 'planned', ?, 'Maulana Azad Library',
              ?, ?, NULL, NULL,
              NULL, NULL, ?, ?, NULL, ?
            )
            """,
            (OUTING_ID, RESIDENT_ID, LIBRARY, expected, grace, CREATED, CREATED, hall_date),
        )
        connection.commit()
    finally:
        connection.close()


def sign_in(client: TestClient, username: str, password: str) -> str:
    response = client.post(
        "/api/v1/auth/login",
        json={"username": username, "password": password},
    )
    assert response.status_code == 200
    return response.json()["access_token"]


def test_gate_scans_and_activity(
    database_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    expected = json.loads(ARTIFACT.read_text(encoding="utf-8"))
    from app.main import app
    from app.shared import clock

    movable = MovableClock(NOW)
    monkeypatch.setattr(clock, "utc_now", movable.utc_now)
    with TestClient(app) as client:
        issue_people(database_path)
        assert_error(client.post("/api/v1/gate/scans", json={"qr_payload": QR}), 401, "unauthenticated")
        resident = sign_in(client, "24-GLLB-118", role_credential("resident"))
        assert_error(
            client.post(
                "/api/v1/gate/scans",
                headers={"Authorization": f"Bearer {resident}"},
                json={"qr_payload": QR},
            ),
            403,
            "forbidden",
        )

        gate = sign_in(client, "gate.fatima", role_credential("gate"))
        headers = {"Authorization": f"Bearer {gate}"}
        assert_error(
            client.post(
                "/api/v1/gate/scans",
                headers=headers,
                json={"qr_payload": "bsj:v1:unknown-token"},
            ),
            404,
            "unknown_hall_pass",
        )
        err = assert_error(
            client.post("/api/v1/gate/scans", headers=headers, json={"qr_payload": QR}),
            409,
            "no_outing_planned",
        )
        assert err["details"]["full_name"] == "Aisha Khan"
        assert err["details"]["room_label"] == "B-204"

        plan_library(database_path)
        # bare token also accepted
        exit_scan = client.post(
            "/api/v1/gate/scans",
            headers=headers,
            json={"qr_payload": "test-resident-hall-pass"},
        )
        assert exit_scan.status_code == 200
        exit_body = exit_scan.json()
        assert exit_body["outcome"] == "exit_recorded"
        assert exit_body["message"] == expected["exit_message"]
        assert exit_body["full_name"] == "Aisha Khan"
        assert exit_body["room_label"] == "B-204"
        assert "recorded_at" not in exit_body
        assert "on_time" not in exit_body
        assert "return_record" not in exit_body
        assert set(exit_body) == {"outcome", "full_name", "room_label", "message", "outing"}
        assert exit_body["outing"]["id"] == OUTING_ID
        assert exit_body["outing"]["status"] == "outside"
        assert exit_body["outing"]["exited_at"] == "2026-09-30T12:00:00Z"
        assert exit_body["outing"]["exit_recorded_by_name"] == "Fatima Khan"
        assert exit_body["outing"]["recorded_at"] == "2026-09-30T12:00:00Z"
        assert exit_body["outing"]["lateness"] == "on_time"
        assert "is_late" not in exit_body["outing"]
        assert "return_timeliness" not in exit_body
        assert "return_timeliness" not in exit_body["outing"]

        dup = assert_error(
            client.post("/api/v1/gate/scans", headers=headers, json={"qr_payload": QR}),
            409,
            "duplicate_scan",
        )
        assert dup["details"]["presence"] == "outside"
        assert "already recorded as outside" in dup["message"]

        # after duplicate window, return on time (before grace 13:00Z)
        movable.moment = datetime(2026, 9, 30, 12, 1, tzinfo=timezone.utc)
        returned = client.post("/api/v1/gate/scans", headers=headers, json={"qr_payload": QR})
        assert returned.status_code == 200
        ret_body = returned.json()
        assert ret_body["outcome"] == "return_recorded"
        assert ret_body["message"] == expected["return_message"]
        assert "recorded_at" not in ret_body
        assert "on_time" not in ret_body
        assert "outing" not in ret_body
        assert "return_timeliness" not in ret_body
        assert set(ret_body) == {"outcome", "full_name", "room_label", "message", "return_record"}
        rr = ret_body["return_record"]
        # expected 12:30Z, grace 13:00Z, returned 12:01Z → on_time
        assert rr["return_timeliness"] == "on_time"
        assert rr["returned_at"] == "2026-09-30T12:01:00Z"
        assert rr["return_recorded_by_name"] == "Fatima Khan"
        assert rr["recorded_at"] == "2026-09-30T12:01:00Z"
        assert "is_late" not in rr
        assert "status" not in rr
        assert rr["outing_type"] == "ordinary"
        assert rr["place"] == "Maulana Azad Library"
        assert rr["minutes_late"] == 0
        assert rr["expected_return_at"] == "2026-09-30T12:30:00Z"
        assert set(rr) == {
            "recorded_at",
            "return_timeliness",
            "returned_at",
            "return_recorded_by_name",
            "outing_type",
            "place",
            "minutes_late",
            "expected_return_at",
        }

        activity = client.get("/api/v1/gate/activity", headers=headers)
        assert activity.status_code == 200
        page = activity.json()
        assert page["total"] == 2
        assert [item["event"] for item in page["items"]] == expected["activity_events"]
        first = page["items"][0]
        assert first["resident_name"] == "Aisha Khan"
        assert first["room_label"] == "B-204"
        assert first["guest_name"] is None
        assert first["host_name"] is None
        assert first["host_room_label"] is None

        warden = sign_in(client, "warden.sara", role_credential("warden"))
        warden_activity = client.get(
            "/api/v1/gate/activity",
            headers={"Authorization": f"Bearer {warden}"},
        )
        assert warden_activity.status_code == 200
        assert warden_activity.json()["total"] == 2

        connection = sqlite3.connect(database_path)
        try:
            presence = connection.execute(
                "SELECT presence FROM residents WHERE user_id = ?",
                (RESIDENT_ID,),
            ).fetchone()[0]
            actions = [
                row[0]
                for row in connection.execute(
                    """
                    SELECT action FROM audit_log
                    WHERE action IN ('outing.exit', 'outing.return')
                    ORDER BY occurred_at, rowid
                    """
                )
            ]
        finally:
            connection.close()
        assert presence == "inside"
        assert actions == ["outing.exit", "outing.return"]


CLASH_OUTING = "e7700000-0000-4000-8000-000000000021"
CLASH_PERMISSION = "f8800000-0000-4000-8000-000000000021"
CLASH_RETURN = "2026-09-30T16:00:00Z"
# 19:30 Asia/Kolkata, after the summer ordinary end at 18:30.
EVENING = datetime(2026, 9, 30, 14, 0, tzinfo=timezone.utc)


def seed_clashing_return(path: Path) -> None:
    connection = sqlite3.connect(path)
    try:
        connection.execute("PRAGMA foreign_keys=ON;")
        grace = "2026-09-30T16:30:00Z"
        hall_date = (
            datetime.strptime(CLASH_RETURN, "%Y-%m-%dT%H:%M:%SZ")
            .replace(tzinfo=timezone.utc)
            .astimezone(ZoneInfo("Asia/Kolkata"))
            .date()
            .isoformat()
        )
        connection.execute(
            """
            INSERT INTO outings (
              id, resident_id, permission_id, type, status, destination_id, place,
              expected_return_at, grace_ends_at, exited_at, exit_recorded_by,
              returned_at, return_recorded_by, created_at, updated_at, cancelled_at, hall_date
            ) VALUES (
              ?, ?, NULL, 'ordinary', 'planned', ?, 'Maulana Azad Library',
              ?, ?, NULL, NULL,
              NULL, NULL, ?, ?, NULL, ?
            )
            """,
            (CLASH_OUTING, RESIDENT_ID, LIBRARY, CLASH_RETURN, grace, CREATED, CREATED, hall_date),
        )
        connection.execute(
            """
            INSERT INTO permissions (
              id, resident_id, type, status, short_place, destination_detail, address,
              reason, departure_at, expected_return_at, decided_by, decided_at,
              decision_note, created_at, updated_at
            ) VALUES (
              ?, ?, 'late_night', 'approved', 'Women''s College', NULL, NULL,
              'Late return the same evening.', '2026-09-30T13:00:00Z', ?,
              ?, ?, NULL, ?, ?
            )
            """,
            (
                CLASH_PERMISSION,
                RESIDENT_ID,
                CLASH_RETURN,
                WARDEN_ID,
                CREATED,
                CREATED,
                CREATED,
            ),
        )
        connection.commit()
    finally:
        connection.close()


def test_late_return_reports_minutes_past_expected_return(
    database_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    from app.main import app
    from app.shared import clock

    movable = MovableClock(NOW)
    monkeypatch.setattr(clock, "utc_now", movable.utc_now)
    with TestClient(app) as client:
        issue_people(database_path)
        plan_library(database_path)
        gate = sign_in(client, "gate.fatima", GATE_PHRASE)
        headers = {"Authorization": f"Bearer {gate}"}
        assert client.post("/api/v1/gate/scans", headers=headers, json={"qr_payload": QR}).status_code == 200
        # returned 13:45Z, past grace → late, 75 minutes after expected return
        movable.moment = datetime(2026, 9, 30, 13, 45, 30, tzinfo=timezone.utc)
        gate = sign_in(client, "gate.fatima", GATE_PHRASE)
        headers = {"Authorization": f"Bearer {gate}"}
        returned = client.post("/api/v1/gate/scans", headers=headers, json={"qr_payload": QR})
        assert returned.status_code == 200
        rr = returned.json()["return_record"]
        assert rr["return_timeliness"] == "late"
        assert rr["outing_type"] == "ordinary"
        assert rr["place"] == "Maulana Azad Library"
        assert rr["minutes_late"] == 75
        assert rr["expected_return_at"] == "2026-09-30T12:30:00Z"


def test_permission_exit_refuses_when_return_already_planned(
    database_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    from app.main import app
    from app.shared import clock

    monkeypatch.setattr(clock, "utc_now", MovableClock(EVENING).utc_now)
    with TestClient(app) as client:
        issue_people(database_path)
        seed_clashing_return(database_path)
        gate = sign_in(client, "gate.fatima", role_credential("gate"))
        response = client.post(
            "/api/v1/gate/scans",
            headers={"Authorization": f"Bearer {gate}"},
            json={"qr_payload": QR},
        )
        error = assert_error(response, 409, "return_already_planned")
        assert error["message"] == "This resident already has an outing ending at that time."
        assert error["details"]["full_name"] == "Aisha Khan"
        assert error["details"]["room_label"] == "B-204"
        connection = sqlite3.connect(database_path)
        try:
            outside = connection.execute(
                "SELECT COUNT(*) FROM outings WHERE resident_id = ? AND status = 'outside'",
                (RESIDENT_ID,),
            ).fetchone()[0]
        finally:
            connection.close()
        assert outside == 0


def test_tied_gate_activity_pages_do_not_skip_or_repeat(
    database_path: Path,
) -> None:
    """Two exits that share a time, event, and name stay in outing-id order."""
    from app.main import app
    from app.shared.auth.security import hash_password

    low_resident = "b22de000-0000-4000-8000-000000000031"
    high_resident = "b22de000-0000-4000-8000-000000000032"
    low_room = "d4400000-0000-4000-8000-000000000031"
    high_room = "d4400000-0000-4000-8000-000000000032"
    low_outing = "a1100000-0000-4000-8000-0000000000a1"
    high_outing = "f1100000-0000-4000-8000-0000000000f2"
    exited = "2026-09-30T12:00:00Z"
    expected = "2026-09-30T12:30:00Z"
    grace = "2026-09-30T13:00:00Z"
    hall_date = (
        datetime.strptime(expected, "%Y-%m-%dT%H:%M:%SZ")
        .replace(tzinfo=timezone.utc)
        .astimezone(ZoneInfo("Asia/Kolkata"))
        .date()
        .isoformat()
    )

    with TestClient(app) as client:
        connection = sqlite3.connect(database_path)
        try:
            connection.execute("PRAGMA foreign_keys=ON;")
            connection.execute(
                """
                INSERT INTO users (
                  id, role, username, full_name, password_hash, status, created_at, updated_at
                ) VALUES (?, 'gate', 'gate.fatima', 'Fatima Khan', ?, 'active', ?, ?)
                """,
                (GATE_ID, hash_password(role_credential("gate")), CREATED, CREATED),
            )
            connection.execute(
                "INSERT INTO staff (user_id, job_title) VALUES (?, 'Gatekeeper')",
                (GATE_ID,),
            )
            # Insert the higher outing id first. Without a unique tie-break,
            # the page follows that insertion order.
            for room_id, number, label, resident_id, username, qr, outing_id in (
                (high_room, "202", "B-202", high_resident, "24-GLLB-202", "bsj:v1:tie-high", high_outing),
                (low_room, "201", "B-201", low_resident, "24-GLLB-201", "bsj:v1:tie-low", low_outing),
            ):
                connection.execute(
                    """
                    INSERT INTO rooms (id, block_id, number, label, bed_count, is_active)
                    VALUES (?, ?, ?, ?, 2, 1)
                    """,
                    (room_id, BLOCK_B, number, label),
                )
                connection.execute(
                    """
                    INSERT INTO users (
                      id, role, username, full_name, password_hash, status, created_at, updated_at
                    ) VALUES (?, 'resident', ?, 'Amina Khan', ?, 'active', ?, ?)
                    """,
                    (resident_id, username, hash_password(role_credential("resident")), CREATED, CREATED),
                )
                connection.execute(
                    """
                    INSERT INTO residents (
                      user_id, enrolment_number, course, room_id, guardian_name, guardian_phone,
                      qr_token, presence, created_at, updated_at
                    ) VALUES (?, ?, 'B.A. LL.B. (Hons.)', ?, 'Rashid Khan',
                      '+919876543210', ?, 'outside', ?, ?)
                    """,
                    (resident_id, username, room_id, qr, CREATED, CREATED),
                )
                connection.execute(
                    """
                    INSERT INTO outings (
                      id, resident_id, permission_id, type, status, destination_id, place,
                      expected_return_at, grace_ends_at, exited_at, exit_recorded_by,
                      returned_at, return_recorded_by, created_at, updated_at, cancelled_at, hall_date
                    ) VALUES (
                      ?, ?, NULL, 'ordinary', 'outside', ?, 'Maulana Azad Library',
                      ?, ?, ?, ?,
                      NULL, NULL, ?, ?, NULL, ?
                    )
                    """,
                    (
                        outing_id,
                        resident_id,
                        LIBRARY,
                        expected,
                        grace,
                        exited,
                        GATE_ID,
                        CREATED,
                        CREATED,
                        hall_date,
                    ),
                )
            connection.commit()
        finally:
            connection.close()

        gate = sign_in(client, "gate.fatima", role_credential("gate"))
        headers = {"Authorization": f"Bearer {gate}"}
        first = client.get("/api/v1/gate/activity?limit=1&offset=0", headers=headers)
        second = client.get("/api/v1/gate/activity?limit=1&offset=1", headers=headers)
        assert first.status_code == 200
        assert second.status_code == 200
        first_page = first.json()
        second_page = second.json()
        assert first_page["total"] == 2
        assert second_page["total"] == 2
        assert [item["event"] for item in first_page["items"]] == ["exit"]
        assert [item["event"] for item in second_page["items"]] == ["exit"]
        assert first_page["items"][0]["room_label"] == "B-201"
        assert second_page["items"][0]["room_label"] == "B-202"
        assert first_page["items"][0]["occurred_at"] == second_page["items"][0]["occurred_at"]
        assert first_page["items"][0]["resident_name"] == second_page["items"][0]["resident_name"]
        assert first_page["items"][0]["guest_name"] is None
        assert second_page["items"][0]["guest_name"] is None
