"""LIKE search treats _ and % as characters."""

from __future__ import annotations

import sqlite3
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.shared.testing_env import role_credential
from app.staff.register.tests.staff_desk_records import store_guest_stays
from app.staff.register.tests.test_permission_queue import (
    AISHA_ID,
    ZARA_ID,
    FrozenClock,
    auth,
    issue_people,
    sign_in,
    store_pending_permissions,
)


def _rename(path: Path) -> None:
    connection = sqlite3.connect(path)
    try:
        connection.execute(
            "UPDATE users SET full_name = ? WHERE id = ?",
            ("Ann_Lee", AISHA_ID),
        )
        connection.execute(
            "UPDATE users SET full_name = ? WHERE id = ?",
            ("Pam%Poe", ZARA_ID),
        )
        connection.commit()
    finally:
        connection.close()


def test_like_search_matches_literal_wildcards(
    database_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    from app.shared import clock
    from app.shared.migrate import migrate

    monkeypatch.setattr(clock, "utc_now", FrozenClock().utc_now)
    migrate()
    issue_people(database_path)
    store_pending_permissions(database_path)
    store_guest_stays(database_path)
    _rename(database_path)

    from app.main import app

    with TestClient(app) as client:
        warden = sign_in(client, "warden.sara", role_credential("warden"))
        provost = sign_in(client, "provost.halima", role_credential("provost"))
        warden_headers = auth(warden)
        provost_headers = auth(provost)

        def ids(path: str, headers: dict[str, str], q: str, key: str = "id") -> set[str]:
            response = client.get(path, params={"q": q}, headers=headers)
            assert response.status_code == 200, response.text
            return {item[key] for item in response.json()["items"]}

        underscore = {
            "register": ids("/api/v1/register/residents", warden_headers, "_"),
            "office": ids("/api/v1/admin/residents", provost_headers, "_"),
            "notifications": ids(
                "/api/v1/register/notifications", warden_headers, "_", "resident_id"
            ),
            "permissions": ids("/api/v1/permissions", warden_headers, "_", "resident_id"),
            "guests": ids("/api/v1/guest-stays", warden_headers, "_", "host_name"),
        }
        percent = {
            "register": ids("/api/v1/register/residents", warden_headers, "%"),
            "office": ids("/api/v1/admin/residents", provost_headers, "%"),
            "notifications": ids(
                "/api/v1/register/notifications", warden_headers, "%", "resident_id"
            ),
            "permissions": ids("/api/v1/permissions", warden_headers, "%", "resident_id"),
            "guests": ids("/api/v1/guest-stays", warden_headers, "%", "host_name"),
        }

    assert underscore == {
        "register": {AISHA_ID},
        "office": {AISHA_ID},
        "notifications": {AISHA_ID},
        "permissions": {AISHA_ID},
        "guests": {"Ann_Lee"},
    }
    assert percent == {
        "register": {ZARA_ID},
        "office": {ZARA_ID},
        "notifications": {ZARA_ID},
        "permissions": {ZARA_ID},
        "guests": {"Pam%Poe"},
    }
