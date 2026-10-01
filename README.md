# Begum Sultan Jahan Hall

Hostel movement system for residents, wardens, gate staff, and the provost. The mobile app will be React Native. The API is FastAPI. This checkout is the local foundation: the data model, the HTTP contract, and the implemented hall API under `/api/v1`.

Read these three first.

| Document | What is in it |
|---|---|
| [`docs/README.md`](docs/README.md) | Docs map by domain (design, api, database, architecture, tests, engineering) |
| [`docs/architecture/system-architecture.md`](docs/architecture/system-architecture.md) | The diagram of the system as it stands |
| [`docs/database/database.md`](docs/database/database.md) | What the hall keeps, and the rules for how it changes. Version 0.3.4. Created when the service starts |
| [`docs/api/api.md`](docs/api/api.md) | Every endpoint: who calls it, the payload, and the response. API version 0.2.12 |
| [`docs/design/design-system.md`](docs/design/design-system.md) | Visual design lock for the Expo client |
| [`docs/design/workflows.md`](docs/design/workflows.md) | Product workflows (auth, home, permissions, register, gate, guests) |

Swagger serves the same HTTP contract at http://localhost:8000/docs from `backend/openapi.yaml`. The test catalog is [`docs/tests/tests.md`](docs/tests/tests.md) (thirty-one recorded checks).

## Repository

| Path | What it is |
|---|---|
| `backend/app/main.py` | Starts the process |
| `backend/app/shared/` | Sign-in, the clock, errors, settings, the database connection, and creating the hall. Sign-in tests are in `backend/app/shared/auth/tests/` |
| `backend/app/residents/` | Resident phone: `home`, `outings`, `permissions`, `guests`, `hall_pass` |
| `backend/app/staff/` | Gate, the register, and the hall office: `gate`, `register`, `office` |
| `backend/app/dev_seed.py` | Local sign-in accounts. Not created when the service starts |
| `backend/tests/` | Startup check for the whole hall, and the development-account check |
| `docs/` | Domain folders: design, api, database, architecture, tests, engineering. See `docs/README.md` |
| `reference/` | The original proposal, demo, and prototype. Not the application |
| `AGENTS.md` | Engineering rules for changes in this repo |

Docker is not part of local development. Hosting is written in code when that work starts.

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

Then open:

- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc
- OpenAPI file, as served: http://localhost:8000/openapi.json
- Health: http://localhost:8000/health
- Ready: http://localhost:8000/ready

### Implemented routes

Paths in `backend/openapi.yaml` that the process serves today:

| Area | Paths |
|---|---|
| Auth | `POST /api/v1/auth/login`, `POST /api/v1/auth/refresh`, `POST /api/v1/auth/logout`, `GET /api/v1/auth/me`, `POST /api/v1/auth/change-password` |
| Resident | `GET /api/v1/me/home`, `GET /api/v1/me/history`, `GET /api/v1/me/hall-pass`, `GET /api/v1/destinations`, ordinary outings under `/api/v1/me/outings*`, permissions under `/api/v1/me/permissions*`, guest stays under `/api/v1/me/guest-stays*` |
| Register | `GET /api/v1/register/summary`, `GET /api/v1/register/residents`, `GET /api/v1/register/residents/{resident_id}`, `GET /api/v1/register/late` |
| Permissions (staff) | `GET /api/v1/permissions`, `GET /api/v1/permissions/{permission_id}`, `POST /api/v1/permissions/{permission_id}/decision` |
| Guest stays (staff) | `GET /api/v1/guest-stays`, `GET /api/v1/guest-stays/{guest_stay_id}`, decision and payment under `/api/v1/guest-stays/{guest_stay_id}/*` |
| Gate | `POST /api/v1/gate/scans`, `GET /api/v1/gate/activity`, guest arrival and departure under `/api/v1/gate/guests*` |
| Hall office | Settings, blocks, rooms, destinations, residents, staff, password reset, audit log, SMS log, and register CSV export under `/api/v1/admin/*` |
| Operations | `GET /health`, `GET /ready` |

In development, `/docs` re-reads `openapi.yaml` on each load. A business route must be in that file before it is registered, or the process will not start.

On startup the service creates the hall in `backend/data/hostel.db` when that file is new. It does not create people. `GET /health` does not return hall data. `APP_SECRET_KEY` must be set in `backend/.env` or the process refuses to start. `SMS_DRIVER` must stay `mock` unless `ENVIRONMENT` is `production`. Any other value stops the process, so a laptop cannot send a parent SMS. Late and return guardian messages use the mock SMS path on register read and return scan (no phone network).

`APP_SECRET_KEY` must be at least 32 bytes. A shorter value stops the process before it serves.

From `backend/`, add the local sign-in accounts with `.venv/bin/python -m app.dev_seed`. This runs only when `ENVIRONMENT` is `development`. A second run leaves an account that is already there, including a password that was changed. The command prints the password of each account it adds. Room B-204 is created for the sample resident because the published hall page does not list door numbers.

From `backend/`, run the checks with `.venv/bin/pytest`. A push to `dev`, and a pull request, runs the same checks on GitHub. Every recorded check is listed in [`docs/tests/tests.md`](docs/tests/tests.md); each entry names its test file under `backend/app/.../tests/` or `backend/tests/`.

## What is deliberately not here

- React Native / Expo client
- Docker, Nginx, and the VPS
- Live parent SMS provider (development stays on the mock driver; late/return notices are recorded only)
- Emergency alerts (the proposal leaves those out of the first version)
- A payment gateway (the hall office marks a guest stay paid or unpaid)

## Open decisions

These are in `docs/database/database.md` and in hall settings, because the proposal did not fix them:

- The clock time when ordinary hours end
- How many seconds a second gate scan is ignored so it cannot undo the first
- How early a resident may scan out on an approved permission
- How far ahead an ordinary expected return may be set

Sign-in is hall-issued username and password. A resident's username is the enrolment number. That screen was not in the proposal.
