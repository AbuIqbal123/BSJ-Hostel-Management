"""Warden and provost guest-stay queue, decisions, and payment."""

from __future__ import annotations

from typing import Annotated, Literal

from fastapi import APIRouter, BackgroundTasks, File, Query, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel, ConfigDict, Field

from app.residents.guests.payment_evidence import (
    MAX_EVIDENCE_BYTES,
    delete_evidence_file,
    resolve_stored_path,
    store_evidence_file,
    validate_upload,
)
from app.residents.guests.records import (
    GuestBucket,
    GuestStayBody,
    GuestStayPageBody,
    list_guest_stays,
    load_guest_stay,
    record_guest_stay,
)
from app.residents.notifications.records import record_decision
from app.shared import clock, push
from app.shared.auth.routes import ConnectionDep
from app.shared.errors import ApiError
from app.shared.schemas import DecisionRequest
from app.staff.register.routes import RegisterDep

router = APIRouter(prefix="/api/v1", tags=["Guest Stays"])


class PaymentRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    payment_status: Literal["paid", "unpaid"]
    payment_note: str | None = Field(default=None, max_length=500)


def _payment_mutable(row) -> bool:
    return (
        row["arrived_at"] is None
        and row["departed_at"] is None
        and row["status"] in {"pending", "approved"}
    )


def _require_mutable_stay(connection, guest_stay_id: str):
    existing = connection.execute(
        """
        SELECT id, status, guest_name, arrived_at, departed_at,
               payment_evidence_path
        FROM guest_stays
        WHERE id = ?
        """,
        (guest_stay_id,),
    ).fetchone()
    if existing is None:
        raise ApiError(404, "not_found", "That record was not found.")
    if not _payment_mutable(existing):
        raise ApiError(
            409,
            "payment_locked",
            "Payment cannot be changed after the guest has arrived or the stay is closed.",
        )
    return existing


@router.get("/guest-stays", response_model=GuestStayPageBody)
def list_guest_stays_staff(
    _account: RegisterDep,
    connection: ConnectionDep,
    bucket: Annotated[GuestBucket | None, Query()] = None,
    include_terminal: Annotated[bool, Query()] = False,
    q: Annotated[str | None, Query(max_length=80)] = None,
    block_id: Annotated[str | None, Query()] = None,
    limit: Annotated[int, Query(ge=1, le=500)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> GuestStayPageBody:
    today = clock.hall_local_date(clock.utc_now())
    return list_guest_stays(
        connection,
        host_resident_id=None,
        limit=limit,
        offset=offset,
        today=today,
        bucket=bucket,
        include_terminal=include_terminal,
        q=q,
        block_id=block_id,
    )


@router.get("/guest-stays/{guest_stay_id}", response_model=GuestStayBody)
def get_guest_stay(
    guest_stay_id: str,
    _account: RegisterDep,
    connection: ConnectionDep,
) -> GuestStayBody:
    today = clock.hall_local_date(clock.utc_now())
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
    background_tasks: BackgroundTasks,
) -> GuestStayBody:
    now_text = clock.format_instant(clock.utc_now())
    note = None if body.note is None else body.note.strip() or None
    existing = connection.execute(
        """
        SELECT id, status, arrived_at, guest_name
        FROM guest_stays
        WHERE id = ?
        """,
        (guest_stay_id,),
    ).fetchone()
    if existing is None:
        raise ApiError(404, "not_found", "That record was not found.")
    if existing["status"] != "pending":
        raise ApiError(
            409,
            "not_pending",
            "Only a pending guest stay can be approved or rejected "
            f"(current status: {existing['status']}).",
        )
    if existing["arrived_at"] is not None and body.decision == "rejected":
        raise ApiError(
            409,
            "not_pending",
            "A guest stay cannot be rejected after the guest has arrived.",
        )
    row = connection.execute(
        """
        UPDATE guest_stays
        SET
          status = ?,
          decided_by = ?,
          decided_at = ?,
          decision_note = ?,
          updated_at = ?
        WHERE id = ? AND status = 'pending'
        RETURNING id, guest_name, host_resident_id
        """,
        (body.decision, account.id, now_text, note, now_text, guest_stay_id),
    ).fetchone()
    if row is None:
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
    job = record_decision(
        connection,
        kind="guest_stay_decided",
        record_id=guest_stay_id,
        resident_id=row["host_resident_id"],
        decision=body.decision,
        now_text=now_text,
        what=f"guest stay for {row['guest_name']}",
        noun="guest stay",
        by_name=account.full_name,
    )
    background_tasks.add_task(push.dispatch, [job])
    today = clock.hall_local_date(clock.utc_now())
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
    existing = _require_mutable_stay(connection, guest_stay_id)
    previous_evidence = existing["payment_evidence_path"]
    note = None if body.payment_note is None else body.payment_note.strip() or None
    if body.payment_status == "paid":
        if note is None:
            raise ApiError(
                422,
                "validation_error",
                "Payment note is required when marking paid.",
                field="payment_note",
            )
        updated = connection.execute(
            """
            UPDATE guest_stays
            SET
              payment_status = 'paid',
              payment_marked_by = ?,
              payment_marked_at = ?,
              payment_note = ?,
              updated_at = ?
            WHERE id = ?
              AND status IN ('pending', 'approved')
              AND arrived_at IS NULL
              AND departed_at IS NULL
            RETURNING id, guest_name
            """,
            (account.id, now_text, note, now_text, guest_stay_id),
        ).fetchone()
    else:
        updated = connection.execute(
            """
            UPDATE guest_stays
            SET
              payment_status = 'unpaid',
              payment_marked_by = NULL,
              payment_marked_at = NULL,
              payment_note = NULL,
              payment_evidence_path = NULL,
              payment_evidence_original_name = NULL,
              payment_evidence_content_type = NULL,
              payment_evidence_uploaded_at = NULL,
              payment_evidence_uploaded_by = NULL,
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
    if body.payment_status == "unpaid":
        delete_evidence_file(previous_evidence)
    record_guest_stay(
        connection,
        now_text,
        account.id,
        "guest_stay.payment_marked",
        guest_stay_id,
        f"{account.full_name} marked guest payment {body.payment_status} for {updated['guest_name']}.",
    )
    today = clock.hall_local_date(clock.utc_now())
    stay = load_guest_stay(connection, guest_stay_id, today=today)
    assert stay is not None
    return stay


@router.post(
    "/guest-stays/{guest_stay_id}/payment/evidence",
    response_model=GuestStayBody,
)
async def upload_guest_payment_evidence(
    guest_stay_id: str,
    account: RegisterDep,
    connection: ConnectionDep,
    evidence: UploadFile = File(...),
) -> GuestStayBody:
    existing = _require_mutable_stay(connection, guest_stay_id)
    raw = await evidence.read(MAX_EVIDENCE_BYTES + 1)
    original_name, content_type = validate_upload(
        filename=evidence.filename,
        content_type=evidence.content_type,
        size=len(raw),
    )
    relative = store_evidence_file(
        guest_stay_id=guest_stay_id,
        content=raw,
        content_type=content_type,
        previous_relative=existing["payment_evidence_path"],
    )
    now_text = clock.format_instant(clock.utc_now())
    connection.execute(
        """
        UPDATE guest_stays
        SET
          payment_evidence_path = ?,
          payment_evidence_original_name = ?,
          payment_evidence_content_type = ?,
          payment_evidence_uploaded_at = ?,
          payment_evidence_uploaded_by = ?,
          updated_at = ?
        WHERE id = ?
          AND status IN ('pending', 'approved')
          AND arrived_at IS NULL
          AND departed_at IS NULL
        """,
        (
            relative,
            original_name,
            content_type,
            now_text,
            account.id,
            now_text,
            guest_stay_id,
        ),
    )
    record_guest_stay(
        connection,
        now_text,
        account.id,
        "guest_stay.payment_evidence_uploaded",
        guest_stay_id,
        f"{account.full_name} uploaded payment evidence for {existing['guest_name']}.",
    )
    today = clock.hall_local_date(clock.utc_now())
    stay = load_guest_stay(connection, guest_stay_id, today=today)
    assert stay is not None
    return stay


@router.get("/guest-stays/{guest_stay_id}/payment/evidence")
def download_guest_payment_evidence(
    guest_stay_id: str,
    _account: RegisterDep,
    connection: ConnectionDep,
) -> FileResponse:
    row = connection.execute(
        """
        SELECT
          payment_evidence_path,
          payment_evidence_original_name,
          payment_evidence_content_type
        FROM guest_stays
        WHERE id = ?
        """,
        (guest_stay_id,),
    ).fetchone()
    if row is None:
        raise ApiError(404, "not_found", "That record was not found.")
    if row["payment_evidence_path"] is None:
        raise ApiError(404, "not_found", "No payment evidence is stored for this stay.")
    path = resolve_stored_path(row["payment_evidence_path"])
    if not path.is_file():
        raise ApiError(404, "not_found", "No payment evidence is stored for this stay.")
    filename = row["payment_evidence_original_name"] or path.name
    return FileResponse(
        path,
        media_type=row["payment_evidence_content_type"] or "application/octet-stream",
        filename=filename,
        content_disposition_type="attachment",
    )


@router.delete(
    "/guest-stays/{guest_stay_id}/payment/evidence",
    response_model=GuestStayBody,
)
def clear_guest_payment_evidence(
    guest_stay_id: str,
    account: RegisterDep,
    connection: ConnectionDep,
) -> GuestStayBody:
    existing = _require_mutable_stay(connection, guest_stay_id)
    previous = existing["payment_evidence_path"]
    now_text = clock.format_instant(clock.utc_now())
    connection.execute(
        """
        UPDATE guest_stays
        SET
          payment_evidence_path = NULL,
          payment_evidence_original_name = NULL,
          payment_evidence_content_type = NULL,
          payment_evidence_uploaded_at = NULL,
          payment_evidence_uploaded_by = NULL,
          updated_at = ?
        WHERE id = ?
          AND status IN ('pending', 'approved')
          AND arrived_at IS NULL
          AND departed_at IS NULL
        """,
        (now_text, guest_stay_id),
    )
    delete_evidence_file(previous)
    if previous is not None:
        record_guest_stay(
            connection,
            now_text,
            account.id,
            "guest_stay.payment_evidence_cleared",
            guest_stay_id,
            f"{account.full_name} cleared payment evidence for {existing['guest_name']}.",
        )
    today = clock.hall_local_date(clock.utc_now())
    stay = load_guest_stay(connection, guest_stay_id, today=today)
    assert stay is not None
    return stay
