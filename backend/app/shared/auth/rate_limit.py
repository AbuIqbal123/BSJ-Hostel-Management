"""Tiny in-process attempt limit for sign-in and refresh."""

from __future__ import annotations

import threading
import time

from app.shared.errors import ApiError

LOGIN_LIMIT = 30
REFRESH_LIMIT = 60
OPTIONS_LIMIT = 60
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

    def _recent(self, key: str, now: float) -> list[float]:
        return [stamp for stamp in self._hits.get(key, []) if now - stamp < self.window_seconds]

    def check(self, key: str) -> None:
        now = time.monotonic()
        with self._lock:
            recent = self._recent(key, now)
            if len(recent) >= self.limit:
                self._hits[key] = recent
                raise ApiError(
                    429,
                    "rate_limited",
                    "Too many attempts. Try again shortly.",
                )
            recent.append(now)
            self._hits[key] = recent

    def blocked(self, key: str) -> bool:
        """True when this key is already at the limit. Does not record a hit."""
        now = time.monotonic()
        with self._lock:
            recent = self._recent(key, now)
            if recent:
                self._hits[key] = recent
            else:
                self._hits.pop(key, None)
            return len(recent) >= self.limit

    def record(self, key: str) -> None:
        """Record one hit. The caller already decided this attempt failed."""
        now = time.monotonic()
        with self._lock:
            recent = self._recent(key, now)
            recent.append(now)
            self._hits[key] = recent


login_limiter = AttemptLimiter(limit=LOGIN_LIMIT, window_seconds=WINDOW_SECONDS)
# Failed passwords only. A correct password does not spend this budget, so
# one address cannot lock a warden out before the failure threshold.
username_login_limiter = AttemptLimiter(limit=LOGIN_LIMIT, window_seconds=WINDOW_SECONDS)
refresh_limiter = AttemptLimiter(limit=REFRESH_LIMIT, window_seconds=WINDOW_SECONDS)
# Opening signup reads the room list. It must not spend the sign-in budget.
options_limiter = AttemptLimiter(limit=OPTIONS_LIMIT, window_seconds=WINDOW_SECONDS)


def client_key(request_client_host: str | None) -> str:
    return request_client_host or "unknown"


def username_key(username: str) -> str:
    folded = username.casefold().strip()
    return folded or "blank"
