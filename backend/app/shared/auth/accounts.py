"""Writes that keep an account's password, access tokens, and sessions in step.

A password change, an office reset, and a suspension must all refuse older
access tokens (raise ``token_version``) and revoke live refresh sessions.
Keeping those writes here means a new caller cannot do one without the other.
"""

from __future__ import annotations

import sqlite3

from app.shared.auth.security import hash_password


def insert_user(
    connection: sqlite3.Connection,
    *,
    user_id: str,
    role: str,
    username: str,
    full_name: str,
    password: str,
    when: str,
    status: str = "active",
) -> None:
    """Insert the users row for a new account, with its password hashed."""
    connection.execute(
        """
        INSERT INTO users (
          id, role, username, full_name, password_hash, status,
          created_at, updated_at, password_changed_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (user_id, role, username, full_name, hash_password(password), status, when, when, when),
    )


def revoke_live_sessions(
    connection: sqlite3.Connection, user_id: str, when: str
) -> None:
    connection.execute(
        """
        UPDATE sessions
        SET revoked_at = ?
        WHERE user_id = ? AND revoked_at IS NULL
        """,
        (when, user_id),
    )


def set_password(
    connection: sqlite3.Connection, user_id: str, password: str, when: str
) -> None:
    """Store a new password, refuse older access tokens, and end sessions."""
    connection.execute(
        """
        UPDATE users
        SET password_hash = ?, updated_at = ?, password_changed_at = ?,
            token_version = token_version + 1
        WHERE id = ?
        """,
        (hash_password(password), when, when, user_id),
    )
    revoke_live_sessions(connection, user_id, when)


def end_access(connection: sqlite3.Connection, user_id: str, when: str) -> None:
    """Refuse the account's current access tokens and end its sessions."""
    connection.execute(
        "UPDATE users SET token_version = token_version + 1 WHERE id = ?",
        (user_id,),
    )
    revoke_live_sessions(connection, user_id, when)
