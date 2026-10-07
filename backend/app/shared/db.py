"""SQLite connection for one environment.

Each connection uses WAL, a busy timeout, and foreign keys. The hall
records are created by app.shared.migrate when the service starts. Callers open
a short transaction and close it.

The success response is sent only after this transaction commits. FastAPI runs
the code after `yield` once the response has already started, so a failed
commit there cannot change the status line.
"""

from __future__ import annotations

import sqlite3
from collections.abc import Iterator
from typing import Any

from fastapi import Request

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
    busy_timeout_ms = int(settings.sqlite_busy_timeout_ms)
    connection.execute("PRAGMA busy_timeout=" + str(busy_timeout_ms) + ";")
    connection.execute("PRAGMA foreign_keys=ON;")
    return connection


def commit_request(scope: dict[str, Any]) -> None:
    """Commit the open request transaction before the status line is sent."""
    state = scope.get("state")
    connection = state.get("hall_connection") if isinstance(state, dict) else None
    if connection is not None:
        connection.commit()


def get_connection(request: Request) -> Iterator[sqlite3.Connection]:
    connection = create_connection()
    request.state.hall_connection = connection
    try:
        yield connection
    except Exception:
        connection.rollback()
        raise
    finally:
        if getattr(request.state, "hall_connection", None) is connection:
            del request.state.hall_connection
        connection.close()


def hall_settings(connection: sqlite3.Connection) -> sqlite3.Row:
    """The one settings row. Migration 0001 seeds it and a trigger keeps it."""
    return connection.execute("SELECT * FROM hall_settings WHERE id = 'hall'").fetchone()
