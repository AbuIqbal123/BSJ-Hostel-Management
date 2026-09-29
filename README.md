# Begum Sultan Jahan Hall

Hostel movement system for residents, wardens, gate staff, and the provost. The mobile app will be React Native. The API is FastAPI. This checkout is the local foundation: the data model and the HTTP contract, before the business routes are built.

Read these three first.

| Document | What is in it |
|---|---|
| [`docs/system-architecture.md`](docs/system-architecture.md) | The diagram of the system as it stands |
| [`docs/database.md`](docs/database.md) | Every table, column, state, and rule. Schema version 0.1.0. Not applied yet |
| [`docs/api.md`](docs/api.md) | Every endpoint: who calls it, the payload, and the response. API version 0.1.0 |

Swagger serves the same HTTP contract at http://127.0.0.1:8000/docs from `backend/openapi.yaml`.

## Repository

| Path | What it is |
|---|---|
| `backend/` | The FastAPI service |
| `docs/` | The diagram, the database, the API, the later hosting plan, and tests |
| `reference/` | The original proposal, demo, and prototype. Not the application |
| `AGENTS.md` | Engineering rules for changes in this repo |

Docker is not part of local development. The later hosting plan is in [`docs/architecture.md`](docs/architecture.md).

A change to stored data, HTTP, or the shape of the system updates the owning document in the same change. The rule is in `AGENTS.md`. Schema and HTTP edits follow `.grok/skills/contract-maintenance/SKILL.md`.

## Local API

Requires Python 3.11 or newer. This setup uses the interpreter on the machine.

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload
```

Then open:

- Swagger UI: http://127.0.0.1:8000/docs
- ReDoc: http://127.0.0.1:8000/redoc
- OpenAPI file, as served: http://127.0.0.1:8000/openapi.json
- Health: http://127.0.0.1:8000/health

`GET /health` is the only implemented route. Every other path in the document is specified and returns 404 until it is built. In development, `/docs` re-reads `openapi.yaml` on each load. Business routes must be added to that file before they are registered, or the process will not start.

The database file will be `backend/data/hostel.db` once a connection is opened. No tables are created yet. `SMS_DRIVER` must stay `mock` unless `ENVIRONMENT` is `production`. Any other value stops the process, so a laptop cannot send a parent SMS.

## What is deliberately not here

- React Native / Expo client
- Docker, Nginx, and the VPS
- Business logic, migrations, and authentication
- Emergency alerts (the proposal leaves those out of the first version)
- A payment gateway (the hall office marks a guest stay paid or unpaid)

## Open decisions

These are in `docs/database.md` and in hall settings, because the proposal did not fix them:

- The clock time when ordinary hours end
- How many seconds a second gate scan is ignored so it cannot undo the first
- How early a resident may scan out on an approved permission
- How far ahead an ordinary expected return may be set

Sign-in is hall-issued username and password. A resident's username is the enrolment number. That screen was not in the proposal.
