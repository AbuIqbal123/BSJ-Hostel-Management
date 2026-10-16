"""Shared pytest hooks for the hall API checks."""

from __future__ import annotations

from collections.abc import Iterator
from pathlib import Path

import pytest

from app.shared.auth.rate_limit import (
    login_limiter,
    options_limiter,
    refresh_limiter,
    username_login_limiter,
)
from app.shared.testing_env import signing_key_for_tests


@pytest.fixture(autouse=True)
def _reset_auth_rate_limiters() -> None:
    login_limiter.reset()
    username_login_limiter.reset()
    options_limiter.reset()
    refresh_limiter.reset()
    yield
    login_limiter.reset()
    username_login_limiter.reset()
    options_limiter.reset()
    refresh_limiter.reset()


@pytest.fixture
def database_path(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Iterator[Path]:
    path = tmp_path / "hostel.db"
    monkeypatch.setenv("DATABASE_PATH", str(path))
    monkeypatch.setenv("ENVIRONMENT", "development")
    monkeypatch.setenv("SMS_DRIVER", "mock")
    monkeypatch.setenv("APP_SECRET_KEY", signing_key_for_tests())
    from app.shared.config import get_settings

    get_settings.cache_clear()
    yield path
    get_settings.cache_clear()
