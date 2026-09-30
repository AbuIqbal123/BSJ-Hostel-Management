---
name: contract-maintenance
description: >
  Keep the Begum Sultan Jahan Hall backend contract aligned with the code.
  Use whenever an API route, request, response, status code, error code, auth
  rule, database table, column, constraint, or record lifecycle changes, and
  whenever implementing a FastAPI endpoint in this hostel system. Also use when
  the user says the contract, Swagger, OpenAPI, schema, or data model is out
  of date, or runs /contract-maintenance.
---

# Contract maintenance

Two files own the contract. A third is rendered from the HTTP file so a person can read it:

- HTTP: `backend/openapi.yaml` (this is what `/docs` shows)
- HTTP, for reading: `docs/api.md` (generated; do not edit it by hand)
- Database: `docs/database.md`

When a change affects what a client sends, what the server returns, who may call it, what is stored, or how a record moves between states:

1. Edit the owning file in the same change as the code.
2. Leave `info.version` and the version at the top of `docs/database.md` unchanged while the work is on dev. Do not add a revision row. Change those version numbers only when the change is for production.
3. Update the example and the error code if the caller would see a different payload.
4. If the YAML changed, regenerate the reading copy from the repository root: `backend/.venv/bin/python backend/scripts/render_api_md.py`.
5. Do not leave the change only in a commit message or a code comment.
6. If the change adds, removes, or connects a part of the system, update `docs/system-architecture.md` in the same change. The line convention is at the top of that file.

A route registered in `backend/app` must already be a path in `backend/openapi.yaml`. The process refuses to start otherwise. A path may be documented before it is implemented.

Confirmed hall rules and open decisions are both listed in `docs/database.md`. An open decision becomes a confirmed rule only when that file says the hall decided it.

After an HTTP edit, start the backend from `backend/` and load `/docs`. The operation you changed is visible there with its payload and response.
