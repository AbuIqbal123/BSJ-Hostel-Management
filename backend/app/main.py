"""API process.

backend/openapi.yaml is the HTTP contract and is what /docs shows.
docs/api.md is the same contract, rendered for reading.
A route registered on this app must already be in that file.
Paths in the file may exist before they are implemented.
"""

from __future__ import annotations

from contextlib import asynccontextmanager
from pathlib import Path

import yaml
from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from pydantic import BaseModel

from app.shared.config import get_settings
from app.shared.errors import ApiError, api_error_handler, validation_error_handler
from app.shared.migrate import migrate
from app.shared.auth.routes import router as auth_router
from app.residents.home.routes import router as home_router
from app.residents.hall_pass.routes import router as hall_pass_router
from app.residents.outings.routes import router as outings_router
from app.residents.permissions.routes import router as permissions_router
from app.staff.register.routes import router as register_router
from app.staff.register.permission_routes import router as permission_queue_router

SPEC_PATH = Path(__file__).resolve().parent.parent / "openapi.yaml"
DOCUMENTATION_PATHS = {"/openapi.json", "/docs", "/docs/oauth2-redirect", "/redoc"}


class Health(BaseModel):
    status: str


def load_spec() -> dict:
    spec = yaml.safe_load(SPEC_PATH.read_text(encoding="utf-8"))
    if not isinstance(spec, dict) or not isinstance(spec.get("paths"), dict):
        raise RuntimeError(f"{SPEC_PATH} has no paths object")
    return spec


def ensure_routes_documented(app: FastAPI, spec: dict) -> None:
    documented = set(spec["paths"])
    missing = sorted(
        {
            route.path
            for route in app.routes
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
    get_settings()
    ensure_routes_documented(app, load_spec())
    migrate()
    yield


app = FastAPI(lifespan=lifespan, docs_url="/docs", redoc_url="/redoc")
app.include_router(auth_router)
app.include_router(home_router)
app.include_router(hall_pass_router)
app.include_router(outings_router)
app.include_router(permissions_router)
app.include_router(register_router)
app.include_router(permission_queue_router)
app.add_exception_handler(ApiError, api_error_handler)
app.add_exception_handler(RequestValidationError, validation_error_handler)


@app.get("/health", response_model=Health)
def health() -> Health:
    return Health(status="ok")


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
