# Load checks (optional)

Thin Locust scenarios for a running local hall API. **Not** part of the GitHub Checks workflow on every PR.

## Setup

```bash
cd backend
source .venv/bin/activate
pip install -r requirements-load.txt
cp -n .env.example .env   # APP_SECRET_KEY ≥ 32 bytes
uvicorn app.main:app --host 127.0.0.1 --port 8000
```

In another shell, with the same venv, seed the DB then export load-test credentials (use the same accounts you just seeded — do not commit values):

```bash
cd backend
python -m app.dev_seed

export LOAD_TEST_WARDEN_USERNAME=...   # seeded warden username
export LOAD_TEST_WARDEN_PASSWORD=...   # seeded warden phrase
export LOAD_TEST_GATE_USERNAME=...     # seeded gate username
export LOAD_TEST_GATE_PASSWORD=...     # seeded gate phrase
export LOAD_TEST_RESIDENT_QR=...       # seeded resident hall-pass QR payload

locust -f load/locustfile.py --host http://127.0.0.1:8000
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
| Smoke | 10 | 2/s | Confirm the four scenarios return mostly 2xx. |
| Target ~500 | 500 | 50/s | Hold 3–5 minutes; watch p95 and error rate. |
| Stress ~1000 | 1000 | 100/s | Expect saturation; use to find the cliff, not a pass/fail gate. |

Headless example for ~500:

```bash
locust -f load/locustfile.py --host http://127.0.0.1:8000 \
  --users 500 --spawn-rate 50 --run-time 5m --headless
```

SQLite and a single uvicorn worker are the usual bottleneck before the HTTP layer. These numbers are guidance for a laptop run, not production SLOs.
