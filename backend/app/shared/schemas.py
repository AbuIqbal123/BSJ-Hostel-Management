"""Wire schemas shared by more than one route module."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class HallPass(BaseModel):
    model_config = ConfigDict(extra="forbid")
    qr_payload: str
    full_name: str
    room_label: str


class Destination(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: str
    name: str
    type: Literal["named", "other"]
    status: Literal["active", "inactive"]


class DestinationList(BaseModel):
    model_config = ConfigDict(extra="forbid")
    items: list[Destination]


class DecisionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    decision: Literal["approved", "rejected"]
    note: str | None = Field(default=None, max_length=500)
