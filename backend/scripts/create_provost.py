"""Create the first provost.

Run from `backend/`:

    .venv/bin/python scripts/create_provost.py --username provost --full-name "Hall Provost"

The password is typed at a hidden prompt and repeated. It is never an
argument, and this script never prints it. If a provost account already
exists, the script stops and leaves that password unchanged.

A laptop writes the local SQLite file. To write the hosted hall, run this
where `RENDER=true` and the Turso URL and token are already in the
environment. Do not put the password or the token on the command line.
"""

from __future__ import annotations

import argparse
import re
import sys
import uuid
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.shared import clock  # noqa: E402
from app.shared.auth.password_rules import PASSWORD_CLASS_PATTERN, PASSWORD_CLASSES_MESSAGE  # noqa: E402
from app.shared.auth.security import hash_password  # noqa: E402
from app.shared.db import INTEGRITY_ERRORS, create_connection  # noqa: E402
from app.shared.migrate import migrate  # noqa: E402


def password_is_strong(value: str) -> bool:
    if not 10 <= len(value) <= 200:
        return False
    return re.fullmatch(PASSWORD_CLASS_PATTERN, value) is not None


def reject_password_flag(argv: list[str]) -> None:
    for arg in argv:
        if arg == "-p" or arg == "--password" or arg.startswith("--password="):
            raise SystemExit("Type the password at the prompt. Do not pass it as an argument.")


def create_first_provost(username: str, full_name: str, password: str) -> str:
    """Insert the first provost. Return `created` or `exists`."""
    cleaned_name = full_name.strip()
    cleaned_username = username.strip()
    if not cleaned_name or not cleaned_username:
        raise ValueError("Username and full name are required.")
    if not password_is_strong(password):
        raise ValueError(PASSWORD_CLASSES_MESSAGE)
    migrate()
    now_text = clock.format_instant(clock.utc_now())
    connection = create_connection()
    try:
        existing = connection.execute(
            "SELECT id FROM users WHERE role = 'provost' LIMIT 1"
        ).fetchone()
        if existing is not None:
            return "exists"
        user_id = str(uuid.uuid4())
        connection.execute(
            """
            INSERT INTO users (
              id, role, username, full_name, password_hash, status, created_at, updated_at
            ) VALUES (?, 'provost', ?, ?, ?, 'active', ?, ?)
            """,
            (user_id, cleaned_username, cleaned_name, hash_password(password), now_text, now_text),
        )
        connection.execute(
            "INSERT INTO staff (user_id, job_title) VALUES (?, 'Provost')",
            (user_id,),
        )
        connection.commit()
        return "created"
    except INTEGRITY_ERRORS as exc:
        connection.rollback()
        raise ValueError("That username is already in use.") from exc
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()


def main(argv: list[str] | None = None) -> int:
    args = list(sys.argv[1:] if argv is None else argv)
    reject_password_flag(args)
    parser = argparse.ArgumentParser(description="Create the first provost account.")
    parser.add_argument("--username", required=True)
    parser.add_argument("--full-name", required=True)
    parsed = parser.parse_args(args)
    migrate()
    connection = create_connection()
    try:
        existing = connection.execute(
            "SELECT id FROM users WHERE role = 'provost' LIMIT 1"
        ).fetchone()
    finally:
        connection.close()
    if existing is not None:
        print("A provost account already exists. The password was not changed.")
        return 0
    import getpass

    password = getpass.getpass("Password: ")
    repeated = getpass.getpass("Repeat password: ")
    if password != repeated:
        print("The passwords do not match.", file=sys.stderr)
        return 2
    if not password_is_strong(password):
        print(PASSWORD_CLASSES_MESSAGE, file=sys.stderr)
        return 2
    try:
        result = create_first_provost(parsed.username, parsed.full_name, password)
    except ValueError as exc:
        print(str(exc), file=sys.stderr)
        return 2
    if result == "exists":
        print("A provost account already exists. The password was not changed.")
        return 0
    print("Created the provost account.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
