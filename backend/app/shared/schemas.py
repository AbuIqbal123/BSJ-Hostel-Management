"""Wire schemas shared by more than one route module."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class Destination(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: str
    name: str
    source: Literal["preset", "custom"]
    status: Literal["active", "inactive"]


class DestinationList(BaseModel):
    model_config = ConfigDict(extra="forbid")
    items: list[Destination]


class DecisionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    decision: Literal["approved", "rejected"]
    note: str | None = Field(default=None, max_length=500)
