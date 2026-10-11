"""Create the hall records when the service starts.

A new hall database has PRAGMA user_version 0. Each migration leaves the
version at its own number. A database that is already current is left alone.
Production applies these statements on Turso. A development process applies
them to the local SQLite file.
"""

from __future__ import annotations

import re
from pathlib import Path

from app.shared.config import get_settings
from app.shared.db import create_connection

MIGRATIONS = tuple(sorted((Path(__file__).resolve().parent / "migrations").glob("*.sql")))
SCHEMA_VERSION = len(MIGRATIONS)
_VERSION_ASSIGNMENT = re.compile(r"PRAGMA\s+user_version\s*=\s*(\d+)\s*$", re.IGNORECASE)


def sql_statements(script: str) -> list[str]:
    """Split a migration script the way SQLite's executescript does.

    Semicolons inside quotes and inside a trigger body stay in that statement.
    """
    statements: list[str] = []
    buf: list[str] = []
    in_string = False
    begin_depth = 0
    i = 0
    length = len(script)
    while i < length:
        char = script[i]
        if in_string:
            buf.append(char)
            if char == "'":
                if i + 1 < length and script[i + 1] == "'":
                    buf.append("'")
                    i += 2
                    continue
                in_string = False
            i += 1
            continue
        if char == "-" and i + 1 < length and script[i + 1] == "-":
            while i < length and script[i] != "\n":
                buf.append(script[i])
                i += 1
            continue
        if char == "'":
            in_string = True
            buf.append(char)
            i += 1
            continue
        if char.isalpha() or char == "_":
            end = i + 1
            while end < length and (script[end].isalnum() or script[end] == "_"):
                end += 1
            word = script[i:end]
            buf.append(word)
            upper = word.upper()
            if upper == "BEGIN":
                begin_depth += 1
            elif upper == "END" and begin_depth:
                begin_depth -= 1
            i = end
            continue
        if char == ";" and begin_depth == 0:
            text = "".join(buf).strip()
            if text:
                statements.append(text)
            buf = []
            i += 1
            continue
        buf.append(char)
        i += 1
    tail = "".join(buf).strip()
    if tail:
        statements.append(tail)
    return statements


def _assigned_user_version(statement: str) -> int | None:
    kept = [
        line
        for line in statement.splitlines()
        if not line.strip().startswith("--")
    ]
    match = _VERSION_ASSIGNMENT.match("\n".join(kept).strip())
    if match is None:
        return None
    return int(match.group(1))


def _store_turso_version(connection: object, version: int) -> None:
    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS hall_schema (
          id TEXT PRIMARY KEY CHECK (id = 'hall'),
          version INTEGER NOT NULL
        )
        """
    )
    connection.execute(
        """
        INSERT INTO hall_schema (id, version) VALUES ('hall', ?)
        ON CONFLICT(id) DO UPDATE SET version = excluded.version
        """,
        (version,),
    )


def apply_script(connection: object, script: str, *, remote: bool) -> None:
    if not remote:
        connection.executescript(script)
        return
    for statement in sql_statements(script):
        version = _assigned_user_version(statement)
        if version is not None:
            _store_turso_version(connection, version)
            continue
        connection.execute(statement)
    connection.commit()


def current_version(connection: object, *, remote: bool) -> int:
    if not remote:
        return int(connection.execute("PRAGMA user_version").fetchone()[0])
    try:
        row = connection.execute(
            "SELECT version FROM hall_schema WHERE id = 'hall'"
        ).fetchone()
    except Exception:
        return 0
    if row is None:
        return 0
    return int(row[0])


def migrate() -> None:
    remote = get_settings().environment == "production"
    connection = create_connection()
    try:
        version = current_version(connection, remote=remote)
        if version > SCHEMA_VERSION:
            raise RuntimeError(
                f"Database user_version is {version}; this service expects {SCHEMA_VERSION}."
            )
        for path in MIGRATIONS[version:]:
            apply_script(connection, path.read_text(encoding="utf-8"), remote=remote)
            version = current_version(connection, remote=remote)
        if version != SCHEMA_VERSION:
            raise RuntimeError(
                f"Hall migration finished at user_version {version}; expected {SCHEMA_VERSION}."
            )
        connection.commit()
    finally:
        connection.close()
