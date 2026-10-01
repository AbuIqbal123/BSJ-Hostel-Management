"""Hall office settings records."""

from __future__ import annotations

import sqlite3
import uuid

from pydantic import BaseModel, ConfigDict, Field

SETTINGS_COLUMNS = (
    "hall_name",
    "university_name",
    "timezone",
    "grace_minutes",
    "summer_hours_start",
    "summer_hours_end",
    "winter_hours_start",
    "winter_hours_end",
    "summer_season_start",
    "winter_season_start",
    "permission_early_minutes",
    "guest_max_inclusive_days",
    "guest_min_lead_days",
    "scan_duplicate_window_seconds",
    "late_sms_template",
    "return_sms_template",
)

LATE_PLACEHOLDERS = (
    "{resident_name}",
    "{room}",
    "{expected_return_local}",
    "{hall_name}",
)
RETURN_PLACEHOLDERS = (
    "{resident_name}",
    "{room}",
    "{returned_at_local}",
    "{hall_name}",
)

HHMM = r"^([01][0-9]|2[0-3]):[0-5][0-9]$"
MMDD = r"^(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$"


class HallSettings(BaseModel):
    model_config = ConfigDict(extra="forbid")
    hall_name: str
    university_name: str
    timezone: str
    grace_minutes: int
    summer_hours_start: str
    summer_hours_end: str
    winter_hours_start: str
    winter_hours_end: str
    summer_season_start: str
    winter_season_start: str
    permission_early_minutes: int
    guest_max_inclusive_days: int
    guest_min_lead_days: int
    scan_duplicate_window_seconds: int
    late_sms_template: str
    return_sms_template: str


class HallSettingsUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    hall_name: str | None = Field(default=None, min_length=1, max_length=160)
    university_name: str | None = Field(default=None, min_length=1, max_length=160)
    grace_minutes: int | None = Field(default=None, ge=0, le=180)
    summer_hours_start: str | None = Field(default=None, pattern=HHMM)
    summer_hours_end: str | None = Field(default=None, pattern=HHMM)
    winter_hours_start: str | None = Field(default=None, pattern=HHMM)
    winter_hours_end: str | None = Field(default=None, pattern=HHMM)
    summer_season_start: str | None = Field(default=None, pattern=MMDD)
    winter_season_start: str | None = Field(default=None, pattern=MMDD)
    permission_early_minutes: int | None = Field(default=None, ge=0, le=180)
    guest_max_inclusive_days: int | None = Field(default=None, ge=1, le=30)
    guest_min_lead_days: int | None = Field(default=None, ge=0, le=14)
    scan_duplicate_window_seconds: int | None = Field(default=None, ge=0, le=600)
    late_sms_template: str | None = Field(default=None, min_length=1)
    return_sms_template: str | None = Field(default=None, min_length=1)


def load_settings(connection: sqlite3.Connection) -> HallSettings:
    row = connection.execute(
        f"SELECT {', '.join(SETTINGS_COLUMNS)} FROM hall_settings WHERE id = 'hall'"
    ).fetchone()
    assert row is not None
    return HallSettings(**{key: row[key] for key in SETTINGS_COLUMNS})


def template_keeps_placeholders(template: str, required: tuple[str, ...]) -> bool:
    return all(token in template for token in required)


def record_settings_updated(
    connection: sqlite3.Connection,
    occurred_at: str,
    actor_user_id: str,
    summary: str,
    detail: str | None = None,
) -> None:
    connection.execute(
        """
        INSERT INTO audit_log (
          id, occurred_at, actor_user_id, action, entity_type, entity_id, summary, detail
        ) VALUES (?, ?, ?, 'settings.updated', 'settings', 'hall', ?, ?)
        """,
        (str(uuid.uuid4()), occurred_at, actor_user_id, summary, detail),
    )


def apply_settings_update(
    current: HallSettings,
    patch: HallSettingsUpdate,
) -> tuple[HallSettings, dict[str, object]]:
    """Return merged settings and the changed field map (new values only)."""
    changes: dict[str, object] = {}
    data = current.model_dump()
    for field_name in patch.model_fields_set:
        value = getattr(patch, field_name)
        if value is None:
            continue
        if isinstance(value, str):
            value = value.strip()
            if not value:
                continue
        if data[field_name] != value:
            changes[field_name] = value
            data[field_name] = value
    return HallSettings(**data), changes
