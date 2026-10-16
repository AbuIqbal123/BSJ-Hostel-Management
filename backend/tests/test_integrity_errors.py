"""Plain SQLite and Turso raise different IntegrityError classes; one tuple covers both."""

from __future__ import annotations

import sqlite3

import turso_serverless

from app.shared.db import DB_ERRORS, INTEGRITY_ERRORS


def test_turso_integrity_error_is_not_a_sqlite_one() -> None:
    # The reason the tuple exists. If this ever becomes a subclass, the tuple can go.
    assert not issubclass(turso_serverless.IntegrityError, sqlite3.IntegrityError)


def test_db_errors_cover_sqlite_and_turso() -> None:
    for error in (
        sqlite3.OperationalError,
        sqlite3.DatabaseError,
        turso_serverless.OperationalError,
        turso_serverless.DatabaseError,
    ):
        try:
            raise error("database is locked")
        except DB_ERRORS as caught:
            assert "locked" in str(caught).lower()


def test_integrity_errors_cover_sqlite_and_turso() -> None:
    for error in (sqlite3.IntegrityError, turso_serverless.IntegrityError):
        try:
            raise error("UNIQUE constraint failed: users.username")
        except INTEGRITY_ERRORS as caught:
            assert "unique" in str(caught).lower()
