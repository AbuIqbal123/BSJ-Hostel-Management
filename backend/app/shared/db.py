"""SQLite connection for one environment.

Each connection uses WAL, a busy timeout, and foreign keys. The hall
records are created by app.shared.migrate when the service starts. Callers open
a short transaction and close it.
"""

from __future__ import annotations

import sqlite3
from collections.abc import Iterator

from app.shared.config import get_settings


def create_connection() -> sqlite3.Connection:
    settings = get_settings()
    settings.database_path.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(
        settings.database_path,
        timeout=settings.sqlite_busy_timeout_ms / 1000,
        check_same_thread=False,
    )
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA journal_mode=WAL;")
    connection.execute(f"PRAGMA busy_timeout={int(settings.sqlite_busy_timeout_ms)};")
    connection.execute("PRAGMA foreign_keys=ON;")
    return connection


def get_connection() -> Iterator[sqlite3.Connection]:
    connection = create_connection()
    try:
        yield connection
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()
