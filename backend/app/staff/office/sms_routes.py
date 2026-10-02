"""Provost SMS log."""

from __future__ import annotations

from typing import Annotated, Literal

from fastapi import APIRouter, Query
from pydantic import BaseModel, ConfigDict

from app.shared.auth.routes import ConnectionDep
from app.staff.office.routes import ProvostDep

router = APIRouter(prefix="/api/v1/admin", tags=["Hall office"])


class SmsMessage(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: str
    outing_id: str
    resident_id: str
    resident_name: str | None = None
    notice_type: Literal["late_notice", "return_notice"]
    recipient_phone: str
    body: str
    status: Literal["sent", "failed"]
    created_at: str


class SmsPage(BaseModel):
    model_config = ConfigDict(extra="forbid")
    total: int
    limit: int
    offset: int
    items: list[SmsMessage]


@router.get("/sms", response_model=SmsPage)
def list_sms(
    _account: ProvostDep,
    connection: ConnectionDep,
    limit: Annotated[int, Query(ge=1, le=500)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> SmsPage:
    total = connection.execute("SELECT COUNT(*) AS n FROM guardian_messages").fetchone()["n"]
    rows = connection.execute(
        """
        SELECT
          guardian_messages.id,
          guardian_messages.outing_id,
          guardian_messages.resident_id,
          users.full_name AS resident_name,
          guardian_messages.notice_type,
          guardian_messages.recipient_phone,
          guardian_messages.body,
          guardian_messages.status,
          guardian_messages.created_at
        FROM guardian_messages
        JOIN users ON users.id = guardian_messages.resident_id
        ORDER BY guardian_messages.created_at DESC, guardian_messages.id DESC
        LIMIT ? OFFSET ?
        """,
        (limit, offset),
    ).fetchall()
    items = [
        SmsMessage(
            id=row["id"],
            outing_id=row["outing_id"],
            resident_id=row["resident_id"],
            resident_name=row["resident_name"],
            notice_type=row["notice_type"],
            recipient_phone=row["recipient_phone"],
            body=row["body"],
            status=row["status"],
            created_at=row["created_at"],
        )
        for row in rows
    ]
    return SmsPage(total=int(total), limit=limit, offset=offset, items=items)
