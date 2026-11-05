# Plan an ordinary outing

A resident plans an ordinary outing with destination and times inside ordinary hours. Planning does not change presence. She can cancel a planned outing.

## Sub-features

- `destinations-list` loads active destinations.
- `outing-plan` creates a planned ordinary outing (`201`).
- `outing-list` shows it on `GET /api/v1/me/outings`.
- `outing-cancel` cancels it.

## How to get to it (user POV)

- Resident Home → Plan → place, leave, return → Confirm.
- API: `POST /api/v1/me/outings` after sign-in.

## Driving it with verify-bsj-hall HTTP

Preconditions:

- Launch + doctor; resident token for `24-GLLB-118`.
- Pick times in the **future**, same hall day (Asia/Kolkata), inside ordinary hours (after 6:00 AM through 6:30 PM IST). Prefer mid-morning IST on the next hall day if “now” is awkward.

- **List destinations.** `GET /api/v1/destinations` with bearer token → `200`; pick a non-Other `id`.
- **Plan.** `POST /api/v1/me/outings` with `destination_id`, `starts_at`, `expected_return_at` → `201`; `status` is `planned`.
- **Confirm list.** `GET /api/v1/me/outings` → body includes that `id`.
- **Cancel.** `POST /api/v1/me/outings/{id}/cancel` → success; list no longer shows it as planned (or status `cancelled`).
- **Proof.** Save plan + list + cancel JSON and statuses under `artifacts/<run>/plan-ordinary-outing/`.

## Gotchas

- Times outside ordinary hours need permission flows — out of scope here.
- Two outings cannot share the same `expected_return_at`.
- A plan inside the QR show window still leaves presence `inside` until a gate scan.
- If destinations are empty, stop and report migration/seed failure — do not invent a UUID.
