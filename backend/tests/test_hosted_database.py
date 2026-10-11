"""The hosted API keeps the hall database on Turso and writes no database file."""

from __future__ import annotations

from collections.abc import Iterator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

import sqlite3

from app.shared.migrate import MIGRATIONS, SCHEMA_VERSION, apply_script
from app.shared.testing_env import signing_key_for_tests

TURSO_URL = "libsql://bsj-hall.turso.io"
TURSO_TOKEN = "hosted-token-not-a-secret"


class _Cursor:
    def __init__(self, sql: str) -> None:
        self.sql = sql

    def fetchone(self) -> tuple[int]:
        return (SCHEMA_VERSION,)

    def fetchall(self) -> list[object]:
        return []


class _Connection:
    def __init__(self) -> None:
        self.row_factory = None
        self.statements: list[str] = []
        self.closed = False

    def execute(self, sql: str, parameters: object = ()) -> _Cursor:
        self.statements.append(sql)
        return _Cursor(sql)

    def executescript(self, sql_script: str) -> _Cursor:
        self.statements.append(sql_script)
        return _Cursor(sql_script)

    def commit(self) -> None:
        return None

    def rollback(self) -> None:
        return None

    def close(self) -> None:
        self.closed = True


@pytest.fixture
def hosted_env(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Iterator[Path]:
    database = tmp_path / "must-not-exist" / "hostel.db"
    monkeypatch.setenv("ENVIRONMENT", "production")
    monkeypatch.setenv("SMS_DRIVER", "mock")
    monkeypatch.setenv("APP_SECRET_KEY", signing_key_for_tests())
    monkeypatch.setenv("DATABASE_PATH", str(database))
    monkeypatch.delenv("TURSO_DATABASE_URL", raising=False)
    monkeypatch.delenv("TURSO_AUTH_TOKEN", raising=False)
    from app.shared.config import get_settings

    get_settings.cache_clear()
    yield database
    get_settings.cache_clear()


def test_production_refuses_to_open_a_database_file(hosted_env: Path) -> None:
    from app.shared.db import create_connection

    with pytest.raises(RuntimeError, match="Turso"):
        create_connection()
    assert not hosted_env.exists()
    assert not hosted_env.parent.exists()


def test_production_refuses_a_file_url(hosted_env: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("DATABASE_PATH", raising=False)
    monkeypatch.setenv("TURSO_DATABASE_URL", "file:hostel.db")
    monkeypatch.setenv("TURSO_AUTH_TOKEN", TURSO_TOKEN)
    from app.shared.config import get_settings
    from app.shared.db import create_connection

    get_settings.cache_clear()
    with pytest.raises(RuntimeError, match="database file"):
        create_connection()
    assert not hosted_env.exists()


def test_production_opens_turso_and_writes_no_file(
    hosted_env: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.delenv("DATABASE_PATH", raising=False)
    monkeypatch.setenv("TURSO_DATABASE_URL", TURSO_URL)
    monkeypatch.setenv("TURSO_AUTH_TOKEN", TURSO_TOKEN)
    opened: list[tuple[str, str]] = []
    remote = _Connection()

    def connect(url: str, *, auth_token: str | None = None, **kwargs: object) -> _Connection:
        opened.append((url, auth_token or ""))
        assert kwargs == {}
        return remote

    monkeypatch.setattr("turso_serverless.connect", connect)
    from app.shared.config import get_settings
    from app.shared.db import create_connection

    get_settings.cache_clear()
    connection = create_connection()
    assert opened == [(TURSO_URL, TURSO_TOKEN)]
    assert connection.row_factory is not None
    assert any("foreign_keys" in statement for statement in remote.statements)
    assert all("journal_mode" not in statement for statement in remote.statements)
    assert not hosted_env.exists()
    assert not (hosted_env.parent.parent / "data").exists()


def test_ready_uses_turso_and_does_not_create_a_file(
    hosted_env: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.delenv("DATABASE_PATH", raising=False)
    monkeypatch.setenv("TURSO_DATABASE_URL", TURSO_URL)
    monkeypatch.setenv("TURSO_AUTH_TOKEN", TURSO_TOKEN)
    remote = _Connection()
    calls = {"n": 0}

    def connect(url: str, *, auth_token: str | None = None, **kwargs: object) -> _Connection:
        calls["n"] += 1
        if calls["n"] > 1:
            raise RuntimeError("turso unavailable")
        return remote

    monkeypatch.setattr("turso_serverless.connect", connect)
    from app.shared.config import get_settings

    get_settings.cache_clear()
    from app.main import app

    with TestClient(app) as client:
        assert client.get("/health").json() == {"status": "ok"}
        ready = client.get("/ready")
        assert ready.status_code == 503
        assert ready.json()["error"]["code"] == "not_ready"
        assert ready.json()["error"]["message"] == "The hall database could not be opened."
    assert not hosted_env.exists()
    assert calls["n"] == 2


def test_turso_script_shape_matches_sqlite(tmp_path: Path) -> None:
    direct = tmp_path / "direct.db"
    split = tmp_path / "split.db"
    with sqlite3.connect(direct) as connection:
        for path in MIGRATIONS:
            connection.executescript(path.read_text(encoding="utf-8"))
    with sqlite3.connect(split) as connection:
        for path in MIGRATIONS:
            apply_script(connection, path.read_text(encoding="utf-8"), remote=True)
            connection.execute(
                "PRAGMA user_version = " + str(
                    connection.execute(
                        "SELECT version FROM hall_schema WHERE id = 'hall'"
                    ).fetchone()[0]
                )
            )

    def names(path: Path) -> list[str]:
        with sqlite3.connect(path) as connection:
            return [
                row[0]
                for row in connection.execute(
                    """
                    SELECT name FROM sqlite_master
                    WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
                    ORDER BY name
                    """
                )
            ]

    assert names(direct) == [name for name in names(split) if name != "hall_schema"]
    with sqlite3.connect(split) as connection:
        assert connection.execute("PRAGMA user_version").fetchone()[0] == SCHEMA_VERSION
        assert connection.execute("SELECT COUNT(*) FROM rooms").fetchone()[0] > 0
