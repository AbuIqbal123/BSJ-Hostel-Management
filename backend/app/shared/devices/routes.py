"""Expo push tokens for any signed-in account."""

from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Response
from pydantic import BaseModel, ConfigDict, Field

from app.shared import clock
from app.shared.auth.routes import AccountDep, ConnectionDep

router = APIRouter(prefix="/api/v1/devices", tags=["Devices"])

EXPO_TOKEN = r"^Expo(nent)?PushToken\[[A-Za-z0-9_-]+\]$"


class PushTokenRegister(BaseModel):
    model_config = ConfigDict(extra="forbid")
    token: str = Field(max_length=200, pattern=EXPO_TOKEN)
    platform: Literal["ios", "android"]


class PushTokenDelete(BaseModel):
    model_config = ConfigDict(extra="forbid")
    token: str = Field(min_length=1, max_length=200)


@router.post("/push-token", status_code=204)
def register_push_token(
    body: PushTokenRegister, account: AccountDep, connection: ConnectionDep
) -> Response:
    now_text = clock.format_instant(clock.utc_now())
    connection.execute(
        """
        INSERT INTO push_tokens (token, user_id, platform, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT (token) DO UPDATE SET
          user_id = excluded.user_id,
          platform = excluded.platform,
          updated_at = excluded.updated_at
        """,
        (body.token, account.id, body.platform, now_text, now_text),
    )
    return Response(status_code=204)


@router.delete("/push-token", status_code=204)
def delete_push_token(
    body: PushTokenDelete, account: AccountDep, connection: ConnectionDep
) -> Response:
    connection.execute(
        "DELETE FROM push_tokens WHERE token = ? AND user_id = ?",
        (body.token, account.id),
    )
    return Response(status_code=204)
