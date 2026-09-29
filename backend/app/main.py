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
from pydantic import BaseModel

from app.config import get_settings

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
    yield


app = FastAPI(lifespan=lifespan, docs_url="/docs", redoc_url="/redoc")


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
