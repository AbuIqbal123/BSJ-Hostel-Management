"""Gate activity lines from exits, returns, and guest movements."""

from __future__ import annotations

import sqlite3
from datetime import datetime, timezone
from typing import Literal
from zoneinfo import ZoneInfo

from pydantic import BaseModel, ConfigDict


class GateActivityItem(BaseModel):
    model_config = ConfigDict(extra="forbid")
    event: Literal["exit", "return", "guest_arrival", "guest_departure"]
    occurred_at: str
    title: str
    subtitle: str


class GateActivityPage(BaseModel):
    model_config = ConfigDict(extra="forbid")
    total: int
    limit: int
    offset: int
    items: list[GateActivityItem]


def format_clock_12(instant_utc: str, timezone_name: str) -> str:
    moment = datetime.strptime(instant_utc, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc)
    local = moment.astimezone(ZoneInfo(timezone_name))
    hour = local.hour % 12 or 12
    suffix = "AM" if local.hour < 12 else "PM"
    return f"{hour}:{local.minute:02d} {suffix}"


def normalize_qr_payload(qr_payload: str) -> str:
    text = qr_payload.strip()
    if text.startswith("bsj:v1:"):
        return text
    return f"bsj:v1:{text}"


_GATE_ACTIVITY_UNION = """
SELECT event, occurred_at, title, subtitle, source_id
FROM (
  SELECT
    'exit' AS event,
    outings.exited_at AS occurred_at,
    users.full_name AS title,
    rooms.label AS subtitle,
    outings.id AS source_id
  FROM outings
  JOIN residents ON residents.user_id = outings.resident_id
  JOIN users ON users.id = outings.resident_id
  JOIN rooms ON rooms.id = residents.room_id
  WHERE outings.exited_at IS NOT NULL
  UNION ALL
  SELECT
    'return',
    outings.returned_at,
    users.full_name,
    rooms.label,
    outings.id
  FROM outings
  JOIN residents ON residents.user_id = outings.resident_id
  JOIN users ON users.id = outings.resident_id
  JOIN rooms ON rooms.id = residents.room_id
  WHERE outings.returned_at IS NOT NULL
  UNION ALL
  SELECT
    'guest_arrival',
    guest_stays.arrived_at,
    guest_stays.guest_name,
    host.full_name || ' · ' || rooms.label,
    guest_stays.id
  FROM guest_stays
  JOIN users AS host ON host.id = guest_stays.host_resident_id
  JOIN residents ON residents.user_id = guest_stays.host_resident_id
  JOIN rooms ON rooms.id = residents.room_id
  WHERE guest_stays.arrived_at IS NOT NULL
  UNION ALL
  SELECT
    'guest_departure',
    guest_stays.departed_at,
    guest_stays.guest_name,
    host.full_name || ' · ' || rooms.label,
    guest_stays.id
  FROM guest_stays
  JOIN users AS host ON host.id = guest_stays.host_resident_id
  JOIN residents ON residents.user_id = guest_stays.host_resident_id
  JOIN rooms ON rooms.id = residents.room_id
  WHERE guest_stays.departed_at IS NOT NULL
)
"""


def list_gate_activity(
    connection: sqlite3.Connection,
    *,
    limit: int,
    offset: int,
) -> GateActivityPage:
    total = connection.execute(
        f"SELECT COUNT(*) AS n FROM ({_GATE_ACTIVITY_UNION})"
    ).fetchone()["n"]
    rows = connection.execute(
        f"""
        {_GATE_ACTIVITY_UNION}
        ORDER BY occurred_at DESC, event, title, source_id
        LIMIT ? OFFSET ?
        """,
        (limit, offset),
    ).fetchall()
    items = [
        GateActivityItem(
            event=row["event"],
            occurred_at=row["occurred_at"],
            title=row["title"],
            subtitle=row["subtitle"],
        )
        for row in rows
    ]
    return GateActivityPage(
        total=total,
        limit=limit,
        offset=offset,
        items=items,
    )
