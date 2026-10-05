# Agent notes

Begum Sultan Jahan Hall hostel management. Residents, wardens, gate staff, and the provost. The hall API is the local FastAPI service in `backend/`. The resident phone app is Expo, in `mobile/`, with its own notes in `mobile/AGENTS.md`. Docker is later.

Before changing API behavior, the database, or the shape of the system, follow `.grok/skills/contract-maintenance/SKILL.md` and the rules below.

| Concern | File |
|---|---|
| Docs map by domain | `docs/README.md` |
| Product behavior already shown | `reference/proposal/`, `reference/demo/`, `reference/prototype/` |
| Visual design and Expo UI rules | `docs/design/design-system.md` |
| Product workflows (screens and steps) | `docs/design/workflows.md` |
| System as it stands | `docs/architecture/system-architecture.md` |
| What the hall keeps (and product rules for data) | `docs/database/database.md` |
| HTTP contract, for reading | `docs/api/api.md` |
| HTTP contract served at `/docs` | `backend/openapi.yaml` |
| Test specifications | `docs/tests/tests.md` |
| Local engineering notes | `docs/engineering/` |
| Pre-ship security checklist | `docs/security/pre-ship-checklist.md` |

## Engineering rules

These rules apply to every change in this repository.

### Spec-driven development

Behavior is specified before it is implemented.

- HTTP behavior lives in `backend/openapi.yaml`. The reading copy is `docs/api/api.md`, regenerated from that file.
- Stored data lives in `docs/database/database.md`.
- The shape of the system lives in `docs/architecture/system-architecture.md`.
- A test's specification lives in `docs/tests/tests.md`.
- Technical detail lives in the code. There is no separate technical specification.

Do not implement a behavior those documents do not already describe. Update the owning document in the same change as the code. While this work is on dev, leave the API version and the database document version as they are. Do not add a database revision row for a dev change. Those version numbers start when the work moves to production.

### OpenAPI tags and Postman folders

OpenAPI tags are grouped by URL prefix. Postman collection folders use the same names so Swagger and Postman stay aligned.

| Tag / folder | URL prefix |
|---|---|
| Auth | `/api/v1/auth` |
| Register | `/api/v1/register` |
| Gate | `/api/v1/gate` |
| Permissions | `/api/v1/permissions` and `/api/v1/me/permissions*` |
| Guest Stays | `/api/v1/guest-stays` and `/api/v1/me/guest-stays*` |

Other tags (Operations, Resident, Hall office) follow the same idea: one tag owns a clear path family. When you add a route, put it under the tag for its prefix. When you add or move a Postman request, put it in the matching folder. Do not put permission or guest-stay routes under Register.

### Response field names

Response JSON uses explicit domain names so clients do not guess presentation. Prefer `guest_name`, `host_name`, `host_room_label`, `resident_name`, `room_label`, and the same style elsewhere. Do not use generic presentation fields such as `title` or `subtitle` on response schemas. Gate activity uses `resident_name` and `room_label` on resident lines, and `guest_name`, `host_name`, and `host_room_label` on guest lines.

### Documents that stay current

Finish the change and the document together.

| What changed | What to update |
|---|---|
| Stored data: a table, column, constraint, or the way a row moves | `docs/database/database.md` |
| HTTP: a route, payload, response, status, error, or who may call it | `backend/openapi.yaml`, then regenerate `docs/api/api.md` |
| The shape of the system: a part is added, removed, or connected | `docs/architecture/system-architecture.md` |

A new endpoint or column updates the database document and the API document. Update the diagram when that work adds, removes, or connects a part, such as the phone app, a database the API opens, or a message that is sent. The line convention is at the top of `docs/architecture/system-architecture.md`. Schema and HTTP edits follow `.grok/skills/contract-maintenance/SKILL.md`.

### Test-driven development

Red, green, refactor stays. Write a failing check for one behavior, run it, see it fail because that behavior is missing, then write the code that makes it pass.

One slice is one behavior a person can name, such as a wrong password being refused, or sign-out revoking the refresh token. Do not write every test for a feature before any of the code. Do not start a slice with a migration. A migration is only for a change to stored records, and the check that needs those records comes first.

Prefer an end-to-end check that calls the API and then reads what was stored. Keep the check narrow enough that a failure names the behavior. When the check is about what the hall keeps, save a repeatable artifact and compare against it.

Do not add a test after the code that only restates the code. A regression check is written first, so it fails on the bug, then the fix makes it pass.

### Where code and tests live

Group the service by business area.

| Area | Code | Tests |
|---|---|---|
| Sign-in | `backend/app/shared/auth/` | `backend/app/shared/auth/tests/` |
| Resident phone | `backend/app/residents/` with `home`, `notifications`, `outings`, `permissions`, `guests`, `hall_pass` | Beside that area, in its `tests/` folder |
| Gate, register, and hall office | `backend/app/staff/` with `gate`, `register`, `office` | Beside that area, in its `tests/` folder |
| Startup of the whole hall | `backend/app/shared/migrate.py` and `backend/app/shared/migrations/` | `backend/tests/` |

`backend/app/main.py` only starts the process. Sign-in, the clock, errors, settings, and the database connection stay in `backend/app/shared/`, because every area uses them. A new route goes in the area that owns the behavior.

### How tests are written

- Prefer an end-to-end check. Use an isolated check only for a failure the end-to-end path cannot show. Write those failures in `docs/tests/tests.md` before that isolated check.
- An end-to-end check that records what the hall keeps leaves an artifact. A later run compares against that file.

### Test documentation

Every test has an entry in `docs/tests/tests.md`, updated in the same change as the test. The entry names the test file, the purpose, the actor, and the artifact. Use the format at the top of that file. The entry does not copy every payload when the test file already states them.
