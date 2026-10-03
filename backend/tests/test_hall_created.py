"""Starting the service creates the hall described in docs/database/database.md."""

from __future__ import annotations

from app.shared.testing_env import signing_key_for_tests

import json
import sqlite3
from collections.abc import Iterator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

ARTIFACT = Path(__file__).resolve().parent / "artifacts" / "hall-inventory.json"
SEEDED_TABLES = {"hall_settings", "blocks", "destinations", "rooms"}
BOOLEAN_COLUMNS = {"is_active", "is_other"}


@pytest.fixture
def database_path(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Iterator[Path]:
    path = tmp_path / "hostel.db"
    monkeypatch.setenv("DATABASE_PATH", str(path))
    monkeypatch.setenv("ENVIRONMENT", "development")
    monkeypatch.setenv("SMS_DRIVER", "mock")
    monkeypatch.setenv("APP_SECRET_KEY", signing_key_for_tests())
    from app.shared.config import get_settings

    get_settings.cache_clear()
    yield path
    get_settings.cache_clear()


def _cell(column: str, value: object) -> object:
    if column in BOOLEAN_COLUMNS and value is not None:
        return bool(value)
    return value


def read_inventory(path: Path) -> dict:
    connection = sqlite3.connect(path)
    connection.row_factory = sqlite3.Row
    try:
        user_version = connection.execute("PRAGMA user_version").fetchone()[0]
        tables = [
            row[0]
            for row in connection.execute(
                """
                SELECT name FROM sqlite_master
                WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
                ORDER BY name
                """
            )
        ]
        columns = {
            table: [
                row[1]
                for row in connection.execute(f'PRAGMA table_info("{table}")')
            ]
            for table in tables
        }
        indexes = [
            row[0]
            for row in connection.execute(
                """
                SELECT name FROM sqlite_master
                WHERE type = 'index' AND sql IS NOT NULL
                ORDER BY name
                """
            )
        ]

        def rows(table: str, order: str) -> list[dict]:
            found = connection.execute(
                f"SELECT * FROM {table} ORDER BY {order}"
            ).fetchall()
            return [
                {key: _cell(key, row[key]) for key in row.keys()}
                for row in found
            ]

        empty = {
            table: connection.execute(f'SELECT COUNT(*) FROM "{table}"').fetchone()[0]
            for table in tables
            if table not in SEEDED_TABLES
        }
        return {
            "user_version": user_version,
            "tables": tables,
            "columns": columns,
            "indexes": indexes,
            "hall_settings": rows("hall_settings", "id"),
            "blocks": rows("blocks", "code"),
            "destinations": rows("destinations", "name COLLATE NOCASE"),
            "rooms": rows("rooms", "label"),
            "empty_tables": empty,
        }
    finally:
        connection.close()


def test_startup_creates_the_hall(database_path: Path) -> None:
    expected = json.loads(ARTIFACT.read_text(encoding="utf-8"))
    from app.main import app

    with TestClient(app) as client:
        first = client.get("/health")
    assert first.status_code == 200
    assert first.json() == {"status": "ok"}

    with TestClient(app) as client:
        second = client.get("/health")
    assert second.status_code == 200
    assert second.json() == {"status": "ok"}

    assert database_path.is_file(), "startup did not create the hall database"
    assert read_inventory(database_path) == expected
