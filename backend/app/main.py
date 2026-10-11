"""API process.

backend/openapi.yaml is the HTTP contract and is what /docs shows.
docs/api/api.md is the same contract, rendered for reading.
A route registered on this app must already be in that file.
Paths in the file may exist before they are implemented.
"""

from __future__ import annotations

import os
import sqlite3

import turso_serverless
from contextlib import asynccontextmanager
from pathlib import Path

import yaml
from fastapi import FastAPI
from uvicorn.middleware.proxy_headers import ProxyHeadersMiddleware
from fastapi.exceptions import RequestValidationError
from pydantic import BaseModel

from app.shared.config import get_settings, is_hosted
from app.shared.db import commit_request
from app.shared.errors import ApiError, api_error_handler, validation_error_handler
from app.shared.migrate import MIGRATIONS, SCHEMA_VERSION, applied_migrations, migrate
from app.shared.auth.routes import router as auth_router
from app.residents.home.routes import router as home_router
from app.residents.account_routes import router as account_router
from app.residents.notifications.routes import router as notifications_router
from app.residents.hall_pass.routes import router as hall_pass_router
from app.residents.guests.routes import router as guests_router
from app.residents.guests.staff_routes import router as guest_staff_router
from app.residents.outings.routes import router as outings_router
from app.residents.permissions.routes import router as permissions_router
from app.staff.register.routes import router as register_router
from app.staff.register.permission_routes import router as permission_queue_router
from app.staff.gate.routes import router as gate_router
from app.staff.gate.guest_routes import router as gate_guests_router
from app.staff.office.routes import router as office_router
from app.staff.office.blocks_routes import router as office_blocks_router
from app.staff.office.rooms_routes import router as office_rooms_router
from app.staff.office.destinations_routes import router as office_destinations_router
from app.staff.office.residents_routes import router as office_residents_router
from app.staff.office.staff_routes import router as office_staff_router
from app.staff.office.password_routes import router as office_password_router
from app.staff.office.audit_routes import router as office_audit_router
from app.staff.office.sms_routes import router as office_sms_router
from app.staff.office.export_routes import router as office_export_router

SPEC_PATH = Path(__file__).resolve().parent.parent / "openapi.yaml"
DOCUMENTATION_PATHS = {"/openapi.json", "/docs", "/docs/oauth2-redirect", "/redoc"}
ROUTERS = (
    auth_router,
    home_router,
    account_router,
    notifications_router,
    hall_pass_router,
    guests_router,
    guest_staff_router,
    outings_router,
    permissions_router,
    register_router,
    permission_queue_router,
    gate_router,
    gate_guests_router,
    office_router,
    office_blocks_router,
    office_rooms_router,
    office_destinations_router,
    office_residents_router,
    office_staff_router,
    office_password_router,
    office_audit_router,
    office_sms_router,
    office_export_router,
)


class Health(BaseModel):
    status: str


class Ready(BaseModel):
    status: str
    user_version: int


def load_spec() -> dict:
    spec = yaml.safe_load(SPEC_PATH.read_text(encoding="utf-8"))
    if not isinstance(spec, dict) or not isinstance(spec.get("paths"), dict):
        raise RuntimeError(f"{SPEC_PATH} has no paths object")
    return spec


def ensure_routes_documented(app: FastAPI, spec: dict) -> None:
    documented = set(spec["paths"])
    routes = [*app.routes, *(route for router in ROUTERS for route in router.routes)]
    missing = sorted(
        {
            route.path
            for route in routes
            if getattr(route, "methods", None)
            and route.path not in DOCUMENTATION_PATHS
            and route.path not in documented
        }
    )
    if missing:
        joined = ", ".join(missing)
        raise RuntimeError(
            f"These routes are not in openapi.yaml: {joined}. "
            "Update the contract in the same change."
        )


@asynccontextmanager
async def lifespan(app: FastAPI):
    ensure_routes_documented(app, load_spec())
    migrate()
    yield


app = FastAPI(lifespan=lifespan, docs_url="/docs", redoc_url="/redoc")
for router in ROUTERS:
    app.include_router(router)
app.add_exception_handler(ApiError, api_error_handler)
app.add_exception_handler(RequestValidationError, validation_error_handler)


@app.get("/health", response_model=Health)
def health() -> Health:
    return Health(status="ok")


def _schema_version(connection: sqlite3.Connection) -> int:
    expected = {path.name for path in MIGRATIONS}
    if applied_migrations(connection) != expected:
        raise RuntimeError("The hall schema is not current.")
    return SCHEMA_VERSION


@app.get("/ready", response_model=Ready)
def ready() -> Ready:
    settings = get_settings()
    if is_hosted():
        try:
            from app.shared.db import create_connection

            connection = create_connection()
            try:
                user_version = _schema_version(connection)
            finally:
                connection.close()
        except (RuntimeError, OSError, sqlite3.Error, turso_serverless.Error) as exc:
            raise ApiError(503, "not_ready", "The hall database could not be opened.") from exc
        return Ready(status="ready", user_version=user_version)
    path = settings.database_path
    if not path.is_file():
        raise ApiError(503, "not_ready", "The hall database could not be opened.")
    try:
        connection = sqlite3.connect(
            path.resolve().as_uri() + "?mode=ro",
            uri=True,
            timeout=settings.sqlite_busy_timeout_ms / 1000,
        )
        try:
            user_version = _schema_version(connection)
        finally:
            connection.close()
    except sqlite3.Error as exc:
        raise ApiError(503, "not_ready", "The hall database could not be opened.") from exc
    return Ready(status="ready", user_version=user_version)


def custom_openapi() -> dict:
    settings = get_settings()
    if settings.environment != "development" and app.openapi_schema is not None:
        return app.openapi_schema
    spec = load_spec()
    ensure_routes_documented(app, spec)
    if settings.environment != "development":
        app.openapi_schema = spec
    return spec


app.openapi = custom_openapi


class CommitBeforeResponse:
    """Commit the request transaction before http.response.start."""

    def __init__(self, asgi_app: object) -> None:
        self.asgi_app = asgi_app

    async def __call__(self, scope: dict, receive: object, send: object) -> None:
        if scope["type"] != "http":
            await self.asgi_app(scope, receive, send)  # type: ignore[misc]
            return
        started = False
        failed = False

        async def send_after_commit(message: dict) -> None:
            nonlocal failed, started
            if failed:
                return
            if message["type"] == "http.response.start" and not started:
                try:
                    commit_request(scope)
                except Exception:
                    failed = True
                    started = True
                    body = b"Internal Server Error"
                    await send(  # type: ignore[misc]
                        {
                            "type": "http.response.start",
                            "status": 500,
                            "headers": [
                                (b"content-type", b"text/plain; charset=utf-8"),
                                (b"content-length", str(len(body)).encode()),
                            ],
                        }
                    )
                    await send({"type": "http.response.body", "body": body})  # type: ignore[misc]
                    return
                started = True
            await send(message)  # type: ignore[misc]

        await self.asgi_app(scope, receive, send_after_commit)  # type: ignore[misc]


# Inner middleware commits. Outer middleware rewrites the client from a trusted proxy.
app.add_middleware(CommitBeforeResponse)
app.add_middleware(
    ProxyHeadersMiddleware,
    trusted_hosts=os.environ.get("FORWARDED_ALLOW_IPS", "127.0.0.1,::1"),
)
