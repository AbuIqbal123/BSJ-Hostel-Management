# Test catalog

Document version: **0.4.62**

Status: thirty-six recorded tests. A resident can self-onboard at `POST /api/v1/auth/onboard` and sign in immediately. The onboard form can list active unassigned rooms at `GET /api/v1/auth/onboard/options`. Startup creates the hall. Mock late and return guardian notices are recorded on register read and return scan. `GET /ready` opens the database and reports user_version beside shallow `/health`. The signing key must be at least 32 bytes. Sign-in keeps a session. Sign-in and refresh attempts are rate-limited. A development command adds local accounts. Resident home reads the resident's own screen. The destination list shows the active ordinary-outing choices, with Other last. A resident can plan an ordinary outing before the gate scan. She can read the outing that is still planned or outside. She can cancel that plan before the gate scan. A warden or the provost can read the register presence board: hall and block counts, the resident list with filters, one resident's record, and the late list. A resident can submit, list, read, and cancel late-night and home-going permissions. A warden or the provost can read the permission queue and decide a pending request. The staff permission queue sorts by created_at (newest default) and accepts optional filters for block, permission_type, and created_at date range. A resident can read her own exit and return history as a paginated list. A resident can read her permanent hall-pass QR payload. A resident can apply for, list, read, edit, and cancel her own guest stays. A warden or the provost can list guest stays by bucket (terminal cancelled/rejected omitted by default; `include_terminal=true` opts them back in), decide a pending stay, mark payment before arrival, and optionally upload payment evidence. Gate staff can scan a hall pass to record an exit or return, and read recent gate activity (resident lines use `resident_name` and `room_label`; guest lines use `guest_name`, `host_name`, and `host_room_label`). Gate staff can list expected and in-hall guests (optional `payment_status` filter) and record guest arrival and departure (response includes `recorded_by` and `arrival_time`/`departure_time` equal to `recorded_at`, and does not include `guests_in_hall_count`). Gate staff can read guest dining occupancy counts for the gate home strip. The provost can read and update hall settings. The provost can read and update hall notification SMS templates. The provost can list, create, and update blocks. The provost can list, create, and update rooms. The provost can list, create, and update destinations. The provost can list, create, and update residents, with the own phone required on create, and reissue a hall pass. The provost can list, create, and update staff accounts. The provost can reset a user password. The provost can read the audit log. The provost can read the SMS log. The provost can export the register as CSV.

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
| Purpose | Starting the service creates the hall in `docs/database/database.md`. `GET /health` still only reports that the process is up. |
| Actor | System job. Service startup. |
| Preconditions | The database file is absent. No people, rooms, permissions, outings, guest stays, guardian messages, or audit entries exist. |
| Action | Start the service on that empty file. `GET /health` with no payload. Start the service a second time on the same file. `GET /health` again. |
| Expected response | Both calls return 200 and `{"status":"ok"}`. The body contains no hall data. The file then matches the artifact: schema version 11, one settings record (summer 6:30 AM–6:30 PM from 1 April, winter 6:30 AM–5:30 PM from 1 October, grace 30 minutes), five blocks with the published room counts and no door numbers, and the destinations in alphabetical order with Other as the only free-text choice. The other tables exist and are empty. The second start does not add another copy. |
| Failure cases | E2E; failure cases are covered by the expected response. |
| Artifact | `backend/tests/artifacts/hall-inventory.json` |

### `guardian-sms` Mock late and return notices

| Field | Content |
|---|---|
| Test | `backend/app/shared/tests/test_guardian_sms.py` |
| Purpose | When grace has ended and the resident is still outside, reading the register records a mock late notice. A later return scan records a mock return notice. Bodies keep `{hall_name}`. |
| Actor | Warden (register), then gate staff (return scan). |
| Preconditions | Hall exists. One resident is outside past grace with no guardian messages yet. SMS driver is mock. |
| Action | `GET /api/v1/register/late` as warden. Then `POST /api/v1/gate/scans` with that resident's hall pass as gate. |
| Expected response | Late list succeeds. One `late_notice` row is `sent` via `mock` and names the hall. Return scan records return with `return_record.return_timeliness` `late` (returned at 12:30Z, expected 11:30Z, grace ended 12:00Z). One `return_notice` is `sent` via `mock`. Audit has `sms.late_notice` and `sms.return_notice`. A second insert of the same notice leaves the outing `returned`, keeps one message, and writes one audit entry. |
| Failure cases | Isolated for the overlapping insert: the unique `(outing_id, notice_type)` index is hit after the return is marked, which two HTTP calls cannot freeze between the existence check and the insert. The second insert does not raise, and the return stays recorded. |
| Artifact | none |

### `ready` Database readiness beside health

| Field | Content |
|---|---|
| Test | `backend/tests/test_ready.py` |
| Purpose | `GET /ready` opens an existing hall database and returns `user_version`. `GET /health` stays shallow and does not create a database. |
| Actor | System job / operator. |
| Preconditions | The hall from startup exists on the test database file. A second path is missing, a third path is a directory, and a fourth path is a text file. |
| Action | `GET /health`. `GET /ready` on the migrated file, then on the missing path, the directory, and the text file. `GET /health` again after the missing path. |
| Expected response | Health returns 200 `{"status":"ok"}` with no hall data, including while the database path is missing, and that missing file is not created. Ready on the migrated file returns 200 with `status` `ready` and `user_version` matching the migrated schema. |
| Failure cases | A missing file, a directory, or a file that is not a database returns 503 `not_ready` and says the hall database could not be opened. The missing file and its parent directory stay absent. The text file is left unchanged. |
| Artifact | none |

### `app-secret-length` Signing key length at startup

| Field | Content |
|---|---|
| Test | `backend/tests/test_secret_key.py` |
| Purpose | The process refuses to start when `APP_SECRET_KEY` is shorter than 32 bytes, so JWT HS256 does not warn or run with a weak key. |
| Actor | System job. Settings load. |
| Preconditions | `ENVIRONMENT` is development and `SMS_DRIVER` is mock. |
| Action | Load settings with a short key, then with a key of at least 32 bytes. |
| Expected response | The short key raises. The long key is accepted. |
| Failure cases | Isolated; short key is refused before the HTTP app starts. |
| Artifact | none |

### `auth-session` Sign in, refresh, sign out, and change password

| Field | Content |
|---|---|
| Test | `backend/app/shared/auth/tests/test_session.py` |
| Purpose | A hall-issued account can sign in, stay signed in, sign out, and change its own password. The password and the session secret are never stored. |
| Actor | Gate staff, then a resident. A suspended gate account is refused. |
| Preconditions | The hall from `hall-created` exists. The clock is frozen and moved only where a step below names a time. Three accounts exist, created at 2026-09-30T00:00:00Z. Fatima Khan is active gate staff, username `gate.fatima`, job title Gatekeeper. Aisha Khan is an active resident, username `24-GLLB-118`, room B-204, course B.A. LL.B. (Hons.), guardian Rashid Khan at +919876543210, presence inside. Noor Ali is suspended gate staff, username `gate.suspended`. No sessions or audit entries exist yet. |
| Action | At 00:01, `POST /api/v1/auth/login` with a wrong password, an unknown username, the suspended account's password, and a body that omits the password. Then sign in as `GATE.FATIMA`. `GET /api/v1/auth/me` with that access token, with no token, and with a token that is not a session. At 00:02, `POST /api/v1/auth/refresh` with the refresh token, then again with the token just replaced. At 00:03, sign in a second time. At 00:04, `POST /api/v1/auth/logout`. Repeat both refresh tokens. At 00:05, sign in again. `POST /api/v1/auth/change-password` with the wrong current password, with a new password shorter than 10 characters, and then with the current password and a new password of at least 10 characters. Sign in with the old password. At 00:07, sign in with the new password. At 00:08, sign in as `24-gllb-118` and `GET /api/v1/auth/me`. At 00:09, sign in as the gate account again. Move the clock to 00:25 and call `GET /api/v1/auth/me` with the 00:07 access token. Move the clock to 2026-10-30T00:09:01Z and refresh the 00:09 token. |
| Expected response | Wrong, unknown, and suspended sign-in return 401 `unauthenticated`. An unknown username and a known username with the wrong password both say username or password is wrong. The suspended attempt (correct password) says the account is suspended and to contact the Hall Office. A missing password returns 422 `validation_error` on `password`. A successful sign-in returns 200 with `token_type` `bearer`, `expires_in` 900, an access token, a refresh token, and the user summary. The username in the response is the stored spelling. `GET /api/v1/auth/me` returns the gate job title or the resident room, and the other profile is null. A missing, unknown, expired, rotated, or signed-out token returns 401 `unauthenticated` and says to sign in again. Refresh returns a new pair and the presented refresh token then fails. Logout returns 204 and both live refresh tokens then fail. The access token from before logout still opens `GET /api/v1/auth/me` until its 15 minutes pass. A wrong current password returns 401. A short new password returns 422 on `new_password` and says to use at least 10 characters. A successful change returns 204, the old password then fails, and the refresh token from before the change fails. The stored state matches the artifact: sessions and audit entries at the times above, no password and no session secret in the file, and the new password kept as Argon2id. |
| Failure cases | E2E; failure cases are covered by the expected response. |
| Artifact | `backend/app/shared/auth/tests/artifacts/auth-session.json` |

### `auth-rate-limit` Sign-in and refresh attempt limit

| Field | Content |
|---|---|
| Test | `backend/app/shared/auth/tests/test_rate_limit.py` |
| Purpose | Repeated sign-in or refresh attempts from one client are refused with 429 so password guessing stays slow. |
| Actor | Anyone calling login or refresh. |
| Preconditions | The hall from `hall-created` exists. One active gate account exists. The in-process limit is set low for the check. |
| Action | Call `POST /api/v1/auth/login` with a wrong password until the limit is exceeded, then once more. Separately, after a successful sign-in, call `POST /api/v1/auth/refresh` with a bad token until the limit is exceeded, then once more. |
| Expected response | Calls within the limit return 401 `unauthenticated`. The next call returns 429 `rate_limited` and says too many attempts. |
| Failure cases | E2E; failure cases are covered by the expected response. |
| Artifact | none |

### `auth-resident-onboard` Resident self-onboard

| Field | Content |
|---|---|
| Test | `backend/app/shared/auth/tests/test_onboard.py` |
| Purpose | A resident can self-onboard with full name, enrolment, password, own phone, guardian details, block, and room; the account is active immediately. |
| Actor | Anyone (no token) for onboard and later resident sign-in. |
| Preconditions | Empty enrolment. An active room exists in the selected block. Clock frozen at 2026-09-30T12:00:00Z. |
| Action | `POST /api/v1/auth/onboard` with required fields and optional course; a body that omits phone; a password shorter than 10 characters; a room that is not in the selected block; the same enrolment with different capitals. Then sign in. Then repeat the taken enrolment until the sign-in attempt limit is exceeded. |
| Expected response | Onboard returns 201 with `enrolment_number`, `status` `active`, and the ready message, and no tokens. The stored resident is active, inside, on that room, with a hall pass that is not in the artifact. A missing phone and a short password return 422 `validation_error`. A room outside the block returns 422 `validation_error`. A taken enrolment, ignoring capitals, returns 401 `unauthenticated` and says username or password is wrong, never 409 and never a duplicate-enrolment code. Sign-in returns 200 tokens immediately. After the attempt limit, the next onboard returns 429 `rate_limited`. |
| Failure cases | E2E; failure cases are covered by the expected response. |
| Artifact | `backend/app/shared/auth/tests/artifacts/auth-resident-onboard.json` |

### `auth-onboard-options` Onboard room picker

| Field | Content |
|---|---|
| Test | `backend/app/shared/auth/tests/test_onboard_options.py` |
| Purpose | The onboard form can list active blocks and the active rooms that have no resident yet, without a token and without office fields. |
| Actor | Anyone (no token). |
| Preconditions | The hall from `hall-created` exists. Block-B is active and has two active unassigned rooms, one active room that already has a resident (a bed still free), and one inactive room. Block-A is inactive and has an active unassigned room. Block-C is active and has only an assigned room. |
| Action | `GET /api/v1/auth/onboard/options` with no token. Repeat until the sign-in attempt limit is exceeded. |
| Expected response | 200 list matching the artifact. Each block is `id` and `name` only, ordered by name. Each room is `id` and `label` only, ordered by label. Only Block-B's two active unassigned rooms are present. Assigned rooms, inactive rooms, inactive blocks, and blocks with nothing left are absent. No office fields. The call past the attempt limit returns 429 `rate_limited`. |
| Failure cases | E2E; failure cases are covered by the expected response. |
| Artifact | `backend/app/shared/auth/tests/artifacts/auth-onboard-options.json` |


### `dev-accounts` Local sign-in accounts

| Field | Content |
|---|---|
| Test | `backend/tests/test_dev_seed.py` |
| Purpose | A development command adds the local sign-in accounts. Starting the service does not add them, and the command does not replace an account that is already there. |
| Actor | System job. The development seed command. |
| Preconditions | The database file may be absent. `ENVIRONMENT` is `development` for the accounts, then anything else for the refusal. The clock is frozen at 2026-09-30T00:00:00Z while the accounts are added. The published hall page does not list door numbers, so room B-204 exists only after this command. |
| Action | Run the seed. `POST /api/v1/auth/login` as `gate.fatima` with the wrong password, as `nobody`, as `gate.suspended` with that account's password, then as `GATE.FATIMA`, `24-gllb-118`, `warden.sara`, and `provost.halima` with the passwords the seed keeps. Run the seed again. Run the seed with `ENVIRONMENT` set to `production`. |
| Expected response | The first run matches the artifact: room B-204, Fatima Khan (`gate.fatima`, Gatekeeper), Aisha Khan (`24-GLLB-118`, B.A. LL.B. (Hons.), guardian Rashid Khan at +919876543210, inside), Noor Ali (`gate.suspended`, suspended), Sara Malik (`warden.sara`, Warden), and Halima Begum (`provost.halima`, Provost). No password, hall-pass code, or session secret is in the artifact. The wrong password and an unknown username both return 401 and say username or password is wrong. The suspended account returns 401 and says the account is suspended and to contact the Hall Office. Each active account returns 200 with that account's stored username and role. The second run leaves the password, the last sign-in, the sessions, and the audit log as they were. Outside development the command raises and does not create the database. |
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
| Expected response | No token returns 401 `unauthenticated` and says to sign in again. The gate account returns 403 `forbidden` and says this account cannot do that. Aisha's first call matches the `empty` object in the artifact: room B-204, Block-B, inside, no outing, no permission, and no history. The second call matches `outside`: she is outside, the open outing is the library with `lateness` `late`, the active permission is the pending late-night request, and the history is the ten newest of her own exits and returns (`exited_at`/`returned_at`/`recorded_by` shape, no `occurred_at`). The other resident's records are absent. The cancelled plan is absent. At the grace instant `lateness` is `on_time`. One second after grace it is `late`. The call does not add an audit entry and does not change the outing. |
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
| Expected response | No token returns 401 `unauthenticated` and says to sign in again. The gate account returns 403 `forbidden` and says this account cannot do that. A return that is not in the future returns 422 `validation_error` and says the expected return must be in the future. 6:30 AM returns 409 `outside_ordinary_hours` and says that return is outside ordinary hours. One second after 6:30 PM, and 6:30 PM on 1 October, return 409 `permission_required` and say that return is outside ordinary hours. Please submit a permission request. An unknown destination returns 422 and says to choose a destination from the list. Other without words returns 422 and says destination text is required. While she is outside, Shamshad Market on 2 October returns 201 and matches `ahead`. The library plan returns 201 and matches `library` in the artifact, apart from the new id. The passed plan is cancelled at 2026-09-30T00:30:00Z. The extra text is ignored. Women's College at 12:00 PM returns 201 and matches `same_day`. A second library plan for the same 6:30 PM returns 409 `return_already_planned` and says she already has an outing ending at that time. The plan list is paginated (`total`/`limit`/`offset`) and is Women's College, then the library, then Shamshad Market. The open outing is Women's College, because that is the soonest plan for today. The later plan today and the 2 October plan stay on the list. The winter plan matches `winter_end`. The Other plan matches `other`, and its stored destination id is empty. Each saved row stores the hall day of its expected return. She is inside again after the outside plan, with the presence time restored by the test. Raising grace does not change the outing already saved. The audit log gains one system `outing.cancelled` for the passed plan and one `outing.planned` for each saved plan. |
| Failure cases | E2E; failure cases are covered by the expected response. |
| Artifact | `backend/app/residents/outings/tests/artifacts/plan-outing.json` |

### `current-outing` The open outing

| Field | Content |
|---|---|
| Test | `backend/app/residents/outings/tests/test_current.py` |
| Purpose | A resident reads the outing she is outside on, or the soonest plan whose return falls on today's hall date. A later day is not this outing. When a planned return has passed, `POST /api/v1/me/expire-passed` (or plan/cancel/scan) cancels that plan with no staff member; GET does not. An outside outing stays outside after its expected return. It is late only after grace. |
| Actor | A resident. A gate account is refused. |
| Preconditions | The hall from `hall-created` exists. The clock starts at 2026-09-30T08:00:00Z. Aisha Khan is an active resident, username `24-GLLB-118`, inside, with no outing. Fatima Khan is active gate staff. |
| Action | `GET /api/v1/me/outings/current` with no access token, then as Fatima Khan, then as Aisha Khan. Plan the library for 6:30 PM and read it again. Move the clock to that return, sign in again because the access token lasts 15 minutes, then one second later, and read it again. Store an outside outing to Shamshad Market whose grace ends at 7:00 PM. Move the clock to 7:00 PM, sign in again, and read it at that grace instant and one second later. Read `GET /api/v1/me/home` at that later instant. |
| Expected response | No token returns 401 `unauthenticated` and says to sign in again. The gate account returns 403 `forbidden` and says this account cannot do that. The first read matches `empty`. After the plan, the read matches `library` apart from the new id. At the exact expected return the plan is still open. One second later the read matches `empty`, and the plan is cancelled at 2026-09-30T13:00:01Z by an audit entry with no actor. The outside outing matches `outside` and has `lateness` `on_time` at 7:00 PM. One second later `lateness` is `late` and it is still outside. Home shows that same late outing. |
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

### `register-presence` Register presence board

| Field | Content |
|---|---|
| Test | `backend/app/staff/register/tests/test_presence.py` |
| Purpose | A warden or the provost reads who is inside, outside, or late, the same counts for each block, and one resident's open outside outing (or null when she is inside). Suspended residents are left out of the counts. Guests and waiting permissions follow `docs/database/database.md`. |
| Actor | A warden. A gate or resident account is refused. The provost may call the same routes. |
| Preconditions | The hall from `hall-created` exists. The clock is frozen at 2026-09-30T13:00:00Z. Fatima Khan is active gate staff. Sara Malik is an active warden. Halima Begum is an active provost. Active residents: Aisha Khan in B-204 (inside, with one cancelled outing, one returned outing, and one pending late-night permission), Maryam Siddiqui in B-205 (outside to the library, grace ends at 14:00), and Zara Ahmed in A-101 (outside to Shamshad Market, grace ended at 12:30, late notice sent). Noor Fatima is a suspended resident in A-102 and is inside. Guest stays: one pending for Aisha, one arrived in Aisha's block whose end date was yesterday, and one arrived in Maryam's block whose end date is tomorrow. Zara also has a pending permission. |
| Action | `GET /api/v1/register/summary`, `GET /api/v1/register/residents`, `GET /api/v1/register/residents/{resident_id}`, and `GET /api/v1/register/late` with no token, as Fatima Khan, as Aisha Khan, then as Sara Malik. As Sara, read the summary on the empty hall before the people are stored, then after they are stored. Filter residents by `q`, `state`, and `block_id`. Read Aisha, Maryam, Zara, an unknown id, and the late list. As Halima Begum, read the summary once. |
| Expected response | No token returns 401 `unauthenticated` and says to sign in again. Gate and resident accounts return 403 `forbidden` and say this account cannot do that. The empty summary matches `empty` in the artifact: every count is 0 and each published block appears. The filled summary matches `summary`: hall totals are the sum of the blocks; Block-B has Aisha inside, Maryam outside, one pending permission, two guests in hall including one who should have left, and one pending guest stay; Block-A has Zara late and one pending permission; the suspended resident is absent from every count. The unfiltered resident list matches `residents` (Aisha, Maryam, Zara by name); each row uses `outside_destination` for the open outing place (null when inside). Search, `state=late`, and Block-A each match their artifact slices. The late list is Zara only. Aisha's record matches `aisha` (inside, `outing` null despite cancelled and returned outings on file, guardian notice not due). Maryam's matches `maryam` (outside, `outing` is that outside outing, not late, notice not due). Zara's matches `zara` (late, `outing` is that outside outing, notice sent). An unknown id returns 404 `not_found`. The provost summary matches the warden summary. The register reads do not add an audit entry; only the sign-ins do. |
| Failure cases | E2E; failure cases are covered by the expected response. |
| Artifact | `backend/app/staff/register/tests/artifacts/register-presence.json` |

### `permission-lifecycle` Late-night and home-going permissions

| Field | Content |
|---|---|
| Test | `backend/app/residents/permissions/tests/test_lifecycle.py` |
| Purpose | A resident submits late-night and home-going requests (departure not in the past, return after departure, no maximum-ahead cap), lists and reads her own, and cancels while pending or approved. A warden or the provost reads the queue and decides only a pending request; a second decision is refused with the current status named. Approval does not create an outing. Several permissions may overlap, including late-night and home going on the same dates. An approved permission past its expected return expires on `POST /api/v1/me/expire-passed` / `POST /api/v1/permissions/expire-passed` (and on write paths); GET list/fetch do not write expiry. Cancel is refused with `permission_in_use` after the gate has recorded an exit against it. |
| Actor | A resident. A warden decides. A gate account is refused on resident and staff permission routes. The provost may decide. |
| Preconditions | The hall from `hall-created` exists. The clock is frozen at 2026-09-30T13:00:00Z. Aisha Khan is an active resident, username `24-GLLB-118`, room B-204, inside. Fatima Khan is active gate staff. Sara Malik is an active warden. Halima Begum is an active provost. Maryam Siddiqui is another active resident in B-205. |
| Action | Resident routes with no token, as Fatima, then as Aisha: `POST /api/v1/me/permissions` late-night and home going, including a second late-night that overlaps the first, and a home going that overlaps the late-night dates; refuse a departure clearly in the past; accept a departure a few minutes before now (clock skew); refuse return not after departure; list and get own (a prior submit already expired the unused approved permission past its return; GET does not write; `POST /api/v1/me/expire-passed` is idempotent); get another resident's id; cancel pending; submit and cancel approved; refuse cancel on `in_use` with `permission_in_use`. Staff routes with no token, as Fatima, as Aisha, then as Sara: list queue (default pending; GET does not expire; `POST /api/v1/permissions/expire-passed` expires another unused approved permission past its return), get one, approve with empty note, confirm no outing row, refuse a second decision with a message that names the current status, reject another pending. As Halima, approve one. Look again at an expired permission. |
| Expected response | No token returns 401 `unauthenticated`. Gate on resident routes and gate or resident on staff routes return 403 `forbidden`. A departure clearly in the past returns 422 `validation_error` on `departure_at`. A departure a few minutes before now is accepted. Return not after departure returns 422 `validation_error`. Overlapping late-night and home-going submissions return 201. Own list is newest first and each item is a Permission (no resident_id/name/room); GET does not expire; submit (and `POST /api/v1/me/expire-passed`) expire that resident's unused approved permission past its return. Another resident's id returns 404. Cancel pending or approved returns 200 `cancelled`. Cancel after exit returns 409 `permission_in_use`. Staff default list is pending; GET does not expire; `POST /api/v1/permissions/expire-passed` expires unused approved permissions past their return. Approve returns 200 `approved`, stores the decider, writes `permission.approved`, and leaves outings empty for that permission. A second decision returns 409 `not_pending` and says only a pending permission can be approved or rejected, naming the current status. Reject returns 200 `rejected`. Expired permissions stay `expired` when looked at again, with a system `permission.expired` audit entry from the first look. |
| Failure cases | E2E; failure cases are covered by the expected response. |
| Artifact | `backend/app/residents/permissions/tests/artifacts/permission-lifecycle.json` |

### `permission-queue` Staff permission queue filters and sort

| Field | Content |
|---|---|
| Test | `backend/app/staff/register/tests/test_permission_queue.py` |
| Purpose | A warden or the provost lists permissions sorted by `created_at` (newest first by default, or oldest), and may filter by the resident's current-room `block_id`, by `permission_type` (late_night or home_going), and by an inclusive `created_at` range (`created_from` / `created_to`). Status still defaults to pending. |
| Actor | A warden. A gate or resident account is refused. The provost may call the same route. |
| Preconditions | The hall from `hall-created` exists. The clock is frozen at 2026-09-30T13:00:00Z. Fatima Khan is active gate staff. Sara Malik is an active warden. Halima Begum is an active provost. Active residents: Aisha Khan in B-204 (Block-B) and Zara Ahmed in A-101 (Block-A). Four pending permissions exist with known created_at times and types so filters and sort order are visible. |
| Action | `GET /api/v1/permissions` with no token, as Fatima, as Aisha, then as Sara: default pending list (newest first); `order=oldest`; filter `permission_type=home_going`; filter `block_id` for Block-A; filter `created_from` and `created_to`; combine `permission_type` and `block_id`. As Halima, read the default list once. |
| Expected response | No token returns 401 `unauthenticated`. Gate and resident return 403 `forbidden`. The default list matches `default` in the artifact (newest `created_at` first). `order=oldest` matches `oldest`. `permission_type=home_going` matches `home_going`. Block-A matches `block_a`. The created_at window matches `created_range`. Combined `permission_type` and block matches `home_going_block_a`. The provost default list matches the warden default. The reads do not add an audit entry beyond sign-in. |
| Failure cases | E2E; failure cases are covered by the expected response. |
| Artifact | `backend/app/staff/register/tests/artifacts/permission-queue.json` |


### `resident-history` Own exit and return history

| Field | Content |
|---|---|
| Test | `backend/app/residents/home/tests/test_history.py` |
| Purpose | A resident reads her own exit and return lines, newest first, with limit and offset. Each outing contributes an exit line and, once returned, a return line. Each line carries `exited_at` or `returned_at` (the other null) and `recorded_by` (the staff display name who recorded that movement). |
| Actor | A resident. A gate account is refused. |
| Preconditions | The hall from `hall-created` exists. The clock is frozen at 2026-09-30T13:00:00Z. Aisha Khan is an active resident, username `24-GLLB-118`, room B-204, inside. Fatima Khan is active gate staff. Maryam Siddiqui is another active resident. No outing history exists yet until the open-day fixture runs. |
| Action | `GET /api/v1/me/history` with no token, as Fatima, then as Aisha when empty; again after exits and returns exist; with `limit=3&offset=0` and `limit=3&offset=9`. |
| Expected response | No token returns 401 `unauthenticated`. Gate returns 403 `forbidden`. Empty matches `empty` in the artifact. After the open day, the default page matches `full` (eleven lines, newest first). Each HistoryEvent has `event`, `place`, `outing_id`, `exited_at`, `returned_at`, and `recorded_by` (no `occurred_at`). For `exited`, `exited_at` is set and `returned_at` is null; for `returned`, the reverse. `recorded_by` is Fatima Khan for every seeded line. The first page of three matches `page`. The tail page matches `tail`. The ten newest lines match home `recent_history`. Another resident's lines and a cancelled plan are absent. The reads do not add an audit entry beyond sign-in. |
| Failure cases | E2E; failure cases are covered by the expected response. |
| Artifact | `backend/app/residents/home/tests/artifacts/resident-history.json` |


### `resident-hall-pass` Permanent hall pass

| Field | Content |
|---|---|
| Test | `backend/app/residents/hall_pass/tests/test_hall_pass.py` |
| Purpose | A resident reads the permanent hall-pass payload the phone encodes as a QR image. The same payload is used to leave and to come back. |
| Actor | A resident. Gate and warden accounts are refused. |
| Preconditions | The hall from `hall-created` exists. The clock is frozen at 2026-09-30T13:00:00Z. Aisha Khan is an active resident, username `24-GLLB-118`, room B-204, hall-pass token `bsj:v1:test-resident-hall-pass`. Fatima Khan is active gate staff. Sara Malik is an active warden. |
| Action | `GET /api/v1/me/hall-pass` with no token, as Fatima, as Sara, then as Aisha. |
| Expected response | No token returns 401 `unauthenticated`. Gate and warden return 403 `forbidden`. Aisha's call matches `pass` in the artifact: `qr_payload` is the stored `qr_token`, with her full name and room label. The read does not change the token and does not add an audit entry beyond sign-in. |
| Failure cases | E2E; failure cases are covered by the expected response. |
| Artifact | `backend/app/residents/hall_pass/tests/artifacts/resident-hall-pass.json` |


### `guest-stays-resident` Own guest stay applications

| Field | Content |
|---|---|
| Test | `backend/app/residents/guests/tests/test_lifecycle.py` |
| Purpose | A resident applies for a guest stay (lead days and inclusive length from hall settings), lists and reads her own, edits while pending/approved (dates-only after arrival), and cancels while pending or approved before arrival. Another resident's stay is not visible. |
| Actor | A resident. A gate account is refused. |
| Preconditions | The hall from `hall-created` exists. The clock is frozen at 2026-09-30T13:00:00Z (hall date 30 September 2026). Aisha Khan is an active resident in B-204. Maryam Siddiqui is another active resident. Fatima Khan is active gate staff. Sara Malik is an active warden (used only to seed an approved stay and an arrived stay in the fixture). Hall settings keep `guest_min_lead_days` 1 and `guest_max_inclusive_days` 7. |
| Action | `POST/GET /api/v1/me/guest-stays`, `GET/PATCH /api/v1/me/guest-stays/{id}`, `POST .../cancel` with no token, as Fatima, then as Aisha: refuse start on today and over-long stays; submit a valid stay; list and get; cancel pending; submit again and cancel; cancel a seeded approved stay before arrival; refuse cancel after arrival; refuse get/cancel of Maryam's stay. Also `GET` three seeded approved stays that have not arrived: paid from 30 September through 2 October, unpaid on those dates, and paid from 20 September through 28 September. |
| Expected response | No token returns 401 `unauthenticated`. Gate returns 403 `forbidden`. Request and response stay fields are `guest_start_date` / `guest_end_date`. Start on today's hall date, end before start, and inclusive length over 7 return 422 `validation_error`. A valid apply returns 201 `pending` / `unpaid` / bucket `pending` and matches `submitted` in the artifact (apart from the new id). Own list is newest first and each list item is a GuestStaySummary card (no reason, decision note, or staff recorder ids). Get by id returns the full GuestStay (`decided_by`, `arrived_recorded_by`, and `departed_recorded_by` are staff user UUIDs or null, not display names). Get another host's id returns 404. Before arrival, PATCH with all five editable fields returns 200 `pending`, clears decision fields, and leaves payment unchanged (including when previously approved). After arrival, PATCH may change only `guest_start_date`/`guest_end_date` (name/relation/reason → 422); status returns to `pending` with arrival kept. PATCH on rejected/cancelled/departed returns 409 `not_editable`. Cancel pending or approved (before arrival) returns 200 `cancelled`. Cancel after arrival, or cancel a terminal stay, returns 409 `not_cancellable`. Audit gains `guest_stay.submitted`, `guest_stay.edited`, and `guest_stay.cancelled` for the resident's own actions. A paid approved stay that has not arrived, from 30 September 2026 through 2 October 2026, is bucket `expected`. The same dates unpaid are bucket `not_expected`. A paid approved stay that has not arrived, from 20 September 2026 through 28 September 2026, is bucket `not_expected`. |
| Failure cases | E2E; failure cases are covered by the expected response. |
| Artifact | `backend/app/residents/guests/tests/artifacts/guest-stays-resident.json` |


### `guest-stays-staff` Staff guest stay queue, decision, and payment

| Field | Content |
|---|---|
| Test | `backend/app/residents/guests/tests/test_staff_queue.py` |
| Purpose | A warden or the provost lists guest stays filtered by derived bucket (`in_hall` is the dining set and includes `should_have_left`). By default the list omits terminal buckets `cancelled` and `rejected`; `include_terminal=true` includes them. An explicit `bucket=cancelled` or `bucket=rejected` returns that subset without the flag. Reads one stay, approves or rejects only while pending, and marks payment paid or unpaid before arrival on pending or approved stays, recording a free-text `payment_note` for off-system proof when marking paid. |
| Actor | A warden. The provost may call the same routes. Gate and resident accounts are refused. |
| Preconditions | The hall from `hall-created` exists. The clock is frozen at 2026-09-30T13:00:00Z. Seeded stays cover pending, upcoming, in-hall, should-have-left, departed, rejected, and cancelled. Fatima Khan is gate staff. Sara Malik is warden. Halima Begum is provost. |
| Action | `GET /api/v1/guest-stays` (default, `include_terminal=true`, and with `bucket`), `GET /api/v1/guest-stays/{id}`, `POST .../decision`, `POST .../payment` with no token, as Fatima, as Aisha, then as Sara; as Halima read upcoming once. Payment paid sends a non-empty `payment_note`; paid without a note is refused; unpaid clears the note. |
| Expected response | No token returns 401. Gate and resident return 403. Default list excludes cancelled and rejected ids; `include_terminal=true` includes them; `bucket=rejected` and `bucket=cancelled` return those subsets without the flag. List items are GuestStaySummary cards; GET by id returns the full GuestStay including `payment_note`. Pending bucket matches the artifact id order. `bucket=in_hall` includes in-hall and should-have-left; `should_have_left` is that subset alone. Approve with empty note stores `approved` unpaid and clears the note; `decided_by` is the deciding staff user UUID; a second decision returns 409 `not_pending`. After a resident post-arrival date edit, staff may approve again while arrival is kept; reject after arrival returns 409. A later date edit returns the stay to pending with an empty decision, and gate may record departure. Reject stores the note. Marking paid without `payment_note` (or with only whitespace) returns 422 `validation_error`. Payment paid with a note then unpaid on an approved stay before arrival succeeds; unpaid clears `payment_note`, the payment staff fields, and any payment evidence. Payment on pending with a note succeeds; payment after arrival or on departed/rejected returns 409 `payment_locked`. Audit records `guest_stay.approved`, `guest_stay.rejected`, `guest_stay.payment_marked`, `guest_stay.edited`, and `guest_stay.departed`. |
| Failure cases | E2E; failure cases are covered by the expected response. |
| Artifact | `backend/app/residents/guests/tests/artifacts/guest-stays-staff.json` |


### `guest-payment-evidence` Optional guest payment evidence upload

| Field | Content |
|---|---|
| Test | `backend/app/residents/guests/tests/test_payment_evidence.py` |
| Purpose | A warden or the provost may optionally upload, replace, download, or clear a JPEG/PNG/PDF receipt on a guest stay while payment is mutable. Evidence is never required to mark paid. Marking unpaid clears evidence. |
| Actor | A warden. The provost may call the same routes. Gate and resident accounts are refused. |
| Preconditions | The hall from `hall-created` exists. The clock is frozen. An approved unpaid stay before arrival is seeded. `PAYMENT_EVIDENCE_DIR` points at a temp directory. |
| Action | `POST /api/v1/guest-stays/{id}/payment/evidence` with multipart field `evidence`; `GET` and `DELETE` the same path; mark paid without evidence; mark unpaid after upload; refuse after arrival and for disallowed types/size. |
| Expected response | No token returns 401. Gate and resident return 403. Upload of a small PNG stores metadata on GuestStay (`payment_evidence_original_name`, `payment_evidence_content_type`, `payment_evidence_uploaded_at`, `payment_evidence_uploaded_by` as the staff user id) with no absolute path. Download returns the file bytes. Replace overwrites. DELETE clears metadata without changing `payment_status`. Marking paid with `payment_status` and a `payment_note`, and no file, still succeeds. Marking unpaid clears evidence. After arrival returns 409 `payment_locked`. Disallowed content type, extension, or oversize returns 422 `validation_error`. Audit records `guest_stay.payment_evidence_uploaded` and `guest_stay.payment_evidence_cleared`. |
| Failure cases | E2E; failure cases are covered by the expected response. |
| Artifact | `backend/app/residents/guests/tests/artifacts/guest-payment-evidence.json` |

### `gate-scans` Hall-pass scan and recent gate activity

| Field | Content |
|---|---|
| Test | `backend/app/staff/gate/tests/test_scans.py` |
| Purpose | Gate (or warden/provost) scans a hall pass to record an ordinary exit or return (discriminated envelope: exit nests `outing` with `recorded_at` and `lateness`, and no `return_timeliness`; return nests `return_record` with `return_timeliness` `on_time`|`within_grace`|`late` plus `recorded_at`/…; no envelope `recorded_at`), refuses unknown passes and scans with no usable plan, refuses a second scan inside the duplicate window, and lists recent exit/return activity newest first. Tied lines keep one order so a later page does not repeat or skip. |
| Actor | Gate staff. Warden may read activity. Resident is refused on scan. |
| Preconditions | The hall from `hall-created` exists. Clock starts at 2026-09-30T12:00:00Z (inside summer ordinary hours). Aisha Khan is an active resident with hall-pass `bsj:v1:test-resident-hall-pass`, inside. Fatima Khan is gate staff. Sara Malik is warden. |
| Action | `POST /api/v1/gate/scans` and `GET /api/v1/gate/activity` with no token, as Aisha, as Fatima (unknown QR; no plan; plan then exit with bare token; duplicate; return after 60s), then activity as Fatima and Sara. |
| Expected response | No token returns 401. Resident returns 403. Unknown QR returns 404 `unknown_hall_pass`. No plan returns 409 `no_outing_planned` with name/room details. Exit returns 200 `exit_recorded` with envelope keys only `outcome`, `full_name`, `room_label`, `message`, plus nested `outing` (movement fields including `outing_type` and `lateness` `on_time`, and `recorded_at`; no bare `type`, no `is_late`, and no `return_timeliness`); no top-level `recorded_at`/`return_record`. Immediate rescan returns 409 `duplicate_scan`. After the window (return at 12:01Z, expected 12:30Z, grace 13:00Z), return returns 200 `return_recorded` with nested `return_record` (`recorded_at`, `return_timeliness` `on_time`, `returned_at`, `return_recorded_by_name`; no booleans and no `status`); no `outing`. Activity total 2 with events return then exit. Each resident activity line has `resident_name` and `room_label` set and `guest_name`, `host_name`, and `host_room_label` null. Warden can read activity. Audit gains `outing.exit` and `outing.return`. A permission exit that would end when another outing ends returns 409 `return_already_planned` and inserts no outside outing. Two exits at the same instant for two residents with the same name stay in outing-id order: limit 1 returns the lower id's `room_label` first, and the next page returns the other room. |
| Failure cases | E2E; failure cases are covered by the expected response. |
| Artifact | `backend/app/staff/gate/tests/artifacts/gate-scans.json` |









### `gate-guests` Gate guest list, arrival, and departure

| Field | Content |
|---|---|
| Test | `backend/app/staff/gate/tests/test_guests.py` |
| Purpose | Gate (or warden/provost) lists guests expected today or currently in the hall on a timing-based bucket, optionally filters by `payment_status` (`paid` or `unpaid`; omit returns every guest in the bucket), records arrival when the stay is approved, paid, and within dates, and records departure for a guest still dining (including after the end date). Arrival and departure flashes return `recorded_by` (staff display name) and a movement time (`arrival_time` / `departure_time`) that must equal `recorded_at`. |
| Actor | Gate staff. Warden may list. Resident is refused. |
| Preconditions | The hall from `hall-created` exists. Clock frozen at 2026-09-30T12:00:00Z. Fatima Khan is gate staff. Sara Malik is warden. Aisha Khan and Maryam Siddiqui are residents with rooms. Seeded stays: expected paid today, in-hall, should-have-left dining, unpaid within stay, and upcoming paid. |
| Action | `GET /api/v1/gate/guests?bucket=expected|in_hall` with and without `payment_status=paid|unpaid`, `POST /api/v1/gate/guests/{id}/arrival`, `POST /api/v1/gate/guests/{id}/departure` with no token, as Aisha, as Fatima (list both buckets; paid/unpaid/omit filters on expected; refuse unpaid/upcoming/already-in-hall arrival; arrive expected; refuse double arrival; refuse departure for not-in-hall; depart should-have-left), then list as Sara. Empty POST bodies; no client-supplied times. |
| Expected response | No token returns 401. Resident returns 403. Omit on expected matches artifact ids (paid and unpaid within stay). `payment_status=paid` returns only paid; `payment_status=unpaid` returns only unpaid. In-hall list includes dining and should-have-left ordered by start date. Unpaid arrival returns 409 `payment_required`. Upcoming or already-arrived returns 409 `guest_not_expected`. Successful arrival matches artifact message and the response does not include `guests_in_hall_count`. `recorded_by` is Fatima Khan; `arrival_time` equals `recorded_at`; body has no `departure_time`. Activity then includes a `guest_arrival` line with `guest_name`, `host_name`, and `host_room_label` set and `resident_name` and `room_label` null. Departure of overstay returns artifact message and the response does not include `guests_in_hall_count`. `recorded_by` is Fatima Khan; `departure_time` equals `recorded_at`; body has no `arrival_time`; status becomes `departed`. Audit gains `guest_stay.arrived` then `guest_stay.departed`. |
| Failure cases | E2E; failure cases are covered by the expected response. |
| Artifact | `backend/app/staff/gate/tests/artifacts/gate-guests.json` |




### `gate-occupancy` Guest dining occupancy at the gate

| Field | Content |
|---|---|
| Test | `backend/app/staff/gate/tests/test_occupancy.py` |
| Purpose | Gate (or warden/provost) reads hall-wide guest dining occupancy: guests still in the hall, and the subset who should already have left, without calling arrival/departure or the full register summary. |
| Actor | Gate staff. Warden may read. Resident is refused. |
| Preconditions | The hall from `hall-created` exists. Clock frozen at 2026-09-30T12:00:00Z. Fatima Khan is gate staff. Sara Malik is warden. Aisha Khan and Maryam Siddiqui are residents with rooms. Seeded stays: in-hall within dates, should-have-left dining, expected (not arrived), unpaid, and departed. |
| Action | `GET /api/v1/gate/occupancy` with no token, as Aisha, as Fatima, then as Sara. |
| Expected response | No token returns 401. Resident returns 403. Gate and warden return 200 with `guests_in_hall_count` 2 and `guests_should_have_left_count` 1 matching the artifact. |
| Failure cases | E2E; failure cases are covered by the expected response. |
| Artifact | `backend/app/staff/gate/tests/artifacts/gate-occupancy.json` |


### `admin-settings` Hall settings read and update

| Field | Content |
|---|---|
| Test | `backend/app/staff/office/tests/test_settings.py` |
| Purpose | Provost reads the single hall settings record and patches only the fields that change. Ordinary outing windows use `summer_outing_*` / `winter_outing_*`. Permission leave window uses `permission_lead_minutes`. Grace changes do not rewrite existing outing grace ends. Outing end must stay after start; season starts must differ. Timezone is not patchable. SMS templates are not on this resource. |
| Actor | Provost. Warden and resident are refused. |
| Preconditions | The hall from `hall-created` exists (default settings). Clock frozen at 2026-09-30T12:00:00Z. Halima Begum is provost. Sara Malik is warden. Aisha Khan is a resident. |
| Action | `GET` and `PATCH /api/v1/admin/settings` with no token, as Aisha, as Sara, as Halima (read defaults with new outing/lead field names and without SMS fields or old `*_hours_*` / `permission_early_minutes` names; patch grace and guest lead; refuse bad outing end, equal seasons, timezone field; empty body; confirm grace change leaves an existing outing `grace_ends_at` untouched). |
| Expected response | No token returns 401. Resident and warden return 403. GET matches artifact defaults (outing_* and permission_lead_minutes present; hours_* / permission_early_minutes / late_sms_template / return_sms_template absent). Successful PATCH returns updated HallSettings and audit `settings.updated`. Invalid outing windows/seasons return 422 `validation_error`. Extra `timezone` returns 422. Empty patch returns current settings with no new audit. |
| Failure cases | E2E; failure cases are covered by the expected response. |
| Artifact | `backend/app/staff/office/tests/artifacts/admin-settings.json` |

### `admin-notifications` Hall notification templates read and update

| Field | Content |
|---|---|
| Test | `backend/app/staff/office/tests/test_notifications.py` |
| Purpose | Provost-only GET/PATCH of late and return SMS templates. Same permission gate as hall settings. Templates must keep the placeholders listed on HallNotifications. |
| Actor | Provost. Resident, warden, and gate are refused. |
| Preconditions | The hall from `hall-created` exists (default templates). Clock frozen at 2026-09-30T12:00:00Z. Halima Begum is provost. Sara Malik is warden. Fatima Khan is gate. Aisha Khan is a resident. |
| Action | `GET` and `PATCH /api/v1/admin/notifications` with no token, as Aisha, as Sara, as Fatima, as Halima (read defaults; refuse template missing a placeholder; empty body; successful patch of late template). |
| Expected response | No token returns 401. Resident, warden, and gate return 403. Provost GET matches artifact defaults. Invalid template returns 422 `validation_error` with field `late_sms_template`. Successful PATCH returns updated HallNotifications and audit `settings.updated` (templates still live on the hall settings row). Empty patch returns current templates with no new audit. |
| Failure cases | E2E; failure cases are covered by the expected response. |
| Artifact | `backend/app/staff/office/tests/artifacts/admin-notifications.json` |



### `admin-blocks` List, create, and update blocks

| Field | Content |
|---|---|
| Test | `backend/app/staff/office/tests/test_blocks.py` |
| Purpose | Provost lists all blocks (including inactive), creates a block with a unique code, and patches name/floors/room_count/beds_per_room/status. Duplicate codes are refused. Code is not patchable. Deactivating leaves rooms in place. JSON null on a field that cannot be cleared is refused. JSON null on floors still clears floors. |
| Actor | Provost. Warden and resident are refused. |
| Preconditions | The hall from `hall-created` exists (five published blocks). Clock frozen at 2026-09-30T12:00:00Z. Halima Begum is provost. Sara Malik is warden. Aisha Khan is a resident with room B-204 in Block-B. |
| Action | `GET/POST /api/v1/admin/blocks` and `PATCH /api/v1/admin/blocks/{block_id}` with no token, as Aisha, as Sara, as Halima (list seed order; create Block-E; refuse duplicate code case-insensitively; patch name and deactivate B; confirm room B-204 remains; unknown id 404). As Halima, patch Block-B with null `status`, null `name`, and null `room_count`, then with null `floors`. |
| Expected response | No token returns 401. Resident and warden return 403. List matches artifact seed codes. Create returns 201 with `status` `active` and audit `block.created`. Duplicate returns 409 `duplicate_block`. Patch returns 200 and audit `block.updated`. Deactivated block stays on the list. Null `status`, `name`, or `room_count` returns 422 `validation_error` and Block-B stays active with its name and room count. Null `floors` returns 200 and floors is null. |
| Failure cases | E2E; failure cases are covered by the expected response. |
| Artifact | `backend/app/staff/office/tests/artifacts/admin-blocks.json` |



### `admin-rooms` List, create, and update rooms

| Field | Content |
|---|---|
| Test | `backend/app/staff/office/tests/test_rooms.py` |
| Purpose | Provost lists rooms (optional `block_id` filter), creates a room with label `{block code}-{number}` and bed_count from the block, and patches number/bed_count/status. Duplicate door numbers in a block are refused. A room with residents cannot be deactivated. |
| Actor | Provost. Warden and resident are refused. |
| Preconditions | The hall from `hall-created` exists. Clock frozen at 2026-09-30T12:00:00Z. Halima Begum is provost. Sara Malik is warden. Aisha Khan is a resident in B-204 (Block-B). |
| Action | `GET/POST /api/v1/admin/rooms` and `PATCH /api/v1/admin/rooms/{room_id}` with no token, as Aisha, as Sara, as Halima (list by block; create B-205 preserving leading zeros on another number; refuse duplicate 204; rename empty room number; refuse deactivate occupied; deactivate empty; unknown id 404). |
| Expected response | No token returns 401. Resident and warden return 403. Create returns 201 with label and beds from block, audit `room.created`. Duplicate returns 409 `duplicate_room`. Occupied deactivate returns 409 `room_in_use`. Successful patches audit `room.updated` and rewrite label when number changes. Null `status`, `number`, or `bed_count` returns 422 and leaves the room active with its number; an unknown block on create returns 404 `not_found`. |
| Failure cases | E2E; failure cases are covered by the expected response. |
| Artifact | `backend/app/staff/office/tests/artifacts/admin-rooms.json` |



### `admin-destinations` List, create, and update destinations

| Field | Content |
|---|---|
| Test | `backend/app/staff/office/tests/test_destinations.py` |
| Purpose | Provost lists all destinations (including inactive), named places alphabetical with Other last; creates a destination; patches name/source/status. Duplicate names and a second active Other are refused. A null update field is refused and does not change the row. Deactivating does not rewrite outing places. |
| Actor | Provost. Warden and resident are refused. |
| Preconditions | The hall from `hall-created` exists (five seeded destinations). Clock frozen at 2026-09-30T12:00:00Z. Halima Begum is provost. Sara Malik is warden. Aisha Khan is a resident. |
| Action | `GET/POST /api/v1/admin/destinations` and `PATCH /api/v1/admin/destinations/{id}` with no token, as Aisha, as Sara, as Halima (list seed order; create City Clinic; refuse duplicate name; refuse second active Other; deactivate a named place; reactivate; set `source` `custom` on a row while Other is active → other_exists; unknown id 404). `PATCH` the active Other row with JSON null for `name`, `status`, and `source`. |
| Expected response | No token returns 401. Resident and warden return 403. List matches artifact seed names with Other last. Create returns 201 and audit `destination.created`. Duplicate returns 409 `duplicate_destination`. Second Other returns 409 `other_exists`. Patches audit `destination.updated`. Each null field returns 422 `validation_error` and the following list still shows that row active, named Other, with `source` `custom`. |
| Failure cases | E2E; failure cases are covered by the expected response. |
| Artifact | `backend/app/staff/office/tests/artifacts/admin-destinations.json` |



### `admin-residents` Resident accounts and hall-pass reissue

| Field | Content |
|---|---|
| Test | `backend/app/staff/office/tests/test_residents.py` |
| Purpose | Provost lists resident accounts (including suspended, no QR), creates a resident with a one-time hall pass and temporary password, reads and patches an account (enrolment changes username; course and phone may clear; suspend revokes sessions), and reissues a hall pass once. A null name is refused. A resident is placed only in an active room. The resident's own `phone` is required on create (E.164); patch may still clear it to null. |
| Actor | Provost. Warden and resident are refused. |
| Preconditions | The hall from `hall-created` exists. Clock frozen at 2026-09-30T12:00:00Z. Halima Begum is provost. Sara Malik is warden. Aisha Khan is an active resident in B-204 with no own phone yet. Room B-205 exists empty in Block-B. The retired-room check marks B-205 inactive. |
| Action | `GET/POST /api/v1/admin/residents`, `GET/PATCH /api/v1/admin/residents/{id}`, `POST .../hall-pass/reissue` with no token, as Aisha, as Sara, as Halima (list/search; create Maryam in B-205 with required `phone`; refuse create without `phone`; refuse duplicate enrolment; get without QR; patch course/room/enrolment/phone; suspend and confirm refresh revoked; reinstate; reissue QR; unknown id 404). Separately, as Halima, refuse a null full name, clear course, clear phone, and refuse create and a room move onto retired B-205. |
| Expected response | No token returns 401. Non-provost returns 403. Create returns 201 with account+hall_pass (`bsj:v1:`) and the submitted `phone`. Create without `phone` returns 422 `validation_error`. List/get echo `phone` (null when unset on legacy rows). Duplicate returns 409 `duplicate_username`. GET/list omit QR. Suspend audits `resident.suspended` and revokes sessions. Reissue returns new HallPass and audits `hall_pass.reissued`; old token stops matching. A null full name returns 422 `validation_error` and the stored name stays Aisha Khan. Clearing course or phone returns 200 with that field null. Create or a room move onto the retired room returns 409 `room_inactive` and the resident stays in B-204. |
| Failure cases | E2E; failure cases are covered by the expected response. |
| Artifact | `backend/app/staff/office/tests/artifacts/admin-residents.json` |



### `admin-staff` Staff account list, create, and update

| Field | Content |
|---|---|
| Test | `backend/app/staff/office/tests/test_staff.py` |
| Purpose | Provost lists gate/warden/provost accounts, creates a staff account with a temporary password that is not returned, and patches name/job title/status. Role is not patchable. Suspension revokes refresh tokens. |
| Actor | Provost. Warden and resident are refused. |
| Preconditions | The hall from `hall-created` exists. Clock frozen at 2026-09-30T12:00:00Z. Halima Begum is provost. Sara Malik is warden. Aisha Khan is a resident. |
| Action | `GET/POST /api/v1/admin/staff` and `PATCH /api/v1/admin/staff/{user_id}` with no token, as Aisha, as Sara, as Halima (list; create Imran gate; refuse duplicate username; refuse role in patch; suspend and confirm refresh revoked; reinstate; unknown id 404). |
| Expected response | No token returns 401. Non-provost returns 403. Create returns 201 StaffAccount without password and audit `staff.created`. Duplicate returns 409 `duplicate_username`. Suspend/update audits `staff.updated` and revokes sessions on suspension. |
| Failure cases | E2E; failure cases are covered by the expected response. |
| Artifact | `backend/app/staff/office/tests/artifacts/admin-staff.json` |



### `admin-password-reset` Reset a user password

| Field | Content |
|---|---|
| Test | `backend/app/staff/office/tests/test_password_reset.py` |
| Purpose | Provost sets a temporary password for a resident or staff account and revokes that user's refresh tokens. The new password is not returned. |
| Actor | Provost. Warden and resident are refused. |
| Preconditions | The hall from `hall-created` exists. Clock frozen at 2026-09-30T12:00:00Z. Halima Begum is provost. Sara Malik is warden. Aisha Khan is a resident. |
| Action | `POST /api/v1/admin/users/{user_id}/password` with no token, as Aisha, as Sara, as Halima (reset Aisha; sign in with new password; old refresh fails; short password 422; unknown id 404; reset Sara). |
| Expected response | No token returns 401. Non-provost returns 403. Success returns 204. Short temporary password returns 422. Unknown user returns 404. |
| Failure cases | E2E; failure cases are covered by the expected response. |
| Artifact | `backend/app/staff/office/tests/artifacts/admin-password-reset.json` |



### `admin-audit` Audit log

| Field | Content |
|---|---|
| Test | `backend/app/staff/office/tests/test_audit.py` |
| Purpose | Provost reads the audit log newest first, with optional entity_type and entity_id filters. Responses omit detail. |
| Actor | Provost. Warden and resident are refused. |
| Preconditions | The hall from `hall-created` exists. Clock frozen at 2026-09-30T12:00:00Z. Halima Begum is provost. Sara Malik is warden. Aisha Khan is a resident. Seeded audit rows for auth.login and settings.updated. |
| Action | `GET /api/v1/admin/audit` with no token, as Aisha, as Sara, as Halima (list newest first; filter by entity_type; filter by entity_id; pagination). |
| Expected response | No token returns 401. Non-provost returns 403. List matches artifact order and fields; `detail` absent from JSON. |
| Failure cases | E2E; failure cases are covered by the expected response. |
| Artifact | `backend/app/staff/office/tests/artifacts/admin-audit.json` |



### `admin-sms` SMS log

| Field | Content |
|---|---|
| Test | `backend/app/staff/office/tests/test_sms.py` |
| Purpose | Provost reads guardian SMS notices newest first (late and return). |
| Actor | Provost. Warden and resident are refused. |
| Preconditions | The hall from `hall-created` exists. Clock frozen at 2026-09-30T12:00:00Z. Halima Begum is provost. Seeded late and return guardian messages for Aisha. |
| Action | `GET /api/v1/admin/sms` with no token, as Aisha, as Sara, as Halima (list newest first; pagination). |
| Expected response | No token returns 401. Non-provost returns 403. List matches artifact notice types and resident_name. Items omit transport `driver`. |
| Failure cases | E2E; failure cases are covered by the expected response. |
| Artifact | `backend/app/staff/office/tests/artifacts/admin-sms.json` |


### `admin-register-export` Register CSV export

| Field | Content |
|---|---|
| Test | `backend/app/staff/office/tests/test_register_export.py` |
| Purpose | Provost downloads one UTF-8 CSV of active residents and guest stays with the contract header. A cell a spreadsheet would treat as a formula is prefixed with a single quote. |
| Actor | Provost. Warden and resident are refused. |
| Preconditions | The hall from `hall-created` exists. Clock frozen at 2026-09-30T13:00:00Z. Halima Begum is provost. Aisha is outside past grace (late), guardian phone +919876543210. One approved paid guest stay in hall. A second export uses a place and a guest name that start with `=`. |
| Action | `GET /api/v1/admin/register/export` with no token, as Aisha, as Sara, as Halima. |
| Expected response | No token returns 401. Non-provost returns 403. CSV `text/csv` with artifact header; resident then guest rows; empty cells where a field does not apply. The guardian phone cell starts with a single quote then +91. A place or guest name that starts with `=` is prefixed the same way. Ordinary text and the header are unchanged. |
| Failure cases | E2E; failure cases are covered by the expected response. |
| Artifact | `backend/app/staff/office/tests/artifacts/admin-register-export.csv` |


