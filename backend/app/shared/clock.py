"""Hall clock.

Stored instants come from this function so a test can freeze the time.
The value is UTC.
"""

from __future__ import annotations

from datetime import datetime, timezone


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def format_instant(moment: datetime) -> str:
    """UTC instant as YYYY-MM-DDTHH:MM:SSZ, without a fraction of a second."""
    if moment.tzinfo is None:
        raise ValueError("instant must include a timezone")
    return moment.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
