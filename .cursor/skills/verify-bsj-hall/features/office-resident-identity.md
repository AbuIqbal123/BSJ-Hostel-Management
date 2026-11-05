# Office resident identity

Name, enrolment number, and course are set at create or onboard. The provost may change contact, room, and status on `PATCH /api/v1/admin/residents/{id}`, but identity fields are refused.

## Sub-features

- `identity-refused` — PATCH with `full_name`, `enrolment_number`, or `course` returns `422`.
- `contact-allowed` — PATCH `phone` (or guardian fields) returns `200` and GET echoes the change.

## How to get to it (user POV)

- Provost Office → Residents → open a resident → Save.
- API: `PATCH /api/v1/admin/residents/{residentId}`.

## Driving it with verify-bsj-hall HTTP

Preconditions:

- Launch + doctor.
- Provost token (`provost.halima` or `provost` from seed).
- Known resident id for `24-GLLB-118` (from `GET /api/v1/admin/residents?q=24-GLLB-118` or list).

- **Refuse name.** `PATCH` with `{"full_name":"Someone Else"}` → `422` `validation_error`.
- **Refuse enrolment.** `PATCH` with `{"enrolment_number":"99-XX-001"}` → `422`.
- **Refuse course.** `PATCH` with `{"course":null}` or a new course string → `422`.
- **Confirm unchanged.** `GET /api/v1/admin/residents/{id}` → name, enrolment, course still the seeded values.
- **Allowed contact.** `PATCH` with a new E.164 `phone`, then GET → phone matches; restore by clearing to `null` if desired.
- **Proof.** Status files + GET bodies under `artifacts/<run>/office-resident-identity/`.

## Gotchas

- Extra fields are refused by schema (`extra=forbid`); do not expect a domain message that names “identity locked”.
- Create (`POST /api/v1/admin/residents`) still accepts name/enrolment/course — that path is out of this feature’s refuse checks.
- Warden/resident tokens must get `403` on admin residents — optional extra assertion.
