"""Resident guest list: upcoming stays first, older stays on request."""

from __future__ import annotations

from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.residents.guests.tests.test_lifecycle import (
    APPROVED_STAY,
    ARRIVED_STAY,
    OTHER_STAY,
    PAID_INSIDE_STAY,
    PAID_PAST_STAY,
    REJECTED_STAY,
    UNPAID_INSIDE_STAY,
    GATE_ID,
    FrozenClock,
    issue_people,
    seed_expected_boundary_stays,
    seed_staff_shaped_stays,
    sign_in,
)
from app.shared.testing_env import role_credential


def ids(response) -> list[str]:
    assert response.status_code == 200
    return [item["id"] for item in response.json()["items"]]


def test_own_guest_stays_upcoming_and_older(
    database_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    from app.main import app
    from app.shared import clock

    monkeypatch.setattr(clock, "utc_now", FrozenClock().utc_now)
    with TestClient(app) as client:
        issue_people(database_path)
        seed_staff_shaped_stays(database_path)
        seed_expected_boundary_stays(database_path)
        resident = sign_in(client, "24-GLLB-118", role_credential("resident"))
        headers = {"Authorization": f"Bearer {resident}"}
        base = "/api/v1/me/guest-stays"

        upcoming = client.get(f"{base}?when=upcoming", headers=headers)
        assert ids(upcoming) == [
            ARRIVED_STAY,
            PAID_INSIDE_STAY,
            UNPAID_INSIDE_STAY,
            APPROVED_STAY,
        ]
        assert upcoming.json()["total"] == 4
        past = client.get(f"{base}?when=past", headers=headers)
        assert ids(past) == [REJECTED_STAY, PAID_PAST_STAY]
        assert past.json()["total"] == 2

        # Each stay is in exactly one of the two lists, and another host's stay is in neither.
        everything = client.get(f"{base}?limit=500", headers=headers)
        assert sorted(ids(everything)) == sorted(ids(upcoming) + ids(past))
        assert OTHER_STAY not in ids(everything)

        # Older stays page by offset, nothing repeats.
        first = client.get(f"{base}?when=past&limit=1&offset=0", headers=headers)
        second = client.get(f"{base}?when=past&limit=1&offset=1", headers=headers)
        assert ids(first) == [REJECTED_STAY]
        assert ids(second) == [PAID_PAST_STAY]
        assert second.json()["total"] == 2

        bad = client.get(f"{base}?when=soon", headers=headers)
        assert bad.status_code == 422


def test_own_guest_stays_left_and_cancelled_are_older(
    database_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    import sqlite3

    from app.main import app
    from app.shared import clock

    monkeypatch.setattr(clock, "utc_now", FrozenClock().utc_now)
    with TestClient(app) as client:
        issue_people(database_path)
        seed_staff_shaped_stays(database_path)
        connection = sqlite3.connect(database_path)
        try:
            connection.execute(
                "UPDATE guest_stays SET departed_at = '2026-09-30T10:00:00Z', "
                "departed_recorded_by = ?, status = 'departed' WHERE id = ?",
                (GATE_ID, ARRIVED_STAY),
            )
            connection.execute(
                "UPDATE guest_stays SET status = 'cancelled', decided_by = NULL, decided_at = NULL WHERE id = ?",
                (APPROVED_STAY,),
            )
            connection.commit()
        finally:
            connection.close()
        resident = sign_in(client, "24-GLLB-118", role_credential("resident"))
        headers = {"Authorization": f"Bearer {resident}"}
        base = "/api/v1/me/guest-stays"
        assert ids(client.get(f"{base}?when=upcoming", headers=headers)) == []
        assert set(ids(client.get(f"{base}?when=past", headers=headers))) == {
            ARRIVED_STAY,
            APPROVED_STAY,
            REJECTED_STAY,
        }
