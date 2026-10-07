"""Tiny in-process attempt limit for sign-in and refresh."""

from __future__ import annotations

import threading
import time

from app.shared.errors import ApiError

LOGIN_LIMIT = 30
REFRESH_LIMIT = 60
WINDOW_SECONDS = 60


class AttemptLimiter:
    """Sliding window of timestamps per client key."""

    def __init__(self, *, limit: int, window_seconds: int) -> None:
        self.limit = limit
        self.window_seconds = window_seconds
        self._hits: dict[str, list[float]] = {}
        self._lock = threading.Lock()

    def reset(self) -> None:
        with self._lock:
            self._hits.clear()

    def check(self, key: str) -> None:
        now = time.monotonic()
        with self._lock:
            recent = [stamp for stamp in self._hits.get(key, []) if now - stamp < self.window_seconds]
            if len(recent) >= self.limit:
                raise ApiError(
                    429,
                    "rate_limited",
                    "Too many attempts. Try again shortly.",
                )
            recent.append(now)
            self._hits[key] = recent


login_limiter = AttemptLimiter(limit=LOGIN_LIMIT, window_seconds=WINDOW_SECONDS)
refresh_limiter = AttemptLimiter(limit=REFRESH_LIMIT, window_seconds=WINDOW_SECONDS)


def client_key(request_client_host: str | None) -> str:
    return request_client_host or "unknown"
