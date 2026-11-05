---
name: verify-bsj-hall
description: >-
  Drive Begum Sultan Jahan Hall's real Hall API the way a client would (HTTP on a
  disposable scratch server). Use to prove a change works: launch, doctor, drive a
  mapped feature, keep artifacts, clean up. Prefer this over claiming "pytest passed"
  when the question is end-user HTTP behavior. Phone UI proof stays in e2e/ (iOS simulator).
---

# Verify Begum Sultan Jahan Hall (API)

Primary surface: **Hall API** (`backend/`, FastAPI). Secondary: Expo phone (`mobile/`) — driven by `e2e/` on macOS; do not use this skill to double-drive a shared Metro or the laptop hall on port 8000.

Never drive `http://localhost:8000` or the e2e port `8010`. This skill uses **8020+** and requires `/health` to report `"e2e_scratch": true`.

## Launch

From the repo root:

```bash
.cursor/skills/verify-bsj-hall/scripts/launch.sh
```

Prints the same vars and writes `$BSJ_VERIFY_STATE/env.sh`. After launch:

```bash
. "$(cat .cursor/skills/verify-bsj-hall/.last-state)/env.sh"
```

Prefer `backend/.venv` when present; otherwise builds a scratch venv with `python3.14+`.

Ready means `GET /health` returns `{"status":"ok","e2e_scratch":true}` and `GET /ready` returns `{"status":"ready"}`. Schema + `app.dev_seed` accounts are applied before uvicorn accepts traffic. Seed passwords are in `$BSJ_VERIFY_STATE/seed-accounts.txt` (mode 600); use `scripts/password.sh <username>` — never paste passwords into chat.

Override port with `BSJ_VERIFY_API_PORT` (must not be 8000 or 8010).

## Doctor

```bash
.cursor/skills/verify-bsj-hall/scripts/doctor.sh
```

Confirms: pid alive, scratch health, ready, seed file present. Run first whenever anything looks off.

## Drive

HTTP only. Helpers:

```bash
# status code on stdout; body in OUT_FILE
export BSJ_HTTP_TOKEN="<access_token>"   # optional
.cursor/skills/verify-bsj-hall/scripts/http.sh METHOD /api/v1/... OUT_FILE ['{"json":true}']

.cursor/skills/verify-bsj-hall/scripts/password.sh 24-GLLB-118
```

Prefer OpenAPI paths and JSON field names from `backend/openapi.yaml` / `docs/api/api.md`. Stable handles: route paths and response `error.code` values — not UI coordinates.

Read `features/README.md`, then the feature file for the journey. One proof = one feature file’s recipe.

One-shot smoke of the sign-in map:

```bash
.cursor/skills/verify-bsj-hall/scripts/prove-sign-in.sh
```

## Evidence

Store under `.cursor/skills/verify-bsj-hall/artifacts/<run_id>/<feature>/` (gitignored). Keep:

- Request outcome: `*.status` and response JSON
- Proof of side effect: a second read (GET) or a refused write that shows the contract
- `proof.txt` one-line summary for humans/agents

Proof standards: real login and real routes; capture action + resulting state; mocks only where the hall already isolates (SMS mock). Do not treat pytest alone as proof of the user path this skill maps.

## Cleanup

```bash
.cursor/skills/verify-bsj-hall/scripts/cleanup.sh
```

Kills only the pid recorded at launch. Removes scratch DB/seeds; **keeps artifacts**. Does not touch `backend/data` or `backend/.env`.

## Isolation

Two verify runs need different `BSJ_VERIFY_RUN_ID` / ports. Do not attach to a hall the user already has open. Refusing a non-scratch server beats corrupting their session.

## Feature map

See [features/README.md](features/README.md).
