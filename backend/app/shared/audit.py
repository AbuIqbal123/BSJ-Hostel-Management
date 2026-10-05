"""One writer for audit_log rows."""

from __future__ import annotations

import sqlite3
import uuid


def record_audit(
    connection: sqlite3.Connection,
    occurred_at: str,
    actor_user_id: str | None,
    action: str,
    entity_type: str,
    entity_id: str,
    summary: str,
    detail: str | None = None,
) -> None:
    connection.execute(
        """
        INSERT INTO audit_log (
          id, occurred_at, actor_user_id, action, entity_type, entity_id, summary, detail
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            str(uuid.uuid4()),
            occurred_at,
            actor_user_id,
            action,
            entity_type,
            entity_id,
            summary,
            detail,
        ),
    )
