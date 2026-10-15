"""Expo push to staff and resident phones. Best effort, after the commit.

Nothing here can fail or slow the request that caused it. Outside production
(and in tests) the mock driver only records what it would have sent, the same
way SMS works. In production with PUSH_DRIVER=expo, a daemon thread posts to
the Expo push API with a short timeout and deletes tokens Expo reports as
DeviceNotRegistered.
"""

from __future__ import annotations

import logging
import threading
from dataclasses import dataclass, field

import httpx

from app.shared.config import get_settings

EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"
TIMEOUT_SECONDS = 5.0
CHUNK = 100
STAFF_ROLES = ("warden", "provost")

log = logging.getLogger("bsj.push")

# What the mock driver would have sent. Tests read it; nothing else does.
SENT: list[dict] = []


@dataclass(frozen=True)
class PushJob:
    """One alert. `user_ids` are residents; `staff` sends to every warden and provost."""

    title: str
    body: str
    kind: str
    record_id: str
    resident_id: str
    notification_id: str
    user_ids: tuple[str, ...] = ()
    staff: bool = False
    extra: dict = field(default_factory=dict)


def dispatch(jobs: list[PushJob]) -> None:
    """Call only after the transaction that wrote the records has committed."""
    if not jobs:
        return
    if get_settings().push_driver == "expo":
        threading.Thread(target=_deliver_safely, args=(list(jobs),), daemon=True).start()
    else:
        _deliver_safely(list(jobs))


def _deliver_safely(jobs: list[PushJob]) -> None:
    try:
        _deliver(jobs)
    except Exception:  # noqa: BLE001 - push must never break anything
        log.exception("push delivery failed")


def _badge(connection, user_id: str, role: str) -> int:
    from app.residents.notifications.records import resident_unread_count
    from app.staff.register.records import unread_count

    if role == "resident":
        return resident_unread_count(connection, user_id)
    return unread_count(connection, user_id)


def _messages(connection, job: PushJob) -> list[dict]:
    if job.staff:
        rows = connection.execute(
            f"""
            SELECT push_tokens.token, users.id AS user_id, users.role
            FROM push_tokens JOIN users ON users.id = push_tokens.user_id
            WHERE users.status = 'active' AND users.role IN ({",".join("?" * len(STAFF_ROLES))})
            """,
            STAFF_ROLES,
        ).fetchall()
    else:
        rows = connection.execute(
            f"""
            SELECT push_tokens.token, users.id AS user_id, users.role
            FROM push_tokens JOIN users ON users.id = push_tokens.user_id
            WHERE users.status = 'active' AND users.id IN ({",".join("?" * len(job.user_ids))})
            """,
            job.user_ids,
        ).fetchall()
    badges: dict[str, int] = {}
    messages = []
    for row in rows:
        if row["user_id"] not in badges:
            badges[row["user_id"]] = _badge(connection, row["user_id"], row["role"])
        messages.append(
            {
                "to": row["token"],
                "title": job.title,
                "body": job.body,
                "sound": "default",
                "priority": "high",
                "badge": badges[row["user_id"]],
                "data": {
                    "notification_id": job.notification_id,
                    "kind": job.kind,
                    "record_id": job.record_id,
                    "resident_id": job.resident_id,
                },
            }
        )
    return messages


def _deliver(jobs: list[PushJob]) -> None:
    from app.shared.db import create_connection

    settings = get_settings()
    connection = create_connection()
    try:
        messages = [message for job in jobs for message in _messages(connection, job)]
        if not messages:
            return
        if settings.push_driver != "expo":
            SENT.extend(messages)
            log.info("push mock recorded %d message(s)", len(messages))
            return
        headers = {"Accept": "application/json", "Content-Type": "application/json"}
        if settings.expo_access_token.strip():
            headers["Authorization"] = f"Bearer {settings.expo_access_token.strip()}"
        with httpx.Client(timeout=TIMEOUT_SECONDS, headers=headers) as client:
            dead = send_expo(client, messages)
        if dead:
            connection.executemany(
                "DELETE FROM push_tokens WHERE token = ?", [(token,) for token in dead]
            )
            connection.commit()
            log.info("push removed %d unregistered token(s)", len(dead))
    finally:
        connection.close()


def send_expo(client: httpx.Client, messages: list[dict]) -> list[str]:
    """POST to Expo in chunks. Returns tokens Expo says are no longer registered."""
    dead: list[str] = []
    for start in range(0, len(messages), CHUNK):
        chunk = messages[start : start + CHUNK]
        try:
            response = client.post(EXPO_PUSH_URL, json=chunk)
            response.raise_for_status()
            tickets = response.json().get("data", [])
        except (httpx.HTTPError, ValueError) as exc:
            log.warning("push send failed for %d message(s): %s", len(chunk), type(exc).__name__)
            continue
        for message, ticket in zip(chunk, tickets):
            if ticket.get("status") != "error":
                continue
            reason = (ticket.get("details") or {}).get("error")
            if reason == "DeviceNotRegistered":
                dead.append(message["to"])
            else:
                log.warning("push ticket error: %s", reason or ticket.get("message"))
    return dead
