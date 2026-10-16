""" readiness opens the hall database beside shallow health."""

from __future__ import annotations

from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.shared.migrate import SCHEMA_VERSION


def test_ready_reports_user_version(database_path: Path) -> None:
    from app.main import app

    with TestClient(app) as client:
        health = client.get("/health")
        assert health.status_code == 200
        assert health.json() == {"status": "ok"}

        ready = client.get("/ready")
        assert ready.status_code == 200
        assert ready.json() == {"status": "ready", "user_version": SCHEMA_VERSION}


def _point_at(monkeypatch: pytest.MonkeyPatch, path: Path) -> None:
    monkeypatch.setenv("DATABASE_PATH", str(path))
    from app.shared.config import get_settings

    get_settings.cache_clear()


def test_ready_refuses_a_database_it_cannot_open(
    database_path: Path, monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    from app.main import app

    with TestClient(app) as client:
        assert client.get("/health").json() == {"status": "ok"}

        missing = tmp_path / "absent" / "hostel.db"
        _point_at(monkeypatch, missing)
        refused = client.get("/ready")
        assert refused.status_code == 503
        assert refused.json()["error"]["code"] == "not_ready"
        assert refused.json()["error"]["message"] == "The hall database could not be opened."
        assert not missing.exists()
        assert not missing.parent.exists()
        assert client.get("/health").json() == {"status": "ok"}
        assert not missing.exists()

        folder = tmp_path / "a-directory"
        folder.mkdir()
        _point_at(monkeypatch, folder)
        refused_folder = client.get("/ready")
        assert refused_folder.status_code == 503
        assert refused_folder.json()["error"]["code"] == "not_ready"
        assert folder.is_dir()

        junk = tmp_path / "notes.txt"
        junk.write_text("not a database", encoding="utf-8")
        _point_at(monkeypatch, junk)
        refused_junk = client.get("/ready")
        assert refused_junk.status_code == 503
        assert refused_junk.json()["error"]["code"] == "not_ready"
        assert junk.read_text(encoding="utf-8") == "not a database"

        def timed_out(_connection: object) -> int:
            raise TimeoutError("timed out talking to the database")

        _point_at(monkeypatch, database_path)
        monkeypatch.setattr("app.main._schema_version", timed_out)
        refused_timeout = client.get("/ready")
        assert refused_timeout.status_code == 503
        assert refused_timeout.json()["error"]["code"] == "not_ready"
        assert refused_timeout.json()["error"]["message"] == "The hall database could not be opened."
        assert "timed out" not in refused_timeout.text
        assert "TimeoutError" not in refused_timeout.text
