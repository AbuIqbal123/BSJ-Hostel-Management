"""Passwords and access tokens.

Password hashes are Argon2id. Access tokens are signed and are not stored.
A refresh secret is stored only as a SHA-256 hash. Expiry follows the hall clock.
"""

from __future__ import annotations

import hashlib
import threading
from datetime import datetime, timedelta, timezone

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError

from app.shared import clock
from app.shared.config import get_settings
from app.shared.errors import ApiError

# OWASP Argon2id: 19 MiB, 2 iterations, 1 lane.
_hasher = PasswordHasher(
    time_cost=2,
    memory_cost=19456,
    parallelism=1,
    hash_len=32,
    salt_len=16,
)
_dummy_hash: str | None = None
_dummy_lock = threading.Lock()

ACCESS_TOKEN_SECONDS = 900
REFRESH_TOKEN_DAYS = 30
_ALGORITHM = "HS256"
_SIGN_IN_AGAIN = "Sign in again."


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def password_matches(password_hash: str, password: str) -> bool:
    try:
        return _hasher.verify(password_hash, password)
    except VerifyMismatchError:
        return False


def consume_unknown_password(password: str) -> None:
    """Spend the same check an unknown username would otherwise skip."""
    global _dummy_hash
    with _dummy_lock:
        if _dummy_hash is None:
            _dummy_hash = _hasher.hash("hall-unknown-user")
        stored = _dummy_hash
    password_matches(stored, password)


def hash_refresh_secret(secret: str) -> str:
    return hashlib.sha256(secret.encode("utf-8")).hexdigest()


def issue_access_token(user_id: str, issued_at: datetime) -> str:
    expires = issued_at + timedelta(seconds=ACCESS_TOKEN_SECONDS)
    payload = {
        "sub": user_id,
        "typ": "access",
        "iat": int(issued_at.timestamp()),
        "exp": int(expires.timestamp()),
    }
    return jwt.encode(payload, get_settings().app_secret_key, algorithm=_ALGORITHM)


def access_subject(token: str) -> str:
    try:
        payload = jwt.decode(
            token,
            get_settings().app_secret_key,
            algorithms=[_ALGORITHM],
            options={"verify_exp": False, "require": ["exp", "sub"]},
        )
    except jwt.PyJWTError:
        raise ApiError(401, "unauthenticated", _SIGN_IN_AGAIN) from None
    subject = payload.get("sub")
    exp = payload.get("exp")
    if payload.get("typ") != "access" or not isinstance(subject, str) or not subject:
        raise ApiError(401, "unauthenticated", _SIGN_IN_AGAIN)
    if isinstance(exp, bool) or not isinstance(exp, (int, float)):
        raise ApiError(401, "unauthenticated", _SIGN_IN_AGAIN)
    expires_at = datetime.fromtimestamp(int(exp), tz=timezone.utc)
    if clock.utc_now() >= expires_at:
        raise ApiError(401, "unauthenticated", _SIGN_IN_AGAIN)
    return subject


def bearer_token(authorization: str | None) -> str:
    if authorization is None:
        raise ApiError(401, "unauthenticated", _SIGN_IN_AGAIN)
    scheme, separator, token = authorization.partition(" ")
    if (
        separator != " "
        or scheme.lower() != "bearer"
        or not token
        or any(character.isspace() for character in token)
    ):
        raise ApiError(401, "unauthenticated", _SIGN_IN_AGAIN)
    return token
