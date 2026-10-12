"""Outings and requests stored straight into the hall for staff desk checks."""

from __future__ import annotations

import sqlite3
from pathlib import Path

from app.staff.register.tests.test_permission_queue import (
    AISHA_ID,
    GATE_ID,
    WARDEN_ID,
    ZARA_ID,
)

PERM_USED = "f8800000-0000-4000-8000-000000000051"
OUT_LATE_NOW = "0a700000-0000-4000-8000-000000000061"
OUT_LATE_PAST = "0a700000-0000-4000-8000-000000000062"
OUT_ON_TIME = "0a700000-0000-4000-8000-000000000063"
STAY_B = "9e500000-0000-4000-8000-000000000071"
STAY_A = "9e500000-0000-4000-8000-000000000072"


def _outing(connection, outing_id, resident_id, permission_id, kind, status, place,
            expected, grace, exited, returned, created) -> None:
    connection.execute(
        """
        INSERT INTO outings (
          id, resident_id, permission_id, type, status, place,
          expected_return_at, grace_ends_at, exited_at, exit_recorded_by,
          returned_at, return_recorded_by, created_at, updated_at, hall_date
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
          date(datetime(replace(?, 'Z', ''), '+5 hours', '+30 minutes')))
        """,
        (
            outing_id, resident_id, permission_id, kind, status, place,
            expected, grace, exited, None if exited is None else GATE_ID,
            returned, None if returned is None else GATE_ID, created, created, expected,
        ),
    )


def store_outings(path: Path) -> None:
    """Aisha is out and late now; Zara came back late yesterday and on time before."""
    connection = sqlite3.connect(path)
    try:
        connection.execute("PRAGMA foreign_keys=ON;")
        connection.execute(
            """
            INSERT INTO permissions (
              id, resident_id, type, status, short_place, reason, departure_at,
              expected_return_at, decided_by, decided_at, created_at, updated_at
            ) VALUES (?, ?, 'late_night', 'completed', 'City library', 'Late study.',
              '2026-09-29T13:00:00Z', '2026-09-29T16:00:00Z', ?,
              '2026-09-28T10:00:00Z', '2026-09-28T09:00:00Z', '2026-09-29T16:45:00Z')
            """,
            (PERM_USED, ZARA_ID, WARDEN_ID),
        )
        _outing(connection, OUT_LATE_NOW, AISHA_ID, None, "ordinary", "outside", "Market",
                "2026-09-30T12:00:00Z", "2026-09-30T12:15:00Z",
                "2026-09-30T09:00:00Z", None, "2026-09-30T08:00:00Z")
        _outing(connection, OUT_LATE_PAST, ZARA_ID, PERM_USED, "late_night", "returned",
                "City library", "2026-09-29T16:00:00Z", "2026-09-29T16:15:00Z",
                "2026-09-29T13:00:00Z", "2026-09-29T16:45:00Z", "2026-09-29T12:00:00Z")
        _outing(connection, OUT_ON_TIME, ZARA_ID, None, "ordinary", "returned", "Bank",
                "2026-09-28T11:00:00Z", "2026-09-28T11:15:00Z",
                "2026-09-28T08:00:00Z", "2026-09-28T10:00:00Z", "2026-09-28T07:00:00Z")
        connection.execute(
            "UPDATE residents SET presence = 'outside' WHERE user_id = ?", (AISHA_ID,)
        )
        connection.commit()
    finally:
        connection.close()


def store_guest_stays(path: Path) -> None:
    """One pending stay hosted in block B, one in block A."""
    connection = sqlite3.connect(path)
    try:
        connection.execute("PRAGMA foreign_keys=ON;")
        for stay_id, host, guest, created in (
            (STAY_B, AISHA_ID, "Noor Khan", "2026-09-30T09:30:00Z"),
            (STAY_A, ZARA_ID, "Mehr Ahmed", "2026-09-30T08:30:00Z"),
        ):
            connection.execute(
                """
                INSERT INTO guest_stays (
                  id, host_resident_id, guest_name, relation, guest_start_date,
                  guest_end_date, reason, status, created_at, updated_at
                ) VALUES (?, ?, ?, 'Sister', '2026-10-05', '2026-10-06', 'Visit.',
                  'pending', ?, ?)
                """,
                (stay_id, host, guest, created, created),
            )
        connection.commit()
    finally:
        connection.close()
