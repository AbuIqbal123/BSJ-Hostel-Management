"""Rows in her inbox, and the pushes that go with them.

A row is written when a warden or the provost decides her permission or guest
stay, when a roommate is asked to decide a guest stay, when that roommate
decides, and once per outing when it passes grace while she is out. The late
row is also the sent-once marker for the late push to her and to staff.
"""

from __future__ import annotations

import sqlite3
import uuid
from dataclasses import dataclass
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
            INSERT INTO resident_notifications (
              id, resident_id, kind, record_id, actor_user_id, decision, created_at
            )
            VALUES (?, ?, 'resident_late', ?, '', NULL, ?)
            ON CONFLICT (kind, record_id, resident_id, actor_user_id) DO NOTHING
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


def record_roommate_requests(
    connection: sqlite3.Connection,
    *,
    record_id: str,
    host_resident_id: str,
    roommate_user_ids: list[str],
    guest_name: str,
    guest_start_date: str,
    guest_end_date: str,
    now_text: str,
) -> PushJob:
    """One inbox row per current roommate, and one push to all of them."""
    for roommate_id in roommate_user_ids:
        connection.execute(
            """
            INSERT INTO resident_notifications (
              id, resident_id, kind, record_id, actor_user_id, decision, created_at
            ) VALUES (?, ?, 'guest_stay_roommate_requested', ?, '', NULL, ?)
            """,
            (str(uuid.uuid4()), roommate_id, record_id, now_text),
        )
    return PushJob(
        title="Your roommate has requested a guest stay",
        body=f"{guest_name}, {guest_start_date} to {guest_end_date}",
        kind="guest_stay_roommate_requested",
        record_id=record_id,
        resident_id=host_resident_id,
        notification_id=f"guest_stay_roommate_requested:{record_id}",
        user_ids=tuple(roommate_user_ids),
    )


def _decision_word(decision: str) -> str:
    return "approved" if decision == "approved" else "declined"


def record_roommate_decision(
    connection: sqlite3.Connection,
    *,
    record_id: str,
    host_resident_id: str,
    host_name: str,
    actor_user_id: str,
    actor_name: str,
    decision: str,
    guest_name: str,
    guest_start_date: str,
    guest_end_date: str,
    now_text: str,
) -> list[PushJob]:
    """Tell the host, and keep a lasting row for the roommate who decided."""
    word = _decision_word(decision)
    quieter = f"{guest_name}, {guest_start_date} to {guest_end_date}"
    host_notice = str(uuid.uuid4())
    own_notice = str(uuid.uuid4())
    connection.execute(
        """
        INSERT INTO resident_notifications (
          id, resident_id, kind, record_id, actor_user_id, decision, created_at
        ) VALUES (?, ?, 'guest_stay_roommate_decided', ?, ?, ?, ?)
        """,
        (host_notice, host_resident_id, record_id, actor_user_id, decision, now_text),
    )
    connection.execute(
        """
        INSERT INTO resident_notifications (
          id, resident_id, kind, record_id, actor_user_id, decision, created_at
        ) VALUES (?, ?, 'guest_stay_roommate_recorded', ?, '', ?, ?)
        """,
        (own_notice, actor_user_id, record_id, decision, now_text),
    )
    return [
        PushJob(
            title=f"Your roommate {actor_name} {word} the guest stay",
            body=quieter,
            kind="guest_stay_roommate_decided",
            record_id=record_id,
            resident_id=host_resident_id,
            notification_id=host_notice,
            user_ids=(host_resident_id,),
        ),
        PushJob(
            title=f"You {word} {host_name}'s guest stay",
            body=quieter,
            kind="guest_stay_roommate_recorded",
            record_id=record_id,
            resident_id=actor_user_id,
            notification_id=own_notice,
            user_ids=(actor_user_id,),
        ),
    ]


@dataclass(frozen=True)
class GuestStayHistoryLine:
    id: str
    guest_stay_id: str
    notice_kind: str
    decision: str
    guest_name: str
    guest_start_date: str
    guest_end_date: str
    host_name: str
    actor_name: str | None


def guest_stay_history_lines(
    connection: sqlite3.Connection, resident_id: str
) -> list[GuestStayHistoryLine]:
    """Decision notices that stay on her History tab."""
    rows = connection.execute(
        """
        SELECT
          notes.id,
          notes.record_id,
          notes.kind,
          notes.decision,
          guest_stays.guest_name,
          guest_stays.guest_start_date,
          guest_stays.guest_end_date,
          host.full_name AS host_name,
          CASE notes.kind
            WHEN 'guest_stay_roommate_decided' THEN actor.full_name
            WHEN 'guest_stay_decided' THEN decider.full_name
            ELSE NULL
          END AS actor_name
        FROM resident_notifications AS notes
        JOIN guest_stays ON guest_stays.id = notes.record_id
        JOIN users AS host ON host.id = guest_stays.host_resident_id
        LEFT JOIN users AS actor
          ON notes.kind = 'guest_stay_roommate_decided' AND actor.id = notes.actor_user_id
        LEFT JOIN users AS decider
          ON notes.kind = 'guest_stay_decided' AND decider.id = guest_stays.decided_by
        WHERE notes.resident_id = ?
          AND notes.kind IN (
            'guest_stay_decided',
            'guest_stay_roommate_decided',
            'guest_stay_roommate_recorded'
          )
        ORDER BY notes.created_at, notes.id
        """,
        (resident_id,),
    ).fetchall()
    return [
        GuestStayHistoryLine(
            id=row["id"],
            guest_stay_id=row["record_id"],
            notice_kind=row["kind"],
            decision=row["decision"],
            guest_name=row["guest_name"],
            guest_start_date=row["guest_start_date"],
            guest_end_date=row["guest_end_date"],
            host_name=row["host_name"],
            actor_name=row["actor_name"],
        )
        for row in rows
    ]


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
