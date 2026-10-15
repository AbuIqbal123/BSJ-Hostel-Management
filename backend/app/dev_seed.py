"""Local sign-in accounts.

Startup creates the hall and does not create people. This command adds
the accounts used on a development machine. Room B-204 is a dev-only room
for that resident.

Passwords come from the app settings loader (process environment or the
untracked backend/.env): BSJ_SEED_PASSWORD_<ROLE>, then BSJ_SEED_PASSWORD.
With neither, a strong random password is generated and printed once, only
for an account this run creates. Passwords from settings are never printed.
Nothing in this file embeds a development password. Old values that once
lived in git history must be treated as burned.

Re-runs: an account that already exists is left exactly as it is, including
its password. Pass --reset-passwords to set every seed account's password
again (a generated one is printed once; a configured one is not shown).
"""

from __future__ import annotations

import argparse
import secrets
import string
from dataclasses import dataclass

from app.shared import clock
from app.shared.auth.security import hash_password
from app.shared.config import get_settings, is_hosted
from app.shared.db import create_connection
from app.shared.migrate import migrate

BLOCK_B = "d032aad6-a203-5ea0-ba9a-3a9257edbfc8"
ROOM_ID = "d4400000-0000-4000-8000-000000000004"
RESIDENT_QR = "bsj:v1:test-resident-hall-pass"

_PASSWORD_ALPHABET = string.ascii_letters + string.digits + "!@#$%&*"


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


def configured_password(role_key: str) -> str | None:
    """Configured value for a role, read through the app settings loader."""
    settings = get_settings()
    specific = getattr(settings, f"bsj_seed_password_{role_key.lower()}", "").strip()
    if specific:
        return specific
    return settings.bsj_seed_password.strip() or None


@dataclass(frozen=True)
class SeedResult:
    created: list[str]
    reset: list[str]
    left: list[str]
    generated: dict[str, str]  # username -> generated password (never configured ones)
    configured: list[str]  # usernames whose password came from settings


@dataclass(frozen=True)
class DevAccount:
    id: str
    role: str
    username: str
    full_name: str
    role_key: str
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
        "GATE",
        "active",
        job_title="Gatekeeper",
    ),
    DevAccount(
        "b22de000-0000-4000-8000-000000000002",
        "resident",
        "24-GLLB-118",
        "Aisha Khan",
        "RESIDENT",
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
        "SUSPENDED",
        "suspended",
        job_title="Gatekeeper",
    ),
    DevAccount(
        "e55fa000-0000-4000-8000-000000000005",
        "warden",
        "warden.sara",
        "Sara Malik",
        "WARDEN",
        "active",
        job_title="Warden",
    ),
    DevAccount(
        "f66ab000-0000-4000-8000-000000000006",
        "provost",
        "provost.halima",
        "Halima Begum",
        "PROVOST",
        "active",
        job_title="Provost",
    ),
)


def seed(reset_passwords: bool = False) -> SeedResult:
    """Add any missing development accounts.

    Existing accounts keep their password unless reset_passwords is true.
    """
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
    result = SeedResult([], [], [], {}, [])

    def password_for(account: DevAccount) -> str:
        value = configured_password(account.role_key)
        if value is not None:
            result.configured.append(account.username)
            return value
        value = _generate_password()
        result.generated[account.username] = value
        return value

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
                if reset_passwords:
                    connection.execute(
                        "UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?",
                        (hash_password(password_for(account)), created, existing["id"]),
                    )
                    result.reset.append(account.username)
                else:
                    result.left.append(account.username)
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
                    hash_password(password_for(account)),
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
            result.created.append(account.username)
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()
    return result


def report(result: SeedResult) -> list[str]:
    """Lines to print. Only generated passwords appear, once."""
    lines: list[str] = []
    if result.created:
        lines.append("Added: " + ", ".join(result.created))
    if result.reset:
        lines.append("Password reset: " + ", ".join(result.reset))
    if result.left:
        lines.append(
            "Left unchanged (already exist, password NOT touched): "
            + ", ".join(result.left)
            + ". Use --reset-passwords if you do not know them."
        )
    if result.configured:
        lines.append(
            "Password taken from BSJ_SEED_PASSWORD* settings (not shown): "
            + ", ".join(result.configured)
        )
    if result.generated:
        lines.append("Generated passwords (shown once, save them now):")
        for username, value in result.generated.items():
            lines.append(f"  {username}  {value}")
    return lines


def main() -> None:
    parser = argparse.ArgumentParser(description="Add local development accounts.")
    parser.add_argument(
        "--reset-passwords",
        action="store_true",
        help="Set a new password on accounts that already exist.",
    )
    args = parser.parse_args()
    for line in report(seed(reset_passwords=args.reset_passwords)):
        print(line)


if __name__ == "__main__":
    main()
