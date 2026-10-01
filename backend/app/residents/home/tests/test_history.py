"""Own exit and return history for the resident phone."""

from __future__ import annotations

import json
import sqlite3
from collections.abc import Iterator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.dev_seed import GATE_PHRASE, RESIDENT_PHRASE
from app.residents.home.tests import test_home

ARTIFACT = Path(__file__).resolve().parent / "artifacts" / "resident-history.json"


@pytest.fixture
def database_path(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Iterator[Path]:
    path = tmp_path / "hostel.db"
    monkeypatch.setenv("DATABASE_PATH", str(path))
    monkeypatch.setenv("ENVIRONMENT", "development")
    monkeypatch.setenv("SMS_DRIVER", "mock")
    monkeypatch.setenv("APP_SECRET_KEY", "test-only-auth-secret")
    from app.shared.config import get_settings

    get_settings.cache_clear()
    yield path
    get_settings.cache_clear()


def test_resident_history(database_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    expected = json.loads(ARTIFACT.read_text(encoding="utf-8"))
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
        gate = test_home.sign_in(client, "gate.fatima", GATE_PHRASE)
        test_home.assert_error(
            client.get("/api/v1/me/history", headers={"Authorization": f"Bearer {gate}"}),
            403,
            "forbidden",
            "This account cannot do that.",
        )
        resident = test_home.sign_in(client, "24-GLLB-118", RESIDENT_PHRASE)
        headers = {"Authorization": f"Bearer {resident}"}
        empty = client.get("/api/v1/me/history", headers=headers)
        assert empty.status_code == 200
        assert empty.json() == expected["empty"]

        test_home.store_open_day(database_path)
        full = client.get("/api/v1/me/history", headers=headers)
        assert full.status_code == 200
        assert full.json() == expected["full"]

        page = client.get("/api/v1/me/history?limit=3&offset=0", headers=headers)
        assert page.status_code == 200
        assert page.json() == expected["page"]

        tail = client.get("/api/v1/me/history?limit=3&offset=9", headers=headers)
        assert tail.status_code == 200
        assert tail.json() == expected["tail"]

        home_recent = json.loads(test_home.ARTIFACT.read_text(encoding="utf-8"))["outside"][
            "recent_history"
        ]
        assert full.json()["items"][:10] == home_recent
        assert all(item["place"] != "Other hall" for item in full.json()["items"])
        assert all(item["place"] != "Cancelled plan" for item in full.json()["items"])

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
