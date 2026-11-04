"""Provost audit log."""

from __future__ import annotations

from datetime import date
from typing import Annotated

from fastapi import APIRouter, Query
from pydantic import BaseModel, ConfigDict

from app.shared.page import PageDep
from app.shared.auth.routes import ConnectionDep
from app.staff.office.audit_records import list_audit_rows
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
    page: PageDep,
    q: Annotated[str | None, Query(max_length=80)] = None,
    entity_type: Annotated[str | None, Query()] = None,
    entity_id: Annotated[str | None, Query()] = None,
    from_day: Annotated[date | None, Query(alias="from")] = None,
    to_day: Annotated[date | None, Query(alias="to")] = None,
) -> AuditPage:
    total, rows = list_audit_rows(
        connection,
        q=q,
        entity_type=entity_type,
        entity_id=entity_id,
        from_day=from_day,
        to_day=to_day,
        limit=page.limit,
        offset=page.offset,
    )
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
    return AuditPage(total=total, limit=page.limit, offset=page.offset, items=items)
