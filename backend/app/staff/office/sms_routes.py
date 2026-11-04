"""Provost SMS log."""

from __future__ import annotations

from datetime import date
from typing import Annotated, Literal

from fastapi import APIRouter, Query
from pydantic import BaseModel, ConfigDict

from app.shared.inbox import hall_day_bounds
from app.shared.like import like_contains
from app.shared.page import PageDep
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
    page: PageDep,
    q: Annotated[str | None, Query(max_length=80)] = None,
    notice_type: Annotated[Literal["late_notice", "return_notice"] | None, Query()] = None,
    status: Annotated[Literal["sent", "failed"] | None, Query()] = None,
    from_day: Annotated[date | None, Query(alias="from")] = None,
    to_day: Annotated[date | None, Query(alias="to")] = None,
) -> SmsPage:
    limit = page.limit
    offset = page.offset
    filters: list[str] = []
    params: list[object] = []
    if notice_type is not None:
        filters.append("guardian_messages.notice_type = ?")
        params.append(notice_type)
    if status is not None:
        filters.append("guardian_messages.status = ?")
        params.append(status)
    if q is not None and q.strip():
        needle = like_contains(q.strip().lower())
        filters.append(
            """
            (
              lower(users.full_name) LIKE ? ESCAPE '\\'
              OR lower(guardian_messages.recipient_phone) LIKE ? ESCAPE '\\'
              OR lower(guardian_messages.body) LIKE ? ESCAPE '\\'
            )
            """
        )
        params.extend([needle, needle, needle])
    start, end = hall_day_bounds(from_day, to_day)
    if start:
        filters.append("guardian_messages.created_at >= ?")
        params.append(start)
    if end:
        filters.append("guardian_messages.created_at <= ?")
        params.append(end)
    where = (" WHERE " + " AND ".join(filters)) if filters else ""
    total = connection.execute(
        f"""
        SELECT COUNT(*) AS n
        FROM guardian_messages
        JOIN users ON users.id = guardian_messages.resident_id
        {where}
        """,
        params,
    ).fetchone()["n"]
    rows = connection.execute(
        f"""
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
        {where}
        ORDER BY guardian_messages.created_at DESC, guardian_messages.id DESC
        LIMIT ? OFFSET ?
        """,
        (*params, limit, offset),
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
