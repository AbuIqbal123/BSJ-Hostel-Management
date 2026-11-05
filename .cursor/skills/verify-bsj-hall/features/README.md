# Hall API verification map

Maintained source for verifying user-facing Hall API behavior on a disposable scratch server. Read this index, then the matching feature file.

## Baseline preconditions

- Launch via `.cursor/skills/verify-bsj-hall/scripts/launch.sh` (port 8020 by default).
- `doctor.sh` reports scratch health and ready.
- Seeded accounts include at least `24-GLLB-118` (resident), `gate.fatima`, `warden.sara`, `provost.halima` (or `provost`).
- Passwords from `password.sh` / `seed-accounts.txt` only.
- Never drive port 8000 or 8010.

## Driving conventions

- Start from a fresh launch unless the feature says otherwise.
- Use `http.sh` with literal paths from OpenAPI.
- Capture status + JSON for the action and a confirming read.
- After mutations that should stick, GET the resource again.
- Restore or cancel created outings when the feature says to; keep artifacts.

## Proof and skip reporting

- HTTP proof: status file + response body + optional second GET.
- Mutation proof includes a read of stored state through an API the role may call.
- Record feature ID and username role used.
- Unreachable path → report failure and precondition; do not claim a different path verified it.

## Features

- [Sign in](./sign-in.md) — login success and wrong-password refusal.
- [Plan an ordinary outing](./plan-ordinary-outing.md) — resident plans, lists, cancels.
- [Gate scan](./gate-scan.md) — gate scans a live hall-pass payload when the window allows.
- [Office resident identity](./office-resident-identity.md) — provost cannot PATCH name / enrolment / course.
