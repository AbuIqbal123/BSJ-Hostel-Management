"""Create the hall records when the service starts.

The published schema version stays 1 until the hall moves to production.
Migration files are applied in name order. Each applied file is recorded in
schema_migrations. A database that already has the hall and no record yet is
marked applied, because those files already ran during dev.
"""

from __future__ import annotations

from pathlib import Path

from app.shared.db import create_connection

MIGRATIONS = tuple(sorted((Path(__file__).resolve().parent / "migrations").glob("*.sql")))
SCHEMA_VERSION = 1

_BOOKKEEPING = """
CREATE TABLE IF NOT EXISTS schema_migrations (
  filename TEXT PRIMARY KEY
)
"""


def _table_exists(connection: object, name: str) -> bool:
    row = connection.execute(
        "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?",
        (name,),
    ).fetchone()
    return row is not None


def applied_migrations(connection: object) -> set[str]:
    if not _table_exists(connection, "schema_migrations"):
        return set()
    return {
        row[0]
        for row in connection.execute(
            "SELECT filename FROM schema_migrations"
        ).fetchall()
    }


def _mark_applied(connection: object, filename: str) -> None:
    connection.execute(
        "INSERT INTO schema_migrations (filename) VALUES (?)",
        (filename,),
    )


def migrate() -> None:
    expected = {path.name for path in MIGRATIONS}
    connection = create_connection()
    try:
        connection.execute(_BOOKKEEPING)
        applied = applied_migrations(connection)
        if _table_exists(connection, "hall_settings") and not applied:
            for path in MIGRATIONS:
                _mark_applied(connection, path.name)
        else:
            for path in MIGRATIONS:
                if path.name in applied:
                    continue
                connection.executescript(path.read_text(encoding="utf-8"))
                _mark_applied(connection, path.name)
        connection.commit()
        if applied_migrations(connection) != expected:
            raise RuntimeError(
                "Hall migration did not record every migration file. "
                f"The schema version stays {SCHEMA_VERSION} until production."
            )
    finally:
        connection.close()
