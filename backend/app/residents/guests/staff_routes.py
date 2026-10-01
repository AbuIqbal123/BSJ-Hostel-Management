"""Warden and provost guest-stay queue, decisions, and payment."""

from __future__ import annotations

from typing import Annotated, Literal

from fastapi import APIRouter, Query
from pydantic import BaseModel, ConfigDict, Field

from app.residents.guests.records import (
    GuestBucket,
    GuestStayBody,
    GuestStayPageBody,
    hall_today,
    list_guest_stays,
    load_guest_stay,
    record_guest_stay,
)
from app.shared import clock
from app.shared.auth.routes import ConnectionDep
from app.shared.errors import ApiError
from app.staff.register.routes import RegisterDep

router = APIRouter(prefix="/api/v1", tags=["Guest Stays"])


class DecisionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    decision: Literal["approved", "rejected"]
    note: str | None = Field(default=None, max_length=500)


class PaymentRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    payment_status: Literal["paid", "unpaid"]


@router.get("/guest-stays", response_model=GuestStayPageBody)
def list_guest_stays_staff(
    _account: RegisterDep,
    connection: ConnectionDep,
    bucket: Annotated[GuestBucket | None, Query()] = None,
    limit: Annotated[int, Query(ge=1, le=500)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> GuestStayPageBody:
    today = hall_today(connection, clock.utc_now())
    return list_guest_stays(
        connection,
        host_resident_id=None,
        limit=limit,
        offset=offset,
        today=today,
        bucket=bucket,
    )


@router.get("/guest-stays/{guest_stay_id}", response_model=GuestStayBody)
def get_guest_stay(
    guest_stay_id: str,
    _account: RegisterDep,
    connection: ConnectionDep,
) -> GuestStayBody:
    today = hall_today(connection, clock.utc_now())
    stay = load_guest_stay(connection, guest_stay_id, today=today)
    if stay is None:
        raise ApiError(404, "not_found", "That record was not found.")
    return stay


@router.post("/guest-stays/{guest_stay_id}/decision", response_model=GuestStayBody)
def decide_guest_stay(
    guest_stay_id: str,
    body: DecisionRequest,
    account: RegisterDep,
    connection: ConnectionDep,
) -> GuestStayBody:
    now_text = clock.format_instant(clock.utc_now())
    note = None if body.note is None else body.note.strip() or None
    row = connection.execute(
        """
        UPDATE guest_stays
        SET
          status = ?,
          decided_by = ?,
          decided_at = ?,
          decision_note = ?,
          updated_at = ?
        WHERE id = ? AND status = 'pending' AND arrived_at IS NULL AND departed_at IS NULL
        RETURNING id, guest_name
        """,
        (body.decision, account.id, now_text, note, now_text, guest_stay_id),
    ).fetchone()
    if row is None:
        existing = connection.execute(
            "SELECT status FROM guest_stays WHERE id = ?",
            (guest_stay_id,),
        ).fetchone()
        if existing is None:
            raise ApiError(404, "not_found", "That record was not found.")
        raise ApiError(
            409,
            "not_pending",
            "Only a pending guest stay can be approved or rejected "
            f"(current status: {existing['status']}).",
        )
    action = "guest_stay.approved" if body.decision == "approved" else "guest_stay.rejected"
    verb = "approved" if body.decision == "approved" else "rejected"
    record_guest_stay(
        connection,
        now_text,
        account.id,
        action,
        guest_stay_id,
        f"{account.full_name} {verb} a guest stay for {row['guest_name']}.",
    )
    today = hall_today(connection, clock.utc_now())
    stay = load_guest_stay(connection, guest_stay_id, today=today)
    assert stay is not None
    return stay


@router.post("/guest-stays/{guest_stay_id}/payment", response_model=GuestStayBody)
def mark_guest_payment(
    guest_stay_id: str,
    body: PaymentRequest,
    account: RegisterDep,
    connection: ConnectionDep,
) -> GuestStayBody:
    now_text = clock.format_instant(clock.utc_now())
    existing = connection.execute(
        """
        SELECT id, status, guest_name, arrived_at, departed_at
        FROM guest_stays
        WHERE id = ?
        """,
        (guest_stay_id,),
    ).fetchone()
    if existing is None:
        raise ApiError(404, "not_found", "That record was not found.")
    if (
        existing["arrived_at"] is not None
        or existing["departed_at"] is not None
        or existing["status"] not in {"pending", "approved"}
    ):
        raise ApiError(
            409,
            "payment_locked",
            "Payment cannot be changed after the guest has arrived or the stay is closed.",
        )
    if body.payment_status == "paid":
        updated = connection.execute(
            """
            UPDATE guest_stays
            SET
              payment_status = 'paid',
              payment_marked_by = ?,
              payment_marked_at = ?,
              updated_at = ?
            WHERE id = ?
              AND status IN ('pending', 'approved')
              AND arrived_at IS NULL
              AND departed_at IS NULL
            RETURNING id, guest_name
            """,
            (account.id, now_text, now_text, guest_stay_id),
        ).fetchone()
    else:
        updated = connection.execute(
            """
            UPDATE guest_stays
            SET
              payment_status = 'unpaid',
              payment_marked_by = NULL,
              payment_marked_at = NULL,
              updated_at = ?
            WHERE id = ?
              AND status IN ('pending', 'approved')
              AND arrived_at IS NULL
              AND departed_at IS NULL
            RETURNING id, guest_name
            """,
            (now_text, guest_stay_id),
        ).fetchone()
    if updated is None:
        raise ApiError(
            409,
            "payment_locked",
            "Payment cannot be changed after the guest has arrived or the stay is closed.",
        )
    record_guest_stay(
        connection,
        now_text,
        account.id,
        "guest_stay.payment_marked",
        guest_stay_id,
        f"{account.full_name} marked guest payment {body.payment_status} for {updated['guest_name']}.",
    )
    today = hall_today(connection, clock.utc_now())
    stay = load_guest_stay(connection, guest_stay_id, today=today)
    assert stay is not None
    return stay
