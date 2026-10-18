"""Guest-stay payment evidence kept as a blob in the hall database.

The server stores the bytes it was given. It does not convert them.
The type comes from the file header, not from the client's Content-Type.
"""

from __future__ import annotations

import sqlite3
from typing import Any

from python_multipart.exceptions import FormParserError
from python_multipart.multipart import MultipartParser, parse_options_header
from starlette.requests import Request

from app.shared.errors import ApiError

MAX_EVIDENCE_BYTES = 2 * 1024 * 1024
# The request is the file plus one multipart wrapper. The file itself stays at 2 MiB.
_MULTIPART_ALLOWANCE = 8 * 1024

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


class _EvidenceCapture:
    """The `evidence` file part, stopped once it passes the size limit."""

    def __init__(self) -> None:
        self.filename: str | None = None
        self.chunks: list[bytes] = []
        self.size = 0
        self.too_big = False
        self.saw_file = False
        self._field = bytearray()
        self._value = bytearray()
        self._capturing = False

    def on_part_begin(self) -> None:
        self._capturing = False
        self._field.clear()
        self._value.clear()

    def on_header_field(self, data: bytes, start: int, end: int) -> None:
        self._field.extend(data[start:end])

    def on_header_value(self, data: bytes, start: int, end: int) -> None:
        self._value.extend(data[start:end])

    def on_header_end(self) -> None:
        if bytes(self._field).lower() == b"content-disposition":
            _, options = parse_options_header(bytes(self._value))
            if options.get(b"name") == b"evidence" and b"filename" in options:
                self.saw_file = True
                self._capturing = True
                self.filename = options[b"filename"].decode("utf-8", "replace")
        self._field.clear()
        self._value.clear()

    def on_headers_finished(self) -> None:
        return None

    def on_part_data(self, data: bytes, start: int, end: int) -> None:
        if not self._capturing or self.too_big:
            return
        piece = bytes(data[start:end])
        self.size += len(piece)
        if self.size > MAX_EVIDENCE_BYTES:
            self.too_big = True
            self.chunks.clear()
            return
        self.chunks.append(piece)

    def on_part_end(self) -> None:
        self._capturing = False

    def on_end(self) -> None:
        return None

    def callbacks(self) -> dict[str, Any]:
        return {
            "on_part_begin": self.on_part_begin,
            "on_part_data": self.on_part_data,
            "on_part_end": self.on_part_end,
            "on_header_field": self.on_header_field,
            "on_header_value": self.on_header_value,
            "on_header_end": self.on_header_end,
            "on_headers_finished": self.on_headers_finished,
            "on_end": self.on_end,
        }


def _declared_length(request: Request) -> int | None:
    raw = request.headers.get("content-length")
    if raw is None:
        return None
    try:
        return int(raw)
    except ValueError:
        return None


async def read_limited_evidence(request: Request) -> tuple[bytes, str | None]:
    """File bytes and filename. 413 as soon as the body passes the limit."""
    declared = _declared_length(request)
    if declared is not None and declared > MAX_EVIDENCE_BYTES + _MULTIPART_ALLOWANCE:
        raise ApiError(413, "payload_too_large", _TOO_LARGE, field="evidence")
    _, params = parse_options_header(request.headers.get("content-type"))
    boundary = params.get(b"boundary")
    if boundary is None:
        raise ApiError(422, "validation_error", _EMPTY, field="evidence")
    capture = _EvidenceCapture()
    parser = MultipartParser(boundary, capture.callbacks())
    cap = MAX_EVIDENCE_BYTES + _MULTIPART_ALLOWANCE
    received = 0
    try:
        async for chunk in request.stream():
            received += len(chunk)
            if received > cap or capture.too_big:
                raise ApiError(413, "payload_too_large", _TOO_LARGE, field="evidence")
            parser.write(chunk)
            if capture.too_big:
                raise ApiError(413, "payload_too_large", _TOO_LARGE, field="evidence")
        parser.finalize()
    except FormParserError as exc:
        raise ApiError(422, "validation_error", _EMPTY, field="evidence") from exc
    if capture.too_big:
        raise ApiError(413, "payload_too_large", _TOO_LARGE, field="evidence")
    if not capture.saw_file:
        raise ApiError(422, "validation_error", _EMPTY, field="evidence")
    return b"".join(capture.chunks), capture.filename


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
