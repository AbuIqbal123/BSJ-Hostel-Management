"""Shared hall clock helpers."""

from __future__ import annotations

from datetime import datetime, timezone

import pytest

from app.shared import clock
from app.shared.errors import ApiError


def test_parse_instant_utc() -> None:
    moment = clock.parse_instant("2026-09-30T13:00:00Z")
    assert moment == datetime(2026, 9, 30, 13, 0, tzinfo=timezone.utc)
    assert clock.format_instant(moment) == "2026-09-30T13:00:00Z"


def test_parse_instant_rejects_bad_value() -> None:
    with pytest.raises(ValueError):
        clock.parse_instant("2026-09-30T13:00:00+00:00")


def test_wire_instant_refuses_other_forms() -> None:
    assert clock.wire_instant("2026-09-30T13:00:00Z") == datetime(
        2026, 9, 30, 13, 0, tzinfo=timezone.utc
    )
    for value in ("2026-09-30T13:00:00+00:00", "2026-9-30T13:00:00Z"):
        with pytest.raises(ApiError) as refused:
            clock.wire_instant(value, field="departure_at")
        assert refused.value.status_code == 422
        assert refused.value.message == "Use a UTC instant, such as 2026-09-30T13:00:00Z."
        assert refused.value.field == "departure_at"


def test_hall_local_date_and_time() -> None:
    # Asia/Kolkata is UTC+5:30, so 18:30Z is midnight local.
    moment = clock.parse_instant("2026-09-30T18:30:00Z")
    assert clock.hall_local_date(moment) == "2026-10-01"
    assert clock.hall_time_12("2026-09-30T18:30:00Z") == "12:00 AM"
    assert clock.hall_time_12("2026-09-30T13:00:00Z") == "6:30 PM"
