"""Late-night and home-going permissions: submit, list, get, cancel, and decide."""

from __future__ import annotations

import json
import re
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.dev_seed import (
    GATE_PHRASE,
    PROVOST_PHRASE,
    RESIDENT_PHRASE,
    WARDEN_PHRASE,
)


ARTIFACT = Path(__file__).resolve().parent / "artifacts" / "permission-lifecycle.json"
BLOCK_B = "d032aad6-a203-5ea0-ba9a-3a9257edbfc8"
GATE_ID = "a11ce000-0000-4000-8000-000000000001"
RESIDENT_ID = "b22de000-0000-4000-8000-000000000002"
OTHER_ID = "c44ef000-0000-4000-8000-000000000009"
WARDEN_ID = "e55fa000-0000-4000-8000-000000000005"
PROVOST_ID = "f66ab000-0000-4000-8000-000000000006"
ROOM_B204 = "d4400000-0000-4000-8000-000000000004"
ROOM_B205 = "d4400000-0000-4000-8000-000000000005"
IN_USE_ID = "f8800000-0000-4000-8000-000000000030"
EXPIRED_ID = "f8800000-0000-4000-8000-000000000031"
STAFF_EXPIRE_ID = "f8800000-0000-4000-8000-000000000032"
OTHER_PERM = "f8800000-0000-4000-8000-000000000099"
MISSING = "00000000-0000-4000-8000-000000000099"
CREATED = "2026-09-30T00:00:00Z"
NOW = "2026-09-30T13:00:00Z"
UUID = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$"
)


class FrozenClock:
    def __init__(self) -> None:
        self.moment = datetime(2026, 9, 30, 13, 0, tzinfo=timezone.utc)

    def utc_now(self) -> datetime:
        return self.moment

    def advance(self, seconds: int = 1) -> None:
        from datetime import timedelta

        self.moment = self.moment + timedelta(seconds=seconds)


def assert_error(
    response, status: int, code: str, message: str, field: str | None = None
) -> None:
    assert response.status_code == status
    body = response.json()
    assert set(body) == {"error"}
    error = body["error"]
    assert error["code"] == code
    assert error["message"] == message
    if field is None:
        assert "details" not in error
    else:
        assert error["details"] == {"field": field}


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
        connection.executemany(
            """
            INSERT INTO rooms (id, block_id, number, label, bed_count, is_active)
            VALUES (?, ?, ?, ?, 2, 1)
            """,
            (
                (ROOM_B204, BLOCK_B, "204", "B-204"),
                (ROOM_B205, BLOCK_B, "205", "B-205"),
            ),
        )
        people = (
            (GATE_ID, "gate", "gate.fatima", "Fatima Khan", GATE_PHRASE, "Gatekeeper"),
            (WARDEN_ID, "warden", "warden.sara", "Sara Malik", WARDEN_PHRASE, "Warden"),
            (PROVOST_ID, "provost", "provost.halima", "Halima Begum", PROVOST_PHRASE, "Provost"),
            (RESIDENT_ID, "resident", "24-GLLB-118", "Aisha Khan", RESIDENT_PHRASE, None),
            (OTHER_ID, "resident", "24-GLLB-119", "Maryam Siddiqui", RESIDENT_PHRASE, None),
        )
        for user_id, role, username, full_name, password, job in people:
            connection.execute(
                """
                INSERT INTO users (
                  id, role, username, full_name, password_hash, status, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, 'active', ?, ?)
                """,
                (user_id, role, username, full_name, hash_password(password), CREATED, CREATED),
            )
            if role == "resident":
                room = ROOM_B204 if user_id == RESIDENT_ID else ROOM_B205
                connection.execute(
                    """
                    INSERT INTO residents (
                      user_id, enrolment_number, course, room_id, guardian_name, guardian_phone,
                      qr_token, presence, created_at, updated_at
                    ) VALUES (?, ?, 'B.A. LL.B. (Hons.)', ?, 'Guardian',
                      '+919876543210', ?, 'inside', ?, ?)
                    """,
                    (user_id, username, room, f"bsj:v1:{username}", CREATED, CREATED),
                )
            else:
                connection.execute(
                    "INSERT INTO staff (user_id, job_title) VALUES (?, ?)",
                    (user_id, job),
                )
        connection.commit()
    finally:
        connection.close()


def insert_seed_permissions(path: Path) -> None:
    connection = sqlite3.connect(path)
    try:
        connection.execute("PRAGMA foreign_keys=ON;")
        connection.execute(
            """
            INSERT INTO permissions (
              id, resident_id, type, status, short_place, destination_detail, address,
              reason, departure_at, expected_return_at, decided_by, decided_at,
              decision_note, created_at, updated_at
            ) VALUES
            (?, ?, 'late_night', 'in_use', 'Women''s College', 'Seminar Hall', NULL,
             'Already left on this permission.', '2026-09-30T12:00:00Z', '2026-09-30T16:00:00Z',
             ?, '2026-09-30T11:00:00Z', NULL, '2026-09-30T10:00:00Z', '2026-09-30T12:00:00Z'),
            (?, ?, 'home_going', 'approved', 'Lucknow', NULL, '12 Park Road',
             'Unused and past its return.', '2026-09-28T02:30:00Z', '2026-09-29T12:00:00Z',
             ?, '2026-09-27T11:00:00Z', NULL, '2026-09-27T10:00:00Z', '2026-09-27T11:00:00Z'),
            (?, ?, 'late_night', 'approved', 'City library', NULL, NULL,
             'Unused past return for staff expire-on-look.', '2026-09-28T10:00:00Z',
             '2026-09-29T10:00:00Z', ?, '2026-09-28T09:00:00Z', NULL,
             '2026-09-28T08:00:00Z', '2026-09-28T09:00:00Z'),
            (?, ?, 'late_night', 'pending', 'Other hall', NULL, NULL,
             'Another resident is waiting.', '2026-09-30T15:00:00Z', '2026-09-30T17:00:00Z',
             NULL, NULL, NULL, '2026-09-30T12:00:00Z', '2026-09-30T12:00:00Z')
            """,
            (
                IN_USE_ID,
                RESIDENT_ID,
                WARDEN_ID,
                EXPIRED_ID,
                RESIDENT_ID,
                WARDEN_ID,
                STAFF_EXPIRE_ID,
                OTHER_ID,
                WARDEN_ID,
                OTHER_PERM,
                OTHER_ID,
            ),
        )
        connection.commit()
    finally:
        connection.close()


def permission_row(path: Path, permission_id: str) -> sqlite3.Row:
    connection = sqlite3.connect(path)
    connection.row_factory = sqlite3.Row
    try:
        row = connection.execute(
            "SELECT * FROM permissions WHERE id = ?",
            (permission_id,),
        ).fetchone()
        assert row is not None
        return row
    finally:
        connection.close()


def outing_count_for(path: Path, permission_id: str) -> int:
    connection = sqlite3.connect(path)
    try:
        return connection.execute(
            "SELECT COUNT(*) FROM outings WHERE permission_id = ?",
            (permission_id,),
        ).fetchone()[0]
    finally:
        connection.close()


def permission_audits(path: Path) -> list[sqlite3.Row]:
    connection = sqlite3.connect(path)
    connection.row_factory = sqlite3.Row
    try:
        return connection.execute(
            """
            SELECT actor_user_id, action, entity_type, entity_id, summary
            FROM audit_log
            WHERE action LIKE 'permission.%'
            ORDER BY occurred_at, id
            """
        ).fetchall()
    finally:
        connection.close()


def without_id(body: dict) -> dict:
    return {key: value for key, value in body.items() if key != "id"}


def test_permission_lifecycle(database_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    expected = json.loads(ARTIFACT.read_text(encoding="utf-8"))
    from app.shared import clock
    from app.main import app

    frozen = FrozenClock()
    monkeypatch.setattr(clock, "utc_now", frozen.utc_now)
    with TestClient(app) as client:
        issue_people(database_path)
        insert_seed_permissions(database_path)

        late_night_body = {
            "permission_type": "late_night",
            "short_place": "Women's College",
            "destination_detail": "Seminar Hall",
            "reason": "Faculty seminar ends at 9:00 PM. Requesting late return to hall.",
            "departure_at": "2026-09-30T14:00:00Z",
            "expected_return_at": "2026-09-30T16:00:00Z",
        }
        assert_error(
            client.post("/api/v1/me/permissions", json=late_night_body),
            401,
            "unauthenticated",
            "Sign in again.",
        )
        gate = sign_in(client, "gate.fatima", GATE_PHRASE)
        assert_error(
            client.post("/api/v1/me/permissions", headers=auth(gate), json=late_night_body),
            403,
            "forbidden",
            "This account cannot do that.",
        )
        resident = sign_in(client, "24-GLLB-118", RESIDENT_PHRASE)
        assert_error(
            client.post(
                "/api/v1/me/permissions",
                headers=auth(resident),
                json={
                    **late_night_body,
                    "departure_at": "2026-09-30T12:00:00Z",
                    "expected_return_at": "2026-09-30T16:00:00Z",
                },
            ),
            422,
            "validation_error",
            "The departure must not be in the past.",
            "departure_at",
        )
        skew = client.post(
            "/api/v1/me/permissions",
            headers=auth(resident),
            json={
                **late_night_body,
                "short_place": "Skew check",
                "departure_at": "2026-09-30T12:57:00Z",
                "expected_return_at": "2026-09-30T16:00:00Z",
            },
        )
        assert skew.status_code == 201
        skew_id = skew.json()["id"]
        frozen.advance()
        cancelled_skew = client.post(
            f"/api/v1/me/permissions/{skew_id}/cancel",
            headers=auth(resident),
        )
        assert cancelled_skew.status_code == 200
        frozen.advance()
        assert_error(
            client.post(
                "/api/v1/me/permissions",
                headers=auth(resident),
                json={
                    **late_night_body,
                    "expected_return_at": "2026-09-30T14:00:00Z",
                },
            ),
            422,
            "validation_error",
            "The expected return must be after the departure.",
        )

        first = client.post(
            "/api/v1/me/permissions",
            headers=auth(resident),
            json=late_night_body,
        )
        assert first.status_code == 201
        first_body = first.json()
        assert UUID.fullmatch(first_body["id"])
        assert without_id(first_body) == expected["late_night"]
        first_id = first_body["id"]
        frozen.advance()
        row = permission_row(database_path, first_id)
        assert row["status"] == "pending"
        assert row["resident_id"] == RESIDENT_ID
        assert row["decided_by"] is None
        assert row["decided_at"] is None
        assert row["destination_detail"] == "Seminar Hall"
        assert row["address"] is None

        overlap_late = client.post(
            "/api/v1/me/permissions",
            headers=auth(resident),
            json={
                "permission_type": "late_night",
                "short_place": "J.N. Medical College",
                "reason": "Second late-night on overlapping hours.",
                "departure_at": "2026-09-30T14:30:00Z",
                "expected_return_at": "2026-09-30T16:30:00Z",
            },
        )
        assert overlap_late.status_code == 201
        overlap_late_id = overlap_late.json()["id"]
        assert without_id(overlap_late.json()) == expected["overlap_late"]
        frozen.advance()

        home = client.post(
            "/api/v1/me/permissions",
            headers=auth(resident),
            json={
                "permission_type": "home_going",
                "short_place": "Lucknow",
                "address": "14, Civil Lines, Lucknow, U.P. 226001",
                "reason": "Family visit. Eid with parents.",
                "departure_at": "2026-09-30T15:00:00Z",
                "expected_return_at": "2026-10-02T13:30:00Z",
            },
        )
        assert home.status_code == 201
        home_id = home.json()["id"]
        assert without_id(home.json()) == expected["home_going"]
        home_row = permission_row(database_path, home_id)
        assert home_row["address"] == "14, Civil Lines, Lucknow, U.P. 226001"
        assert home_row["destination_detail"] is None

        # Submit (write path) already expired the unused approved permission past its return.
        assert permission_row(database_path, EXPIRED_ID)["status"] == "expired"
        # GET stays read-only; expire-passed is idempotent when nothing is left.
        own_before = client.get("/api/v1/me/permissions", headers=auth(resident))
        assert own_before.status_code == 200
        assert own_before.json()["items"][-1]["status"] == "expired"
        expired_me = client.post("/api/v1/me/expire-passed", headers=auth(resident))
        assert expired_me.status_code == 200
        assert expired_me.json()["permissions_expired"] == 0

        own_list = client.get("/api/v1/me/permissions", headers=auth(resident))
        assert own_list.status_code == 200
        listed = own_list.json()
        assert listed["total"] == 6
        assert listed["limit"] == 50
        assert listed["offset"] == 0
        assert [item["id"] for item in listed["items"]] == [
            home_id,
            overlap_late_id,
            first_id,
            skew_id,
            IN_USE_ID,
            EXPIRED_ID,
        ]
        assert "resident_id" not in listed["items"][0]
        assert "resident_name" not in listed["items"][0]
        assert "room_label" not in listed["items"][0]
        assert listed["items"][-1]["status"] == "expired"

        got = client.get(f"/api/v1/me/permissions/{first_id}", headers=auth(resident))
        assert got.status_code == 200
        assert without_id(got.json()) == expected["late_night"]
        assert "resident_id" not in got.json()

        assert_error(
            client.get(f"/api/v1/me/permissions/{OTHER_PERM}", headers=auth(resident)),
            404,
            "not_found",
            "That record was not found.",
        )
        assert_error(
            client.get(f"/api/v1/me/permissions/{MISSING}", headers=auth(resident)),
            404,
            "not_found",
            "That record was not found.",
        )

        cancelled_pending = client.post(
            f"/api/v1/me/permissions/{overlap_late_id}/cancel",
            headers=auth(resident),
        )
        assert cancelled_pending.status_code == 200
        assert cancelled_pending.json()["status"] == "cancelled"
        assert without_id(cancelled_pending.json()) == expected["cancelled_pending"]

        assert_error(
            client.post(
                f"/api/v1/me/permissions/{IN_USE_ID}/cancel",
                headers=auth(resident),
            ),
            409,
            "permission_in_use",
            "The gate has already recorded an exit on this permission, so it cannot be cancelled.",
        )
        assert permission_row(database_path, IN_USE_ID)["status"] == "in_use"

        assert_error(
            client.get("/api/v1/permissions", headers=auth(gate)),
            403,
            "forbidden",
            "This account cannot do that.",
        )
        assert_error(
            client.get("/api/v1/permissions"),
            401,
            "unauthenticated",
            "Sign in again.",
        )
        assert_error(
            client.get("/api/v1/permissions", headers=auth(resident)),
            403,
            "forbidden",
            "This account cannot do that.",
        )

        warden = sign_in(client, "warden.sara", WARDEN_PHRASE)
        assert permission_row(database_path, STAFF_EXPIRE_ID)["status"] == "approved"
        queue_before = client.get("/api/v1/permissions", headers=auth(warden))
        assert queue_before.status_code == 200
        assert permission_row(database_path, STAFF_EXPIRE_ID)["status"] == "approved"
        expired_staff = client.post(
            "/api/v1/permissions/expire-passed",
            headers=auth(warden),
        )
        assert expired_staff.status_code == 200
        assert expired_staff.json()["permissions_expired"] == 1
        assert permission_row(database_path, STAFF_EXPIRE_ID)["status"] == "expired"

        queue = client.get("/api/v1/permissions", headers=auth(warden))
        assert queue.status_code == 200
        queue_body = queue.json()
        assert queue_body["total"] == 3
        assert [item["id"] for item in queue_body["items"]] == [
            home_id,
            first_id,
            OTHER_PERM,
        ]
        assert all(item["status"] == "pending" for item in queue_body["items"])
        assert queue_body["items"][0]["resident_name"] == "Aisha Khan"
        assert queue_body["items"][2]["resident_name"] == "Maryam Siddiqui"

        review = client.get(f"/api/v1/permissions/{first_id}", headers=auth(warden))
        assert review.status_code == 200
        assert without_id(review.json()) == expected["review_pending"]

        approved = client.post(
            f"/api/v1/permissions/{first_id}/decision",
            headers=auth(warden),
            json={"decision": "approved", "note": ""},
        )
        assert approved.status_code == 200
        assert without_id(approved.json()) == expected["approved"]
        assert outing_count_for(database_path, first_id) == 0
        approved_row = permission_row(database_path, first_id)
        assert approved_row["status"] == "approved"
        assert approved_row["decided_by"] == WARDEN_ID
        assert approved_row["decided_at"] == "2026-09-30T13:00:04Z"
        assert approved_row["decision_note"] is None

        assert_error(
            client.post(
                f"/api/v1/permissions/{first_id}/decision",
                headers=auth(warden),
                json={"decision": "rejected"},
            ),
            409,
            "not_pending",
            "Only a pending permission can be approved or rejected (current status: approved).",
        )

        cancelled_approved = client.post(
            f"/api/v1/me/permissions/{first_id}/cancel",
            headers=auth(resident),
        )
        assert cancelled_approved.status_code == 200
        assert cancelled_approved.json()["status"] == "cancelled"
        assert without_id(cancelled_approved.json()) == expected["cancelled_approved"]

        rejected = client.post(
            f"/api/v1/permissions/{home_id}/decision",
            headers=auth(warden),
            json={"decision": "rejected", "note": "Not this week."},
        )
        assert rejected.status_code == 200
        assert without_id(rejected.json()) == expected["rejected"]
        assert outing_count_for(database_path, home_id) == 0

        provost = sign_in(client, "provost.halima", PROVOST_PHRASE)
        provost_decision = client.post(
            f"/api/v1/permissions/{OTHER_PERM}/decision",
            headers=auth(provost),
            json={"decision": "approved"},
        )
        assert provost_decision.status_code == 200
        assert provost_decision.json()["status"] == "approved"
        assert provost_decision.json()["decided_by"] == "Halima Begum"
        assert outing_count_for(database_path, OTHER_PERM) == 0

        expired_get = client.get(
            f"/api/v1/me/permissions/{EXPIRED_ID}",
            headers=auth(resident),
        )
        assert expired_get.status_code == 200
        assert expired_get.json()["status"] == "expired"
        assert without_id(expired_get.json()) == expected["expired"]

        audits = permission_audits(database_path)
        actions = [(row["action"], row["actor_user_id"], row["entity_id"]) for row in audits]
        assert ("permission.submitted", RESIDENT_ID, skew_id) in actions
        assert ("permission.cancelled", RESIDENT_ID, skew_id) in actions
        assert ("permission.submitted", RESIDENT_ID, first_id) in actions
        assert ("permission.submitted", RESIDENT_ID, overlap_late_id) in actions
        assert ("permission.submitted", RESIDENT_ID, home_id) in actions
        assert ("permission.cancelled", RESIDENT_ID, overlap_late_id) in actions
        assert ("permission.approved", WARDEN_ID, first_id) in actions
        assert ("permission.cancelled", RESIDENT_ID, first_id) in actions
        assert ("permission.rejected", WARDEN_ID, home_id) in actions
        assert ("permission.approved", PROVOST_ID, OTHER_PERM) in actions
        assert ("permission.expired", None, EXPIRED_ID) in actions
        assert ("permission.expired", None, STAFF_EXPIRE_ID) in actions


def test_pending_permission_can_be_changed(
    database_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    from app.shared import clock
    from app.main import app

    frozen = FrozenClock()
    monkeypatch.setattr(clock, "utc_now", frozen.utc_now)
    body = {
        "permission_type": "late_night",
        "short_place": "Women's College",
        "reason": "Seminar.",
        "departure_at": "2026-09-30T14:00:00Z",
        "expected_return_at": "2026-09-30T16:00:00Z",
    }
    changed = {
        **body,
        "short_place": "Library",
        "reason": "The seminar moved.",
        "departure_at": "2026-09-30T15:00:00Z",
        "expected_return_at": "2026-09-30T17:00:00Z",
    }
    with TestClient(app) as client:
        issue_people(database_path)
        resident = sign_in(client, "24-GLLB-118", RESIDENT_PHRASE)
        created = client.post("/api/v1/me/permissions", headers=auth(resident), json=body)
        assert created.status_code == 201
        permission_id = created.json()["id"]
        saved = client.patch(
            f"/api/v1/me/permissions/{permission_id}",
            headers=auth(resident),
            json=changed,
        )
        assert saved.status_code == 200
        assert saved.json()["status"] == "pending"
        assert saved.json()["short_place"] == "Library"
        assert saved.json()["reason"] == "The seminar moved."
        assert saved.json()["departure_at"] == "2026-09-30T15:00:00Z"
        assert_error(
            client.patch(
                f"/api/v1/me/permissions/{permission_id}",
                headers=auth(resident),
                json={**changed, "expected_return_at": "2026-09-30T15:00:00Z"},
            ),
            422,
            "validation_error",
            "The expected return must be after the departure.",
        )
        warden = sign_in(client, "warden.sara", WARDEN_PHRASE)
        decided = client.post(
            f"/api/v1/permissions/{permission_id}/decision",
            headers=auth(warden),
            json={"decision": "approved", "note": ""},
        )
        assert decided.status_code == 200
        assert_error(
            client.patch(
                f"/api/v1/me/permissions/{permission_id}",
                headers=auth(resident),
                json=changed,
            ),
            409,
            "not_editable",
            "Only a pending permission can be changed.",
        )


def test_late_night_returns_the_same_night(
    database_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    from app.shared import clock
    from app.main import app

    frozen = FrozenClock()
    monkeypatch.setattr(clock, "utc_now", frozen.utc_now)
    same_night = {
        "permission_type": "late_night",
        "short_place": "Women's College",
        "reason": "Seminar.",
        "departure_at": "2026-09-30T14:00:00Z",
        "expected_return_at": "2026-09-30T16:00:00Z",
    }
    midnight = {
        **same_night,
        "expected_return_at": "2026-09-30T18:30:00Z",
    }
    next_morning = {
        **same_night,
        "expected_return_at": "2026-09-30T19:00:00Z",
    }
    home = {
        "permission_type": "home_going",
        "short_place": "Lucknow",
        "address": "14, Civil Lines, Lucknow",
        "reason": "Family visit.",
        "departure_at": "2026-09-30T15:00:00Z",
        "expected_return_at": "2026-10-02T13:30:00Z",
    }
    with TestClient(app) as client:
        issue_people(database_path)
        resident = sign_in(client, "24-GLLB-118", RESIDENT_PHRASE)
        created = client.post("/api/v1/me/permissions", headers=auth(resident), json=same_night)
        assert created.status_code == 201
        at_midnight = client.post("/api/v1/me/permissions", headers=auth(resident), json=midnight)
        assert at_midnight.status_code == 201
        assert_error(
            client.post("/api/v1/me/permissions", headers=auth(resident), json=next_morning),
            422,
            "validation_error",
            "A late-night return has to be the same day. Only 12:00 AM can be the next day.",
            "expected_return_at",
        )
        changed = client.patch(
            f"/api/v1/me/permissions/{created.json()['id']}",
            headers=auth(resident),
            json=next_morning,
        )
        assert_error(
            changed,
            422,
            "validation_error",
            "A late-night return has to be the same day. Only 12:00 AM can be the next day.",
            "expected_return_at",
        )
        home_going = client.post("/api/v1/me/permissions", headers=auth(resident), json=home)
        assert home_going.status_code == 201
