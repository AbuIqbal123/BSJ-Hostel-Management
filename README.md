# Begum Sultan Jahan Hall

Hostel movement system for residents, wardens, gate staff, and the provost. The mobile app will be React Native. The API is FastAPI. This checkout is the local foundation: the data model, the HTTP contract, sign-in, the resident home screen, the ordinary destination list, and ordinary outings.

Read these three first.

| Document | What is in it |
|---|---|
| [`docs/system-architecture.md`](docs/system-architecture.md) | The diagram of the system as it stands |
| [`docs/database.md`](docs/database.md) | What the hall keeps, and the rules for how it changes. Version 0.3.4. Created when the service starts |
| [`docs/api.md`](docs/api.md) | Every endpoint: who calls it, the payload, and the response. API version 0.2.12 |

Swagger serves the same HTTP contract at http://127.0.0.1:8000/docs from `backend/openapi.yaml`.

## Repository

| Path | What it is |
|---|---|
| `backend/app/main.py` | Starts the process |
| `backend/app/shared/` | Sign-in, the clock, errors, settings, the database connection, and creating the hall. Sign-in tests are in `backend/app/shared/auth/tests/` |
| `backend/app/residents/` | Resident phone: `home`, `outings`, `permissions`, `guests`, `hall_pass` |
| `backend/app/staff/` | Gate, the register, and the hall office: `gate`, `register`, `office` |
| `backend/app/dev_seed.py` | Local sign-in accounts. Not created when the service starts |
| `backend/tests/` | Startup check for the whole hall, and the development-account check |
| `docs/` | The diagram, what the hall keeps, the API, and the test catalog |
| `reference/` | The original proposal, demo, and prototype. Not the application |
| `AGENTS.md` | Engineering rules for changes in this repo |

Docker is not part of local development. Hosting is written in code when that work starts.

Secret scanning for commits is documented in [`docs/dev-pre-commit.md`](docs/dev-pre-commit.md) (free Gitleaks via pre-commit; no API key).

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

Sign-in is implemented: `POST /api/v1/auth/login`, `POST /api/v1/auth/refresh`, `POST /api/v1/auth/logout`, `GET /api/v1/auth/me`, and `POST /api/v1/auth/change-password`. Resident home is implemented: `GET /api/v1/me/home`. The ordinary destination list is implemented: `GET /api/v1/destinations`. Ordinary outings are implemented: `POST /api/v1/me/outings`, `GET /api/v1/me/outings`, `GET /api/v1/me/outings/current`, and `POST /api/v1/me/outings/{outing_id}/cancel`. Every other path in the document is specified and returns 404 until it is built. In development, `/docs` re-reads `openapi.yaml` on each load. Business routes must be added to that file before they are registered, or the process will not start.

On startup the service creates the hall in `backend/data/hostel.db` when that file is new. It does not create people. `GET /health` does not return hall data. `APP_SECRET_KEY` must be set in `backend/.env` or the process refuses to start. `SMS_DRIVER` must stay `mock` unless `ENVIRONMENT` is `production`. Any other value stops the process, so a laptop cannot send a parent SMS.

From `backend/`, add the local sign-in accounts with `.venv/bin/python -m app.dev_seed`. This runs only when `ENVIRONMENT` is `development`. A second run leaves an account that is already there, including a password that was changed. The command prints the password of each account it adds. Room B-204 is created for the sample resident because the published hall page does not list door numbers.

From `backend/`, run the checks with `.venv/bin/pytest`. A push to `dev`, and a pull request, runs the same checks on GitHub. Sign-in is `app/shared/auth/tests/test_session.py`. Startup is `tests/test_hall_created.py`. The local accounts are `tests/test_dev_seed.py`. Resident home is `app/residents/home/tests/test_home.py`. The destination list is `app/residents/outings/tests/test_destinations.py`. Ordinary outings are `app/residents/outings/tests/test_plan.py`, `test_current.py`, and `test_cancel.py`.

## What is deliberately not here

- React Native / Expo client
- Docker, Nginx, and the VPS
- Business routes other than sign-in, resident home, the destination list, and ordinary outings
- Emergency alerts (the proposal leaves those out of the first version)
- A payment gateway (the hall office marks a guest stay paid or unpaid)

## Open decisions

These are in `docs/database.md` and in hall settings, because the proposal did not fix them:

- The clock time when ordinary hours end
- How many seconds a second gate scan is ignored so it cannot undo the first
- How early a resident may scan out on an approved permission
- How far ahead an ordinary expected return may be set

Sign-in is hall-issued username and password. A resident's username is the enrolment number. That screen was not in the proposal.
