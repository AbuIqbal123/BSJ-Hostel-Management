"""Startup refuses a router route that openapi.yaml does not list."""

from __future__ import annotations

from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.shared.testing_env import signing_key_for_tests


def test_startup_refuses_an_undocumented_router_route(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("DATABASE_PATH", str(tmp_path / "hostel.db"))
    monkeypatch.setenv("ENVIRONMENT", "development")
    monkeypatch.setenv("SMS_DRIVER", "mock")
    monkeypatch.setenv("APP_SECRET_KEY", signing_key_for_tests())
    from app import main
    from app.shared.config import get_settings

    get_settings.cache_clear()
    spec = main.load_spec()
    del spec["paths"]["/api/v1/auth/login"]
    monkeypatch.setattr(main, "load_spec", lambda: spec)

    with pytest.raises(RuntimeError, match="/api/v1/auth/login"):
        with TestClient(main.app):
            pass
    get_settings.cache_clear()
