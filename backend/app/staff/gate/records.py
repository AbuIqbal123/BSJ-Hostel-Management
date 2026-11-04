"""Gate activity lines from exits, returns, and guest movements."""

from __future__ import annotations

import sqlite3
from typing import Literal

from pydantic import BaseModel, ConfigDict


class GateActivityItem(BaseModel):
    model_config = ConfigDict(extra="forbid")
    event: Literal["exit", "return", "guest_arrival", "guest_departure"]
    occurred_at: str
    resident_name: str | None
    room_label: str | None
    guest_name: str | None
    host_name: str | None
    host_room_label: str | None


class GateActivityPage(BaseModel):
    model_config = ConfigDict(extra="forbid")
    total: int
    limit: int
    offset: int
    items: list[GateActivityItem]


def normalize_qr_payload(qr_payload: str) -> str:
    text = qr_payload.strip()
    if text.startswith("bsj:v1:"):
        return text
    return f"bsj:v1:{text}"


_GATE_ACTIVITY_UNION = """
SELECT
  event,
  occurred_at,
  resident_name,
  room_label,
  guest_name,
  host_name,
  host_room_label,
  source_id
FROM (
  SELECT
    'exit' AS event,
    outings.exited_at AS occurred_at,
    users.full_name AS resident_name,
    rooms.label AS room_label,
    CAST(NULL AS TEXT) AS guest_name,
    CAST(NULL AS TEXT) AS host_name,
    CAST(NULL AS TEXT) AS host_room_label,
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
    CAST(NULL AS TEXT),
    CAST(NULL AS TEXT),
    CAST(NULL AS TEXT),
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
    CAST(NULL AS TEXT),
    CAST(NULL AS TEXT),
    guest_stays.guest_name,
    host.full_name,
    rooms.label,
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
    CAST(NULL AS TEXT),
    CAST(NULL AS TEXT),
    guest_stays.guest_name,
    host.full_name,
    rooms.label,
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
    q: str | None = None,
    event: Literal["exit", "return", "guest_arrival", "guest_departure"] | None = None,
    from_at: str | None = None,
    to_at: str | None = None,
) -> GateActivityPage:
    from app.shared.like import like_contains

    filters: list[str] = []
    params: list[object] = []
    if event is not None:
        filters.append("event = ?")
        params.append(event)
    if from_at is not None:
        filters.append("occurred_at >= ?")
        params.append(from_at)
    if to_at is not None:
        filters.append("occurred_at <= ?")
        params.append(to_at)
    if q is not None and q.strip():
        needle = like_contains(q.strip().lower())
        filters.append(
            """
            (
              lower(COALESCE(resident_name, '')) LIKE ? ESCAPE '\\'
              OR lower(COALESCE(room_label, '')) LIKE ? ESCAPE '\\'
              OR lower(COALESCE(guest_name, '')) LIKE ? ESCAPE '\\'
              OR lower(COALESCE(host_name, '')) LIKE ? ESCAPE '\\'
              OR lower(COALESCE(host_room_label, '')) LIKE ? ESCAPE '\\'
            )
            """
        )
        params.extend([needle, needle, needle, needle, needle])
    where = f"WHERE {' AND '.join(filters)}" if filters else ""
    base = f"SELECT * FROM ({_GATE_ACTIVITY_UNION}) AS gate_activity {where}"
    total = connection.execute(
        f"SELECT COUNT(*) AS n FROM ({base})",
        params,
    ).fetchone()["n"]
    rows = connection.execute(
        f"""
        {base}
        ORDER BY occurred_at DESC, event, COALESCE(resident_name, guest_name), source_id
        LIMIT ? OFFSET ?
        """,
        (*params, limit, offset),
    ).fetchall()
    items = [
        GateActivityItem(
            event=row["event"],
            occurred_at=row["occurred_at"],
            resident_name=row["resident_name"],
            room_label=row["room_label"],
            guest_name=row["guest_name"],
            host_name=row["host_name"],
            host_room_label=row["host_room_label"],
        )
        for row in rows
    ]
    return GateActivityPage(
        total=total,
        limit=limit,
        offset=offset,
        items=items,
    )
