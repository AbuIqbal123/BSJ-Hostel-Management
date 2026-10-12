"""Sign-in, refresh, sign-out, the current account, and a password change."""

from __future__ import annotations

import secrets
import sqlite3
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Header, Request, Response
from pydantic import BaseModel, ConfigDict, Field

from app.shared import clock
from app.shared.audit import record_audit
from app.shared.db import get_connection
from app.shared.errors import ApiError
from app.shared.auth.rate_limit import client_key, login_limiter, refresh_limiter
from app.staff.office.records import new_hall_pass_token, revoke_live_sessions, room_has_capacity
from app.shared.auth.password_rules import IndianMobile, StrongPassword
from app.shared.auth.security import (
    ACCESS_TOKEN_SECONDS,
    REFRESH_TOKEN_DAYS,
    access_subject,
    bearer_token,
    consume_unknown_password,
    hash_password,
    hash_refresh_secret,
    issue_access_token,
    password_matches,
)

router = APIRouter(prefix="/api/v1/auth", tags=["Auth"])

RESIDENT_BLOCK_CODES = ("A", "B", "C", "D")

_BAD_CREDENTIALS = "Username or password is wrong."

ConnectionDep = Annotated[sqlite3.Connection, Depends(get_connection)]
_SIGN_IN_AGAIN = "Sign in again."


class LoginRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    username: str = Field(min_length=1, max_length=80)
    password: str = Field(min_length=1, max_length=200)


class RefreshRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    refresh_token: str


class ChangePasswordRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    current_password: str = Field(min_length=1, max_length=200)
    new_password: StrongPassword


class UserSummary(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: str
    role: Literal["resident", "gate", "warden", "provost"]
    full_name: str
    username: str
    status: Literal["active", "suspended"]


class ResidentSummary(BaseModel):
    model_config = ConfigDict(extra="forbid")
    enrolment_number: str
    course: str | None
    room_label: str
    block_name: str
    presence: Literal["inside", "outside"]


class StaffSummary(BaseModel):
    model_config = ConfigDict(extra="forbid")
    job_title: str


class CurrentUser(UserSummary):
    resident: ResidentSummary | None
    staff: StaffSummary | None


class TokenResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")
    access_token: str
    token_type: Literal["bearer"]
    expires_in: int
    refresh_token: str
    user: UserSummary


@dataclass(frozen=True)
class Account:
    id: str
    role: str
    username: str
    full_name: str
    status: str
    password_hash: str
    job_title: str | None
    enrolment_number: str | None
    course: str | None
    presence: str | None
    room_label: str | None
    block_name: str | None

    def summary(self) -> UserSummary:
        return UserSummary.model_validate(
            {
                "id": self.id,
                "role": self.role,
                "full_name": self.full_name,
                "username": self.username,
                "status": self.status,
            }
        )


def _account_from_row(row: sqlite3.Row) -> Account:
    return Account(
        id=row["id"],
        role=row["role"],
        username=row["username"],
        full_name=row["full_name"],
        status=row["status"],
        password_hash=row["password_hash"],
        job_title=row["job_title"],
        enrolment_number=row["enrolment_number"],
        course=row["course"],
        presence=row["presence"],
        room_label=row["room_label"],
        block_name=row["block_name"],
    )


def _load_account(connection: sqlite3.Connection, user_id: str) -> Account | None:
    row = connection.execute(
        """
        SELECT
          users.id,
          users.role,
          users.username,
          users.full_name,
          users.status,
          users.password_hash,
          staff.job_title,
          residents.enrolment_number,
          residents.course,
          residents.presence,
          rooms.label AS room_label,
          blocks.name AS block_name
        FROM users
        LEFT JOIN staff ON staff.user_id = users.id
        LEFT JOIN residents ON residents.user_id = users.id
        LEFT JOIN rooms ON rooms.id = residents.room_id
        LEFT JOIN blocks ON blocks.id = rooms.block_id
        WHERE users.id = ?
        """,
        (user_id,),
    ).fetchone()
    if row is None:
        return None
    return _account_from_row(row)


def current_user(
    connection: ConnectionDep,
    authorization: Annotated[str | None, Header()] = None,
) -> Account:
    account = _load_account(connection, access_subject(bearer_token(authorization)))
    if account is None or account.status != "active":
        raise ApiError(401, "unauthenticated", _SIGN_IN_AGAIN)
    return account


AccountDep = Annotated[Account, Depends(current_user)]


def _record(connection: sqlite3.Connection, when: str, account: Account, action: str, summary: str) -> None:
    record_audit(connection, when, account.id, action, "person", account.id, summary)


def _start_session(connection: sqlite3.Connection, account: Account, now: datetime) -> TokenResponse:
    secret = secrets.token_urlsafe(32)
    created = clock.format_instant(now)
    expires = clock.format_instant(now + timedelta(days=REFRESH_TOKEN_DAYS))
    connection.execute(
        """
        INSERT INTO sessions (id, user_id, token_hash, expires_at, revoked_at, created_at)
        VALUES (?, ?, ?, ?, NULL, ?)
        """,
        (
            str(uuid.uuid4()),
            account.id,
            hash_refresh_secret(secret),
            expires,
            created,
        ),
    )
    return TokenResponse(
        access_token=issue_access_token(account.id, now),
        token_type="bearer",
        expires_in=ACCESS_TOKEN_SECONDS,
        refresh_token=secret,
        user=account.summary(),
    )


@router.post("/login")
def login(body: LoginRequest, request: Request, connection: ConnectionDep) -> TokenResponse:
    login_limiter.check(client_key(request.client.host if request.client else None))
    row = connection.execute(
        """
        SELECT id
        FROM users
        WHERE username = ? COLLATE NOCASE
        """,
        (body.username,),
    ).fetchone()
    if row is None:
        consume_unknown_password(body.password)
        raise ApiError(401, "unauthenticated", _BAD_CREDENTIALS)
    account = _load_account(connection, row["id"])
    if not password_matches(account.password_hash, body.password):
        raise ApiError(401, "unauthenticated", _BAD_CREDENTIALS)
    if account.status != "active":
        raise ApiError(
        401,
        "unauthenticated",
        "This account is suspended. Please contact the Hall Office.",
    )
    now = clock.utc_now()
    stamp = clock.format_instant(now)
    connection.execute(
        """
        UPDATE users
        SET last_login_at = ?, updated_at = ?
        WHERE id = ?
        """,
        (stamp, stamp, account.id),
    )
    _record(connection, stamp, account, "auth.login", f"{account.full_name} signed in.")
    return _start_session(connection, account, now)


@router.post("/refresh")
def refresh(body: RefreshRequest, request: Request, connection: ConnectionDep) -> TokenResponse:
    refresh_limiter.check(client_key(request.client.host if request.client else None))
    row = connection.execute(
        """
        SELECT sessions.id, sessions.user_id, sessions.expires_at, sessions.revoked_at
        FROM sessions
        WHERE sessions.token_hash = ?
        """,
        (hash_refresh_secret(body.refresh_token),),
    ).fetchone()
    now = clock.utc_now()
    stamp = clock.format_instant(now)
    if row is None or row["revoked_at"] is not None or row["expires_at"] <= stamp:
        raise ApiError(401, "unauthenticated", _SIGN_IN_AGAIN)
    account = _load_account(connection, row["user_id"])
    if account is None or account.status != "active":
        raise ApiError(401, "unauthenticated", _SIGN_IN_AGAIN)
    connection.execute(
        """
        UPDATE sessions
        SET revoked_at = ?
        WHERE id = ? AND revoked_at IS NULL
        """,
        (stamp, row["id"]),
    )
    return _start_session(connection, account, now)


@router.post("/logout", status_code=204)
def logout(account: AccountDep, connection: ConnectionDep) -> Response:
    stamp = clock.format_instant(clock.utc_now())
    revoke_live_sessions(connection, account.id, stamp)
    _record(connection, stamp, account, "auth.logout", f"{account.full_name} signed out.")
    return Response(status_code=204)


@router.get("/me")
def me(account: AccountDep) -> CurrentUser:
    body = account.summary().model_dump()
    if account.role == "resident":
        body["resident"] = {
            "enrolment_number": account.enrolment_number,
            "course": account.course,
            "room_label": account.room_label,
            "block_name": account.block_name,
            "presence": account.presence,
        }
        body["staff"] = None
    else:
        body["resident"] = None
        body["staff"] = {"job_title": account.job_title}
    return CurrentUser.model_validate(body)


@router.post("/change-password", status_code=204)
def change_password(
    body: ChangePasswordRequest,
    account: AccountDep,
    connection: ConnectionDep,
) -> Response:
    if not password_matches(account.password_hash, body.current_password):
        raise ApiError(401, "unauthenticated", "The current password is wrong.")
    stamp = clock.format_instant(clock.utc_now())
    connection.execute(
        """
        UPDATE users
        SET password_hash = ?, updated_at = ?
        WHERE id = ?
        """,
        (hash_password(body.new_password), stamp, account.id),
    )
    revoke_live_sessions(connection, account.id, stamp)
    return Response(status_code=204)


_ONBOARD_READY = "Your account is ready. Sign in with your enrolment number and password."
_ROOM_BLOCK = "That room is not in the selected block."
_ROOM_INACTIVE = "That room is not in use."
_ROOM_FULL = "This room already has as many residents as it has beds."
_ENROLMENT_TAKEN = "That enrolment number is already an account."


class ResidentOnboardRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    full_name: str = Field(min_length=1, max_length=120)
    enrolment_number: str = Field(min_length=1, max_length=40)
    password: StrongPassword
    course: str | None = Field(default=None, max_length=120)
    phone: IndianMobile
    block_id: str
    room_id: str
    guardian_name: str = Field(min_length=1, max_length=120)
    guardian_phone: IndianMobile


class ResidentOnboardResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")
    enrolment_number: str
    status: Literal["active"]
    message: str


@router.post("/onboard", status_code=201)
def onboard_resident(
    body: ResidentOnboardRequest,
    request: Request,
    connection: ConnectionDep,
) -> ResidentOnboardResponse:
    login_limiter.check(client_key(request.client.host if request.client else None))
    full_name = body.full_name.strip()
    enrolment = body.enrolment_number.strip()
    guardian_name = body.guardian_name.strip()
    course = None if body.course is None else body.course.strip() or None
    if not full_name or not enrolment or not guardian_name:
        raise ApiError(422, "validation_error", "Required fields are missing.")
    room = connection.execute(
        "SELECT block_id, is_active FROM rooms WHERE id = ?",
        (body.room_id,),
    ).fetchone()
    if room is None or room["block_id"] != body.block_id:
        raise ApiError(422, "validation_error", _ROOM_BLOCK, field="room_id")
    if int(room["is_active"]) != 1:
        raise ApiError(422, "validation_error", _ROOM_INACTIVE, field="room_id")
    if not room_has_capacity(connection, body.room_id):
        raise ApiError(422, "validation_error", _ROOM_FULL, field="room_id")

    user_id = str(uuid.uuid4())
    now_text = clock.format_instant(clock.utc_now())
    try:
        connection.execute(
            """
            INSERT INTO users (
              id, role, username, full_name, password_hash, status, created_at, updated_at
            ) VALUES (?, 'resident', ?, ?, ?, 'active', ?, ?)
            """,
            (
                user_id,
                enrolment,
                full_name,
                hash_password(body.password),
                now_text,
                now_text,
            ),
        )
        connection.execute(
            """
            INSERT INTO residents (
              user_id, enrolment_number, course, room_id, phone, guardian_name, guardian_phone,
              qr_token, presence, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'inside', ?, ?)
            """,
            (
                user_id,
                enrolment,
                course,
                body.room_id,
                body.phone,
                guardian_name,
                body.guardian_phone,
                new_hall_pass_token(),
                now_text,
                now_text,
            ),
        )
    except sqlite3.IntegrityError as exc:
        message = str(exc).lower()
        if "unique" in message:
            raise ApiError(
                422,
                "validation_error",
                _ENROLMENT_TAKEN,
                field="enrolment_number",
            ) from exc
        if "beds" in message:
            raise ApiError(422, "validation_error", _ROOM_FULL, field="room_id") from exc
        raise
    return ResidentOnboardResponse(
        enrolment_number=enrolment,
        status="active",
        message=_ONBOARD_READY,
    )


class OnboardRoomOption(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: str
    label: str


class OnboardBlockOption(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: str
    name: str
    rooms: list[OnboardRoomOption]


class EnrolmentCheck(BaseModel):
    model_config = ConfigDict(extra="forbid")
    enrolment_number: str = Field(min_length=1, max_length=40)


@router.post("/onboard/enrolment", status_code=204)
def check_enrolment(
    body: EnrolmentCheck,
    request: Request,
    connection: ConnectionDep,
) -> Response:
    login_limiter.check(client_key(request.client.host if request.client else None))
    enrolment = body.enrolment_number.strip()
    if not enrolment:
        raise ApiError(422, "validation_error", "Enter your enrolment number.", field="enrolment_number")
    taken = connection.execute(
        "SELECT 1 FROM users WHERE username = ? COLLATE NOCASE",
        (enrolment,),
    ).fetchone()
    if taken is not None:
        raise ApiError(422, "validation_error", _ENROLMENT_TAKEN, field="enrolment_number")
    return Response(status_code=204)


@router.get("/onboard/options")
def onboard_options(request: Request, connection: ConnectionDep) -> list[OnboardBlockOption]:
    login_limiter.check(client_key(request.client.host if request.client else None))
    placeholders = ", ".join("?" for _ in RESIDENT_BLOCK_CODES)
    block_rows = connection.execute(
        f"""
        SELECT id, code, name
        FROM blocks
        WHERE code IN ({placeholders})
        ORDER BY code
        """,
        RESIDENT_BLOCK_CODES,
    ).fetchall()
    blocks: list[OnboardBlockOption] = []
    for block in block_rows:
        room_rows = connection.execute(
            """
            SELECT rooms.id AS room_id, rooms.label AS room_label
            FROM rooms
            WHERE rooms.block_id = ?
              AND rooms.is_active = 1
              AND (
                SELECT COUNT(*) FROM residents WHERE residents.room_id = rooms.id
              ) < rooms.bed_count
            ORDER BY CAST(rooms.number AS INTEGER), rooms.number
            """,
            (block["id"],),
        ).fetchall()
        blocks.append(
            OnboardBlockOption(
                id=block["id"],
                name=block["name"],
                rooms=[
                    OnboardRoomOption(id=row["room_id"], label=row["room_label"])
                    for row in room_rows
                ],
            )
        )
    return blocks
