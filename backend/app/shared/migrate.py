"""Create the hall records when the service starts.

A new database file has PRAGMA user_version 0. Each migration leaves the
version at its own number. A file that is already current is left alone.
"""

from __future__ import annotations

from pathlib import Path

from app.shared.db import create_connection

MIGRATIONS = tuple(sorted((Path(__file__).resolve().parent / "migrations").glob("*.sql")))
SCHEMA_VERSION = len(MIGRATIONS)


def migrate() -> None:
    connection = create_connection()
    try:
        version = connection.execute("PRAGMA user_version").fetchone()[0]
        if version > SCHEMA_VERSION:
            raise RuntimeError(
                f"Database user_version is {version}; this service expects {SCHEMA_VERSION}."
            )
        for path in MIGRATIONS[version:]:
            connection.executescript(path.read_text(encoding="utf-8"))
            version = connection.execute("PRAGMA user_version").fetchone()[0]
        if version != SCHEMA_VERSION:
            raise RuntimeError(
                f"Hall migration finished at user_version {version}; expected {SCHEMA_VERSION}."
            )
    finally:
        connection.close()
