"""Local-disk storage for optional guest-stay payment evidence files."""

from __future__ import annotations

import re
import uuid
from pathlib import Path

from app.shared.config import get_settings
from app.shared.errors import ApiError

ALLOWED_CONTENT_TYPES = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "application/pdf": ".pdf",
}
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".pdf"}
MAX_EVIDENCE_BYTES = 5 * 1024 * 1024

_SAFE_ORIGINAL_NAME = re.compile(r"^[^/\\\\]+$")


def evidence_root() -> Path:
    root = get_settings().payment_evidence_dir
    root.mkdir(parents=True, exist_ok=True)
    return root.resolve()


def resolve_stored_path(relative: str) -> Path:
    """Map a stored relative path to an absolute file under the evidence root."""
    root = evidence_root()
    if not relative or relative.startswith("/") or ".." in Path(relative).parts:
        raise ApiError(500, "not_ready", "Stored evidence path is invalid.")
    candidate = (root / relative).resolve()
    try:
        candidate.relative_to(root)
    except ValueError as exc:
        raise ApiError(500, "not_ready", "Stored evidence path is invalid.") from exc
    return candidate


def validate_upload(
    *,
    filename: str | None,
    content_type: str | None,
    size: int,
) -> tuple[str, str, str]:
    """Return (original_name, content_type, stored_extension)."""
    if not filename or not filename.strip():
        raise ApiError(
            422,
            "validation_error",
            "Evidence file is required.",
            field="evidence",
        )
    original = Path(filename).name
    if not original or not _SAFE_ORIGINAL_NAME.match(original):
        raise ApiError(
            422,
            "validation_error",
            "Evidence filename is not valid.",
            field="evidence",
        )
    suffix = Path(original).suffix.lower()
    if suffix not in ALLOWED_EXTENSIONS:
        raise ApiError(
            422,
            "validation_error",
            "Evidence must be a JPEG, PNG, or PDF file.",
            field="evidence",
        )
    normalized_type = (content_type or "").split(";")[0].strip().lower()
    if normalized_type not in ALLOWED_CONTENT_TYPES:
        raise ApiError(
            422,
            "validation_error",
            "Evidence must be image/jpeg, image/png, or application/pdf.",
            field="evidence",
        )
    expected_exts = {ALLOWED_CONTENT_TYPES[normalized_type]}
    if normalized_type == "image/jpeg":
        expected_exts = {".jpg", ".jpeg"}
    if suffix not in expected_exts:
        raise ApiError(
            422,
            "validation_error",
            "Evidence file extension does not match its content type.",
            field="evidence",
        )
    if size <= 0:
        raise ApiError(
            422,
            "validation_error",
            "Evidence file is empty.",
            field="evidence",
        )
    if size > MAX_EVIDENCE_BYTES:
        raise ApiError(
            422,
            "validation_error",
            "Evidence file must be at most 5 MiB.",
            field="evidence",
        )
    return original, normalized_type, ALLOWED_CONTENT_TYPES[normalized_type]


def store_evidence_file(
    *,
    guest_stay_id: str,
    content: bytes,
    content_type: str,
    previous_relative: str | None,
) -> str:
    """Write bytes under a UUID name; return relative path. Removes previous file."""
    ext = ALLOWED_CONTENT_TYPES[content_type]
    relative = f"{guest_stay_id}/{uuid.uuid4().hex}{ext}"
    absolute = resolve_stored_path(relative)
    absolute.parent.mkdir(parents=True, exist_ok=True)
    absolute.write_bytes(content)
    if previous_relative:
        delete_evidence_file(previous_relative)
    return relative


def delete_evidence_file(relative: str | None) -> None:
    if not relative:
        return
    try:
        path = resolve_stored_path(relative)
    except ApiError:
        return
    if path.is_file():
        path.unlink()
