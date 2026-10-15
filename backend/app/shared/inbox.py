"""Pieces both inboxes share: the 90-day window, cursors, and mark-up-to."""

from __future__ import annotations

import base64
import re
from datetime import timedelta
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.shared import clock
from app.shared.errors import ApiError

InboxFilter = Literal["all", "unread", "needs_action"]
WINDOW_DAYS = 90
_INSTANT = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$")


class ReadRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    up_to: str | None = Field(default=None, max_length=200)


class Marked(BaseModel):
    model_config = ConfigDict(extra="forbid")
    marked: int
    unread_count: int


class UnreadCount(BaseModel):
    model_config = ConfigDict(extra="forbid")
    unread_count: int


def window_start(now_text: str) -> str:
    return clock.format_instant(clock.parse_instant(now_text) - timedelta(days=WINDOW_DAYS))


def encode_cursor(occurred_at: str, item_id: str) -> str:
    raw = f"{occurred_at}|{item_id}".encode()
    return base64.urlsafe_b64encode(raw).decode().rstrip("=")


def decode_cursor(cursor: str) -> tuple[str, str]:
    try:
        raw = base64.urlsafe_b64decode(cursor + "=" * (-len(cursor) % 4)).decode()
        occurred_at, item_id = raw.split("|", 1)
    except (ValueError, UnicodeDecodeError) as exc:
        raise ApiError(422, "validation_error", "That cursor is not valid.", field="cursor") from exc
    if not _INSTANT.match(occurred_at) or not item_id:
        raise ApiError(422, "validation_error", "That cursor is not valid.", field="cursor")
    return occurred_at, item_id


def mark_until(body: ReadRequest | None, now_text: str) -> str:
    """The instant a mark-all reaches: now, or the caller's up_to, never later than now."""
    up_to = None if body is None else body.up_to
    if not up_to:
        return now_text
    instant = up_to if _INSTANT.match(up_to) else decode_cursor(up_to)[0]
    return min(instant, now_text)


def hall_day_bounds(first, last) -> tuple[str | None, str | None]:
    """UTC instants covering Asia/Kolkata dates first..last inclusive."""
    from datetime import datetime

    start = end = None
    if first is not None:
        start = clock.format_instant(datetime(first.year, first.month, first.day, tzinfo=clock.HALL_ZONE))
    if last is not None:
        end = clock.format_instant(
            datetime(last.year, last.month, last.day, 23, 59, 59, tzinfo=clock.HALL_ZONE)
        )
    return start, end
