"""Audit log list and export queries for the hall office."""

from __future__ import annotations

import csv
import io
import sqlite3
from datetime import date

from app.shared.inbox import hall_day_bounds
from app.shared.like import like_contains

# Spreadsheet export stays bounded so a long hall log cannot stall the phone.
EXPORT_ROW_CAP = 10_000

AUDIT_CSV_HEADER = [
    "occurred_at",
    "actor_name",
    "actor_user_id",
    "action",
    "entity_type",
    "entity_id",
    "summary",
]


def _audit_where(
    *,
    q: str | None,
    entity_type: str | None,
    entity_id: str | None,
    from_day: date | None,
    to_day: date | None,
) -> tuple[str, list[object]]:
    filters: list[str] = []
    params: list[object] = []
    if entity_type is not None and entity_type.strip():
        filters.append("audit_log.entity_type = ?")
        params.append(entity_type.strip())
    if entity_id is not None and entity_id.strip():
        filters.append("audit_log.entity_id = ?")
        params.append(entity_id.strip())
    if q is not None and q.strip():
        needle = like_contains(q.strip().lower())
        filters.append(
            """
            (
              lower(audit_log.summary) LIKE ? ESCAPE '\\'
              OR lower(audit_log.action) LIKE ? ESCAPE '\\'
              OR lower(COALESCE(actors.full_name, '')) LIKE ? ESCAPE '\\'
            )
            """
        )
        params.extend([needle, needle, needle])
    start, end = hall_day_bounds(from_day, to_day)
    if start:
        filters.append("audit_log.occurred_at >= ?")
        params.append(start)
    if end:
        filters.append("audit_log.occurred_at <= ?")
        params.append(end)
    where = (" WHERE " + " AND ".join(filters)) if filters else ""
    return where, params


def list_audit_rows(
    connection: sqlite3.Connection,
    *,
    q: str | None,
    entity_type: str | None,
    entity_id: str | None,
    from_day: date | None,
    to_day: date | None,
    limit: int,
    offset: int,
) -> tuple[int, list[sqlite3.Row]]:
    where, params = _audit_where(
        q=q,
        entity_type=entity_type,
        entity_id=entity_id,
        from_day=from_day,
        to_day=to_day,
    )
    join = "LEFT JOIN users AS actors ON actors.id = audit_log.actor_user_id"
    total = connection.execute(
        f"SELECT COUNT(*) AS n FROM audit_log {join}{where}",
        params,
    ).fetchone()["n"]
    rows = connection.execute(
        f"""
        SELECT
          audit_log.id,
          audit_log.occurred_at,
          audit_log.actor_user_id,
          actors.full_name AS actor_name,
          audit_log.action,
          audit_log.entity_type,
          audit_log.entity_id,
          audit_log.summary
        FROM audit_log
        {join}
        {where}
        ORDER BY audit_log.occurred_at DESC, audit_log.id DESC
        LIMIT ? OFFSET ?
        """,
        (*params, limit, offset),
    ).fetchall()
    return int(total), list(rows)


def _spreadsheet_cell(value: str) -> str:
    if value.startswith(("=", "+", "-", "@", "\t", "\r")):
        return "'" + value
    return value


def build_audit_csv(
    connection: sqlite3.Connection,
    *,
    q: str | None,
    entity_type: str | None,
    entity_id: str | None,
    from_day: date | None,
    to_day: date | None,
) -> str:
    where, params = _audit_where(
        q=q,
        entity_type=entity_type,
        entity_id=entity_id,
        from_day=from_day,
        to_day=to_day,
    )
    join = "LEFT JOIN users AS actors ON actors.id = audit_log.actor_user_id"
    rows = connection.execute(
        f"""
        SELECT
          audit_log.occurred_at,
          actors.full_name AS actor_name,
          audit_log.actor_user_id,
          audit_log.action,
          audit_log.entity_type,
          audit_log.entity_id,
          audit_log.summary
        FROM audit_log
        {join}
        {where}
        ORDER BY audit_log.occurred_at DESC, audit_log.id DESC
        LIMIT ?
        """,
        (*params, EXPORT_ROW_CAP),
    ).fetchall()
    buffer = io.StringIO()
    writer = csv.DictWriter(buffer, fieldnames=AUDIT_CSV_HEADER, lineterminator="\n")
    writer.writeheader()
    for row in rows:
        writer.writerow(
            {
                key: _spreadsheet_cell("" if row[key] is None else str(row[key]))
                for key in AUDIT_CSV_HEADER
            }
        )
    return buffer.getvalue()
