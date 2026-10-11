"""Starting the service creates the hall described in docs/database/database.md."""

from __future__ import annotations

import json
import sqlite3
from pathlib import Path

from fastapi.testclient import TestClient

from app.shared.migrate import MIGRATIONS, SCHEMA_VERSION, applied_migrations

ARTIFACT = Path(__file__).resolve().parent / "artifacts" / "hall-inventory.json"
SEEDED_TABLES = {"hall_settings", "blocks", "destinations", "rooms"}
BOOKKEEPING_TABLES = {"schema_migrations"}
BOOLEAN_COLUMNS = {"is_active", "is_other"}


def _cell(column: str, value: object) -> object:
    if column in BOOLEAN_COLUMNS and value is not None:
        return bool(value)
    return value


def read_inventory(path: Path) -> dict:
    connection = sqlite3.connect(path)
    connection.row_factory = sqlite3.Row
    try:
        applied = applied_migrations(connection)
        user_version = (
            SCHEMA_VERSION
            if applied == {path.name for path in MIGRATIONS}
            else 0
        )
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
            if table not in SEEDED_TABLES | BOOKKEEPING_TABLES
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
