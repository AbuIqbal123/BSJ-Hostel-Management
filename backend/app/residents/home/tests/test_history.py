"""Own history for the resident phone.

Rows are finished or unused records, not exit and return lines.
"""

from __future__ import annotations

import sqlite3
from collections.abc import Iterator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.shared.testing_env import role_credential
from app.residents.home.tests import test_home


@pytest.fixture
def database_path(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Iterator[Path]:
    path = tmp_path / "hostel.db"
    monkeypatch.setenv("DATABASE_PATH", str(path))
    monkeypatch.setenv("ENVIRONMENT", "development")
    monkeypatch.setenv("SMS_DRIVER", "mock")
    from app.shared.testing_env import signing_key_for_tests

    monkeypatch.setenv("APP_SECRET_KEY", signing_key_for_tests())
    from app.shared.config import get_settings

    get_settings.cache_clear()
    yield path
    get_settings.cache_clear()


FINISHED_OUTING = "e7700000-0000-4000-8000-000000000031"
UNUSED_OUTING = "e7700000-0000-4000-8000-000000000032"
CANCELLED_PASSED = "e7700000-0000-4000-8000-000000000033"
FUTURE_OUTING = "e7700000-0000-4000-8000-000000000034"
STILL_OUT = "e7700000-0000-4000-8000-000000000035"
CANCELLED_FUTURE = "e7700000-0000-4000-8000-000000000036"
OTHER_OUTING = "e7700000-0000-4000-8000-000000000037"
PERMISSION_OUTING = "e7700000-0000-4000-8000-000000000038"

EXPIRED_LATE = "f8800000-0000-4000-8000-000000000031"
LIVE_APPROVED = "f8800000-0000-4000-8000-000000000032"
UNUSED_HOME = "f8800000-0000-4000-8000-000000000033"
COMPLETED_LATE = "f8800000-0000-4000-8000-000000000034"
REJECTED_LATE = "f8800000-0000-4000-8000-000000000035"
PENDING_LATE = "f8800000-0000-4000-8000-000000000036"
IN_USE_LATE = "f8800000-0000-4000-8000-000000000037"
CANCELLED_LATE = "f8800000-0000-4000-8000-000000000038"

UNUSED_GUEST = "a9900000-0000-4000-8000-000000000031"
DEPARTED_GUEST = "a9900000-0000-4000-8000-000000000032"
REJECTED_GUEST = "a9900000-0000-4000-8000-000000000033"
LIVE_GUEST = "a9900000-0000-4000-8000-000000000034"
ARRIVED_GUEST = "a9900000-0000-4000-8000-000000000035"


def _row(
    row_id: str,
    kind: str,
    place: str | None,
    who: str | None,
    started_at: str,
    ended_at: str,
    *,
    exit_recorded_by: str | None = None,
    return_recorded_by: str | None = None,
    unused: bool,
) -> dict:
    return {
        "id": row_id,
        "kind": kind,
        "place": place,
        "who": who,
        "started_at": started_at,
        "ended_at": ended_at,
        "exit_recorded_by": exit_recorded_by,
        "return_recorded_by": return_recorded_by,
        "unused": unused,
    }


FINISHED = _row(
    FINISHED_OUTING,
    "outing",
    "Maulana Azad Library",
    None,
    "2026-09-29T20:00:00Z",
    "2026-09-29T21:00:00Z",
    exit_recorded_by="Fatima Khan",
    return_recorded_by="Sara Malik",
    unused=False,
)
UNUSED_PLAN = _row(
    UNUSED_OUTING,
    "outing",
    "Women's College",
    None,
    "2026-09-29T04:00:00Z",
    "2026-09-29T08:00:00Z",
    unused=True,
)
UNUSED_CANCELLED = _row(
    CANCELLED_PASSED,
    "outing",
    "City bookshop",
    None,
    "2026-09-23T04:00:00Z",
    "2026-09-23T08:00:00Z",
    unused=True,
)
CANCELLED_LATER = _row(
    CANCELLED_FUTURE,
    "outing",
    "Cancelled later",
    None,
    "2026-10-02T04:00:00Z",
    "2026-10-02T08:00:00Z",
    unused=True,
)
REJECTED_PERMISSION = _row(
    REJECTED_LATE,
    "late_night",
    "Refused place",
    None,
    "2026-09-20T14:00:00Z",
    "2026-09-20T16:00:00Z",
    unused=True,
)
REJECTED_STAY = _row(
    REJECTED_GUEST,
    "guest_stay",
    None,
    "Rejected Guest",
    "2026-08-31T18:30:00Z",
    "2026-09-02T18:29:59Z",
    unused=True,
)
CANCELLED_PERMISSION = _row(
    CANCELLED_LATE,
    "late_night",
    "Called off",
    None,
    "2026-10-03T14:00:00Z",
    "2026-10-03T16:00:00Z",
    unused=True,
)
EXPIRED = _row(
    EXPIRED_LATE,
    "late_night",
    "Seminar Hall",
    None,
    "2026-09-26T14:00:00Z",
    "2026-09-26T18:00:00Z",
    unused=True,
)
UNUSED_HOME_ROW = _row(
    UNUSED_HOME,
    "home_going",
    "Lucknow",
    None,
    "2026-09-25T02:30:00Z",
    "2026-09-25T12:00:00Z",
    unused=True,
)
COMPLETED = _row(
    COMPLETED_LATE,
    "late_night",
    "J.N. Medical College",
    None,
    "2026-09-24T14:00:00Z",
    "2026-09-24T16:30:00Z",
    exit_recorded_by="Fatima Khan",
    return_recorded_by="Sara Malik",
    unused=False,
)
UNUSED_STAY = _row(
    UNUSED_GUEST,
    "guest_stay",
    None,
    "Amina Khan",
    "2026-09-26T18:30:00Z",
    "2026-09-28T18:29:59Z",
    unused=True,
)
DEPARTED = _row(
    DEPARTED_GUEST,
    "guest_stay",
    None,
    "Sara Begum",
    "2026-09-19T18:30:00Z",
    "2026-09-22T18:29:59Z",
    unused=False,
)

# Newest ended_at first. ISO instants sort in that order.
ALL_ROWS = [
    CANCELLED_PERMISSION,
    CANCELLED_LATER,
    FINISHED,
    UNUSED_PLAN,
    UNUSED_STAY,
    EXPIRED,
    UNUSED_HOME_ROW,
    COMPLETED,
    UNUSED_CANCELLED,
    DEPARTED,
    REJECTED_PERMISSION,
    REJECTED_STAY,
]


def _seed(path: Path) -> None:
    connection = sqlite3.connect(path)
    try:
        connection.execute("PRAGMA foreign_keys=ON;")
        test_home.insert_outing(
            connection,
            FINISHED_OUTING,
            test_home.RESIDENT_ID,
            "returned",
            "Maulana Azad Library",
            destination_id=test_home.LIBRARY,
            starts_at="2026-09-29T18:00:00Z",
            expected_return_at="2026-09-30T02:00:00Z",
            grace_ends_at="2026-09-30T02:30:00Z",
            exited_at="2026-09-29T20:00:00Z",
            returned_at="2026-09-29T21:00:00Z",
            created_at="2026-09-29T18:00:00Z",
        )
        connection.execute(
            "UPDATE outings SET return_recorded_by = ? WHERE id = ?",
            (test_home.WARDEN_ID, FINISHED_OUTING),
        )
        test_home.insert_outing(
            connection,
            UNUSED_OUTING,
            test_home.RESIDENT_ID,
            "planned",
            "Women's College",
            starts_at="2026-09-29T04:00:00Z",
            expected_return_at="2026-09-29T08:00:00Z",
            grace_ends_at="2026-09-29T08:30:00Z",
            created_at="2026-09-29T03:00:00Z",
        )
        test_home.insert_outing(
            connection,
            CANCELLED_PASSED,
            test_home.RESIDENT_ID,
            "cancelled",
            "City bookshop",
            starts_at="2026-09-23T04:00:00Z",
            expected_return_at="2026-09-23T08:00:00Z",
            grace_ends_at="2026-09-23T08:30:00Z",
            created_at="2026-09-23T03:00:00Z",
            cancelled_at="2026-09-23T05:00:00Z",
        )
        test_home.insert_outing(
            connection,
            FUTURE_OUTING,
            test_home.RESIDENT_ID,
            "planned",
            "Shamshad Market",
            starts_at="2026-10-01T04:00:00Z",
            expected_return_at="2026-10-01T08:00:00Z",
            grace_ends_at="2026-10-01T08:30:00Z",
            created_at="2026-09-30T12:00:00Z",
        )
        test_home.insert_outing(
            connection,
            STILL_OUT,
            test_home.RESIDENT_ID,
            "outside",
            "Still outside",
            starts_at="2026-09-27T02:00:00Z",
            expected_return_at="2026-09-27T08:00:00Z",
            grace_ends_at="2026-09-27T08:30:00Z",
            exited_at="2026-09-27T03:00:00Z",
            created_at="2026-09-27T02:00:00Z",
        )
        test_home.insert_outing(
            connection,
            CANCELLED_FUTURE,
            test_home.RESIDENT_ID,
            "cancelled",
            "Cancelled later",
            starts_at="2026-10-02T04:00:00Z",
            expected_return_at="2026-10-02T08:00:00Z",
            grace_ends_at="2026-10-02T08:30:00Z",
            created_at="2026-09-30T11:00:00Z",
            cancelled_at="2026-09-30T11:30:00Z",
        )
        test_home.insert_outing(
            connection,
            OTHER_OUTING,
            test_home.OTHER_ID,
            "returned",
            "Other hall",
            starts_at="2026-09-28T04:00:00Z",
            expected_return_at="2026-09-28T08:00:00Z",
            grace_ends_at="2026-09-28T08:30:00Z",
            exited_at="2026-09-28T05:00:00Z",
            returned_at="2026-09-28T07:00:00Z",
            created_at="2026-09-28T04:00:00Z",
        )
        permissions = (
            (
                EXPIRED_LATE,
                "late_night",
                "expired",
                "Seminar Hall",
                None,
                None,
                "The window ended unused.",
                "2026-09-26T14:00:00Z",
                "2026-09-26T18:00:00Z",
                test_home.WARDEN_ID,
                "2026-09-26T10:00:00Z",
                None,
                "2026-09-26T09:00:00Z",
            ),
            (
                LIVE_APPROVED,
                "late_night",
                "approved",
                "Still open",
                None,
                None,
                "The window is still open.",
                "2026-09-30T08:00:00Z",
                "2026-09-30T18:00:00Z",
                test_home.WARDEN_ID,
                "2026-09-30T07:00:00Z",
                None,
                "2026-09-30T06:00:00Z",
            ),
            (
                UNUSED_HOME,
                "home_going",
                "approved",
                "Lucknow",
                None,
                "12 Park Road",
                "Approved and the return has passed.",
                "2026-09-25T02:30:00Z",
                "2026-09-25T12:00:00Z",
                test_home.WARDEN_ID,
                "2026-09-24T10:00:00Z",
                None,
                "2026-09-24T09:00:00Z",
            ),
            (
                COMPLETED_LATE,
                "late_night",
                "completed",
                "J.N. Medical College",
                None,
                None,
                "She went and came back.",
                "2026-09-24T14:00:00Z",
                "2026-09-24T16:30:00Z",
                test_home.WARDEN_ID,
                "2026-09-24T10:00:00Z",
                None,
                "2026-09-24T09:00:00Z",
            ),
            (
                REJECTED_LATE,
                "late_night",
                "rejected",
                "Refused place",
                None,
                None,
                "Never approved.",
                "2026-09-20T14:00:00Z",
                "2026-09-20T16:00:00Z",
                test_home.WARDEN_ID,
                "2026-09-20T09:00:00Z",
                "Not this evening.",
                "2026-09-20T08:00:00Z",
            ),
            (
                PENDING_LATE,
                "late_night",
                "pending",
                "Waiting place",
                None,
                None,
                "Still waiting.",
                "2026-09-21T14:00:00Z",
                "2026-09-21T16:00:00Z",
                None,
                None,
                None,
                "2026-09-21T08:00:00Z",
            ),
            (
                IN_USE_LATE,
                "late_night",
                "in_use",
                "Out on permission",
                None,
                None,
                "She left and has not returned.",
                "2026-09-22T02:00:00Z",
                "2026-09-22T06:00:00Z",
                test_home.WARDEN_ID,
                "2026-09-21T10:00:00Z",
                None,
                "2026-09-21T09:00:00Z",
            ),
            (
                CANCELLED_LATE,
                "late_night",
                "cancelled",
                "Called off",
                None,
                None,
                "She cancelled before leaving.",
                "2026-10-03T14:00:00Z",
                "2026-10-03T16:00:00Z",
                None,
                None,
                None,
                "2026-09-30T12:00:00Z",
            ),
        )
        connection.executemany(
            """
            INSERT INTO permissions (
              id, resident_id, type, status, short_place, destination_detail, address,
              reason, departure_at, expected_return_at, decided_by, decided_at,
              decision_note, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            [
                (
                    row_id,
                    test_home.RESIDENT_ID,
                    kind,
                    status,
                    place,
                    detail,
                    address,
                    reason,
                    departure,
                    expected,
                    decided_by,
                    decided_at,
                    note,
                    created,
                    created,
                )
                for (
                    row_id,
                    kind,
                    status,
                    place,
                    detail,
                    address,
                    reason,
                    departure,
                    expected,
                    decided_by,
                    decided_at,
                    note,
                    created,
                ) in permissions
            ],
        )
        connection.execute(
            """
            INSERT INTO outings (
              id, resident_id, permission_id, type, status, destination_id, place,
              expected_return_at, grace_ends_at, exited_at, exit_recorded_by,
              returned_at, return_recorded_by, created_at, updated_at, cancelled_at,
              hall_date
            ) VALUES (
              ?, ?, ?, 'late_night', 'returned', NULL, 'J.N. Medical College',
              '2026-09-24T16:30:00Z', '2026-09-24T17:00:00Z',
              '2026-09-24T14:10:00Z', ?,
              '2026-09-24T16:00:00Z', ?,
              '2026-09-24T14:10:00Z', '2026-09-24T16:00:00Z', NULL,
              '2026-09-24'
            )
            """,
            (
                PERMISSION_OUTING,
                test_home.RESIDENT_ID,
                COMPLETED_LATE,
                test_home.GATE_ID,
                test_home.WARDEN_ID,
            ),
        )
        connection.execute(
            """
            INSERT INTO guest_stays (
              id, host_resident_id, guest_name, relation, guest_start_date, guest_end_date,
              reason, status, payment_status, payment_marked_by, payment_marked_at,
              decided_by, decided_at, decision_note,
              arrived_at, arrived_recorded_by, departed_at, departed_recorded_by,
              created_at, updated_at
            ) VALUES
              (?, ?, 'Amina Khan', 'Aunt', '2026-09-27', '2026-09-28', 'Visit.',
               'approved', 'unpaid', NULL, NULL,
               ?, '2026-09-26T12:00:00Z', NULL,
               NULL, NULL, NULL, NULL,
               '2026-09-26T11:00:00Z', '2026-09-26T12:00:00Z'),
              (?, ?, 'Sara Begum', 'Sister', '2026-09-20', '2026-09-22', 'Visit.',
               'departed', 'paid', ?, '2026-09-19T10:00:00Z',
               ?, '2026-09-19T12:00:00Z', NULL,
               '2026-09-20T04:00:00Z', ?, '2026-09-22T12:00:00Z', ?,
               '2026-09-19T08:00:00Z', '2026-09-22T12:00:00Z'),
              (?, ?, 'Rejected Guest', 'Cousin', '2026-09-01', '2026-09-02', 'Visit.',
               'rejected', 'unpaid', NULL, NULL,
               ?, '2026-09-01T12:00:00Z', 'Not this week.',
               NULL, NULL, NULL, NULL,
               '2026-09-01T08:00:00Z', '2026-09-01T12:00:00Z'),
              (?, ?, 'Still Visiting', 'Aunt', '2026-09-30', '2026-10-02', 'Visit.',
               'approved', 'unpaid', NULL, NULL,
               ?, '2026-09-29T12:00:00Z', NULL,
               NULL, NULL, NULL, NULL,
               '2026-09-29T08:00:00Z', '2026-09-29T12:00:00Z'),
              (?, ?, 'Still In Hall', 'Niece', '2026-09-18', '2026-09-19', 'Visit.',
               'approved', 'paid', ?, '2026-09-17T10:00:00Z',
               ?, '2026-09-17T12:00:00Z', NULL,
               '2026-09-18T04:00:00Z', ?, NULL, NULL,
               '2026-09-17T08:00:00Z', '2026-09-18T04:00:00Z')
            """,
            (
                UNUSED_GUEST,
                test_home.RESIDENT_ID,
                test_home.WARDEN_ID,
                DEPARTED_GUEST,
                test_home.RESIDENT_ID,
                test_home.WARDEN_ID,
                test_home.WARDEN_ID,
                test_home.GATE_ID,
                test_home.GATE_ID,
                REJECTED_GUEST,
                test_home.RESIDENT_ID,
                test_home.WARDEN_ID,
                LIVE_GUEST,
                test_home.RESIDENT_ID,
                test_home.WARDEN_ID,
                ARRIVED_GUEST,
                test_home.RESIDENT_ID,
                test_home.WARDEN_ID,
                test_home.WARDEN_ID,
                test_home.GATE_ID,
            ),
        )
        connection.commit()
    finally:
        connection.close()


def _ids(body: dict) -> list[str]:
    return [item["id"] for item in body["items"]]


def test_resident_history(database_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    from app.main import app
    from app.shared import clock

    monkeypatch.setattr(clock, "utc_now", test_home.FrozenClock().utc_now)
    with TestClient(app) as client:
        test_home.issue_people(database_path)
        test_home.assert_error(
            client.get("/api/v1/me/history"),
            401,
            "unauthenticated",
            "Sign in again.",
        )
        gate = test_home.sign_in(client, "gate.fatima", role_credential("gate"))
        test_home.assert_error(
            client.get("/api/v1/me/history", headers={"Authorization": f"Bearer {gate}"}),
            403,
            "forbidden",
            "This account cannot do that.",
        )
        resident = test_home.sign_in(client, "24-GLLB-118", role_credential("resident"))
        headers = {"Authorization": f"Bearer {resident}"}
        empty = client.get("/api/v1/me/history", headers=headers)
        assert empty.status_code == 200
        assert empty.json() == {"items": [], "next_cursor": None}

        _seed(database_path)
        full = client.get("/api/v1/me/history", headers=headers)
        assert full.status_code == 200
        assert full.json() == {"items": ALL_ROWS, "next_cursor": None}

        # Paging walks the same rows in the same order, two at a time.
        walked: list[dict] = []
        cursor = None
        while True:
            query = "/api/v1/me/history?limit=2" + (f"&cursor={cursor}" if cursor else "")
            page = client.get(query, headers=headers).json()
            assert len(page["items"]) <= 2
            walked.extend(page["items"])
            cursor = page["next_cursor"]
            if cursor is None:
                break
        assert walked == ALL_ROWS
        assert client.get("/api/v1/me/history?cursor=bad!", headers=headers).status_code == 422
        same = client.get("/api/v1/me/history?kind=all", headers=headers)
        assert same.json() == full.json()

        listed = set(_ids(full.json()))
        assert FUTURE_OUTING not in listed
        assert STILL_OUT not in listed
        assert CANCELLED_FUTURE in listed
        assert CANCELLED_LATE in listed
        assert OTHER_OUTING not in listed
        assert LIVE_APPROVED not in listed
        assert REJECTED_LATE in listed
        assert PENDING_LATE not in listed
        assert IN_USE_LATE not in listed
        assert REJECTED_GUEST in listed
        assert LIVE_GUEST not in listed
        assert ARRIVED_GUEST not in listed
        assert "status" not in full.json()["items"][0]
        assert "recorded_by" not in full.json()["items"][0]

        outings = client.get("/api/v1/me/history?kind=outing", headers=headers)
        assert outings.status_code == 200
        assert outings.json()["items"] == [CANCELLED_LATER, FINISHED, UNUSED_PLAN, UNUSED_CANCELLED]
        late = client.get("/api/v1/me/history?kind=late_night", headers=headers)
        assert late.json()["items"] == [
            CANCELLED_PERMISSION,
            EXPIRED,
            COMPLETED,
            REJECTED_PERMISSION,
        ]
        home = client.get("/api/v1/me/history?kind=home_going", headers=headers)
        assert home.json()["items"] == [UNUSED_HOME_ROW]
        guests = client.get("/api/v1/me/history?kind=guest_stay", headers=headers)
        assert guests.json()["items"] == [UNUSED_STAY, DEPARTED, REJECTED_STAY]

        # Hall date of the finished gate times is 30 September, not the UTC date.
        on_end = client.get("/api/v1/me/history?on=2026-09-30", headers=headers)
        assert on_end.json()["items"] == [FINISHED]
        on_utc_date = client.get("/api/v1/me/history?on=2026-09-29", headers=headers)
        assert on_utc_date.json()["items"] == [UNUSED_PLAN]
        # Departed stay covers 20–22 September inclusive, including the day between.
        on_start = client.get("/api/v1/me/history?on=2026-09-20", headers=headers)
        assert on_start.json()["items"] == [DEPARTED, REJECTED_PERMISSION]
        on_middle = client.get("/api/v1/me/history?on=2026-09-21", headers=headers)
        assert on_middle.json()["items"] == [DEPARTED]
        on_last = client.get("/api/v1/me/history?on=2026-09-22", headers=headers)
        assert on_last.json()["items"] == [DEPARTED]
        on_before = client.get("/api/v1/me/history?on=2026-09-19", headers=headers)
        assert on_before.json() == {"items": [], "next_cursor": None}
        on_after = client.get("/api/v1/me/history?on=2026-09-23", headers=headers)
        assert [item["id"] for item in on_after.json()["items"]] == [CANCELLED_PASSED]
        narrowed = client.get(
            "/api/v1/me/history?kind=outing&on=2026-09-29",
            headers=headers,
        )
        assert narrowed.json()["items"] == [UNUSED_PLAN]
        # A range matches any row whose hall days overlap those dates.
        span = client.get(
            "/api/v1/me/history?from=2026-09-20&to=2026-09-22",
            headers=headers,
        )
        assert span.json()["items"] == [DEPARTED, REJECTED_PERMISSION]
        one_day = client.get(
            "/api/v1/me/history?from=2026-09-30&to=2026-09-30",
            headers=headers,
        )
        assert one_day.json()["items"] == [FINISHED]

        connection = sqlite3.connect(database_path)
        try:
            audit = [
                row[0]
                for row in connection.execute(
                    "SELECT action FROM audit_log ORDER BY occurred_at, rowid"
                )
            ]
        finally:
            connection.close()
        assert audit == ["auth.login", "auth.login"]
