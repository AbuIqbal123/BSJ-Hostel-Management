"""Database connection for one request.

The success response is sent only after this transaction commits. FastAPI runs
the code after `yield` once the response has already started, so a failed
commit there cannot change the status line.
"""

from __future__ import annotations

import os
import sqlite3
from collections.abc import Iterator
from typing import Any

from fastapi import Request

from app.shared.config import Settings, get_settings


def _named_row(cursor: object, row: object) -> object:
    """Turso already built a name-and-index row. Keep it."""
    return row


def _connect_turso(settings: Settings) -> Any:
    if os.environ.get("DATABASE_PATH", "").strip():
        raise RuntimeError(
            "DATABASE_PATH is set, but production keeps the hall database on "
            "Turso and does not open a database file. Remove DATABASE_PATH."
        )
    url = settings.turso_database_url.strip()
    token = settings.turso_auth_token.strip()
    if not url or not token:
        raise RuntimeError(
            "Production keeps the hall database on Turso. "
            "Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN. "
            "Refusing to open a database file."
        )
    if url.lower().startswith(("file:", "sqlite:")) or "://" not in url:
        raise RuntimeError(
            "TURSO_DATABASE_URL must be a Turso URL. Refusing to open a database file."
        )
    import turso_serverless

    connection = turso_serverless.connect(url, auth_token=token)
    connection.row_factory = _named_row
    connection.execute("PRAGMA foreign_keys=ON;")
    return connection


def create_connection() -> Any:
    settings = get_settings()
    if settings.environment == "production":
        return _connect_turso(settings)
    settings.database_path.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(
        settings.database_path,
        timeout=settings.sqlite_busy_timeout_ms / 1000,
        check_same_thread=False,
    )
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA journal_mode=WAL;")
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
        del request.state.hall_connection
        connection.close()


def hall_settings(connection: sqlite3.Connection) -> sqlite3.Row:
    """The one settings row. Migration 0001 seeds it and a trigger keeps it."""
    return connection.execute("SELECT * FROM hall_settings WHERE id = 'hall'").fetchone()
