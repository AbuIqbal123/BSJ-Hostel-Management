"""Values used only by automated checks. None are real secrets."""

from __future__ import annotations

import secrets


def signing_key_for_tests() -> str:
    """HS256 signing material for pytest. At least 32 bytes."""
    return "hall-test-signing-key-0123456789abcdef"


def production_signing_key_for_tests() -> str:
    """A non-default key for checks that run with ENVIRONMENT=production."""
    return "production-test-signing-key-0123456789ab"


def fixture_password(label: str = "fixture") -> str:
    """Strong runtime password for fixtures (meets hall character-class rules)."""
    return f"Fx-{label}-{secrets.token_hex(8)}!9"


_ROLE_CREDENTIALS: dict[str, str] = {}


def role_credential(role: str) -> str:
    """Per-process runtime credential for a seeded-style test account.

    Tests insert accounts with this value directly.
    """
    if role not in _ROLE_CREDENTIALS:
        _ROLE_CREDENTIALS[role] = fixture_password(role)
    return _ROLE_CREDENTIALS[role]
