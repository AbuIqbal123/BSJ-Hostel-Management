"""Rows in her inbox, and the pushes that go with them.

A row is written when a warden or the provost decides her permission or guest
stay, and once per outing when it passes grace while she is out. The late row
is also the sent-once marker for the late push to her and to staff.
"""

from __future__ import annotations

import sqlite3
import uuid
from typing import Literal

from app.shared.push import PushJob

DecisionKind = Literal["permission_decided", "guest_stay_decided"]


def resident_unread_count(
    connection: sqlite3.Connection, resident_id: str, up_to: str | None = None
) -> int:
    if up_to is None:
        return connection.execute(
            "SELECT COUNT(*) FROM resident_notifications WHERE resident_id = ? AND read_at IS NULL",
            (resident_id,),
        ).fetchone()[0]
    return connection.execute(
        """
        SELECT COUNT(*) FROM resident_notifications
        WHERE resident_id = ? AND read_at IS NULL AND created_at <= ?
        """,
        (resident_id, up_to),
    ).fetchone()[0]


def record_decision(
    connection: sqlite3.Connection,
    *,
    kind: DecisionKind,
    record_id: str,
    resident_id: str,
    decision: str,
    now_text: str,
    what: str,
    noun: str,
    by_name: str,
) -> PushJob:
    """`what` names the record in the title; `noun` is the inbox sentence's subject."""
    notification_id = str(uuid.uuid4())
    connection.execute(
        """
        INSERT INTO resident_notifications (id, resident_id, kind, record_id, decision, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        (notification_id, resident_id, kind, record_id, decision, now_text),
    )
    word = "approved" if decision == "approved" else "declined"
    return PushJob(
        title=f"{what[:1].upper()}{what[1:]} {word}",
        body=f"Your {noun} has been {decision} by {by_name}",
        kind=kind,
        record_id=record_id,
        resident_id=resident_id,
        notification_id=notification_id,
        user_ids=(resident_id,),
    )


def record_late_outings(connection: sqlite3.Connection, now_text: str) -> list[PushJob]:
    """Write one late row per outing that passed grace while she is out. Returns the pushes."""
    rows = connection.execute(
        """
        SELECT outings.id, outings.resident_id, outings.grace_ends_at, outings.place,
               users.full_name, rooms.label AS room_label
        FROM outings
        JOIN users ON users.id = outings.resident_id
        JOIN residents ON residents.user_id = outings.resident_id
        JOIN rooms ON rooms.id = residents.room_id
        WHERE outings.status = 'outside'
          AND outings.grace_ends_at < ?
          AND NOT EXISTS (
            SELECT 1 FROM resident_notifications
            WHERE kind = 'resident_late' AND record_id = outings.id
          )
        """,
        (now_text,),
    ).fetchall()
    jobs: list[PushJob] = []
    for row in rows:
        notification_id = str(uuid.uuid4())
        cursor = connection.execute(
            """
            INSERT INTO resident_notifications (id, resident_id, kind, record_id, decision, created_at)
            VALUES (?, ?, 'resident_late', ?, NULL, ?)
            ON CONFLICT (kind, record_id) DO NOTHING
            """,
            (notification_id, row["resident_id"], row["id"], row["grace_ends_at"]),
        )
        if cursor.rowcount != 1:
            continue
        jobs.append(
            PushJob(
                title="You are late",
                body="You have not returned by the time you were due",
                kind="resident_late",
                record_id=row["id"],
                resident_id=row["resident_id"],
                notification_id=notification_id,
                user_ids=(row["resident_id"],),
            )
        )
        jobs.append(
            PushJob(
                title="Resident late",
                body=f"{row['full_name']} ({row['room_label']}) is late back from {row['place']}.",
                kind="resident_late",
                record_id=row["id"],
                resident_id=row["resident_id"],
                notification_id=f"resident_late:{row['id']}",
                staff=True,
            )
        )
    return jobs


def request_push(
    *, kind: Literal["permission_requested", "guest_stay_requested"], record_id: str,
    resident_id: str, resident_name: str, room_label: str | None, what: str,
) -> PushJob:
    room = f" ({room_label})" if room_label else ""
    return PushJob(
        title="New request",
        body=f"{resident_name}{room} asked for {what}.",
        kind=kind,
        record_id=record_id,
        resident_id=resident_id,
        notification_id=f"{kind}:{record_id}",
        staff=True,
    )
