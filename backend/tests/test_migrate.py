"""A migration file and its record commit together, and an unrecorded hall is not guessed."""

from __future__ import annotations

import sqlite3
from pathlib import Path

import pytest

from app.shared import migrate as migration


def _tables(path: Path) -> set[str]:
    connection = sqlite3.connect(path)
    try:
        return {row[0] for row in connection.execute("SELECT name FROM sqlite_master WHERE type = 'table'")}
    finally:
        connection.close()


def _forget_records(path: Path, user_version: int) -> None:
    connection = sqlite3.connect(path)
    try:
        connection.execute("DELETE FROM schema_migrations")
        connection.execute(f"PRAGMA user_version = {user_version}")
        connection.commit()
    finally:
        connection.close()


def test_a_failed_file_leaves_nothing_behind(
    database_path: Path, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    broken = tmp_path / "9999_broken.sql"
    broken.write_text(
        "CREATE TABLE half_done (x INTEGER);\nINSERT INTO no_such_table VALUES (1);\n",
        encoding="utf-8",
    )
    migration.migrate()
    monkeypatch.setattr(migration, "MIGRATIONS", (*migration.MIGRATIONS, broken))
    with pytest.raises(sqlite3.OperationalError):
        migration.migrate()
    assert "half_done" not in _tables(database_path)
    connection = sqlite3.connect(database_path)
    try:
        assert broken.name not in migration.applied_migrations(connection)
    finally:
        connection.close()


def test_a_hall_from_before_the_records_uses_user_version(database_path: Path) -> None:
    migration.migrate()
    _forget_records(database_path, len(migration.MIGRATIONS))
    migration.migrate()
    connection = sqlite3.connect(database_path)
    try:
        assert migration.applied_migrations(connection) == {
            path.name for path in migration.MIGRATIONS
        }
    finally:
        connection.close()


def test_a_hall_with_no_record_and_no_user_version_is_refused(database_path: Path) -> None:
    migration.migrate()
    _forget_records(database_path, 0)
    with pytest.raises(RuntimeError, match="no record of its migrations"):
        migration.migrate()
