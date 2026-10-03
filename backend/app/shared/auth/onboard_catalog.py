"""Published resident-block room counts for self-onboard.

Matches the hall inventory counts for Block-A through Block-D. Utility is not a
resident block and is not part of this catalog.
"""

from __future__ import annotations

# Door numbers seeded for each resident block: 1 through this count.
RESIDENT_BLOCK_ROOM_COUNTS: dict[str, int] = {
    "A": 50,
    "B": 58,
    "C": 42,
    "D": 40,
}

RESIDENT_BLOCK_CODES: tuple[str, ...] = ("A", "B", "C", "D")
