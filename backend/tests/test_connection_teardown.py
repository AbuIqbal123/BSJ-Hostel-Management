"""The request connection closes even if its state entry is already gone."""

from __future__ import annotations

import sqlite3
from pathlib import Path

import pytest

from starlette.requests import Request

from app.shared.db import get_connection


def test_teardown_survives_a_missing_state_entry(database_path: Path) -> None:
    request = Request({"type": "http", "state": {}})
    connection_scope = get_connection(request)
    connection = next(connection_scope)
    del request.state.hall_connection
    connection_scope.close()
    assert request.state.hall_connection is None
    with pytest.raises(sqlite3.ProgrammingError):
        connection.execute("SELECT 1")
