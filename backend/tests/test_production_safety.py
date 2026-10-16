"""Production startup refuses unsafe hosting, and docs stay off unless asked."""

from __future__ import annotations

from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.shared.testing_env import production_signing_key_for_tests, signing_key_for_tests


def _clear() -> None:
    from app.shared.config import get_settings

    get_settings.cache_clear()


def test_production_hides_docs_unless_enabled(
    database_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    from app.main import app

    with TestClient(app) as client:
        assert client.get("/docs").status_code == 200
        monkeypatch.setenv("ENVIRONMENT", "production")
        monkeypatch.setenv("APP_SECRET_KEY", production_signing_key_for_tests())
        monkeypatch.setenv("SMS_DRIVER", "dlt")
        monkeypatch.setenv("DEBUG", "false")
        monkeypatch.setenv("CORS_ORIGINS", "")
        monkeypatch.delenv("DOCS_ENABLED", raising=False)
        _clear()
        for path in ("/docs", "/redoc", "/openapi.json"):
            hidden = client.get(path)
            assert hidden.status_code == 404
            body = hidden.json()
            assert body["error"]["code"] == "not_found"
            assert body["detail"] == body["error"]["message"]
            assert body["error"]["request_id"] == hidden.headers["x-request-id"]
            assert "traceback" not in hidden.text.lower()
        assert client.get("/health").status_code == 200
        monkeypatch.setenv("DOCS_ENABLED", "true")
        _clear()
        assert client.get("/docs").status_code == 200


def test_startup_refuses_unsafe_production(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    from app.shared.config import get_settings

    monkeypatch.setenv("SMS_DRIVER", "mock")
    monkeypatch.setenv("DEBUG", "false")
    monkeypatch.setenv("CORS_ORIGINS", "")
    monkeypatch.delenv("RENDER", raising=False)
    monkeypatch.delenv("DATABASE_PATH", raising=False)
    monkeypatch.delenv("DOCS_ENABLED", raising=False)

    monkeypatch.setenv("ENVIRONMENT", "development")
    monkeypatch.setenv("TURSO_TIMEOUT_SECONDS", "0")
    monkeypatch.setenv("APP_SECRET_KEY", signing_key_for_tests())
    _clear()
    with pytest.raises(RuntimeError, match="TURSO_TIMEOUT_SECONDS"):
        get_settings()

    monkeypatch.setenv("TURSO_TIMEOUT_SECONDS", "5")
    monkeypatch.setenv("SMS_DRIVER", "dlt")
    monkeypatch.setenv("ENVIRONMENT", "production")
    monkeypatch.setenv("APP_SECRET_KEY", signing_key_for_tests())
    _clear()
    with pytest.raises(RuntimeError, match="default value"):
        get_settings()

    monkeypatch.setenv("APP_SECRET_KEY", production_signing_key_for_tests())
    monkeypatch.setenv("DEBUG", "true")
    _clear()
    with pytest.raises(RuntimeError, match="DEBUG is on"):
        get_settings()

    monkeypatch.setenv("DEBUG", "false")
    monkeypatch.setenv("CORS_ORIGINS", "https://hall.example, *")
    _clear()
    with pytest.raises(RuntimeError, match="wildcard"):
        get_settings()

    monkeypatch.setenv("CORS_ORIGINS", "")
    monkeypatch.setenv("RENDER", "true")
    monkeypatch.setenv("DATABASE_PATH", str(tmp_path / "hostel.db"))
    _clear()
    with pytest.raises(RuntimeError, match="DATABASE_PATH"):
        get_settings()

    monkeypatch.delenv("DATABASE_PATH", raising=False)
    monkeypatch.setenv("TURSO_DATABASE_URL", "file:hostel.db")
    _clear()
    with pytest.raises(RuntimeError, match="database file"):
        get_settings()

    monkeypatch.delenv("RENDER", raising=False)
    monkeypatch.setenv("ENVIRONMENT", "development")
    monkeypatch.setenv("SMS_DRIVER", "mock")
    monkeypatch.setenv("APP_SECRET_KEY", signing_key_for_tests())
    monkeypatch.setenv("DATABASE_PATH", str(tmp_path / "hostel.db"))
    _clear()
    settings = get_settings()
    assert settings.docs_enabled is True
    monkeypatch.setenv("ENVIRONMENT", "production")
    monkeypatch.setenv("SMS_DRIVER", "dlt")
    monkeypatch.setenv("APP_SECRET_KEY", production_signing_key_for_tests())
    monkeypatch.delenv("DATABASE_PATH", raising=False)
    _clear()
    assert get_settings().docs_enabled is False


def test_production_boot_refuses_each_unsafe_setting(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Starting the process, not only reading settings, refuses each unsafe production value."""
    from app.main import app

    cases = (
        ("short", {"APP_SECRET_KEY": "too-short"}, "32 bytes"),
        ("mock-sms", {"SMS_DRIVER": "mock"}, "must not be mock"),
        (
            "turso-without-token",
            {
                "RENDER": "true",
                "TURSO_DATABASE_URL": "libsql://bsj-hall.turso.io",
                "DATABASE_PATH": None,
                "TURSO_AUTH_TOKEN": None,
            },
            "TURSO_AUTH_TOKEN",
        ),
        ("wildcard-cors", {"CORS_ORIGINS": "*"}, "wildcard"),
        ("e2e-scratch", {"E2E_SCRATCH": "1"}, "E2E_SCRATCH"),
    )
    for name, overrides, match in cases:
        monkeypatch.setenv("ENVIRONMENT", "production")
        monkeypatch.setenv("DEBUG", "false")
        monkeypatch.setenv("CORS_ORIGINS", "")
        monkeypatch.setenv("SMS_DRIVER", "dlt")
        monkeypatch.setenv("APP_SECRET_KEY", production_signing_key_for_tests())
        monkeypatch.setenv("DATABASE_PATH", str(tmp_path / f"{name}.db"))
        monkeypatch.delenv("RENDER", raising=False)
        monkeypatch.delenv("TURSO_DATABASE_URL", raising=False)
        monkeypatch.delenv("TURSO_AUTH_TOKEN", raising=False)
        monkeypatch.delenv("DOCS_ENABLED", raising=False)
        monkeypatch.delenv("E2E_SCRATCH", raising=False)
        for key, value in overrides.items():
            if value is None:
                monkeypatch.delenv(key, raising=False)
            else:
                monkeypatch.setenv(key, value)
        _clear()
        with pytest.raises(RuntimeError, match=match):
            with TestClient(app):
                pass
        _clear()


def test_turso_request_uses_the_configured_timeout(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.shared.db import _install_turso_timeout
    from turso_serverless.session import ProtocolError

    seen: dict[str, float] = {}

    class _Response:
        def read(self) -> bytes:
            return b"{}"

        def __enter__(self) -> _Response:
            return self

        def __exit__(self, *_args: object) -> bool:
            return False

    def urlopen(request: object, timeout: float | None = None) -> _Response:
        seen["timeout"] = timeout or 0
        return _Response()

    class _Session:
        def __init__(self) -> None:
            self._base_url = "https://example.test"
            self.resets = 0

        def _headers(self) -> dict[str, str]:
            return {}

        def _reset_stream(self) -> None:
            self.resets += 1

        def _post(self, path: str, body: dict) -> bytes:
            raise AssertionError(path)

    class _Connection:
        def __init__(self) -> None:
            self._session = _Session()

    monkeypatch.setattr("app.shared.db.urllib.request.urlopen", urlopen)
    connection = _Connection()
    _install_turso_timeout(connection, 5)
    assert connection._session._post("/v2/pipeline", {"requests": []}) == b"{}"
    assert seen["timeout"] == 5

    def timed_out(request: object, timeout: float | None = None) -> _Response:
        raise TimeoutError("timed out")

    monkeypatch.setattr("app.shared.db.urllib.request.urlopen", timed_out)
    with pytest.raises(ProtocolError):
        connection._session._post("/v2/pipeline", {})
    assert connection._session.resets == 1
