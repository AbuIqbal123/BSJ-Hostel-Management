"""Other active residents who share a host's room."""

from __future__ import annotations

import sqlite3


def active_roommate_user_ids(
    connection: sqlite3.Connection, host_resident_id: str
) -> list[str]:
    rows = connection.execute(
        """
        SELECT roommates.user_id
        FROM residents AS host
        JOIN residents AS roommates
          ON roommates.room_id = host.room_id
         AND roommates.user_id <> host.user_id
        JOIN users ON users.id = roommates.user_id
        WHERE host.user_id = ?
          AND users.status = 'active'
        ORDER BY roommates.user_id
        """,
        (host_resident_id,),
    ).fetchall()
    return [row[0] for row in rows]
