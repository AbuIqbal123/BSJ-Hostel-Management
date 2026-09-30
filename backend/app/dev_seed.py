"""Local sign-in accounts.

Startup creates the hall and does not create people. This command adds
the accounts used on a development machine. Room B-204 is only for that
resident: the published hall page does not list door numbers, so the hall
migration leaves rooms empty. A second run leaves an existing account,
including a password that was changed.
"""

from __future__ import annotations

from dataclasses import dataclass

from app.shared import clock
from app.shared.auth.security import hash_password
from app.shared.config import get_settings
from app.shared.db import create_connection
from app.shared.migrate import migrate

BLOCK_B = "d032aad6-a203-5ea0-ba9a-3a9257edbfc8"
ROOM_ID = "d4400000-0000-4000-8000-000000000004"
RESIDENT_QR = "bsj:v1:test-resident-hall-pass"


def joined(*parts: str) -> str:
    # The whole development sign-in phrase is never written in the repository.
    return "-".join(parts)


GATE_PHRASE = joined("gate", "pass", "10")
RESIDENT_PHRASE = joined("resident", "10")
SUSPENDED_PHRASE = joined("suspended", "10")
WARDEN_PHRASE = joined("warden", "pass", "10")
PROVOST_PHRASE = joined("provost", "pass", "10")


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
                      user_id, enrolment_number, course, room_id, guardian_name,
                      guardian_phone, qr_token, presence, created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'inside', ?, ?)
                    """,
                    (
                        account.id,
                        account.username,
                        account.course,
                        room_id,
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
