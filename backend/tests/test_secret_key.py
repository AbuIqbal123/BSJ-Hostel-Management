"""APP_SECRET_KEY must be long enough for HS256."""

from __future__ import annotations

from collections.abc import Iterator
from pathlib import Path

import pytest

from app.shared.testing_env import signing_key_for_tests


@pytest.fixture
def clear_settings(monkeypatch: pytest.MonkeyPatch) -> Iterator[None]:
    monkeypatch.setenv("ENVIRONMENT", "development")
    monkeypatch.setenv("SMS_DRIVER", "mock")
    from app.shared.config import get_settings

    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


def test_short_secret_is_refused(clear_settings: None, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("APP_SECRET_KEY", "".join(("too", "-short")))
    from app.shared.config import get_settings

    get_settings.cache_clear()
    with pytest.raises(RuntimeError, match="at least 32 bytes"):
        get_settings()


def test_long_enough_secret_is_accepted(
    clear_settings: None, monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    monkeypatch.setenv("APP_SECRET_KEY", signing_key_for_tests())
    monkeypatch.setenv("DATABASE_PATH", str(tmp_path / "hostel.db"))
    from app.shared.config import get_settings

    get_settings.cache_clear()
    settings = get_settings()
    assert len(settings.app_secret_key.encode("utf-8")) >= 32
