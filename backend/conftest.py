"""Shared pytest hooks for the hall API checks."""

from __future__ import annotations

import pytest

from app.shared.auth.rate_limit import login_limiter, refresh_limiter


@pytest.fixture(autouse=True)
def _reset_auth_rate_limiters() -> None:
    login_limiter.reset()
    refresh_limiter.reset()
    yield
    login_limiter.reset()
    refresh_limiter.reset()
