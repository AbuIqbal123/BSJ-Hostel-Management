# Test catalog

Document version: **0.4.15**

Status: eight recorded tests. Startup creates the hall. Sign-in keeps a session. A development command adds local accounts. Resident home reads the resident's own screen. The destination list shows the active ordinary-outing choices, with Other last. A resident can plan an ordinary outing before the gate scan. She can read the outing that is still planned or outside. She can cancel that plan before the gate scan.

Each test has an entry here and a file next to the business area it covers. Write the failing check for one behavior, see it fail, then make it pass. Update the entry in that same change. The entry names the test file. It does not copy every payload when the test already states them. A migration is not part of this loop unless the stored records change. Bump this document when the format or a recorded test changes.

The rules that require this file are in `AGENTS.md` under Engineering rules.

## Entry format

Copy this block for each test and fill every field.

### `<id>` `<short name>`

| Field | Content |
|---|---|
| Test | Path of the test file. |
| Purpose | Why this test exists. Same role as an operation summary in Swagger. |
| Actor | Who performs the action: resident, gate, warden, provost, or a system job. |
| Preconditions | Records, clock, and settings that must already exist. |
| Action | The call or user step, including method, path, and payload. |
| Expected response | Status, the response fields that must match, and the stored state after the action. |
| Failure cases | Required before any isolated test. Each way this behavior can fail, and the expected error. For an E2E test, write "E2E; failure cases are covered by the expected response." |
| Artifact | Path of the verifiable, repeatable output written when the test passes. A later run must be able to check this file again. |

## Catalog

### `hall-created` Hall records exist after startup

| Field | Content |
|---|---|
| Test | `backend/tests/test_hall_created.py` |
| Purpose | Starting the service creates the hall in `docs/database.md`. `GET /health` still only reports that the process is up. |
| Actor | System job. Service startup. |
| Preconditions | The database file is absent. No people, rooms, permissions, outings, guest stays, guardian messages, or audit entries exist. |
| Action | Start the service on that empty file. `GET /health` with no payload. Start the service a second time on the same file. `GET /health` again. |
| Expected response | Both calls return 200 and `{"status":"ok"}`. The body contains no hall data. The file then matches the artifact: schema version 3, one settings record (summer 6:30 AM–6:30 PM from 1 April, winter 6:30 AM–5:30 PM from 1 October, grace 30 minutes), five blocks with the published room counts and no door numbers, and the destinations in alphabetical order with Other as the only free-text choice. The other tables exist and are empty. The second start does not add another copy. |
| Failure cases | E2E; failure cases are covered by the expected response. |
| Artifact | `backend/tests/artifacts/hall-inventory.json` |

### `auth-session` Sign in, refresh, sign out, and change password

| Field | Content |
|---|---|
| Test | `backend/app/shared/auth/tests/test_session.py` |
| Purpose | A hall-issued account can sign in, stay signed in, sign out, and change its own password. The password and the session secret are never stored. |
| Actor | Gate staff, then a resident. A suspended gate account is refused. |
| Preconditions | The hall from `hall-created` exists. The clock is frozen and moved only where a step below names a time. Three accounts exist, created at 2026-09-30T00:00:00Z. Fatima Khan is active gate staff, username `gate.fatima`, job title Gatekeeper. Aisha Khan is an active resident, username `24-GLLB-118`, room B-204, course B.A. LL.B. (Hons.), guardian Rashid Khan at +919876543210, presence inside. Noor Ali is suspended gate staff, username `gate.suspended`. No sessions or audit entries exist yet. |
| Action | At 00:01, `POST /api/v1/auth/login` with a wrong password, an unknown username, the suspended account's password, and a body that omits the password. Then sign in as `GATE.FATIMA`. `GET /api/v1/auth/me` with that access token, with no token, and with a token that is not a session. At 00:02, `POST /api/v1/auth/refresh` with the refresh token, then again with the token just replaced. At 00:03, sign in a second time. At 00:04, `POST /api/v1/auth/logout`. Repeat both refresh tokens. At 00:05, sign in again. `POST /api/v1/auth/change-password` with the wrong current password, with a new password shorter than 10 characters, and then with the current password and a new password of at least 10 characters. Sign in with the old password. At 00:07, sign in with the new password. At 00:08, sign in as `24-gllb-118` and `GET /api/v1/auth/me`. At 00:09, sign in as the gate account again. Move the clock to 00:25 and call `GET /api/v1/auth/me` with the 00:07 access token. Move the clock to 2026-10-30T00:09:01Z and refresh the 00:09 token. |
| Expected response | Wrong, unknown, and suspended sign-in return 401 `unauthenticated`. An unknown username says that username does not exist. A known username with the wrong password says the username exists and the password is wrong. The suspended attempt says the account is suspended and to contact the Hall Office. A missing password returns 422 `validation_error` on `password`. A successful sign-in returns 200 with `token_type` `bearer`, `expires_in` 900, an access token, a refresh token, and the user summary. The username in the response is the stored spelling. `GET /api/v1/auth/me` returns the gate job title or the resident room, and the other profile is null. A missing, unknown, expired, rotated, or signed-out token returns 401 `unauthenticated` and says to sign in again. Refresh returns a new pair and the presented refresh token then fails. Logout returns 204 and both live refresh tokens then fail. The access token from before logout still opens `GET /api/v1/auth/me` until its 15 minutes pass. A wrong current password returns 401. A short new password returns 422 on `new_password` and says to use at least 10 characters. A successful change returns 204, the old password then fails, and the refresh token from before the change fails. The stored state matches the artifact: sessions and audit entries at the times above, no password and no session secret in the file, and the new password kept as Argon2id. |
| Failure cases | E2E; failure cases are covered by the expected response. |
| Artifact | `backend/app/shared/auth/tests/artifacts/auth-session.json` |

### `dev-accounts` Local sign-in accounts

| Field | Content |
|---|---|
| Test | `backend/tests/test_dev_seed.py` |
| Purpose | A development command adds the local sign-in accounts. Starting the service does not add them, and the command does not replace an account that is already there. |
| Actor | System job. The development seed command. |
| Preconditions | The database file may be absent. `ENVIRONMENT` is `development` for the accounts, then anything else for the refusal. The clock is frozen at 2026-09-30T00:00:00Z while the accounts are added. The published hall page does not list door numbers, so room B-204 exists only after this command. |
| Action | Run the seed. `POST /api/v1/auth/login` as `gate.fatima` with the wrong password, as `nobody`, as `gate.suspended` with that account's password, then as `GATE.FATIMA`, `24-gllb-118`, `warden.sara`, and `provost.halima` with the passwords the seed keeps. Run the seed again. Run the seed with `ENVIRONMENT` set to `production`. |
| Expected response | The first run matches the artifact: room B-204, Fatima Khan (`gate.fatima`, Gatekeeper), Aisha Khan (`24-GLLB-118`, B.A. LL.B. (Hons.), guardian Rashid Khan at +919876543210, inside), Noor Ali (`gate.suspended`, suspended), Sara Malik (`warden.sara`, Warden), and Halima Begum (`provost.halima`, Provost). No password, hall-pass code, or session secret is in the artifact. The wrong password returns 401 and says the username exists and the password is wrong. The unknown username returns 401 and says that username does not exist. The suspended account returns 401 and says the account is suspended and to contact the Hall Office. Each active account returns 200 with that account's stored username and role. The second run leaves the password, the last sign-in, the sessions, and the audit log as they were. Outside development the command raises and does not create the database. |
| Failure cases | E2E; failure cases are covered by the expected response. |
| Artifact | `backend/tests/artifacts/dev-accounts.json` |

### `resident-home` What the resident sees on opening the phone

| Field | Content |
|---|---|
| Test | `backend/app/residents/home/tests/test_home.py` |
| Purpose | A resident opening the phone sees her room, whether she is inside, the outing that is still planned or outside, the newest permission she is waiting on or cleared to use, and her last ten exits and returns. |
| Actor | A resident. A gate account is refused. |
| Preconditions | The hall from `hall-created` exists. The clock is frozen at 2026-09-30T13:00:00Z. Aisha Khan is an active resident, username `24-GLLB-118`, room B-204, course B.A. LL.B. (Hons.), presence inside. Fatima Khan is active gate staff. No outing, permission, or history exists yet. |
| Action | `GET /api/v1/me/home` with no access token, then as Fatima Khan, then as Aisha Khan. Store an outside ordinary outing for Aisha whose grace ended at 12:30, five returned outings, a cancelled plan, a pending late-night permission, an older approved permission, a newer rejected permission, a newer completed permission, and another resident's open outing and pending permission. `GET /api/v1/me/home` again as Aisha. Set the open outing's grace end to 13:00:00Z and call again, then to 12:59:59Z and call again. |
| Expected response | No token returns 401 `unauthenticated` and says to sign in again. The gate account returns 403 `forbidden` and says this account cannot do that. Aisha's first call matches the `empty` object in the artifact: room B-204, Block-B, inside, no outing, no permission, and no history. The second call matches `outside`: she is outside, the open outing is the library and is late, the active permission is the pending late-night request, and the history is the ten newest of her own exits and returns. The other resident's records are absent. The cancelled plan is absent. At the grace instant she is not late. One second after grace she is late. The call does not add an audit entry and does not change the outing. |
| Failure cases | E2E; failure cases are covered by the expected response. |
| Artifact | `backend/app/residents/home/tests/artifacts/resident-home.json` |

### `destinations` Active ordinary outing choices

| Field | Content |
|---|---|
| Test | `backend/app/residents/outings/tests/test_destinations.py` |
| Purpose | Anyone signed in can read the destinations a resident may choose before an ordinary outing. Named places are alphabetical, ignoring capitals, and the free-text choice Other is always last. A retired destination stays on file and is left off the list. |
| Actor | A resident, and a gate account. |
| Preconditions | The hall from `hall-created` exists, including its five destinations. The clock is frozen at 2026-09-30T13:00:00Z. Aisha Khan is an active resident, username `24-GLLB-118`. Fatima Khan is active gate staff. An active destination named `city clinic` and a retired destination named Aligarh Fort are also on file. |
| Action | `GET /api/v1/destinations` with no access token, then as Aisha Khan, then as Fatima Khan. |
| Expected response | No token returns 401 `unauthenticated` and says to sign in again. Both signed-in calls return 200 and match the artifact: `city clinic`, J.N. Medical College, Maulana Azad Library, Shamshad Market, Women's College, and Other last. Aligarh Fort is absent. The call does not add an audit entry and does not change the destination rows. |
| Failure cases | E2E; failure cases are covered by the expected response. |
| Artifact | `backend/app/residents/outings/tests/artifacts/destinations.json` |

### `plan-outing` Plan an ordinary outing

| Field | Content |
|---|---|
| Test | `backend/app/residents/outings/tests/test_plan.py` |
| Purpose | A resident saves a destination and an expected return before the gate scan. She may save several, including two on the same hall day, and she may do that while she is outside. The call does not record the exit. The expected return must be in the future and inside ordinary hours on that hall date. The end of the window is included. The start is not. A return after the window needs late-night permission or home going. A second plan for the same expected return is refused. Other stores the words she types and no list id. A planned outing whose expected return has already passed is cancelled by the system, with no staff member, and her other plans stay. |
| Actor | A resident. A gate account is refused. |
| Preconditions | The hall from `hall-created` exists. The clock is frozen at 2026-09-30T00:30:00Z, which is 6:00 AM in India. Aisha Khan is an active resident, username `24-GLLB-118`, inside, with no outing. Fatima Khan is active gate staff. Grace is 30 minutes. |
| Action | `POST /api/v1/me/outings` with no access token, then as Fatima Khan, then as Aisha Khan with a return that is not in the future, a return at 6:30 AM, a return one second after 6:30 PM, a return at 6:30 PM on 1 October, an unknown destination, and Other with no words. Mark Aisha outside and plan Shamshad Market for 4:00 PM on 2 October. Mark her inside, store a library plan whose expected return was 29 September, and plan the library at 6:30 PM with an extra text field. Plan Women's College for 12:00 PM the same day. Plan the library again for 6:30 PM. Read `GET /api/v1/me/outings` and `GET /api/v1/me/outings/current`. Clear the planned rows and plan Women's College for 5:30 PM on 1 October. Clear those rows and plan Other as City bookshop for 5:30 PM on 30 September. Then set grace to 60 minutes. |
| Expected response | No token returns 401 `unauthenticated` and says to sign in again. The gate account returns 403 `forbidden` and says this account cannot do that. A return that is not in the future returns 422 `validation_error` and says the expected return must be in the future. 6:30 AM returns 409 `outside_ordinary_hours` and says that return is outside ordinary hours. One second after 6:30 PM, and 6:30 PM on 1 October, return 409 `permission_required` and say that return is outside ordinary hours. Please submit a permission request. An unknown destination returns 422 and says to choose a destination from the list. Other without words returns 422 and says destination text is required. While she is outside, Shamshad Market on 2 October returns 201 and matches `ahead`. The library plan returns 201 and matches `library` in the artifact, apart from the new id. The passed plan is cancelled at 2026-09-30T00:30:00Z. The extra text is ignored. Women's College at 12:00 PM returns 201 and matches `same_day`. A second library plan for the same 6:30 PM returns 409 `return_already_planned` and says she already has an outing ending at that time. The plan list is Women's College, then the library, then Shamshad Market. The open outing is Women's College, because that is the soonest plan for today. The later plan today and the 2 October plan stay on the list. The winter plan matches `winter_end`. The Other plan matches `other`, and its stored destination id is empty. Each saved row stores the hall day of its expected return. She is inside again after the outside plan, with the presence time restored by the test. Raising grace does not change the outing already saved. The audit log gains one system `outing.cancelled` for the passed plan and one `outing.planned` for each saved plan. |
| Failure cases | E2E; failure cases are covered by the expected response. |
| Artifact | `backend/app/residents/outings/tests/artifacts/plan-outing.json` |

### `current-outing` The open outing

| Field | Content |
|---|---|
| Test | `backend/app/residents/outings/tests/test_current.py` |
| Purpose | A resident reads the outing she is outside on, or the soonest plan whose return falls on today's hall date. A later day is not this outing. When a planned return has passed, that read cancels that plan with no staff member. An outside outing stays outside after its expected return. It is late only after grace. |
| Actor | A resident. A gate account is refused. |
| Preconditions | The hall from `hall-created` exists. The clock starts at 2026-09-30T08:00:00Z. Aisha Khan is an active resident, username `24-GLLB-118`, inside, with no outing. Fatima Khan is active gate staff. |
| Action | `GET /api/v1/me/outings/current` with no access token, then as Fatima Khan, then as Aisha Khan. Plan the library for 6:30 PM and read it again. Move the clock to that return, sign in again because the access token lasts 15 minutes, then one second later, and read it again. Store an outside outing to Shamshad Market whose grace ends at 7:00 PM. Move the clock to 7:00 PM, sign in again, and read it at that grace instant and one second later. Read `GET /api/v1/me/home` at that later instant. |
| Expected response | No token returns 401 `unauthenticated` and says to sign in again. The gate account returns 403 `forbidden` and says this account cannot do that. The first read matches `empty`. After the plan, the read matches `library` apart from the new id. At the exact expected return the plan is still open. One second later the read matches `empty`, and the plan is cancelled at 2026-09-30T13:00:01Z by an audit entry with no actor. The outside outing matches `outside` and is not late at 7:00 PM. One second later it is late and still outside. Home shows that same late outing. |
| Failure cases | E2E; failure cases are covered by the expected response. |
| Artifact | `backend/app/residents/outings/tests/artifacts/current-outing.json` |

### `cancel-outing` Cancel a planned outing

| Field | Content |
|---|---|
| Test | `backend/app/residents/outings/tests/test_cancel.py` |
| Purpose | A resident cancels one ordinary outing while it is still planned. Another plan the same day, and a later day, stay. The exit is not recorded and she stays inside. A plan whose expected return has already passed is cancelled by the system first, so cancelling that id finds nothing planned. An outing that is already outside is closed by a return scan, not by this call. |
| Actor | A resident. A gate account is refused. |
| Preconditions | The hall from `hall-created` exists. The clock is frozen at 2026-09-30T08:00:00Z. Aisha Khan is an active resident, username `24-GLLB-118`, inside, with no outing. Fatima Khan is active gate staff. |
| Action | `POST /api/v1/me/outings/{outing_id}/cancel` with no access token, then as Fatima Khan, then as Aisha Khan for an id that is not on file. Store a library plan whose expected return was 29 September and cancel that id. Plan the library for 6:30 PM, Shamshad Market for 4:00 PM on 2 October, and Women's College for 4:00 PM the same day as the library. Cancel the library. Read the open outing and the plan list. Cancel the library again, then cancel Women's College, and read both again. Cancel Shamshad Market. Store an outside outing to Shamshad Market, mark her outside, and cancel that id. |
| Expected response | No token returns 401 `unauthenticated` and says to sign in again. The gate account returns 403 `forbidden` and says this account cannot do that. An unknown id returns 404 `not_found` and says that record was not found. The passed plan is cancelled at 2026-09-30T08:00:00Z by an audit entry with no actor, and cancelling that id returns 409 `no_outing_planned` and says there is no planned outing. The library cancel returns 200 and matches `cancelled` in the artifact, apart from the new id. The stored destination id is the library, `cancelled_at` is 2026-09-30T08:00:00Z, and she stays inside. The audit entry is `outing.cancelled` by Aisha Khan. The open outing is Women's College, and the plan list is Women's College then Shamshad Market. Cancelling the library id again returns 409 `no_outing_planned`. Cancelling Women's College returns 200 with status `cancelled`. The open outing is then empty, because the remaining plan is for 2 October, and that plan is the only row on the plan list. Cancelling the 2 October plan returns 200 with status `cancelled`. The outside outing returns 409 `already_outside` and says she is already outside. That outing stays outside. |
| Failure cases | E2E; failure cases are covered by the expected response. |
| Artifact | `backend/app/residents/outings/tests/artifacts/cancel-outing.json` |
