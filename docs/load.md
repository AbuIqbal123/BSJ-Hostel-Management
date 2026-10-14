# Load checks (optional)

Thin Locust scenarios for a running local hall API. **Not** part of the GitHub Checks workflow on every PR.

## Setup

Use a disposable database file. Login writes sessions, and a gate scan writes a movement. Do not point this run at `backend/data/hostel.db`, and do not point it at the hosted Turso database. A load run stays on the local file. `ENVIRONMENT` stays `development`.

```bash
cd backend
source .venv/bin/activate
pip install -r requirements-load.txt
cp -n .env.example .env   # APP_SECRET_KEY ≥ 32 bytes
export DATABASE_PATH="$(pwd)/data/load-test.db"
rm -f "$DATABASE_PATH" "${DATABASE_PATH}-wal" "${DATABASE_PATH}-shm"
python -m app.dev_seed
uvicorn app.main:app --host localhost --port 8000
```

The seed command reads `BSJ_SEED_PASSWORD_*` when set, otherwise generates and prints each new account's phrase. Copy those into the next shell. Do not commit them. `DATABASE_PATH` above is only for the seed and the server. Locust talks to the host below and does not open the file.

```bash
cd backend
export LOAD_TEST_WARDEN_USERNAME=...   # seeded warden username
export LOAD_TEST_WARDEN_PASSWORD=...   # seeded warden phrase
export LOAD_TEST_GATE_USERNAME=...     # seeded gate username
export LOAD_TEST_GATE_PASSWORD=...     # seeded gate phrase
export LOAD_TEST_RESIDENT_QR=...       # seeded resident hall-pass QR payload

locust -f load/locustfile.py --host http://localhost:8000
```

Open http://127.0.0.1:8089.

`load/locustfile.py` reads only those environment variables. It does not embed username/password string pairs.

## Scenarios

| Name | Call |
|---|---|
| login | `POST /api/v1/auth/login` |
| register_summary / register_residents | register presence board |
| permissions_queue | `GET /api/v1/permissions` |
| gate_scan | `POST /api/v1/gate/scans` with `LOAD_TEST_RESIDENT_QR` |

## Suggested shape

| Mode | Users | Spawn rate | Notes |
|---|---|---|---|
| Smoke | 10 | 2/s | Login, the register, and the permission queue should return mostly 2xx. `gate_scan` shares one hall pass, so after the first movement further scans of that pass are refusals. |
| Target ~500 | 500 | 50/s | Hold 3–5 minutes; watch p95 and error rate. |
| Stress ~1000 | 1000 | 100/s | Expect saturation; use to find the cliff, not a pass/fail gate. |

Headless example for ~500:

```bash
locust -f load/locustfile.py --host http://localhost:8000 \
  --users 500 --spawn-rate 50 --run-time 5m --headless
```

SQLite and a single uvicorn worker are the usual bottleneck before the HTTP layer. These numbers are guidance for a laptop run, not production SLOs.
