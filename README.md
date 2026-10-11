# Begum Sultan Jahan Hall

Hostel movement system for residents, wardens, gate staff, and the provost. The hall API is FastAPI under `/api/v1`. The resident phone app is Expo, in `mobile/`.

Start with these.

| Document | What is in it |
|---|---|
| [`docs/README.md`](docs/README.md) | Docs map by domain (design, api, database, architecture, tests, engineering) |
| [`docs/architecture/system-architecture.md`](docs/architecture/system-architecture.md) | The diagram of the system as it stands |
| [`docs/database/database.md`](docs/database/database.md) | What the hall keeps, and the rules for how it changes. Version 1. Created when the service starts |
| [`docs/api/api.md`](docs/api/api.md) | Every endpoint: who calls it, the payload, and the response. API version 1 |
| [`docs/design/design-system.md`](docs/design/design-system.md) | Visual design lock for the Expo client |
| [`docs/design/workflows.md`](docs/design/workflows.md) | Product workflows (auth, home, permissions, register, gate, guests) |

Swagger serves the same HTTP contract at http://localhost:8000/docs from `backend/openapi.yaml`. The test catalog is [`docs/tests/tests.md`](docs/tests/tests.md).

## Repository

| Path | What it is |
|---|---|
| `backend/app/main.py` | Starts the process |
| `backend/app/shared/` | Sign-in, the clock, errors, settings, the database connection, and creating the hall. Sign-in tests are in `backend/app/shared/auth/tests/` |
| `backend/app/residents/` | Resident phone: `home`, `notifications`, `outings`, `permissions`, `guests`, `hall_pass`, and `account_routes.py` (she deletes her own account) |
| `backend/app/staff/` | Gate, the register, and the hall office: `gate`, `register`, `office` |
| `backend/app/dev_seed.py` | Local sign-in accounts. Not created when the service starts |
| `backend/tests/` | Checks for the whole hall: startup creates it, routes match the contract, the signing key, `/ready`, and the development accounts |
| `mobile/` | Expo resident phone app. Commands and rules are in `mobile/AGENTS.md` |
| `postman/` | Postman checks for the hall API. Folders match the OpenAPI tags |
| `docs/` | Domain folders: design, api, database, architecture, tests, engineering. See `docs/README.md` |
| `reference/` | The original proposal, demo, and prototype. Not the application |
| `AGENTS.md` | Engineering rules for changes in this repo |

Local development runs the API at http://localhost:8000, without Docker. Release phone builds use the hall API at https://bsj-hostel-api.onrender.com (`mobile/eas.json`).

Secret scanning for commits is documented in [`docs/engineering/dev-pre-commit.md`](docs/engineering/dev-pre-commit.md) (free Gitleaks via pre-commit; no API key).

Before production, walk [`docs/security/pre-ship-checklist.md`](docs/security/pre-ship-checklist.md).

Optional Locust load checks (not on every PR CI) are in [`docs/load.md`](docs/load.md).

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

The hosted process is `backend/start.sh` on Render. Render runs the API only. The hall database is Turso (`libsql://` or `turso://`). Set `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` on that service, and do not set `DATABASE_PATH`. The process refuses to start while `DATABASE_PATH` is set, and it does not create a SQLite file. `start.sh` trusts `X-Forwarded-For` (`FORWARDED_ALLOW_IPS`, default `*`) and turns uvicorn's own proxy handling off, so each phone has its own sign-in limit behind Render.

Then open:

- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc
- OpenAPI file, as served: http://localhost:8000/openapi.json
- Health: http://localhost:8000/health
- Ready: http://localhost:8000/ready

Every path in `backend/openapi.yaml` is served. [`docs/api/api.md`](docs/api/api.md) lists them for reading.

In development, `/docs` re-reads `openapi.yaml` on each load. A business route must be in that file before it is registered, or the process will not start.

On a development machine, startup creates the hall in `backend/data/hostel.db` when that file is new. On Render, startup creates the hall in that database when it is new. It does not create people. `GET /health` does not return hall data. `APP_SECRET_KEY` must be set in `backend/.env` or the process refuses to start. `SMS_DRIVER` must stay `mock` unless `ENVIRONMENT` is `production`. Any other value stops the process, so a laptop cannot send a parent SMS. Late and return guardian messages use the mock SMS path on register read and return scan (no phone network).

`APP_SECRET_KEY` must be at least 32 bytes. A shorter value stops the process before it serves.

From `backend/`, add the local sign-in accounts with `.venv/bin/python -m app.dev_seed`. This runs only when `ENVIRONMENT` is `development`. A second run leaves an account that is already there, including a password that was changed. The command prints the password of each account it adds. Room B-204 is created for the sample resident because the published hall page does not list door numbers.

From `backend/`, run the checks with `.venv/bin/pytest`. A push to `dev`, and a pull request, runs the same checks on GitHub. Every recorded check is listed in [`docs/tests/tests.md`](docs/tests/tests.md); each entry names its test file under `backend/app/.../tests/` or `backend/tests/`.

## What is deliberately not here

- Docker and Nginx
- Live parent SMS provider (development stays on the mock driver; late/return notices are recorded only)
- Emergency alerts (the proposal leaves those out of the first version)
- A payment gateway (the hall office marks a guest stay paid or unpaid)

## Open decisions

The values the hall has not fixed yet are under "Still for the hall to decide" in [`docs/database/database.md`](docs/database/database.md). They are hall settings, so they change without reshaping the records.
