# Begum Sultan Jahan Hall

Movement for one hall: who is inside, who is out, who is late, and who is still waiting on a decision.

Residents, gate staff, wardens, and the provost use the Expo app in `mobile/`. The hall API is FastAPI in `backend/`, under `/api/v1`. A laptop serves it at `http://localhost:8000`. Release phone builds call `https://bsj-hostel-api.onrender.com`.

Work lands on `dev`. `main` is production and accepts pull requests only.

## How it fits together

```mermaid
%%{init: {'theme': 'base', 'themeVariables': {'fontFamily': 'ui-sans-serif, sans-serif', 'lineColor': '#1F4D3A', 'textColor': '#14261F'}}}%%
flowchart TB
  resident["Resident"]
  gate["Gate"]
  warden["Warden"]
  provost["Provost"]
  phone["Phone app"]
  browser["Browser"]
  api["Hall API"]
  records[("Hall records")]
  files["Payment evidence"]
  sms["Guardian notices"]
  push["Expo push"]

  resident --> phone
  gate --> phone
  warden --> phone
  provost --> phone
  provost --> browser
  phone -->|"sign-in, home, outings, permissions, guests, hall pass, history, inbox, scan, register"| api
  browser -->|"Swagger, register, gate, hall office"| api
  api -->|"Turso when hosted, SQLite file on a laptop"| records
  api -->|"optional receipt, JPEG PNG or PDF"| files
  api -->|"mock driver, no phone network"| sms
  api -->|"after the record is saved"| push
  push -->|"production driver only"| phone

  classDef person fill:#1F4D3A,stroke:#16382B,color:#FFFFFF
  classDef client fill:#FFFFFF,stroke:#1F4D3A,color:#14261F
  classDef core fill:#E5F0EA,stroke:#1F4D3A,color:#14261F
  classDef store fill:#F0E6C9,stroke:#A68438,color:#14261F
  class resident,gate,warden,provost person
  class phone,browser client
  class api core
  class records,files,sms,push store
```

The same data model is applied at startup. Hosted hall records live in Turso. A laptop and the checks use `backend/data/hostel.db`. The arrow-by-arrow account is [`docs/architecture/system-architecture.md`](docs/architecture/system-architecture.md).

## Who opens what

```mermaid
%%{init: {'theme': 'base', 'themeVariables': {'fontFamily': 'ui-sans-serif, sans-serif', 'lineColor': '#1F4D3A'}}}%%
flowchart LR
  resident["Resident"] --> own["Own home, outing, permission, guest stay, hall pass, history, inbox"]
  gate["Gate"] --> night["Scan, guest arrival and departure, recent activity"]
  warden["Warden"] --> desk["Register, late list, requests"]
  provost["Provost"] --> office["The warden's desk, plus people, rooms, settings, audit, export"]

  classDef person fill:#1F4D3A,stroke:#16382B,color:#FFFFFF
  classDef work fill:#FFFFFF,stroke:#1F4D3A,color:#14261F
  class resident,gate,warden,provost person
  class own,night,desk,office work
```

| | Resident | Gate | Warden | Provost |
|---|---|---|---|---|
| Own outing, permission, guest stay, hall pass | Yes | | | |
| Scan a hall pass, record a guest in or out | | Yes | Yes | Yes |
| Register, late list, decide requests, mark a guest paid | | | Yes | Yes |
| People, rooms, settings, audit, SMS log, register export | | | | Yes |

A resident can delete her own account. Parents have no login. Guests have no pass of their own.

## One outing

```mermaid
%%{init: {'theme': 'base', 'themeVariables': {'fontFamily': 'ui-sans-serif, sans-serif', 'lineColor': '#1F4D3A'}}}%%
flowchart LR
  plan["Ordinary plan, or an approved late-night or home-going permission"]
  qr["Hall pass QR opens in the lead window"]
  exit["Gate scans the exit"]
  back["Gate scans the return"]
  late["Past grace: late on the register, guardian notice, push"]

  plan --> qr --> exit --> back
  exit --> late --> back

  classDef step fill:#FFFFFF,stroke:#1F4D3A,color:#14261F
  classDef warn fill:#F6EBE3,stroke:#8C4A24,color:#14261F
  class plan,qr,exit,back step
  class late warn
```

The hall pass and the gate use one rule for which outing she can use now. An ordinary exit is refused until 30 minutes before it starts. A permission uses its own lead. An approved permission that overlaps another is refused. Back-to-back is allowed.

## A guest stay

```mermaid
%%{init: {'theme': 'base', 'themeVariables': {'fontFamily': 'ui-sans-serif, sans-serif', 'lineColor': '#1F4D3A'}}}%%
flowchart LR
  ask["Resident asks"]
  decide["Warden or provost decides"]
  paid["Mark paid, receipt optional"]
  arrive["Gate records arrival"]
  leave["Gate records departure"]

  ask --> decide --> arrive --> leave
  decide --> paid

  classDef step fill:#FFFFFF,stroke:#1F4D3A,color:#14261F
  class ask,decide,paid,arrive,leave step
```

Payment is a mark on the stay, not a card charge. Evidence is a file the hall stores. The client never sees the file path.

## Run it

From `backend/`, with Python 3.11 or newer:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload
```

Set `APP_SECRET_KEY` to at least 32 bytes. Keep `SMS_DRIVER=mock` unless `ENVIRONMENT` is `production`.

| | |
|---|---|
| Swagger | http://localhost:8000/docs |
| Health | http://localhost:8000/health |
| Ready | http://localhost:8000/ready |

Seed local accounts from `backend/` with `.venv/bin/python -m app.dev_seed`. It runs only in development and refuses Render. Passwords come from `BSJ_SEED_PASSWORD` or a per-role `BSJ_SEED_PASSWORD_*` value, in the shell or in `backend/.env`. A missing one is generated and printed once. A password from settings is not printed. An account that already exists is left as it is. `--reset-passwords` sets the seed accounts again. Room B-204 is created for the sample resident. Passwords that once appeared in this repository are burned. Do not reuse them.

Checks and lint, from `backend/`: `.venv/bin/pytest` and `.venv/bin/ruff check .`. A push to `dev`, and a pull request, runs both on GitHub, plus the phone typecheck and tests.

Phone, from `mobile/`: `npx expo start`. Set `EXPO_PUBLIC_API_URL` when the phone should not use the default host.

## Read next

| Document | What it is |
|---|---|
| [`docs/architecture/system-architecture.md`](docs/architecture/system-architecture.md) | The system as it stands |
| [`docs/database/database.md`](docs/database/database.md) | What the hall keeps, and the rules |
| [`docs/api/api.md`](docs/api/api.md) | Every endpoint, for reading |
| [`docs/design/workflows.md`](docs/design/workflows.md) | Screens and steps |
| [`docs/design/design-system.md`](docs/design/design-system.md) | Forest, paper, gold, and type |
| [`docs/tests/tests.md`](docs/tests/tests.md) | Every recorded test |
| [`docs/security/pre-ship-checklist.md`](docs/security/pre-ship-checklist.md) | Before production |
| [`mobile/AGENTS.md`](mobile/AGENTS.md) | Phone commands |
| [`AGENTS.md`](AGENTS.md) | How a change is made |

Swagger serves `backend/openapi.yaml`. A route must be in that file before it is registered.

## Left out of this version

Emergency alerts. A live SMS provider. A payment gateway. Parent accounts. Docker.
