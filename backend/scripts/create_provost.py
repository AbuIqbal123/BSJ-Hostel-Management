"""Create the first provost.

Run from `backend/`:

    .venv/bin/python scripts/create_provost.py --username provost --full-name "Hall Provost"

The password is typed at a hidden prompt and repeated. It is never an
argument, and this script never prints it. If a provost account already
exists, the script stops and leaves that password unchanged.

A laptop writes the local SQLite file. To write the hosted hall, run this
where `RENDER=true` and the Turso URL and token are already in the
environment. Do not put the password or the token on the command line.

On a laptop only, `--dev-defaults` creates username provost123 with password
provost123. That flag refuses when ENVIRONMENT is production or when this
process would open a Turso URL. The hidden prompt never accepts that password.
"""

from __future__ import annotations

import argparse
import os
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
from app.shared.config import is_hosted  # noqa: E402
from app.shared.db import INTEGRITY_ERRORS, create_connection  # noqa: E402
from app.shared.migrate import migrate  # noqa: E402

DEV_PROVOST_USERNAME = "provost123"
DEV_PROVOST_PASSWORD = "provost123"
DEV_PROVOST_FULL_NAME = "Test Provost"


def password_is_strong(value: str) -> bool:
    if not 10 <= len(value) <= 200:
        return False
    return re.fullmatch(PASSWORD_CLASS_PATTERN, value) is not None


def reject_password_flag(argv: list[str]) -> None:
    for arg in argv:
        if arg == "-p" or arg == "--password" or arg.startswith("--password="):
            raise SystemExit("Type the password at the prompt. Do not pass it as an argument.")


def database_is_turso_url() -> bool:
    """True when this process would open a Turso URL.

    Render sets RENDER=true and then opens TURSO_DATABASE_URL. A laptop ignores
    that URL and opens the local SQLite file, so a copied Turso URL in `.env`
    does not by itself make the local database a Turso URL. A file URL on a
    hosted process is still refused by the caller.
    """
    if not is_hosted():
        return False
    url = os.environ.get("TURSO_DATABASE_URL", "").strip().lower()
    return not url.startswith(("file:", "sqlite:"))


def dev_defaults_refusal() -> str | None:
    """Why `--dev-defaults` must stop, or None when the local file may be used."""
    if os.environ.get("ENVIRONMENT", "").strip().lower() == "production":
        return "Refusing the local test provost. ENVIRONMENT is production."
    if is_hosted():
        if database_is_turso_url():
            return "Refusing the local test provost. The database is a Turso URL."
        return "Refusing the local test provost. This process is hosted."
    return None


def create_first_provost(username: str, full_name: str, password: str) -> str:
    """Insert the first provost. Return `created` or `exists`."""
    if not password_is_strong(password):
        raise ValueError(PASSWORD_CLASSES_MESSAGE)
    return _insert_provost(username, full_name, password, allow_dev_password=False)


def create_dev_provost() -> str:
    """Insert the local test provost. Refuse production and a Turso URL."""
    reason = dev_defaults_refusal()
    if reason is not None:
        raise RuntimeError(reason)
    return _insert_provost(
        DEV_PROVOST_USERNAME,
        DEV_PROVOST_FULL_NAME,
        DEV_PROVOST_PASSWORD,
        allow_dev_password=True,
    )


def _insert_provost(
    username: str, full_name: str, password: str, *, allow_dev_password: bool
) -> str:
    cleaned_name = full_name.strip()
    cleaned_username = username.strip()
    if not cleaned_name or not cleaned_username:
        raise ValueError("Username and full name are required.")
    migrate()
    now_text = clock.format_instant(clock.utc_now())
    connection = create_connection()
    try:
        existing = connection.execute(
            "SELECT id FROM users WHERE role = 'provost' LIMIT 1"
        ).fetchone()
        if existing is not None:
            return "exists"
        if not password_is_strong(password) and not _is_exact_dev_password(
            cleaned_username, password, allow_dev_password
        ):
            raise ValueError(PASSWORD_CLASSES_MESSAGE)
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


def _is_exact_dev_password(username: str, password: str, allow_dev_password: bool) -> bool:
    return (
        allow_dev_password
        and username == DEV_PROVOST_USERNAME
        and password == DEV_PROVOST_PASSWORD
    )


def _main_dev_defaults() -> int:
    reason = dev_defaults_refusal()
    if reason is not None:
        print(reason, file=sys.stderr)
        return 2
    try:
        result = create_dev_provost()
    except (ValueError, RuntimeError) as exc:
        print(str(exc), file=sys.stderr)
        return 2
    if result == "exists":
        print("A provost account already exists. The password was not changed.")
        return 0
    print("Created the provost account.")
    return 0


def main(argv: list[str] | None = None) -> int:
    args = list(sys.argv[1:] if argv is None else argv)
    reject_password_flag(args)
    parser = argparse.ArgumentParser(description="Create the first provost account.")
    parser.add_argument(
        "--dev-defaults",
        action="store_true",
        help="Create the local test provost. Refuses production and a Turso URL.",
    )
    parser.add_argument("--username")
    parser.add_argument("--full-name")
    parsed = parser.parse_args(args)
    if parsed.dev_defaults:
        return _main_dev_defaults()
    if not parsed.username or not parsed.full_name:
        parser.error("--username and --full-name are required")
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
