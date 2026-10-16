"""Every route depends on the signed-in account, except the public allowlist."""

from __future__ import annotations

from app.main import ROUTERS, app

# Health, readiness, and the docs pages are not hall actions.
# Sign-in, refresh, and onboard are how a person gets an account.
PUBLIC = {
    ("GET", "/health"),
    ("GET", "/ready"),
    ("GET", "/openapi.json"),
    ("GET", "/docs"),
    ("GET", "/docs/oauth2-redirect"),
    ("GET", "/redoc"),
    ("POST", "/api/v1/auth/login"),
    ("POST", "/api/v1/auth/refresh"),
    ("POST", "/api/v1/auth/onboard"),
    ("POST", "/api/v1/auth/onboard/enrolment"),
    ("GET", "/api/v1/auth/onboard/options"),
}


def _calls(dependant: object, seen: set[int] | None = None) -> list[str]:
    if dependant is None:
        return []
    seen = set() if seen is None else seen
    if id(dependant) in seen:
        return []
    seen.add(id(dependant))
    names: list[str] = []
    call = getattr(dependant, "call", None)
    if call is not None:
        names.append(getattr(call, "__name__", ""))
    for child in getattr(dependant, "dependencies", []) or []:
        names.extend(_calls(child, seen))
    return names


def _routes() -> list[tuple[str, str, list[str]]]:
    found: list[tuple[str, str, list[str]]] = []
    routes = [*app.routes, *(route for router in ROUTERS for route in router.routes)]
    for route in routes:
        methods = getattr(route, "methods", None)
        path = getattr(route, "path", None)
        if not methods or not path:
            continue
        names = _calls(getattr(route, "dependant", None))
        for method in sorted(methods):
            if method == "HEAD":
                continue
            found.append((method, path, names))
    return found


def test_every_route_has_an_auth_dependency_or_is_public() -> None:
    seen_public: set[tuple[str, str]] = set()
    open_routes: list[str] = []
    for method, path, names in _routes():
        if (method, path) in PUBLIC:
            seen_public.add((method, path))
            continue
        if "current_user" not in names:
            open_routes.append(f"{method} {path}")
    assert open_routes == []
    assert seen_public == PUBLIC
