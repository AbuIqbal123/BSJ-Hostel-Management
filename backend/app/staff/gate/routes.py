"""Scan the hall pass, and list recent gate activity."""

from __future__ import annotations

import sqlite3
import uuid
from datetime import datetime, timedelta, timezone
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, ConfigDict, Field

from app.residents.outings.records import (
    OutingBody,
    expire_passed_plans,
    hall_day,
    hours_refusal,
    load_outing,
    record_outing,
    return_is_taken,
)
from app.shared import clock
from app.shared.sms import consider_late_notices, send_return_notice_if_due
from app.shared.auth.routes import Account, AccountDep, ConnectionDep
from app.shared.errors import ApiError
from app.staff.gate.records import (
    GateActivityPage,
    format_clock_12,
    list_gate_activity,
    normalize_qr_payload,
)

router = APIRouter(prefix="/api/v1/gate", tags=["Gate"])


class ScanRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    qr_payload: str = Field(min_length=1, max_length=300)


class ScanExitOuting(BaseModel):
    """Exit nest: outing movement fields plus recorded_at; no booleans."""

    model_config = ConfigDict(extra="forbid")
    id: str
    permission_id: str | None
    outing_type: Literal["ordinary", "late_night", "home_going"]
    status: Literal["planned", "outside", "returned", "cancelled"]
    place: str
    expected_return_at: str
    grace_ends_at: str
    exited_at: str | None
    exit_recorded_by_name: str | None
    returned_at: str | None
    return_recorded_by_name: str | None
    lateness: Literal["on_time", "late"]
    created_at: str
    recorded_at: str


class ScanReturnRecord(BaseModel):
    model_config = ConfigDict(extra="forbid")
    recorded_at: str
    return_timeliness: Literal["on_time", "within_grace", "late"]
    returned_at: str
    return_recorded_by_name: str


class ScanExitResult(BaseModel):
    model_config = ConfigDict(extra="forbid")
    outcome: Literal["exit_recorded"] = "exit_recorded"
    full_name: str
    room_label: str
    message: str
    outing: ScanExitOuting


class ScanReturnResult(BaseModel):
    model_config = ConfigDict(extra="forbid")
    outcome: Literal["return_recorded"] = "return_recorded"
    full_name: str
    room_label: str
    message: str
    return_record: ScanReturnRecord


ScanResult = ScanExitResult | ScanReturnResult


def _return_timeliness(
    returned_at: str, expected_return_at: str, grace_ends_at: str
) -> Literal["on_time", "within_grace", "late"]:
    if returned_at <= expected_return_at:
        return "on_time"
    if returned_at <= grace_ends_at:
        return "within_grace"
    return "late"


def _exit_outing(outing: OutingBody, recorded_at: str) -> ScanExitOuting:
    kept = outing.model_dump(
        exclude={"starts_at", "qr_visible", "qr_visible_from", "qr_visible_until"}
    )
    return ScanExitOuting(**kept, recorded_at=recorded_at)


def gate_account(account: AccountDep) -> Account:
    if account.role not in {"gate", "warden", "provost"}:
        raise ApiError(403, "forbidden", "This account cannot do that.")
    return account


GateDep = Annotated[Account, Depends(gate_account)]


def _settings(connection: sqlite3.Connection) -> sqlite3.Row:
    row = connection.execute("SELECT * FROM hall_settings WHERE id = 'hall'").fetchone()
    if row is None:
        raise ApiError(422, "validation_error", "The hall settings are missing.")
    return row


def _resident_details(full_name: str, room_label: str, presence: str) -> dict:
    return {"full_name": full_name, "room_label": room_label, "presence": presence}


def _load_resident_by_qr(
    connection: sqlite3.Connection, qr_payload: str
) -> sqlite3.Row | None:
    token = normalize_qr_payload(qr_payload)
    return connection.execute(
        """
        SELECT
          residents.user_id,
          residents.presence,
          residents.qr_token,
          users.full_name,
          users.status,
          rooms.label AS room_label
        FROM residents
        JOIN users ON users.id = residents.user_id
        JOIN rooms ON rooms.id = residents.room_id
        WHERE residents.qr_token = ?
        """,
        (token,),
    ).fetchone()


def _last_movement_at(connection: sqlite3.Connection, resident_id: str) -> str | None:
    row = connection.execute(
        """
        SELECT MAX(moment) AS moment
        FROM (
          SELECT exited_at AS moment FROM outings
          WHERE resident_id = ? AND exited_at IS NOT NULL
          UNION ALL
          SELECT returned_at FROM outings
          WHERE resident_id = ? AND returned_at IS NOT NULL
        )
        """,
        (resident_id, resident_id),
    ).fetchone()
    return None if row is None else row["moment"]


def _within_duplicate_window(
    last_at: str | None, now_text: str, window_seconds: int
) -> bool:
    if last_at is None or window_seconds <= 0:
        return False
    last = datetime.strptime(last_at, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc)
    now = datetime.strptime(now_text, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc)
    return (now - last) <= timedelta(seconds=window_seconds)


def _refuse(
    code: str,
    message: str,
    *,
    full_name: str,
    room_label: str,
    presence: str,
) -> None:
    raise ApiError(
        409,
        code,
        message,
        details=_resident_details(full_name, room_label, presence),
    )


def _outside_outing(connection: sqlite3.Connection, resident_id: str) -> sqlite3.Row | None:
    return connection.execute(
        """
        SELECT id, permission_id, place
        FROM outings
        WHERE resident_id = ? AND status = 'outside'
        ORDER BY exited_at DESC, id DESC
        LIMIT 1
        """,
        (resident_id,),
    ).fetchone()


def _earliest_today_plan(
    connection: sqlite3.Connection,
    resident_id: str,
    today: str,
    now_text: str,
) -> sqlite3.Row | None:
    return connection.execute(
        """
        SELECT id, place, expected_return_at
        FROM outings
        WHERE resident_id = ?
          AND status = 'planned'
          AND type = 'ordinary'
          AND hall_date = ?
          AND expected_return_at >= ?
        ORDER BY expected_return_at ASC, id ASC
        LIMIT 1
        """,
        (resident_id, today, now_text),
    ).fetchone()


def _usable_permission(
    connection: sqlite3.Connection,
    resident_id: str,
    now_text: str,
    early_minutes: int,
) -> tuple[sqlite3.Row | None, str | None]:
    rows = connection.execute(
        """
        SELECT id, type, short_place, departure_at, expected_return_at, status
        FROM permissions
        WHERE resident_id = ? AND status = 'approved'
        ORDER BY departure_at ASC, id ASC
        """,
        (resident_id,),
    ).fetchall()
    too_early: sqlite3.Row | None = None
    for row in rows:
        window_start = datetime.strptime(row["departure_at"], "%Y-%m-%dT%H:%M:%SZ").replace(
            tzinfo=timezone.utc
        ) - timedelta(minutes=early_minutes)
        window_start_text = clock.format_instant(window_start)
        if now_text < window_start_text:
            if too_early is None:
                too_early = row
            continue
        if now_text > row["expected_return_at"]:
            continue
        return row, None
    if too_early is not None:
        return None, "permission_not_yet_valid"
    return None, None


def _record_ordinary_exit(
    connection: sqlite3.Connection,
    *,
    outing_id: str,
    account: Account,
    now_text: str,
    full_name: str,
    place: str,
) -> OutingBody:
    connection.execute(
        """
        UPDATE outings
        SET
          status = 'outside',
          exited_at = ?,
          exit_recorded_by = ?,
          updated_at = ?
        WHERE id = ? AND status = 'planned'
        """,
        (now_text, account.id, now_text, outing_id),
    )
    connection.execute(
        """
        UPDATE residents
        SET presence = 'outside', updated_at = ?
        WHERE user_id = (SELECT resident_id FROM outings WHERE id = ?)
        """,
        (now_text, outing_id),
    )
    record_outing(
        connection,
        now_text,
        account.id,
        "outing.exit",
        outing_id,
        f"{account.full_name} recorded an exit for {full_name} to {place}.",
    )
    connection.commit()
    return load_outing(connection, outing_id)


def _open_permission_exit(
    connection: sqlite3.Connection,
    *,
    permission: sqlite3.Row,
    resident_id: str,
    account: Account,
    settings: sqlite3.Row,
    now_text: str,
    full_name: str,
) -> OutingBody:
    outing_id = str(uuid.uuid4())
    expected = permission["expected_return_at"]
    expected_moment = datetime.strptime(expected, "%Y-%m-%dT%H:%M:%SZ").replace(
        tzinfo=timezone.utc
    )
    grace_ends_at = clock.format_instant(
        expected_moment + timedelta(minutes=int(settings["grace_minutes"]))
    )
    day = hall_day(expected_moment, settings["timezone"])
    connection.execute(
        """
        INSERT INTO outings (
          id, resident_id, permission_id, type, status, destination_id, place,
          expected_return_at, grace_ends_at, exited_at, exit_recorded_by,
          returned_at, return_recorded_by, created_at, updated_at, cancelled_at, hall_date
        ) VALUES (
          ?, ?, ?, ?, 'outside', NULL, ?,
          ?, ?, ?, ?,
          NULL, NULL, ?, ?, NULL, ?
        )
        """,
        (
            outing_id,
            resident_id,
            permission["id"],
            permission["type"],
            permission["short_place"],
            expected,
            grace_ends_at,
            now_text,
            account.id,
            now_text,
            now_text,
            day,
        ),
    )
    connection.execute(
        """
        UPDATE permissions
        SET status = 'in_use', updated_at = ?
        WHERE id = ? AND status = 'approved'
        """,
        (now_text, permission["id"]),
    )
    connection.execute(
        """
        UPDATE residents
        SET presence = 'outside', updated_at = ?
        WHERE user_id = ?
        """,
        (now_text, resident_id),
    )
    record_outing(
        connection,
        now_text,
        account.id,
        "outing.exit",
        outing_id,
        f"{account.full_name} recorded an exit for {full_name} to {permission['short_place']}.",
    )
    connection.commit()
    return load_outing(connection, outing_id)


def _record_return(
    connection: sqlite3.Connection,
    *,
    outing_id: str,
    permission_id: str | None,
    account: Account,
    now_text: str,
    full_name: str,
    place: str,
) -> OutingBody:
    connection.execute(
        """
        UPDATE outings
        SET
          status = 'returned',
          returned_at = ?,
          return_recorded_by = ?,
          updated_at = ?
        WHERE id = ? AND status = 'outside'
        """,
        (now_text, account.id, now_text, outing_id),
    )
    connection.execute(
        """
        UPDATE residents
        SET presence = 'inside', updated_at = ?
        WHERE user_id = (SELECT resident_id FROM outings WHERE id = ?)
        """,
        (now_text, outing_id),
    )
    if permission_id is not None:
        connection.execute(
            """
            UPDATE permissions
            SET status = 'completed', updated_at = ?
            WHERE id = ? AND status = 'in_use'
            """,
            (now_text, permission_id),
        )
    record_outing(
        connection,
        now_text,
        account.id,
        "outing.return",
        outing_id,
        f"{account.full_name} recorded a return for {full_name} from {place}.",
    )
    consider_late_notices(connection, now_text)
    send_return_notice_if_due(connection, outing_id=outing_id, now_text=now_text)
    connection.commit()
    return load_outing(connection, outing_id)


@router.post("/scans", response_model=ScanExitResult | ScanReturnResult)
def scan_hall_pass(
    body: ScanRequest,
    account: GateDep,
    connection: ConnectionDep,
) -> ScanExitResult | ScanReturnResult:
    resident = _load_resident_by_qr(connection, body.qr_payload)
    if resident is None:
        raise ApiError(404, "unknown_hall_pass", "That hall pass was not recognised.")
    full_name = resident["full_name"]
    room_label = resident["room_label"]
    presence = resident["presence"]
    resident_id = resident["user_id"]
    if resident["status"] != "active":
        _refuse(
            "resident_suspended",
            "This resident account is suspended. Contact the Hall Office.",
            full_name=full_name,
            room_label=room_label,
            presence=presence,
        )

    settings = _settings(connection)
    now = clock.utc_now()
    now_text = clock.format_instant(now)
    expire_passed_plans(connection, resident_id, now_text)
    connection.commit()

    last_at = _last_movement_at(connection, resident_id)
    if _within_duplicate_window(
        last_at, now_text, int(settings["scan_duplicate_window_seconds"])
    ):
        if presence == "outside":
            exit_clock = format_clock_12(last_at or now_text, settings["timezone"])
            message = (
                f"This resident is already recorded as outside (exit {exit_clock}). "
                "Ask the resident to present the same hall pass on return. "
                "The register already has an exit."
            )
        else:
            message = (
                "This resident was just recorded at the gate. "
                "Wait a moment before scanning again."
            )
        _refuse(
            "duplicate_scan",
            message,
            full_name=full_name,
            room_label=room_label,
            presence=presence,
        )

    stray_outside = _outside_outing(connection, resident_id)
    if presence == "inside" and stray_outside is not None:
        _refuse(
            "open_outing_exists",
            "This resident already has an open outing outside.",
            full_name=full_name,
            room_label=room_label,
            presence=presence,
        )

    if presence == "outside":
        open_row = stray_outside
        if open_row is None:
            _refuse(
                "no_outing_planned",
                "This resident is marked outside but no open outing was found to return on.",
                full_name=full_name,
                room_label=room_label,
                presence=presence,
            )
        outing = _record_return(
            connection,
            outing_id=open_row["id"],
            permission_id=open_row["permission_id"],
            account=account,
            now_text=now_text,
            full_name=full_name,
            place=open_row["place"],
        )
        timeliness = _return_timeliness(
            now_text, outing.expected_return_at, outing.grace_ends_at
        )
        message = (
            "Late. Status is now inside."
            if timeliness == "late"
            else "On time. Status is now inside."
        )
        return ScanReturnResult(
            full_name=full_name,
            room_label=room_label,
            message=message,
            return_record=ScanReturnRecord(
                recorded_at=now_text,
                return_timeliness=timeliness,
                returned_at=now_text,
                return_recorded_by_name=account.full_name,
            ),
        )

    today = hall_day(now, settings["timezone"])
    plan = _earliest_today_plan(connection, resident_id, today, now_text)
    inside_hours = hours_refusal(now, settings) is None
    if plan is not None and inside_hours:
        outing = _record_ordinary_exit(
            connection,
            outing_id=plan["id"],
            account=account,
            now_text=now_text,
            full_name=full_name,
            place=plan["place"],
        )
        return ScanExitResult(
            full_name=full_name,
            room_label=room_label,
            message="The resident is now outside.",
            outing=_exit_outing(outing, now_text),
        )

    permission, permission_refusal = _usable_permission(
        connection,
        resident_id,
        now_text,
        int(settings["permission_lead_minutes"]),
    )
    if permission is not None:
        if return_is_taken(connection, resident_id, permission["expected_return_at"]):
            _refuse(
                "return_already_planned",
                "This resident already has an outing ending at that time.",
                full_name=full_name,
                room_label=room_label,
                presence=presence,
            )
        outing = _open_permission_exit(
            connection,
            permission=permission,
            resident_id=resident_id,
            account=account,
            settings=settings,
            now_text=now_text,
            full_name=full_name,
        )
        return ScanExitResult(
            full_name=full_name,
            room_label=room_label,
            message="The resident is now outside.",
            outing=_exit_outing(outing, now_text),
        )

    if permission_refusal == "permission_not_yet_valid":
        _refuse(
            "permission_not_yet_valid",
            "That permission is not yet valid for leaving.",
            full_name=full_name,
            room_label=room_label,
            presence=presence,
        )
    if plan is not None and not inside_hours:
        _refuse(
            "outside_ordinary_hours",
            "Ordinary outings can only leave during ordinary hours.",
            full_name=full_name,
            room_label=room_label,
            presence=presence,
        )
    _refuse(
        "no_outing_planned",
        "There is no planned outing for this resident to leave on.",
        full_name=full_name,
        room_label=room_label,
        presence=presence,
    )


@router.get("/activity", response_model=GateActivityPage)
def gate_activity(
    _account: GateDep,
    connection: ConnectionDep,
    limit: Annotated[int, Query(ge=1, le=500)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> GateActivityPage:
    return list_gate_activity(connection, limit=limit, offset=offset)
