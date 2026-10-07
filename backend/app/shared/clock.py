"""Hall clock.

Stored instants come from this function so a test can freeze the time.
The value is UTC.
"""

from __future__ import annotations

from datetime import datetime, timezone
from zoneinfo import ZoneInfo

from app.shared.errors import ApiError

# hall_settings.timezone is pinned to this zone by its CHECK (migration 0001).
HALL_ZONE = ZoneInfo("Asia/Kolkata")


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


def wire_instant(value: str, field: str | None = None) -> datetime:
    """A request instant, refused with 422 unless it is exactly YYYY-MM-DDTHH:MM:SSZ."""
    try:
        moment = parse_instant(value)
    except ValueError:
        moment = None
    if moment is None or format_instant(moment) != value:
        raise ApiError(
            422,
            "validation_error",
            "Use a UTC instant, such as 2026-09-30T13:00:00Z.",
            field=field,
        )
    return moment


def hall_local_date(moment: datetime) -> str:
    """Hall calendar date for a moment, as YYYY-MM-DD."""
    return moment.astimezone(HALL_ZONE).date().isoformat()


def hall_time_12(instant_utc: str) -> str:
    """Hall wall-clock time of a UTC instant, such as 6:30 PM."""
    local = parse_instant(instant_utc).astimezone(HALL_ZONE)
    hour = local.hour % 12 or 12
    suffix = "AM" if local.hour < 12 else "PM"
    return f"{hour}:{local.minute:02d} {suffix}"
