"""Error body from the HTTP contract.

Every failure the caller can see is
{"detail": message, "error": {"code", "message", "request_id", "details"?}}.
`detail` repeats the message so a client that still reads it does not break.
Nothing in the body is a stack trace.
"""

from __future__ import annotations

import logging
from typing import Any

from fastapi import Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException

from app.shared.auth.password_rules import (
    INDIAN_MOBILE_MESSAGE,
    INDIAN_MOBILE_PATTERN,
    PASSWORD_CLASSES_MESSAGE,
)
from app.shared.request_context import current_request_id


def request_id_for(request: Request) -> str:
    value = getattr(request.state, "request_id", "")
    if isinstance(value, str) and value:
        return value
    return current_request_id()


def json_error(status_code: int, code: str, message: str, **kwargs: Any) -> JSONResponse:
    request_id = kwargs.pop("request_id")
    response = JSONResponse(
        status_code=status_code,
        content=error_content(code, message, request_id=request_id, **kwargs),
    )
    response.headers["X-Request-ID"] = request_id
    return response

log = logging.getLogger("bsj.http")

NOT_FOUND = "Not found."
METHOD_NOT_ALLOWED = "That method is not allowed."
INTERNAL = "The hall could not finish that."


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
    request_id: str | None = None,
) -> dict:
    error: dict = {
        "code": code,
        "message": message,
        "request_id": request_id or current_request_id(),
    }
    if details is not None:
        error["details"] = details
    elif field is not None:
        error["details"] = {"field": field}
    return {"detail": message, "error": error}


def api_error_handler(request: Request, exc: ApiError) -> JSONResponse:
    return json_error(
        exc.status_code,
        exc.code,
        exc.message,
        field=exc.field,
        details=exc.details,
        request_id=request_id_for(request),
    )


def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
    request_id = request_id_for(request)
    if exc.status_code == 404:
        code, message = "not_found", NOT_FOUND
    elif exc.status_code == 405:
        code, message = "method_not_allowed", METHOD_NOT_ALLOWED
    elif exc.status_code == 422:
        code, message = "validation_error", "The request is not valid."
    else:
        code, message = "http_error", INTERNAL
        log.error("http %s request_id=%s", exc.status_code, request_id)
    return json_error(exc.status_code, code, message, request_id=request_id)


def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    request_id = request_id_for(request)
    log.error("unhandled %s request_id=%s", type(exc).__name__, request_id)
    return json_error(500, "internal_error", INTERNAL, request_id=request_id)


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
        if kind == "string_too_short" and field in {
            "new_password",
            "password",
            "temporary_password",
        }:
            minimum = error.get("ctx", {}).get("min_length")
            if field in {"new_password", "temporary_password"} or minimum == 10:
                return "Use at least 10 characters.", field
        if kind == "password_classes":
            return PASSWORD_CLASSES_MESSAGE, field
        if (
            kind == "string_pattern_mismatch"
            and error.get("ctx", {}).get("pattern") == INDIAN_MOBILE_PATTERN
        ):
            return INDIAN_MOBILE_MESSAGE, field
        if kind == "string_too_short" and error.get("ctx", {}).get("min_length") == 1:
            return f"{label} is required.", field
        if kind == "extra_forbidden":
            return "That field is not part of this request.", field
    elif kind == "extra_forbidden":
        return "That field is not part of this request.", None
    return "The request is not valid.", field


def validation_error_handler(
    request: Request,
    exc: RequestValidationError,
) -> JSONResponse:
    errors = exc.errors()
    if not errors:
        message, field = "The request is not valid.", None
    else:
        message, field = _validation_message(errors[0])
    return json_error(
        422,
        "validation_error",
        message,
        field=field,
        request_id=request_id_for(request),
    )
