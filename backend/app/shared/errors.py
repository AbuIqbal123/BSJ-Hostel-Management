"""Error body from the HTTP contract.

Every failure the caller can see is {"error": {"code", "message", "details"?}}.
"""

from __future__ import annotations

from typing import Any

from fastapi import Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse


class ApiError(Exception):
    def __init__(
        self,
        status_code: int,
        code: str,
        message: str,
        field: str | None = None,
        details: dict[str, Any] | None = None,
    ) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.code = code
        self.message = message
        self.field = field
        self.details = details


def error_content(
    code: str,
    message: str,
    field: str | None = None,
    details: dict[str, Any] | None = None,
) -> dict:
    error: dict = {"code": code, "message": message}
    if details is not None:
        error["details"] = details
    elif field is not None:
        error["details"] = {"field": field}
    return {"error": error}


def api_error_handler(_request: Request, exc: ApiError) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content=error_content(exc.code, exc.message, exc.field, exc.details),
    )


def _field_name(error: dict) -> str | None:
    parts = [
        part
        for part in error.get("loc", ())
        if part not in {"body", "query", "header", "path"} and isinstance(part, str)
    ]
    if not parts:
        return None
    return parts[-1]


def _validation_message(error: dict) -> tuple[str, str | None]:
    field = _field_name(error)
    kind = error.get("type")
    if field is not None:
        label = field.replace("_", " ").capitalize()
        if kind == "missing":
            return f"{label} is required.", field
        if kind == "string_too_short" and field in {"new_password", "password"}:
            minimum = error.get("ctx", {}).get("min_length")
            if field == "new_password" or minimum == 10:
                return "Use at least 10 characters.", field
        if kind == "string_too_short" and error.get("ctx", {}).get("min_length") == 1:
            return f"{label} is required.", field
        if kind == "extra_forbidden":
            return "That field is not part of this request.", field
    elif kind == "extra_forbidden":
        return "That field is not part of this request.", None
    return "The request is not valid.", field


def validation_error_handler(
    _request: Request,
    exc: RequestValidationError,
) -> JSONResponse:
    errors = exc.errors()
    if not errors:
        message, field = "The request is not valid.", None
    else:
        message, field = _validation_message(errors[0])
    return JSONResponse(
        status_code=422,
        content=error_content("validation_error", message, field),
    )
