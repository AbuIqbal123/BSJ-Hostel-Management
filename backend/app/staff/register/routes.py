"""Warden and provost register presence board."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Query

from app.shared import clock
from app.shared.auth.routes import Account, AccountDep, ConnectionDep
from app.shared.errors import ApiError
from app.shared.sms import consider_late_notices
from app.staff.register.records import (
    RegisterPage,
    RegisterState,
    RegisterSummary,
    ResidentRecord,
    list_register,
    load_resident_record,
    load_summary,
)

router = APIRouter(prefix="/api/v1/register", tags=["Register"])


def staff_register_account(account: AccountDep) -> Account:
    if account.role not in {"warden", "provost"}:
        raise ApiError(403, "forbidden", "This account cannot do that.")
    return account


RegisterDep = Annotated[Account, Depends(staff_register_account)]


def _run_late_notices(connection: ConnectionDep) -> None:
    now_text = clock.format_instant(clock.utc_now())
    consider_late_notices(connection, now_text)
    connection.commit()


@router.get("/summary", response_model=RegisterSummary)
def register_summary(_account: RegisterDep, connection: ConnectionDep) -> RegisterSummary:
    _run_late_notices(connection)
    return load_summary(connection)


@router.get("/residents", response_model=RegisterPage)
def list_register_residents(
    _account: RegisterDep,
    connection: ConnectionDep,
    q: Annotated[str | None, Query(max_length=80)] = None,
    state: Annotated[RegisterState | None, Query()] = None,
    block_id: Annotated[str | None, Query()] = None,
    limit: Annotated[int, Query(ge=1, le=500)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> RegisterPage:
    _run_late_notices(connection)
    return list_register(
        connection,
        q=q,
        state=state,
        block_id=block_id,
        limit=limit,
        offset=offset,
    )


@router.get("/residents/{resident_id}", response_model=ResidentRecord)
def register_resident(
    resident_id: str,
    _account: RegisterDep,
    connection: ConnectionDep,
) -> ResidentRecord:
    _run_late_notices(connection)
    record = load_resident_record(connection, resident_id)
    if record is None:
        raise ApiError(404, "not_found", "That record was not found.")
    return record


@router.get("/late", response_model=RegisterPage)
def register_late(
    _account: RegisterDep,
    connection: ConnectionDep,
    limit: Annotated[int, Query(ge=1, le=500)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> RegisterPage:
    _run_late_notices(connection)
    return list_register(
        connection, q=None, state="late", block_id=None, limit=limit, offset=offset
    )
