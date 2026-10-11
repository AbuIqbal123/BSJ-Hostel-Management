"""The hosted API keeps the hall database on Turso and writes no database file."""

from __future__ import annotations

from collections.abc import Iterator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.shared.migrate import MIGRATIONS
from app.shared.testing_env import signing_key_for_tests

TURSO_URL = "libsql://bsj-hall.turso.io"
TURSO_TOKEN = "hosted-token-not-a-secret"


class _Connection:
    def __init__(self) -> None:
        self.row_factory = None
        self.statements: list[str] = []

    def execute(self, sql: str, parameters: object = ()) -> None:
        self.statements.append(sql)


@pytest.fixture
def hosted_env(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Iterator[Path]:
    database = tmp_path / "must-not-exist" / "hostel.db"
    monkeypatch.setenv("ENVIRONMENT", "production")
    monkeypatch.setenv("RENDER", "true")
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


def test_ready_uses_turso_and_does_not_create_a_file(
    hosted_env: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.delenv("DATABASE_PATH", raising=False)
    monkeypatch.setenv("TURSO_DATABASE_URL", TURSO_URL)
    monkeypatch.setenv("TURSO_AUTH_TOKEN", TURSO_TOKEN)

    def connect(url: str, *, auth_token: str | None = None, **kwargs: object) -> None:
        raise RuntimeError("turso unavailable")

    monkeypatch.setattr("turso_serverless.connect", connect)
    from app.shared.config import get_settings

    get_settings.cache_clear()
    import app.main

    monkeypatch.setattr(app.main, "migrate", lambda: None)
    app = app.main.app

    with TestClient(app) as client:
        assert client.get("/health").json() == {"status": "ok"}
        ready = client.get("/ready")
        assert ready.status_code == 503
        assert ready.json()["error"]["code"] == "not_ready"
        assert ready.json()["error"]["message"] == "The hall database could not be opened."
    assert not hosted_env.exists()


def test_a_laptop_ignores_turso_and_opens_the_file(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    database = tmp_path / "hostel.db"
    monkeypatch.setenv("ENVIRONMENT", "production")
    monkeypatch.setenv("DATABASE_PATH", str(database))
    monkeypatch.setenv("TURSO_DATABASE_URL", TURSO_URL)
    monkeypatch.setenv("TURSO_AUTH_TOKEN", TURSO_TOKEN)
    monkeypatch.setenv("SMS_DRIVER", "mock")
    monkeypatch.setenv("APP_SECRET_KEY", signing_key_for_tests())
    monkeypatch.delenv("RENDER", raising=False)
    called: list[str] = []

    def connect(url: str, *, auth_token: str | None = None, **kwargs: object) -> None:
        called.append(url)

    monkeypatch.setattr("turso_serverless.connect", connect)
    from app.shared.config import get_settings
    from app.shared.db import create_connection

    get_settings.cache_clear()
    connection = create_connection()
    connection.close()
    assert database.is_file()
    assert called == []


def test_migration_files_do_not_set_a_pragma_version() -> None:
    for path in MIGRATIONS:
        assert "user_version" not in path.read_text(encoding="utf-8").lower()
