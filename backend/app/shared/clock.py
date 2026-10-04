"""Hall clock.

Stored instants come from this function so a test can freeze the time.
The value is UTC.
"""

from __future__ import annotations

import sqlite3
from datetime import datetime, timezone
from zoneinfo import ZoneInfo


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def format_instant(moment: datetime) -> str:
    """UTC instant as YYYY-MM-DDTHH:MM:SSZ, without a fraction of a second."""
    if moment.tzinfo is None:
        raise ValueError("instant must include a timezone")
    return moment.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def parse_instant(value: str) -> datetime:
    """Parse YYYY-MM-DDTHH:MM:SSZ into a UTC datetime."""
    return datetime.strptime(value, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc)


def hall_local_date(source: sqlite3.Connection | str, moment: datetime) -> str:
    """Hall calendar date for a moment, as YYYY-MM-DD.

    `source` is a timezone name, or a connection that holds hall_settings.
    """
    if isinstance(source, str):
        timezone_name = source
    else:
        row = source.execute(
            "SELECT timezone FROM hall_settings WHERE id = 'hall'"
        ).fetchone()
        assert row is not None
        timezone_name = row["timezone"]
    return moment.astimezone(ZoneInfo(timezone_name)).date().isoformat()
