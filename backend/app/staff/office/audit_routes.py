"""Provost audit log."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Query
from pydantic import BaseModel, ConfigDict

from app.shared.auth.routes import ConnectionDep
from app.staff.office.routes import ProvostDep

router = APIRouter(prefix="/api/v1/admin", tags=["Hall office"])


class AuditEvent(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: str
    occurred_at: str
    actor_user_id: str | None = None
    actor_name: str | None = None
    action: str
    entity_type: str
    entity_id: str
    summary: str


class AuditPage(BaseModel):
    model_config = ConfigDict(extra="forbid")
    total: int
    limit: int
    offset: int
    items: list[AuditEvent]


@router.get("/audit", response_model=AuditPage)
def list_audit(
    _account: ProvostDep,
    connection: ConnectionDep,
    entity_type: Annotated[str | None, Query()] = None,
    entity_id: Annotated[str | None, Query()] = None,
    limit: Annotated[int, Query(ge=1, le=500)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> AuditPage:
    filters: list[str] = []
    params: list[object] = []
    if entity_type is not None and entity_type.strip():
        filters.append("audit_log.entity_type = ?")
        params.append(entity_type.strip())
    if entity_id is not None and entity_id.strip():
        filters.append("audit_log.entity_id = ?")
        params.append(entity_id.strip())
    where = (" WHERE " + " AND ".join(filters)) if filters else ""
    total = connection.execute(
        f"SELECT COUNT(*) AS n FROM audit_log{where}",
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
        LEFT JOIN users AS actors ON actors.id = audit_log.actor_user_id
        {where}
        ORDER BY audit_log.occurred_at DESC, audit_log.id DESC
        LIMIT ? OFFSET ?
        """,
        (*params, limit, offset),
    ).fetchall()
    items = [
        AuditEvent(
            id=row["id"],
            occurred_at=row["occurred_at"],
            actor_user_id=row["actor_user_id"],
            actor_name=row["actor_name"],
            action=row["action"],
            entity_type=row["entity_type"],
            entity_id=row["entity_id"],
            summary=row["summary"],
        )
        for row in rows
    ]
    return AuditPage(total=int(total), limit=limit, offset=offset, items=items)
