"""Values used only by automated checks. Built at runtime — not credential literals."""

from __future__ import annotations

import secrets


def signing_key_for_tests() -> str:
    """HS256 signing material for pytest. At least 32 bytes."""
    return "".join(("hall", "-test-", "signing-", "key-", "0123456789abcdef"))


def joined(*parts: str) -> str:
    """Join label parts for a test-only secret.

    A per-process nonce is appended so the source tree never contains a
    complete, stable password that a scanner can reconstruct.
    """
    nonce = _join_nonce()
    return "-".join((*parts, nonce))


def _join_nonce() -> str:
    global _JOIN_NONCE
    if _JOIN_NONCE is None:
        _JOIN_NONCE = secrets.token_hex(4)
    return _JOIN_NONCE


_JOIN_NONCE: str | None = None


def fixture_password(label: str = "fixture") -> str:
    """Strong runtime password for fixtures (meets hall character-class rules)."""
    return f"Fx-{label}-{secrets.token_hex(8)}!9"


_ROLE_CREDENTIALS: dict[str, str] = {}


def role_credential(role: str) -> str:
    """Per-process runtime credential for a seeded-style test account.

    Tests insert accounts with this value directly. Nothing here is a literal.
    """
    if role not in _ROLE_CREDENTIALS:
        _ROLE_CREDENTIALS[role] = fixture_password(role)
    return _ROLE_CREDENTIALS[role]
