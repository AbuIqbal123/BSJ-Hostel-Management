"""Request id and response headers for every HTTP call.

The id is the caller's X-Request-ID when that value is a short token, otherwise
a new UUID. It is echoed on the response, written on the access line, and
copied into error bodies. The exception text is not logged: it can carry a
secret from the failing call.
"""

from __future__ import annotations

import logging
import re
import time
import uuid
from contextvars import ContextVar

from app.shared.config import get_settings

log = logging.getLogger("bsj.http")

_request_id: ContextVar[str] = ContextVar("bsj_request_id", default="")
_SAFE_ID = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$")


def current_request_id() -> str:
    value = _request_id.get()
    if value:
        return value
    return str(uuid.uuid4())


def remember_request_id(scope: dict, request_id: str) -> None:
    state = scope.setdefault("state", {})
    if isinstance(state, dict):
        state["request_id"] = request_id


def request_id_from_headers(headers: list[tuple[bytes, bytes]]) -> str:
    raw = ""
    for name, value in headers:
        if name == b"x-request-id":
            raw = value.decode("latin-1", errors="ignore").strip()
            break
    if _SAFE_ID.fullmatch(raw):
        return raw
    return str(uuid.uuid4())


def security_headers() -> list[tuple[bytes, bytes]]:
    headers = [
        (b"x-content-type-options", b"nosniff"),
        (b"referrer-policy", b"no-referrer"),
        (b"x-frame-options", b"DENY"),
    ]
    if get_settings().environment == "production":
        headers.append((b"strict-transport-security", b"max-age=31536000; includeSubDomains"))
    return headers


class RequestContext:
    """Echo X-Request-ID and the security headers on the way out."""

    def __init__(self, asgi_app: object) -> None:
        self.asgi_app = asgi_app

    async def __call__(self, scope: dict, receive: object, send: object) -> None:
        if scope["type"] != "http":
            await self.asgi_app(scope, receive, send)  # type: ignore[misc]
            return
        request_id = request_id_from_headers(scope.get("headers", []))
        remember_request_id(scope, request_id)
        token = _request_id.set(request_id)
        started = time.perf_counter()
        status = 500

        async def send_with_headers(message: dict) -> None:
            nonlocal status
            if message["type"] == "http.response.start":
                status = int(message["status"])
                headers = list(message.get("headers") or [])
                names = {name.lower() for name, _value in headers}
                if b"x-request-id" not in names:
                    headers.append((b"x-request-id", request_id.encode("ascii")))
                headers.extend(security_headers())
                message = {**message, "headers": headers}
            await send(message)  # type: ignore[misc]

        try:
            await self.asgi_app(scope, receive, send_with_headers)  # type: ignore[misc]
        finally:
            elapsed_ms = (time.perf_counter() - started) * 1000
            log.info(
                "%s %s %s %.1fms request_id=%s",
                scope.get("method", ""),
                scope.get("path", ""),
                status,
                elapsed_ms,
                request_id,
            )
            _request_id.reset(token)
