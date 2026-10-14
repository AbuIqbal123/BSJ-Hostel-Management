"""Local sign-in accounts.

Startup creates the hall and does not create people. This command adds
the accounts used on a development machine. Room B-204 is a dev-only room
for that resident. A second run leaves an existing account, including a
password that was changed.

Passwords come from environment variables, or a strong random value is
generated and printed once when an account is created. Nothing in this
file embeds a development password. Old values that once lived in git
history must be treated as burned.
"""

from __future__ import annotations

import os
import secrets
import string
from dataclasses import dataclass

from app.shared import clock
from app.shared.auth.security import hash_password
from app.shared.config import get_settings, is_hosted
from app.shared.db import create_connection
from app.shared.migrate import migrate

# Re-export for tests that still import the join helper from this module.
from app.shared.testing_env import joined as joined  # noqa: F401

BLOCK_B = "d032aad6-a203-5ea0-ba9a-3a9257edbfc8"
ROOM_ID = "d4400000-0000-4000-8000-000000000004"
RESIDENT_QR = "bsj:v1:test-resident-hall-pass"

_PASSWORD_ALPHABET = string.ascii_letters + string.digits + "!@#$%&*"
_resolved: dict[str, str] = {}


def _generate_password() -> str:
    """Strong random password that meets the hall's character-class rules."""
    while True:
        value = "".join(secrets.choice(_PASSWORD_ALPHABET) for _ in range(20))
        if (
            any(c.isupper() for c in value)
            and any(c.islower() for c in value)
            and any(c.isdigit() for c in value)
            and any(c in "!@#$%&*" for c in value)
        ):
            return value


def _resolve_password(role_key: str) -> str:
    """Prefer BSJ_SEED_PASSWORD_<ROLE>, then BSJ_SEED_PASSWORD, else generate once."""
    cached = _resolved.get(role_key)
    if cached is not None:
        return cached
    specific = os.environ.get(f"BSJ_SEED_PASSWORD_{role_key}", "").strip()
    if specific:
        _resolved[role_key] = specific
        return specific
    shared = os.environ.get("BSJ_SEED_PASSWORD", "").strip()
    if shared:
        _resolved[role_key] = shared
        return shared
    generated = _generate_password()
    _resolved[role_key] = generated
    return generated


GATE_PHRASE = _resolve_password("GATE")
RESIDENT_PHRASE = _resolve_password("RESIDENT")
SUSPENDED_PHRASE = _resolve_password("SUSPENDED")
WARDEN_PHRASE = _resolve_password("WARDEN")
PROVOST_PHRASE = _resolve_password("PROVOST")


@dataclass(frozen=True)
class DevAccount:
    id: str
    role: str
    username: str
    full_name: str
    phrase: str
    status: str
    job_title: str | None = None
    course: str | None = None
    phone: str | None = None
    guardian_name: str | None = None
    guardian_phone: str | None = None


ACCOUNTS = (
    DevAccount(
        "a11ce000-0000-4000-8000-000000000001",
        "gate",
        "gate.fatima",
        "Fatima Khan",
        GATE_PHRASE,
        "active",
        job_title="Gatekeeper",
    ),
    DevAccount(
        "b22de000-0000-4000-8000-000000000002",
        "resident",
        "24-GLLB-118",
        "Aisha Khan",
        RESIDENT_PHRASE,
        "active",
        course="B.A. LL.B. (Hons.)",
        phone="+919811112222",
        guardian_name="Rashid Khan",
        guardian_phone="+919876543210",
    ),
    DevAccount(
        "c33ef000-0000-4000-8000-000000000003",
        "gate",
        "gate.suspended",
        "Noor Ali",
        SUSPENDED_PHRASE,
        "suspended",
        job_title="Gatekeeper",
    ),
    DevAccount(
        "e55fa000-0000-4000-8000-000000000005",
        "warden",
        "warden.sara",
        "Sara Malik",
        WARDEN_PHRASE,
        "active",
        job_title="Warden",
    ),
    DevAccount(
        "f66ab000-0000-4000-8000-000000000006",
        "provost",
        "provost.halima",
        "Halima Begum",
        PROVOST_PHRASE,
        "active",
        job_title="Provost",
    ),
)


def seed() -> list[str]:
    """Add any missing development accounts. Returns the usernames just added."""
    if is_hosted():
        raise RuntimeError(
            "Development accounts are not added on Render. "
            "Refuse to seed a hosted database."
        )
    if get_settings().environment != "development":
        raise RuntimeError(
            "Development accounts are added only when ENVIRONMENT is development."
        )
    migrate()
    created = clock.format_instant(clock.utc_now())
    connection = create_connection()
    added: list[str] = []
    try:
        room = connection.execute(
            "SELECT id FROM rooms WHERE label = ?",
            ("B-204",),
        ).fetchone()
        if room is None:
            connection.execute(
                """
                INSERT INTO rooms (id, block_id, number, label, bed_count, is_active)
                VALUES (?, ?, '204', 'B-204', 2, 1)
                """,
                (ROOM_ID, BLOCK_B),
            )
            room_id = ROOM_ID
        else:
            room_id = room["id"]
        for account in ACCOUNTS:
            existing = connection.execute(
                "SELECT id FROM users WHERE username = ? COLLATE NOCASE",
                (account.username,),
            ).fetchone()
            if existing is not None:
                continue
            connection.execute(
                """
                INSERT INTO users (
                  id, role, username, full_name, password_hash, status, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    account.id,
                    account.role,
                    account.username,
                    account.full_name,
                    hash_password(account.phrase),
                    account.status,
                    created,
                    created,
                ),
            )
            if account.role == "resident":
                connection.execute(
                    """
                    INSERT INTO residents (
                      user_id, enrolment_number, course, room_id, phone, guardian_name,
                      guardian_phone, qr_token, presence, created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'inside', ?, ?)
                    """,
                    (
                        account.id,
                        account.username,
                        account.course,
                        room_id,
                        account.phone,
                        account.guardian_name,
                        account.guardian_phone,
                        RESIDENT_QR,
                        created,
                        created,
                    ),
                )
            else:
                connection.execute(
                    "INSERT INTO staff (user_id, job_title) VALUES (?, ?)",
                    (account.id, account.job_title),
                )
            added.append(account.username)
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()
    return added


def main() -> None:
    added = seed()
    if not added:
        print(
            "Development accounts are already in the database. "
            "Existing passwords were left as they are."
        )
        return
    print("Added development accounts:")
    for account in ACCOUNTS:
        if account.username in added:
            print(f"  {account.username}  {account.phrase}")
    skipped = [account.username for account in ACCOUNTS if account.username not in added]
    if skipped:
        print("Left existing accounts as they are: " + ", ".join(skipped))


if __name__ == "__main__":
    main()
