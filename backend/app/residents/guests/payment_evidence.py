"""Guest-stay payment evidence kept as a blob in the hall database.

The server stores the bytes it was given. It does not convert them.
The type comes from the file header, not from the client's Content-Type.
"""

from __future__ import annotations

import sqlite3

from app.shared.errors import ApiError

MAX_EVIDENCE_BYTES = 2 * 1024 * 1024

_JPEG = b"\xff\xd8\xff"
_PNG = b"\x89PNG\r\n\x1a\n"
_PDF = b"%PDF-"

_TYPES = (
    (_JPEG, "image/jpeg", "jpg"),
    (_PNG, "image/png", "png"),
    (_PDF, "application/pdf", "pdf"),
)

_EMPTY = "Evidence file is empty."
_TRUNCATED = "Evidence file is incomplete."
_UNSUPPORTED = "Evidence must be a JPEG, PNG, or PDF."
_TOO_LARGE = "Evidence file must be at most 2 MiB."


def sniff_content_type(content: bytes) -> str:
    """Return the stored type, or raise 413, 415, or 422."""
    if len(content) > MAX_EVIDENCE_BYTES:
        raise ApiError(413, "payload_too_large", _TOO_LARGE, field="evidence")
    if not content:
        raise ApiError(422, "validation_error", _EMPTY, field="evidence")
    for magic, content_type, _ext in _TYPES:
        if content.startswith(magic):
            return content_type
    for magic, _content_type, _ext in _TYPES:
        if magic.startswith(content):
            raise ApiError(422, "validation_error", _TRUNCATED, field="evidence")
    raise ApiError(415, "unsupported_media_type", _UNSUPPORTED, field="evidence")


def display_filename(filename: str | None) -> str:
    """A name for the screen. Path characters are removed. At most 255 characters."""
    raw = (filename or "").replace("\\", "/").split("/")[-1]
    raw = raw.replace("\x00", "").strip()
    if not raw:
        raw = "evidence"
    return raw[:255]


def extension_for(content_type: str) -> str:
    for _magic, stored, ext in _TYPES:
        if stored == content_type:
            return ext
    return "bin"


def save_evidence(
    connection: sqlite3.Connection,
    *,
    guest_stay_id: str,
    content: bytes,
    content_type: str,
    original_name: str,
    uploaded_by: str,
    now_text: str,
) -> None:
    """Upsert the blob and the stay metadata on the caller's transaction."""
    connection.execute(
        """
        INSERT INTO guest_stay_payment_evidence (guest_stay_id, content, size_bytes)
        VALUES (?, ?, ?)
        ON CONFLICT(guest_stay_id) DO UPDATE SET
          content = excluded.content,
          size_bytes = excluded.size_bytes
        """,
        (guest_stay_id, content, len(content)),
    )
    connection.execute(
        """
        UPDATE guest_stays
        SET
          payment_evidence_path = NULL,
          payment_evidence_original_name = ?,
          payment_evidence_content_type = ?,
          payment_evidence_uploaded_at = ?,
          payment_evidence_uploaded_by = ?,
          updated_at = ?
        WHERE id = ?
        """,
        (original_name, content_type, now_text, uploaded_by, now_text, guest_stay_id),
    )


def load_evidence(
    connection: sqlite3.Connection, guest_stay_id: str
) -> tuple[bytes, str] | None:
    """Return the blob and the stored type. None when the blob row is missing."""
    blob = connection.execute(
        """
        SELECT content
        FROM guest_stay_payment_evidence
        WHERE guest_stay_id = ?
        """,
        (guest_stay_id,),
    ).fetchone()
    if blob is None:
        return None
    meta = connection.execute(
        """
        SELECT payment_evidence_content_type
        FROM guest_stays
        WHERE id = ?
        """,
        (guest_stay_id,),
    ).fetchone()
    content_type = None if meta is None else meta["payment_evidence_content_type"]
    if content_type not in {item[1] for item in _TYPES}:
        return None
    content = blob["content"]
    if isinstance(content, memoryview):
        content = content.tobytes()
    return bytes(content), content_type


def clear_evidence(connection: sqlite3.Connection, guest_stay_id: str) -> None:
    connection.execute(
        "DELETE FROM guest_stay_payment_evidence WHERE guest_stay_id = ?",
        (guest_stay_id,),
    )


def download_name(guest_stay_id: str, content_type: str) -> str:
    return f"payment-evidence-{guest_stay_id}.{extension_for(content_type)}"
