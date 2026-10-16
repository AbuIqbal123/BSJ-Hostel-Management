"""404, 405, 422, 500, and a failed commit share one error body."""

from __future__ import annotations

import logging
import sqlite3

import pytest
from fastapi.testclient import TestClient

from app.shared.auth.rate_limit import options_limiter
from app.shared.config import get_settings


def _assert_shape(response, status: int, code: str, message: str) -> None:
    assert response.status_code == status
    body = response.json()
    assert set(body) == {"detail", "error"}
    assert body["detail"] == message
    error = body["error"]
    assert error["code"] == code
    assert error["message"] == message
    assert error["request_id"] == response.headers["x-request-id"]
    assert "traceback" not in response.text.lower()
    assert "file " not in response.text.lower()
    text = response.text.lower()
    assert "sqlite" not in text
    assert "turso" not in text


def test_http_errors_share_one_shape(database_path, monkeypatch: pytest.MonkeyPatch, caplog) -> None:
    from app.main import app

    caplog.set_level(logging.INFO, logger="bsj.http")
    with TestClient(app, raise_server_exceptions=False) as client:
        missing = client.get("/api/v1/does-not-exist", headers={"X-Request-ID": "req-404"})
        _assert_shape(missing, 404, "not_found", "Not found.")
        assert missing.headers["x-request-id"] == "req-404"

        method = client.post("/health")
        _assert_shape(method, 405, "method_not_allowed", "That method is not allowed.")

        invalid = client.post("/api/v1/auth/login", json={})
        assert invalid.status_code == 422
        invalid_body = invalid.json()
        assert invalid_body["error"]["code"] == "validation_error"
        assert invalid_body["detail"] == invalid_body["error"]["message"]
        assert invalid_body["error"]["request_id"] == invalid.headers["x-request-id"]

        def explode(*_args, **_kwargs):
            raise RuntimeError("TURSO_AUTH_TOKEN=secret")

        monkeypatch.setattr(options_limiter, "check", explode)
        failed = client.get("/api/v1/auth/onboard/options")
        _assert_shape(failed, 500, "internal_error", "The hall could not finish that.")
        assert "secret" not in failed.text
        assert "RuntimeError" not in failed.text

        echoed = client.get("/health", headers={"X-Request-ID": "hall-req-1"})
        assert echoed.status_code == 200
        assert echoed.headers["x-request-id"] == "hall-req-1"
        assert echoed.headers["x-content-type-options"] == "nosniff"
        assert echoed.headers["referrer-policy"] == "no-referrer"
        assert echoed.headers["x-frame-options"] == "DENY"
        assert "strict-transport-security" not in echoed.headers

        rejected = client.get("/health", headers={"X-Request-ID": "bad id"})
        assert rejected.headers["x-request-id"] != "bad id"
        assert rejected.headers["x-request-id"]

        monkeypatch.setenv("ENVIRONMENT", "production")
        get_settings.cache_clear()
        secured = client.get("/health")
        assert secured.headers["strict-transport-security"] == "max-age=31536000; includeSubDomains"

        def refuse_commit(_scope):
            raise sqlite3.OperationalError("database is locked")

        monkeypatch.setattr("app.main.commit_request", refuse_commit)
        committed = client.get("/health")
        _assert_shape(committed, 500, "internal_error", "The hall could not finish that.")
        assert "locked" not in committed.text

    joined = "\n".join(record.getMessage() for record in caplog.records)
    assert "request_id=req-404" in joined
    assert "request_id=hall-req-1" in joined
    assert "TURSO_AUTH_TOKEN" not in joined
    assert "secret" not in joined
