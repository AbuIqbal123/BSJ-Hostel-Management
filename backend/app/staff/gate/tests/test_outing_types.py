"""One rule decides which outing a resident can use now, at the gate and on her phone."""

from __future__ import annotations

import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

import pytest
from fastapi.testclient import TestClient

from app.shared.testing_env import role_credential
from app.staff.gate.tests.test_scans import (
    CREATED,
    LIBRARY,
    QR,
    RESIDENT_ID,
    WARDEN_ID,
    MovableClock,
    assert_error,
    issue_people,
    sign_in,
)

PLAN_ID = "e7700000-0000-4000-8000-0000000000a1"
PERMISSION_ID = "f8800000-0000-4000-8000-0000000000a1"
SECOND_PERMISSION_ID = "f8800000-0000-4000-8000-0000000000a2"


def at(hour: int, minute: int = 0) -> datetime:
    return datetime(2026, 9, 30, hour, minute, tzinfo=timezone.utc)


def stamp(hour: int, minute: int = 0) -> str:
    return at(hour, minute).strftime("%Y-%m-%dT%H:%M:%SZ")


def seed_plan(path: Path, starts_at: str | None, expected: str, grace: str) -> None:
    hall_date = (
        datetime.strptime(expected, "%Y-%m-%dT%H:%M:%SZ")
        .replace(tzinfo=timezone.utc)
        .astimezone(ZoneInfo("Asia/Kolkata"))
        .date()
        .isoformat()
    )
    connection = sqlite3.connect(path)
    try:
        connection.execute(
            """
            INSERT INTO outings (
              id, resident_id, permission_id, type, status, destination_id, place,
              starts_at, expected_return_at, grace_ends_at, created_at, updated_at, hall_date
            ) VALUES (?, ?, NULL, 'ordinary', 'planned', ?, 'Maulana Azad Library',
              ?, ?, ?, ?, ?, ?)
            """,
            (PLAN_ID, RESIDENT_ID, LIBRARY, starts_at, expected, grace, CREATED, CREATED, hall_date),
        )
        connection.commit()
    finally:
        connection.close()


def seed_permission(
    path: Path,
    permission_id: str,
    kind: str,
    status: str,
    departure: str,
    expected: str,
) -> None:
    decided = status != "pending"
    connection = sqlite3.connect(path)
    try:
        connection.execute("UPDATE hall_settings SET permission_lead_minutes = 30")
        connection.execute(
            """
            INSERT INTO permissions (
              id, resident_id, type, status, short_place, destination_detail, address,
              reason, departure_at, expected_return_at, decided_by, decided_at,
              decision_note, created_at, updated_at
            ) VALUES (?, ?, ?, ?, 'Women''s College', NULL, ?, 'Late return.',
              ?, ?, ?, ?, NULL, ?, ?)
            """,
            (
                permission_id,
                RESIDENT_ID,
                kind,
                status,
                "Home address, Aligarh" if kind == "home_going" else None,
                departure,
                expected,
                WARDEN_ID if decided else None,
                CREATED if decided else None,
                CREATED,
                CREATED,
            ),
        )
        connection.commit()
    finally:
        connection.close()


def scan(client: TestClient):
    # Sign in per call: the clock moves hours, and access tokens are short-lived.
    token = sign_in(client, "gate.fatima", role_credential("gate"))
    return client.post(
        "/api/v1/gate/scans",
        headers={"Authorization": f"Bearer {token}"},
        json={"qr_payload": QR},
    )


def hall_pass(client: TestClient) -> dict:
    token = sign_in(client, "24-GLLB-118", role_credential("resident"))
    response = client.get("/api/v1/me/hall-pass", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    return response.json()


@pytest.fixture
def desk(database_path: Path, monkeypatch: pytest.MonkeyPatch):
    from app.main import app
    from app.shared import clock

    movable = MovableClock(at(7))
    monkeypatch.setattr(clock, "utc_now", movable.utc_now)
    with TestClient(app) as client:
        issue_people(database_path)
        yield client, movable, database_path


def test_ordinary_exit_waits_for_the_thirty_minute_window(desk) -> None:
    client, movable, path = desk
    seed_plan(path, stamp(8), stamp(10), stamp(10, 30))

    early = hall_pass(client)
    assert early["qr_visible"] is False
    assert early["qr_payload"] is None
    assert early["qr_visible_from"] == stamp(7, 30)
    assert early["outing_type"] == "ordinary"
    assert early["permission_id"] is None
    error = assert_error(scan(client), 409, "outing_not_yet_open")
    assert error["details"]["full_name"] == "Aisha Khan"

    movable.moment = at(7, 31)
    assert hall_pass(client)["qr_visible"] is True
    assert scan(client).json()["outcome"] == "exit_recorded"


@pytest.mark.parametrize("kind", ["late_night", "home_going"])
def test_permission_shows_a_qr_and_is_scanned_inside_its_window(desk, kind: str) -> None:
    client, movable, path = desk
    seed_permission(path, PERMISSION_ID, kind, "approved", stamp(15), stamp(17))

    movable.moment = at(14)
    waiting = hall_pass(client)
    assert waiting["qr_visible"] is False
    assert waiting["qr_payload"] is None
    assert waiting["outing_type"] == kind
    assert waiting["permission_id"] == PERMISSION_ID
    assert waiting["outing_id"] is None
    assert waiting["qr_visible_from"] == stamp(14, 30)
    assert waiting["qr_visible_until"] == stamp(17)
    assert_error(scan(client), 409, "permission_not_yet_valid")

    movable.moment = at(14, 40)
    showing = hall_pass(client)
    assert showing["qr_visible"] is True
    assert showing["qr_payload"] == QR
    assert showing["outing_type"] == kind
    exited = scan(client)
    assert exited.status_code == 200
    assert exited.json()["outing"]["outing_type"] == kind

    outside = hall_pass(client)
    assert outside["qr_visible"] is True
    assert outside["outing_type"] == kind
    assert outside["permission_id"] == PERMISSION_ID
    assert outside["outing_id"] == exited.json()["outing"]["id"]


def test_outside_resident_keeps_the_qr_after_the_permission_window_and_late_return_is_noticed(
    desk,
) -> None:
    client, movable, path = desk
    seed_permission(path, PERMISSION_ID, "late_night", "approved", stamp(15), stamp(17))
    movable.moment = at(15)
    assert scan(client).status_code == 200

    movable.moment = at(17, 40)  # window ended 17:00, grace ended 17:30
    assert hall_pass(client)["qr_visible"] is True
    returned = scan(client)
    assert returned.status_code == 200
    assert returned.json()["return_record"]["return_timeliness"] == "late"

    connection = sqlite3.connect(path)
    try:
        notices = sorted(
            row[0] for row in connection.execute("SELECT notice_type FROM guardian_messages")
        )
        status = connection.execute(
            "SELECT status FROM permissions WHERE id = ?", (PERMISSION_ID,)
        ).fetchone()[0]
    finally:
        connection.close()
    assert notices == ["late_notice", "return_notice"]
    assert status == "completed"
    warden = sign_in(client, "warden.sara", role_credential("warden"))
    past = client.get(
        "/api/v1/register/late-returns",
        headers={"Authorization": f"Bearer {warden}"},
    ).json()
    assert [row["source"] for row in past["items"]] == ["late_night"]


def test_permission_wins_when_it_overlaps_a_planned_ordinary_outing(desk) -> None:
    client, movable, path = desk
    seed_plan(path, stamp(14, 20), stamp(16), stamp(16, 30))
    seed_permission(path, PERMISSION_ID, "home_going", "approved", stamp(14, 30), stamp(17))
    movable.moment = at(14, 40)

    chosen = hall_pass(client)
    assert chosen["outing_type"] == "home_going"
    assert chosen["permission_id"] == PERMISSION_ID
    exited = scan(client)
    assert exited.json()["outing"]["outing_type"] == "home_going"
    connection = sqlite3.connect(path)
    try:
        plan_status = connection.execute(
            "SELECT status FROM outings WHERE id = ?", (PLAN_ID,)
        ).fetchone()[0]
    finally:
        connection.close()
    assert plan_status == "planned"


def test_legacy_plan_without_a_start_shows_a_qr_until_it_ends(desk) -> None:
    client, movable, path = desk
    seed_plan(path, None, stamp(10), stamp(10, 30))
    shown = hall_pass(client)
    assert shown["qr_visible"] is True
    assert shown["outing_type"] == "ordinary"
    assert shown["qr_visible_until"] == stamp(10)


def test_approval_refuses_a_permission_that_overlaps_an_approved_one(desk) -> None:
    client, _movable, path = desk
    seed_permission(path, PERMISSION_ID, "late_night", "approved", stamp(15), stamp(17))
    seed_permission(path, SECOND_PERMISSION_ID, "home_going", "pending", stamp(16), stamp(20))
    provost = sign_in(client, "provost.halima", role_credential("provost"))
    headers = {"Authorization": f"Bearer {provost}"}
    path_decision = f"/api/v1/permissions/{SECOND_PERMISSION_ID}/decision"

    refused = client.post(path_decision, headers=headers, json={"decision": "approved"})
    assert_error(refused, 409, "permission_overlap")
    connection = sqlite3.connect(path)
    try:
        status = connection.execute(
            "SELECT status FROM permissions WHERE id = ?", (SECOND_PERMISSION_ID,)
        ).fetchone()[0]
    finally:
        connection.close()
    assert status == "pending"

    rejected = client.post(path_decision, headers=headers, json={"decision": "rejected"})
    assert rejected.status_code == 200


def test_approval_allows_back_to_back_permissions(desk) -> None:
    client, _movable, path = desk
    seed_permission(path, PERMISSION_ID, "late_night", "approved", stamp(15), stamp(17))
    seed_permission(path, SECOND_PERMISSION_ID, "late_night", "pending", stamp(17), stamp(19))
    provost = sign_in(client, "provost.halima", role_credential("provost"))
    response = client.post(
        f"/api/v1/permissions/{SECOND_PERMISSION_ID}/decision",
        headers={"Authorization": f"Bearer {provost}"},
        json={"decision": "approved"},
    )
    assert response.status_code == 200
