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


def test_notifications_upgrade_keeps_her_inbox_and_quiets_the_past(
    database_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """0018 on a live hall: old decision rows survive, staff start read, late-now gets a read row."""
    from app.staff.register.tests.staff_desk_records import OUT_LATE_NOW, store_outings
    from app.staff.register.tests.test_permission_queue import (
        AISHA_ID,
        WARDEN_ID,
        issue_people,
    )

    before = tuple(path for path in migration.MIGRATIONS if path.name < "0018")
    monkeypatch.setattr(migration, "MIGRATIONS", before)
    migration.migrate()
    issue_people(database_path)
    store_outings(database_path)
    connection = sqlite3.connect(database_path)
    try:
        connection.execute(
            """
            INSERT INTO permissions (
              id, resident_id, type, status, short_place, reason, departure_at,
              expected_return_at, decided_by, decided_at, created_at, updated_at
            ) VALUES ('f8800000-0000-4000-8000-0000000000aa', ?, 'late_night', 'approved',
              'Library', 'Study.', '2026-09-30T14:00:00Z', '2026-09-30T18:00:00Z', ?,
              '2026-09-30T12:00:00Z', '2026-09-30T11:00:00Z', '2026-09-30T12:00:00Z')
            """,
            (AISHA_ID, WARDEN_ID),
        )
        connection.execute(
            """
            INSERT INTO resident_notifications (id, resident_id, permission_id, decision, created_at)
            VALUES ('aaaaaaaa-0000-4000-8000-000000000001', ?,
              'f8800000-0000-4000-8000-0000000000aa', 'approved', '2026-09-30T12:00:00Z')
            """,
            (AISHA_ID,),
        )
        connection.commit()
    finally:
        connection.close()

    monkeypatch.undo()
    migration.migrate()
    connection = sqlite3.connect(database_path)
    try:
        rows = connection.execute(
            "SELECT kind, record_id, decision, read_at IS NULL FROM resident_notifications ORDER BY kind"
        ).fetchall()
        assert rows == [
            ("permission_decided", "f8800000-0000-4000-8000-0000000000aa", "approved", 1),
            ("resident_late", OUT_LATE_NOW, None, 0),
        ]
        unset = connection.execute(
            "SELECT COUNT(*) FROM staff WHERE notifications_read_at IS NULL"
        ).fetchone()[0]
        assert unset == 0
    finally:
        connection.close()
