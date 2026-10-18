"""LIKE patterns that treat the caller's text as characters."""


def escape_like(term: str) -> str:
    """Escape ``\\``, ``%``, and ``_`` for ``LIKE ... ESCAPE '\\'``."""
    return term.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def like_contains(term: str) -> str:
    """The term, escaped, with a wildcard on each side."""
    return f"%{escape_like(term)}%"
