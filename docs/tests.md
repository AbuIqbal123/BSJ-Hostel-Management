# Test catalog

Document version: **0.1.0**

Status: format only. No tests are recorded yet.

This file specifies every test the way `docs/api.md` specifies every HTTP operation. Add the entry before the test code. Update the entry in the same change as the test, and bump the document version when the format or a recorded test changes.

The rules that require this file are in `AGENTS.md` under Engineering rules.

## Entry format

Copy this block for each test and fill every field.

### `<id>` `<short name>`

| Field | Content |
|---|---|
| Purpose | Why this test exists. Same role as an operation summary in Swagger. |
| Actor | Who performs the action: resident, gate, warden, provost, or a system job. |
| Preconditions | Records, clock, and settings that must already exist. |
| Action | The call or user step, including method, path, and payload. |
| Expected response | Status, the response fields that must match, and the stored state after the action. |
| Failure cases | Required before any isolated test. Each way this behavior can fail, and the expected error. For an E2E test, write "E2E; failure cases are covered by the expected response." |
| Artifact | Path of the verifiable, repeatable output written when the test passes. A later run must be able to check this file again. |

## Catalog

No tests yet.
