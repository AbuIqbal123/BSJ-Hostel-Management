"""Guest stays the resident applies for on the phone."""

from __future__ import annotations

import re
import uuid
from datetime import date
from typing import Annotated

from fastapi import APIRouter, Query
from pydantic import BaseModel, ConfigDict, Field

from app.residents.guests.records import (
    GuestStayBody,
    GuestStayPageBody,
    earliest_start_date,
    guest_settings,
    hall_today,
    inclusive_days,
    list_guest_stays,
    load_guest_stay,
    record_guest_stay,
)
from app.residents.home.routes import ResidentDep
from app.shared import clock
from app.shared.auth.routes import ConnectionDep
from app.shared.errors import ApiError

router = APIRouter(prefix="/api/v1", tags=["Guest Stays"])

_DATE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


class GuestStayCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    guest_name: str = Field(min_length=1, max_length=120)
    relation: str = Field(min_length=1, max_length=80)
    guest_start_date: str
    guest_end_date: str
    reason: str = Field(min_length=1, max_length=500)


class GuestStayUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    guest_name: str | None = Field(default=None, min_length=1, max_length=120)
    relation: str | None = Field(default=None, min_length=1, max_length=80)
    guest_start_date: str | None = None
    guest_end_date: str | None = None
    reason: str | None = Field(default=None, min_length=1, max_length=500)


def _parse_date(value: str, *, field: str) -> str:
    if not isinstance(value, str) or not _DATE.match(value):
        raise ApiError(
            422,
            "validation_error",
            f"Use a calendar date for {field}, such as 2026-10-02.",
        )
    try:
        date.fromisoformat(value)
    except ValueError:
        raise ApiError(
            422,
            "validation_error",
            f"Use a calendar date for {field}, such as 2026-10-02.",
        ) from None
    return value


def _validate_stay_window(
    connection,
    *,
    start: str,
    end: str,
    require_lead: bool,
    today: str | None = None,
) -> None:
    if end < start:
        raise ApiError(
            422,
            "validation_error",
            "The end date must be on or after the start date.",
        )
    settings = guest_settings(connection)
    if require_lead:
        hall_date = today if today is not None else hall_today(connection, clock.utc_now())
        earliest = earliest_start_date(hall_date, int(settings["guest_min_lead_days"]))
        if start < earliest:
            raise ApiError(
                422,
                "validation_error",
                "The start date must be at least the hall lead time after today's hall date.",
            )
    days = inclusive_days(start, end)
    maximum = int(settings["guest_max_inclusive_days"])
    if days > maximum:
        raise ApiError(
            422,
            "validation_error",
            f"A guest stay must last from 1 to {maximum} days, counting the first and last day.",
        )


@router.get("/me/guest-stays", response_model=GuestStayPageBody)
def list_own_guest_stays(
    account: ResidentDep,
    connection: ConnectionDep,
    limit: Annotated[int, Query(ge=1, le=500)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> GuestStayPageBody:
    today = hall_today(connection, clock.utc_now())
    return list_guest_stays(
        connection,
        host_resident_id=account.id,
        limit=limit,
        offset=offset,
        today=today,
    )


@router.post("/me/guest-stays", status_code=201, response_model=GuestStayBody)
def submit_guest_stay(
    body: GuestStayCreate,
    account: ResidentDep,
    connection: ConnectionDep,
) -> GuestStayBody:
    start = _parse_date(body.guest_start_date, field="guest_start_date")
    end = _parse_date(body.guest_end_date, field="guest_end_date")
    now = clock.utc_now()
    today = hall_today(connection, now)
    _validate_stay_window(connection, start=start, end=end, require_lead=True, today=today)
    stay_id = str(uuid.uuid4())
    now_text = clock.format_instant(now)
    guest_name = body.guest_name.strip()
    relation = body.relation.strip()
    reason = body.reason.strip()
    if not guest_name or not relation or not reason:
        raise ApiError(422, "validation_error", "Guest name, relation, and reason are required.")
    connection.execute(
        """
        INSERT INTO guest_stays (
          id, host_resident_id, guest_name, relation, guest_start_date, guest_end_date, reason,
          status, payment_status, payment_marked_by, payment_marked_at,
          decided_by, decided_at, decision_note,
          arrived_at, arrived_recorded_by, departed_at, departed_recorded_by,
          created_at, updated_at
        ) VALUES (
          ?, ?, ?, ?, ?, ?, ?,
          'pending', 'unpaid', NULL, NULL,
          NULL, NULL, NULL,
          NULL, NULL, NULL, NULL,
          ?, ?
        )
        """,
        (stay_id, account.id, guest_name, relation, start, end, reason, now_text, now_text),
    )
    record_guest_stay(
        connection,
        now_text,
        account.id,
        "guest_stay.submitted",
        stay_id,
        f"{account.full_name} applied for a guest stay for {guest_name}.",
    )
    stay = load_guest_stay(
        connection,
        stay_id,
        host_resident_id=account.id,
        today=today,
    )
    assert stay is not None
    return stay


@router.get("/me/guest-stays/{guest_stay_id}", response_model=GuestStayBody)
def get_own_guest_stay(
    guest_stay_id: str,
    account: ResidentDep,
    connection: ConnectionDep,
) -> GuestStayBody:
    today = hall_today(connection, clock.utc_now())
    stay = load_guest_stay(
        connection,
        guest_stay_id,
        host_resident_id=account.id,
        today=today,
    )
    if stay is None:
        raise ApiError(404, "not_found", "That record was not found.")
    return stay


@router.patch("/me/guest-stays/{guest_stay_id}", response_model=GuestStayBody)
def edit_guest_stay(
    guest_stay_id: str,
    body: GuestStayUpdate,
    account: ResidentDep,
    connection: ConnectionDep,
) -> GuestStayBody:
    today = hall_today(connection, clock.utc_now())
    row = connection.execute(
        """
        SELECT
          id, host_resident_id, status, guest_name, relation, guest_start_date, guest_end_date,
          reason, payment_status, arrived_at, departed_at
        FROM guest_stays
        WHERE id = ?
        """,
        (guest_stay_id,),
    ).fetchone()
    if row is None or row["host_resident_id"] != account.id:
        raise ApiError(404, "not_found", "That record was not found.")
    if row["departed_at"] is not None or row["status"] in {"departed", "rejected", "cancelled"}:
        raise ApiError(
            409,
            "not_editable",
            "Only a pending or approved guest stay can be edited "
            f"(current status: {row['status']}).",
        )

    provided = body.model_fields_set
    if not provided:
        raise ApiError(422, "validation_error", "Send at least one field to edit.")

    arrived = row["arrived_at"] is not None
    if arrived:
        locked = {"guest_name", "relation", "reason"} & provided
        if locked:
            raise ApiError(
                422,
                "validation_error",
                "After the guest has arrived, only guest_start_date and guest_end_date may be edited.",
            )
        guest_name = row["guest_name"]
        relation = row["relation"]
        reason = row["reason"]
        start = (
            _parse_date(body.guest_start_date, field="guest_start_date")
            if "guest_start_date" in provided
            else row["guest_start_date"]
        )
        end = (
            _parse_date(body.guest_end_date, field="guest_end_date")
            if "guest_end_date" in provided
            else row["guest_end_date"]
        )
        _validate_stay_window(connection, start=start, end=end, require_lead=False)
    else:
        required = {"guest_name", "relation", "guest_start_date", "guest_end_date", "reason"}
        missing = required - provided
        if missing:
            raise ApiError(
                422,
                "validation_error",
                "Before arrival, send guest_name, relation, guest_start_date, guest_end_date, and reason.",
            )
        guest_name = (body.guest_name or "").strip()
        relation = (body.relation or "").strip()
        reason = (body.reason or "").strip()
        if not guest_name or not relation or not reason:
            raise ApiError(
                422,
                "validation_error",
                "Guest name, relation, and reason are required.",
            )
        start = _parse_date(body.guest_start_date or "", field="guest_start_date")
        end = _parse_date(body.guest_end_date or "", field="guest_end_date")
        _validate_stay_window(connection, start=start, end=end, require_lead=True)

    now_text = clock.format_instant(clock.utc_now())
    updated = connection.execute(
        """
        UPDATE guest_stays
        SET
          guest_name = ?,
          relation = ?,
          guest_start_date = ?,
          guest_end_date = ?,
          reason = ?,
          status = 'pending',
          decided_by = NULL,
          decided_at = NULL,
          decision_note = NULL,
          updated_at = ?
        WHERE id = ?
          AND host_resident_id = ?
          AND status IN ('pending', 'approved')
          AND departed_at IS NULL
        RETURNING id, guest_name
        """,
        (
            guest_name,
            relation,
            start,
            end,
            reason,
            now_text,
            guest_stay_id,
            account.id,
        ),
    ).fetchone()
    if updated is None:
        current = connection.execute(
            "SELECT status, departed_at FROM guest_stays WHERE id = ?",
            (guest_stay_id,),
        ).fetchone()
        assert current is not None
        raise ApiError(
            409,
            "not_editable",
            "Only a pending or approved guest stay can be edited "
            f"(current status: {current['status']}).",
        )
    record_guest_stay(
        connection,
        now_text,
        account.id,
        "guest_stay.edited",
        guest_stay_id,
        f"{account.full_name} edited a guest stay for {updated['guest_name']}.",
    )
    stay = load_guest_stay(
        connection,
        guest_stay_id,
        host_resident_id=account.id,
        today=today,
    )
    assert stay is not None
    return stay


@router.post("/me/guest-stays/{guest_stay_id}/cancel", response_model=GuestStayBody)
def cancel_guest_stay(
    guest_stay_id: str,
    account: ResidentDep,
    connection: ConnectionDep,
) -> GuestStayBody:
    today = hall_today(connection, clock.utc_now())
    row = connection.execute(
        """
        SELECT id, host_resident_id, status, guest_name, arrived_at
        FROM guest_stays
        WHERE id = ?
        """,
        (guest_stay_id,),
    ).fetchone()
    if row is None or row["host_resident_id"] != account.id:
        raise ApiError(404, "not_found", "That record was not found.")
    if row["arrived_at"] is not None:
        raise ApiError(
            409,
            "not_cancellable",
            "The guest has already arrived, so this stay cannot be cancelled.",
        )
    if row["status"] not in {"pending", "approved"}:
        raise ApiError(
            409,
            "not_cancellable",
            "Only a pending or approved guest stay can be cancelled "
            f"(current status: {row['status']}).",
        )
    now_text = clock.format_instant(clock.utc_now())
    # Cancelled rows must have no decision fields (database CHECK).
    updated = connection.execute(
        """
        UPDATE guest_stays
        SET
          status = 'cancelled',
          decided_by = NULL,
          decided_at = NULL,
          decision_note = NULL,
          updated_at = ?
        WHERE id = ?
          AND host_resident_id = ?
          AND status IN ('pending', 'approved')
          AND arrived_at IS NULL
        RETURNING id, guest_name
        """,
        (now_text, guest_stay_id, account.id),
    ).fetchone()
    if updated is None:
        current = connection.execute(
            "SELECT status, arrived_at FROM guest_stays WHERE id = ?",
            (guest_stay_id,),
        ).fetchone()
        assert current is not None
        if current["arrived_at"] is not None:
            raise ApiError(
                409,
                "not_cancellable",
                "The guest has already arrived, so this stay cannot be cancelled.",
            )
        raise ApiError(
            409,
            "not_cancellable",
            "Only a pending or approved guest stay can be cancelled "
            f"(current status: {current['status']}).",
        )
    record_guest_stay(
        connection,
        now_text,
        account.id,
        "guest_stay.cancelled",
        guest_stay_id,
        f"{account.full_name} cancelled a guest stay for {updated['guest_name']}.",
    )
    stay = load_guest_stay(
        connection,
        guest_stay_id,
        host_resident_id=account.id,
        today=today,
    )
    assert stay is not None
    return stay
