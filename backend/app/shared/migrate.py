"""Create the hall records when the service starts.

The published schema version stays 1 until the hall moves to production.
Migration files are applied in name order. Each file and its row in
schema_migrations commit together, so a crash cannot leave a file applied but
unrecorded. A database from before schema_migrations has the hall and no
record: the first PRAGMA user_version files are marked applied, because the
old scheme set user_version to the count it had run. With no record and no
user_version, startup refuses rather than guess.
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


def _apply(connection: object, path: Path) -> None:
    connection.executescript(
        "BEGIN;\n"
        f"{path.read_text(encoding='utf-8')}\n"
        f"INSERT INTO schema_migrations (filename) VALUES ('{path.name}');\n"
        "COMMIT;"
    )


def migrate() -> None:
    expected = {path.name for path in MIGRATIONS}
    connection = create_connection()
    try:
        connection.execute(_BOOKKEEPING)
        applied = applied_migrations(connection)
        if _table_exists(connection, "hall_settings") and not applied:
            ran = connection.execute("PRAGMA user_version").fetchone()[0]
            if not ran:
                raise RuntimeError(
                    "The hall database has tables but no record of its migrations. "
                    "Refusing to guess which ran."
                )
            for path in MIGRATIONS[:ran]:
                _mark_applied(connection, path.name)
            connection.commit()
            applied = applied_migrations(connection)
        # Table rebuilds need foreign keys off, and that pragma is ignored
        # inside the transaction each file runs in.
        connection.execute("PRAGMA foreign_keys=OFF")
        for path in MIGRATIONS:
            if path.name not in applied:
                _apply(connection, path)
        connection.execute("PRAGMA foreign_keys=ON")
        if applied_migrations(connection) != expected:
            raise RuntimeError(
                "Hall migration did not record every migration file. "
                f"The schema version stays {SCHEMA_VERSION} until production."
            )
    finally:
        connection.close()
