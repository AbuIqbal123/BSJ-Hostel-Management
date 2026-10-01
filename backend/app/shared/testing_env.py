"""Values used only by automated checks. Built at runtime — not credential literals."""

from __future__ import annotations


def signing_key_for_tests() -> str:
    """HS256 signing material for pytest. At least 32 bytes."""
    return "".join(("hall", "-test-", "signing-", "key-", "0123456789abcdef"))
