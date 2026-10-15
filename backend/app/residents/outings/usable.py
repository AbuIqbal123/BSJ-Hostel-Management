"""Which outing a resident can use right now.

One rule for the gate scan and for GET /me/hall-pass, for every outing type:
an ordinary plan, a late-night permission, and a home-going permission.
"""

from __future__ import annotations

import sqlite3
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Literal

from app.residents.outings.records import qr_window
from app.shared import clock

ORDINARY_LEAD = timedelta(minutes=30)

# Overlap policy, in one place. When several outings are open at once the lowest
# rank wins: the one she is outside on, then a permission, then an ordinary plan.
# To let an ordinary plan beat a permission, swap those two ranks.
_KIND_RANK = {"outside": 0, "permission": 1, "ordinary": 2}


@dataclass(frozen=True)
class UsableOuting:
    kind: Literal["outside", "permission", "ordinary"]
    outing_type: Literal["ordinary", "late_night", "home_going"]
    outing_id: str | None
    permission_id: str | None
    place: str
    starts_at: str | None
    expected_return_at: str
    visible_from: str | None
    visible_until: str | None
    is_open: bool

    @property
    def sort_key(self) -> tuple[int, str, str]:
        return (_KIND_RANK[self.kind], self.visible_from or "", self.outing_id or self.permission_id or "")


def _outside(row: sqlite3.Row, now: datetime) -> UsableOuting:
    _, visible_from, _ = qr_window(
        outing_type=row["type"],
        status="outside",
        starts_at=row["starts_at"],
        expected_return_at=row["expected_return_at"],
        exited_at=row["exited_at"],
        now=now,
    )
    return UsableOuting(
        kind="outside",
        outing_type=row["type"],
        outing_id=row["id"],
        permission_id=row["permission_id"],
        place=row["place"],
        starts_at=row["starts_at"],
        expected_return_at=row["expected_return_at"],
        visible_from=visible_from,
        visible_until=None,
        is_open=True,
    )


def _ordinary(row: sqlite3.Row, now: datetime, today: str) -> UsableOuting | None:
    until = clock.parse_instant(row["expected_return_at"])
    if now >= until:
        return None
    if row["starts_at"] is None:
        # Older rows kept no start: open all of that hall day, until it ends.
        if row["hall_date"] != today:
            return None
        visible_from, is_open = None, True
    else:
        opens = clock.parse_instant(row["starts_at"]) - ORDINARY_LEAD
        visible_from, is_open = clock.format_instant(opens), now >= opens
    return UsableOuting(
        kind="ordinary",
        outing_type="ordinary",
        outing_id=row["id"],
        permission_id=None,
        place=row["place"],
        starts_at=row["starts_at"],
        expected_return_at=row["expected_return_at"],
        visible_from=visible_from,
        visible_until=row["expected_return_at"],
        is_open=is_open,
    )


def _permission(row: sqlite3.Row, now: datetime, lead_minutes: int) -> UsableOuting | None:
    until = clock.parse_instant(row["expected_return_at"])
    if now > until:
        return None
    opens = clock.parse_instant(row["departure_at"]) - timedelta(minutes=lead_minutes)
    return UsableOuting(
        kind="permission",
        outing_type=row["type"],
        outing_id=None,
        permission_id=row["id"],
        place=row["short_place"],
        starts_at=row["departure_at"],
        expected_return_at=row["expected_return_at"],
        visible_from=clock.format_instant(opens),
        visible_until=row["expected_return_at"],
        is_open=now >= opens,
    )


def find_usable_outing(
    connection: sqlite3.Connection,
    resident_id: str,
    now: datetime,
    permission_lead_minutes: int,
) -> UsableOuting | None:
    """The outing she can use now, else the next one coming, else None.

    An outside resident always gets the outing she is out on. Otherwise the
    open outings compete under the overlap policy; if none is open, the next
    one to open is returned with is_open False.
    """
    today = clock.hall_local_date(now)
    found: list[UsableOuting] = []
    for row in connection.execute(
        """
        SELECT id, permission_id, type, place, starts_at, expected_return_at,
               exited_at, hall_date, status
        FROM outings
        WHERE resident_id = ? AND status IN ('planned', 'outside')
          AND (status = 'outside' OR type = 'ordinary')
        """,
        (resident_id,),
    ):
        if row["status"] == "outside":
            found.append(_outside(row, now))
        elif (plan := _ordinary(row, now, today)) is not None:
            found.append(plan)
    for row in connection.execute(
        """
        SELECT id, type, short_place, departure_at, expected_return_at
        FROM permissions
        WHERE resident_id = ? AND status = 'approved'
        """,
        (resident_id,),
    ):
        if (permission := _permission(row, now, permission_lead_minutes)) is not None:
            found.append(permission)
    open_now = sorted((item for item in found if item.is_open), key=lambda item: item.sort_key)
    if open_now:
        return open_now[0]
    coming = sorted(found, key=lambda item: (item.visible_from or "", item.sort_key))
    return coming[0] if coming else None
