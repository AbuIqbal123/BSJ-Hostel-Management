# Agent notes

Begum Sultan Jahan Hall hostel management. Residents, wardens, gate staff, and the provost. React Native and Docker are later. The current work is the local FastAPI contract.

Before changing API behavior, the database, or the shape of the system, follow `.grok/skills/contract-maintenance/SKILL.md` and the rules below.

| Concern | File |
|---|---|
| Product behavior already shown | `reference/proposal/`, `reference/demo/`, `reference/prototype/` |
| System as it stands | `docs/system-architecture.md` |
| Later hosting plan | `docs/architecture.md` |
| Tables, states, SMS, audit | `docs/database.md` |
| HTTP contract, for reading | `docs/api.md` |
| HTTP contract served at `/docs` | `backend/openapi.yaml` |
| Test specifications | `docs/tests.md` |

## Engineering rules

These rules apply to every change in this repository.

### Spec-driven development

Behavior is specified before it is implemented.

- HTTP behavior lives in `backend/openapi.yaml`. The reading copy is `docs/api.md`, regenerated from that file.
- Stored data lives in `docs/database.md`.
- The shape of the system lives in `docs/system-architecture.md`.
- A test's specification lives in `docs/tests.md`.

Do not implement a behavior those documents do not already describe. Update the owning document in the same change as the code, and bump that document's version when its contract changes.

### Documents that stay current

Finish the change and the document together.

| What changed | What to update |
|---|---|
| Stored data: a table, column, constraint, or the way a row moves | `docs/database.md` |
| HTTP: a route, payload, response, status, error, or who may call it | `backend/openapi.yaml`, then regenerate `docs/api.md` |
| The shape of the system: a part is added, removed, or connected | `docs/system-architecture.md` |

A new endpoint or column updates the database document and the API document. Update the diagram when that work adds, removes, or connects a part, such as the phone app, a database the API opens, or a message that is sent. The line convention is at the top of `docs/system-architecture.md`. Schema and HTTP edits follow `.grok/skills/contract-maintenance/SKILL.md`.

### Test-driven development

Write the failing test and its `docs/tests.md` entry before the implementation. The test describes the specified behavior. Then write the code that makes that test pass.

### How tests are written

- Never write unit tests after you write code.
- Highly prefer E2E tests as the sole testing mechanism. Use them to verify complex features work. At the end of E2E tests, produce a verifiable and repeatable artifact.
- If you must test a system in isolation, first write down all the ways it could fail, then write the code.

### Test documentation

Every test is documented in `docs/tests.md` with the same kind of detail as an API operation in Swagger: purpose, the action and payload, the expected response, and the artifact. Use the entry format at the top of that file. Update that entry in the same change as the test.
