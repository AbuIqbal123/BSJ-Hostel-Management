"""Provost hall-office settings and notification routes."""

from __future__ import annotations

import json
import sqlite3
from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.shared import clock
from app.shared.audit import record_audit
from app.shared.auth.routes import Account, AccountDep, ConnectionDep
from app.shared.errors import ApiError
from app.staff.office.records import (
    LATE_PLACEHOLDERS,
    RETURN_PLACEHOLDERS,
    HallNotifications,
    HallNotificationsUpdate,
    HallSettings,
    HallSettingsUpdate,
    apply_patch,
    load_notifications,
    load_settings,
    template_keeps_placeholders,
)

router = APIRouter(prefix="/api/v1/admin", tags=["Hall office"])


# The hall office. Add "warden" here when wardens should open these routes.
_ADMIN_ROLES = frozenset({"provost"})


def provost_account(account: AccountDep) -> Account:
    if account.role not in _ADMIN_ROLES:
        raise ApiError(403, "forbidden", "This account cannot do that.")
    return account


ProvostDep = Annotated[Account, Depends(provost_account)]


def _require_hours_order(merged: HallSettings) -> None:
    if not (merged.summer_outing_end > merged.summer_outing_start):
        raise ApiError(
            422,
            "validation_error",
            "Summer outing end must be after the start.",
            field="summer_outing_end",
        )
    if not (merged.winter_outing_end > merged.winter_outing_start):
        raise ApiError(
            422,
            "validation_error",
            "Winter outing end must be after the start.",
            field="winter_outing_end",
        )


def _require_distinct_seasons(merged: HallSettings) -> None:
    if merged.summer_season_start == merged.winter_season_start:
        raise ApiError(
            422,
            "validation_error",
            "Summer and winter season starts must differ.",
            field="winter_season_start",
        )


def _require_sms_placeholders(
    merged: HallNotifications, changes: dict[str, object]
) -> None:
    if "late_sms_template" in changes and not template_keeps_placeholders(
        merged.late_sms_template, LATE_PLACEHOLDERS
    ):
        raise ApiError(
            422,
            "validation_error",
            "Late SMS template must keep the listed placeholders.",
            field="late_sms_template",
        )
    if "return_sms_template" in changes and not template_keeps_placeholders(
        merged.return_sms_template, RETURN_PLACEHOLDERS
    ):
        raise ApiError(
            422,
            "validation_error",
            "Return SMS template must keep the listed placeholders.",
            field="return_sms_template",
        )


def _save_hall_patch(
    connection: sqlite3.Connection,
    account: Account,
    current: BaseModel,
    changes: dict[str, object],
    summary: str,
) -> None:
    now_text = clock.format_instant(clock.utc_now())
    assignments = ", ".join(f"{key} = ?" for key in changes)
    values = [changes[key] for key in changes]
    connection.execute(
        f"""
        UPDATE hall_settings
        SET {assignments}, updated_at = ?
        WHERE id = 'hall'
        """,
        (*values, now_text),
    )
    detail = json.dumps(
        {"before": {key: getattr(current, key) for key in changes}, "after": changes},
        sort_keys=True,
    )
    record_audit(
        connection,
        now_text,
        account.id,
        "settings.updated",
        "settings",
        "hall",
        summary,
        detail,
    )


@router.get("/settings", response_model=HallSettings)
def get_settings(_account: ProvostDep, connection: ConnectionDep) -> HallSettings:
    return load_settings(connection)


@router.patch("/settings", response_model=HallSettings)
def update_settings(
    body: HallSettingsUpdate,
    account: ProvostDep,
    connection: ConnectionDep,
) -> HallSettings:
    current = load_settings(connection)
    merged, changes = apply_patch(current, body)
    if not changes:
        return current

    _require_hours_order(merged)
    _require_distinct_seasons(merged)

    _save_hall_patch(
        connection, account, current, changes, f"{account.full_name} updated hall settings."
    )
    return load_settings(connection)


@router.get("/notifications", response_model=HallNotifications)
def get_notifications(
    _account: ProvostDep, connection: ConnectionDep
) -> HallNotifications:
    return load_notifications(connection)


@router.patch("/notifications", response_model=HallNotifications)
def update_notifications(
    body: HallNotificationsUpdate,
    account: ProvostDep,
    connection: ConnectionDep,
) -> HallNotifications:
    current = load_notifications(connection)
    merged, changes = apply_patch(current, body)
    if not changes:
        return current

    _require_sms_placeholders(merged, changes)

    _save_hall_patch(
        connection,
        account,
        current,
        changes,
        f"{account.full_name} updated hall notification templates.",
    )
    return load_notifications(connection)
