"""Create the hall records when the service starts.

A new database file has PRAGMA user_version 0. Each migration leaves the
version at its own number. A file that is already current is left alone.
"""

from __future__ import annotations

from pathlib import Path

from app.shared.db import create_connection

SCHEMA_VERSION = 14
MIGRATIONS = (
    Path(__file__).resolve().parent / "migrations" / "0001_create_hall.sql",
    Path(__file__).resolve().parent / "migrations" / "0002_outing_days.sql",
    Path(__file__).resolve().parent / "migrations" / "0003_outing_returns.sql",
    Path(__file__).resolve().parent / "migrations" / "0004_query_indexes.sql",
    Path(__file__).resolve().parent / "migrations" / "0005_late_sms_hall_name.sql",
    Path(__file__).resolve().parent / "migrations" / "0006_guest_stay_date_columns.sql",
    Path(__file__).resolve().parent / "migrations" / "0007_guest_stay_pending_after_arrival.sql",
    Path(__file__).resolve().parent / "migrations" / "0008_guest_stay_payment_note.sql",
    Path(__file__).resolve().parent / "migrations" / "0009_settings_outing_lead_rename.sql",
    Path(__file__).resolve().parent / "migrations" / "0010_resident_phone.sql",
    Path(__file__).resolve().parent / "migrations" / "0011_guest_stay_payment_evidence.sql",
    Path(__file__).resolve().parent / "migrations" / "0012_resident_block_rooms.sql",
    Path(__file__).resolve().parent / "migrations" / "0013_outing_starts_at.sql",
    Path(__file__).resolve().parent / "migrations" / "0014_outing_updated_audit.sql",
)


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
