"""Shared hall clock helpers."""

from __future__ import annotations

import sqlite3
from datetime import datetime, timezone

import pytest

from app.shared import clock


def test_parse_instant_utc() -> None:
    moment = clock.parse_instant("2026-09-30T13:00:00Z")
    assert moment == datetime(2026, 9, 30, 13, 0, tzinfo=timezone.utc)
    assert clock.format_instant(moment) == "2026-09-30T13:00:00Z"


def test_parse_instant_rejects_bad_value() -> None:
    with pytest.raises(ValueError):
        clock.parse_instant("2026-09-30T13:00:00+00:00")


def test_hall_local_date_from_timezone_name() -> None:
    # Asia/Kolkata is UTC+5:30, so 18:30Z is midnight local.
    moment = clock.parse_instant("2026-09-30T18:30:00Z")
    assert clock.hall_local_date("Asia/Kolkata", moment) == "2026-10-01"


def test_hall_local_date_from_connection() -> None:
    connection = sqlite3.connect(":memory:")
    connection.row_factory = sqlite3.Row
    connection.execute(
        "CREATE TABLE hall_settings (id TEXT PRIMARY KEY, timezone TEXT NOT NULL)"
    )
    connection.execute(
        "INSERT INTO hall_settings (id, timezone) VALUES ('hall', 'Asia/Kolkata')"
    )
    moment = clock.parse_instant("2026-09-30T18:30:00Z")
    assert clock.hall_local_date(connection, moment) == "2026-10-01"
