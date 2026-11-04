"""Provost SMS log."""

from __future__ import annotations

from datetime import date
from typing import Annotated, Literal

from fastapi import APIRouter, Query
from pydantic import BaseModel, ConfigDict

from app.shared.page import PageDep
from app.shared.auth.routes import ConnectionDep
from app.staff.office.routes import ProvostDep
from app.staff.office.sms_records import list_sms_rows

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
    page: PageDep,
    q: Annotated[str | None, Query(max_length=80)] = None,
    notice_type: Annotated[Literal["late_notice", "return_notice"] | None, Query()] = None,
    status: Annotated[Literal["sent", "failed"] | None, Query()] = None,
    from_day: Annotated[date | None, Query(alias="from")] = None,
    to_day: Annotated[date | None, Query(alias="to")] = None,
) -> SmsPage:
    total, rows = list_sms_rows(
        connection,
        q=q,
        notice_type=notice_type,
        status=status,
        from_day=from_day,
        to_day=to_day,
        limit=page.limit,
        offset=page.offset,
    )
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
    return SmsPage(total=total, limit=page.limit, offset=page.offset, items=items)
