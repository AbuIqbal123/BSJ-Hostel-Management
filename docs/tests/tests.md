# Test catalog

Document version: **1**

Status: seventy-three recorded tests. A resident can self-onboard at `POST /api/v1/auth/onboard` and sign in immediately. The onboard form always lists resident blocks A–D at `GET /api/v1/auth/onboard/options`, with active rooms that still have a free bed from the seeded inventory. Startup creates the hall. Startup refuses a router route that `backend/openapi.yaml` does not list. Mock late and return guardian notices are recorded on register read and return scan. Shared clock helpers parse a UTC instant and the hall calendar date. The signing key must be at least 32 bytes. Sign-in keeps a session. Sign-in is limited per client address and per username, and refresh attempts are rate-limited. A missing account and a wrong password share that generic refusal. A development command adds local accounts. Resident home reads the resident's own screen, including her planned future ordinary outings. She can change a planned ordinary outing until its show window opens. The destination list shows the active ordinary-outing choices, with Other last. A resident can plan an ordinary outing before the gate scan. She can read the outing that is still planned or outside. She can cancel that plan before the gate scan. A warden or the provost can read the register presence board: hall and block counts, the resident list with filters, one resident's record, and the late list. A resident can submit, list, read, change while pending, and cancel late-night and home-going permissions. A late-night return is the same hall day, or 12:00 AM the next hall day. A warden or the provost can read the permission queue and decide a pending request. The staff permission queue sorts by created_at (newest default) and accepts optional filters for block, permission_type, and created_at date range. A warden or the provost can read current and past late returns, read and mark read a staff inbox derived from requests and late outings, and search permissions and guest stays by name or room. A resident can read her own finished and unused history, one row per outing, permission, or guest stay, filtered by kind and by `on`, or by `from` and `to`, on the Asia/Kolkata hall calendar. A resident can read her hall-pass QR only inside the window of the outing she can use now (ordinary, late-night, or home-going). The gate scan and the hall pass use the same rule, the gate refuses an ordinary exit before 30 minutes ahead of its start, and a warden cannot approve a permission that overlaps another approved one. A resident can apply for, list, read, edit, and cancel her own guest stays. A warden or the provost can list guest stays by bucket (terminal cancelled/rejected omitted by default; `include_terminal=true` opts them back in), decide a pending stay, mark payment before arrival, and optionally upload payment evidence. Gate staff can scan a hall pass to record an exit or return, and read recent gate activity (resident lines use `resident_name` and `room_label`; guest lines use `guest_name`, `host_name`, and `host_room_label`). Gate staff can list expected and in-hall guests (optional `payment_status` filter, `limit`, `offset`, and `q`) and record guest arrival and departure (response includes `recorded_by` and `arrival_time`/`departure_time` equal to `recorded_at`, and does not include `guests_in_hall_count`). Gate staff can read guest dining occupancy counts for the gate home strip. The provost can read and update hall settings. The provost can read and update hall notification SMS templates. The provost can list, create, and update blocks. The provost can list, create, and update rooms. The provost can list, create, and update destinations. The provost can list, create, and update residents, with the own phone required on create, and reissue a hall pass. The provost can list, create, and update staff accounts. The provost can reset a user password. The provost can read the audit log. The provost can read the SMS log. The provost can export the register as CSV. A duplicate create returns its conflict message, not a 500, on plain SQLite and on Turso.

Each test has an entry here and a file next to the business area it covers. Write the failing check for one behavior, see it fail, then make it pass. Update the entry in that same change. The entry names the test file. It does not copy every payload when the test already states them. A migration is not part of this loop unless the stored records change.

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
| Preconditions | The database file is absent. No people, permissions, outings, guest stays, guardian messages, or audit entries exist. Resident-block rooms are created by the hall migration. |
| Action | Start the service on that empty file. `GET /health` with no payload. Start the service a second time on the same file. `GET /health` again. |
| Expected response | Both calls return 200 and `{"status":"ok"}`. The body contains no hall data. The file then matches the artifact: schema version 1, one settings record (summer 6:30 AM–6:30 PM from 1 April, winter 6:30 AM–5:30 PM from 1 October, grace 30 minutes), five blocks with the published room counts, resident-block rooms A-1…A-50, B-1…B-58, C-1…C-42, and D-1…D-40 (Utility has no rooms), and the destinations in alphabetical order with Other as the only free-text choice. The other tables exist and are empty. The second start does not add another copy. |
| Failure cases | E2E; failure cases are covered by the expected response. |
| Artifact | `backend/tests/artifacts/hall-inventory.json` |

### `guardian-sms` Mock late and return notices

| Field | Content |
|---|---|
| Test | `backend/app/shared/tests/test_guardian_sms.py` |
| Purpose | When grace has ended and the resident is still outside, reading the register records a mock late notice. A return scan records the late notice as well when the register was not opened, then records a mock return notice. Bodies keep `{hall_name}`. |
| Actor | Warden (register), then gate staff (return scan). A return with no register read is gate staff only. |
| Preconditions | Hall exists. One resident is outside past grace with no guardian messages yet. SMS driver is mock. |
| Action | `GET /api/v1/register/late` as warden. Then `POST /api/v1/gate/scans` with that resident's hall pass as gate. Separately, the same outside resident is returned by the gate with no register read first. |
| Expected response | Late list succeeds. One `late_notice` row is `sent` via `mock` and names the hall. Return scan records return with `return_record.return_timeliness` `late` (returned at 12:30Z, expected 11:30Z, grace ended 12:00Z). One `return_notice` is `sent` via `mock`. Audit has `sms.late_notice` and `sms.return_notice`. A return with no register read still stores both notices as `sent`. A second insert of the same notice leaves the outing `returned`, keeps one message, and writes one audit entry. |
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
| Failure cases | A missing file, a directory, a file that is not a database, or a database timeout returns 503 `not_ready` and says the hall database could not be opened. The timeout text is not in the response. The missing file and its parent directory stay absent. The text file is left unchanged. |
| Artifact | none |

### `production-safety` Production docs and unsafe hosting

| Field | Content |
|---|---|
| Test | `backend/tests/test_production_safety.py` |
| Purpose | Production hides `/docs`, `/redoc`, and `/openapi.json` unless docs are turned on, and the process refuses to start with debug on, a wildcard CORS origin, a known signing key, a zero Turso timeout, a local database path on Render, or a file URL. |
| Actor | System job. Service startup and a browser opening the contract pages. |
| Preconditions | The hall from startup exists for the docs check. Settings are switched to production with a non-default signing key. A separate check uses the test signing key, debug, a wildcard origin, Render, a database path, and a file URL. |
| Action | `GET /docs` in development, then the same call and `GET /redoc` and `GET /openapi.json` in production, then `GET /health`, then `GET /docs` with docs enabled. Load settings for each unsafe combination. Post one Turso request through the timeout wrapper. |
| Expected response | Development `/docs` is 200. Production docs paths are 404 `not_found` in the shared JSON shape, with the request id echoed, and `/health` stays 200. Turning docs on restores `/docs`. A zero timeout, debug, a wildcard, the test signing key, `DATABASE_PATH` on Render, and a file URL each raise before the process serves traffic. A Turso post uses the configured timeout and turns a timeout into a protocol error. |
| Failure cases | E2E for the docs pages. The startup refusals are isolated because the process must not start. |
| Artifact | none |

### `hosted-database` Hosted hall database is Turso

| Field | Content |
|---|---|
| Test | `backend/tests/test_hosted_database.py` |
| Purpose | The hosted API keeps the hall database on Turso. A production process does not create or open a SQLite file. |
| Actor | System job. Service startup and `GET /ready`. |
| Preconditions | `ENVIRONMENT` is `production`. A database path is set for the refusal, then cleared for the Turso open. No Turso credentials are present until a check sets them. The Turso client is replaced so the check does not reach the network. |
| Action | On Render, open a connection with no Turso credentials, with a `file:` URL, and with a Turso URL and token. Start the service with startup skipped, then `GET /health` and `GET /ready` while Turso cannot be opened. On a laptop, set Turso credentials and open a connection. Read the migration files. |
| Expected response | On Render, missing credentials raise and name Turso. A file URL raises and names a database file. A Turso URL opens that URL with the token, turns foreign keys on, and does not set a journal mode. Ready returns 503 `not_ready` and says the hall database could not be opened. The database path is not created. Health still returns 200 `{"status":"ok"}`. A laptop with Turso credentials opens the SQLite file and does not call Turso. No migration file assigns `PRAGMA user_version`. |
| Failure cases | E2E; failure cases are covered by the expected response. |
| Artifact | none |

### `shared-clock` Hall clock helpers

| Field | Content |
|---|---|
| Test | `backend/app/shared/tests/test_clock.py` |
| Purpose | A UTC instant parses only as `YYYY-MM-DDTHH:MM:SSZ`. A request instant in any other form is refused with the API error. The hall date and the 12-hour hall time are that instant in Asia/Kolkata, the zone that `hall_settings` pins. |
| Actor | None. These are the shared clock helpers. |
| Preconditions | None. |
| Action | Parse `2026-09-30T13:00:00Z`. Parse `2026-09-30T13:00:00+00:00`. Read `2026-09-30T13:00:00Z`, `2026-09-30T13:00:00+00:00`, and `2026-9-30T13:00:00Z` as request instants for `departure_at`. Ask for the hall date of `2026-09-30T18:30:00Z`, and the hall time of `18:30Z` and `13:00Z`. |
| Expected response | The Z instant round-trips through `format_instant`. The offset form raises `ValueError`. The Z request instant is read. `18:30Z` is `2026-10-01` in Asia/Kolkata, at `12:00 AM`. `13:00Z` is `6:30 PM`. |
| Failure cases | The offset form raises `ValueError`. As a request instant, the offset form and the unpadded date are 422 `validation_error` "Use a UTC instant, such as 2026-09-30T13:00:00Z." on `departure_at`. |
| Artifact | none |

### `contract-guard` Startup refuses an undocumented router route

| Field | Content |
|---|---|
| Test | `backend/tests/test_contract_guard.py` |
| Purpose | Every route registered in `backend/app`, including routes on included routers, must be a path in `backend/openapi.yaml`. |
| Actor | System job. Service startup. |
| Preconditions | The contract is loaded with `/api/v1/auth/login` removed. The auth router still serves that path. |
| Action | Start the service. |
| Expected response | Startup raises and names `/api/v1/auth/login` as missing from `openapi.yaml`. |
| Failure cases | E2E; failure cases are covered by the expected response. |
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
| Action | At 00:01, `POST /api/v1/auth/login` with a wrong password, an unknown username, the suspended account's password, and a body that omits the password. Then sign in as `GATE.FATIMA`. `GET /api/v1/auth/me` with that access token, with no token, and with a token that is not a session. At 00:02, `POST /api/v1/auth/refresh` with the refresh token, then again with the token just replaced. At 00:03, sign in a second time. At 00:04, `POST /api/v1/auth/logout`. Repeat both refresh tokens. At 00:05, sign in again. `POST /api/v1/auth/change-password` with the wrong current password, with a new password shorter than 10 characters, with a new password of at least 10 characters that misses a character class, and then with the current password and a new password of at least 10 characters that includes an uppercase letter, a lowercase letter, a number, and a symbol. Sign in with the old password. At 00:07, sign in with the new password. At 00:08, sign in as `24-gllb-118` and `GET /api/v1/auth/me`. At 00:09, sign in as the gate account again. Move the clock to 00:25 and call `GET /api/v1/auth/me` with the 00:07 access token. Move the clock to 2026-10-30T00:09:01Z and refresh the 00:09 token. |
| Expected response | Wrong, unknown, and suspended sign-in return 401 `unauthenticated`. An unknown username and a known username with the wrong password both say username or password is wrong. The suspended attempt (correct password) says the account is suspended and to contact the Hall Office. A missing password returns 422 `validation_error` on `password`. A successful sign-in returns 200 with `token_type` `bearer`, `expires_in` 900, an access token, a refresh token, and the user summary. The username in the response is the stored spelling. `GET /api/v1/auth/me` returns the gate job title or the resident room, and the other profile is null. A missing, unknown, expired, rotated, or signed-out token returns 401 `unauthenticated` and says to sign in again. Refresh returns a new pair and the presented refresh token then fails. Logout returns 204 and both live refresh tokens then fail. The access token from before logout still opens `GET /api/v1/auth/me` until its 15 minutes pass. A wrong current password returns 401. A short new password returns 422 on `new_password` and says to use at least 10 characters. A new password missing an uppercase letter, a lowercase letter, a number, or a symbol returns 422 on `new_password` and says to include an uppercase letter, a lowercase letter, a number, and a symbol. A successful change returns 204, the old password then fails, and the refresh token from before the change fails. The stored state matches the artifact: sessions and audit entries at the times above, no password and no session secret in the file, and the new password kept as Argon2id. |
| Failure cases | E2E; failure cases are covered by the expected response. |
| Artifact | `backend/app/shared/auth/tests/artifacts/auth-session.json` |

### `auth-commit` A failed save is not told as success

| Field | Content |
|---|---|
| Test | `backend/app/shared/auth/tests/test_session.py` |
| Purpose | A write is committed before the success status is sent. If that commit fails, the caller does not get success and the session stays live. |
| Actor | Gate staff. |
| Preconditions | The hall from `hall-created` exists. Fatima Khan can sign in. The commit for the logout request fails. |
| Action | Sign in as `gate.fatima`. `POST /api/v1/auth/logout` while the commit fails. |
| Expected response | Logout returns 500 and does not say she is signed out. Her session is still live. |
| Failure cases | E2E; failure cases are covered by the expected response. |
| Artifact | none |

### `auth-delete-account` A resident deletes her account

| Field | Content |
|---|---|
| Test | `backend/app/residents/tests/test_delete_account.py` |
| Purpose | A resident who created an account can delete it from the phone. The hall frees her room and she cannot sign in again. |
| Actor | A resident. A gate account is refused. |
| Preconditions | The hall from `hall-created` exists. Aisha Khan is an active resident on B-204. Fatima Khan is active gate staff. |
| Action | `POST /api/v1/me/account/delete` as Fatima, then as Aisha with the wrong password, then as Aisha with her password. Separately, while Aisha is outside. |
| Expected response | The gate account returns 403 `forbidden`. The wrong password returns 401 `unauthenticated` and says the current password is wrong. The correct password returns 204 with an empty body. Sign-in with `24-GLLB-118` then returns 401 and says username or password is wrong. Her stored name is `Deleted account`, her status is suspended, her username and enrolment start with `deleted-`, her phone is empty, her guardian name is `Deleted`, her hall pass changed, her old room has no resident, and she has no live session. While she is outside the same call returns 409 `account_in_use` and says to return to the hall first. The audit log records `resident.deleted`, not `auth.logout`. |
| Failure cases | E2E; failure cases are covered by the expected response. |
| Artifact | none |

### `auth-rate-limit` Sign-in and refresh attempt limit

| Field | Content |
|---|---|
| Test | `backend/app/shared/auth/tests/test_rate_limit.py` |
| Purpose | Repeated sign-in or refresh attempts from one client are refused with 429 so password guessing stays slow. The same limit applies per username, before the hall looks the account up, so a missing name and a real name get the same generic refusal and one username cannot lock out another. Behind the proxy, only the last `X-Forwarded-For` hop counts, so two real clients do not share a bucket and a faked earlier entry does not open a new one. |
| Actor | Anyone calling login or refresh. |
| Preconditions | The hall from `hall-created` exists. One active gate account exists. The in-process limit is set low for the check. |
| Action | Call `POST /api/v1/auth/login` with a wrong password until the limit is exceeded, then once more. Separately, after a successful sign-in, call `POST /api/v1/auth/refresh` with a bad token until the limit is exceeded, then once more. With `TRUST_FORWARDED_FOR=1`, from `127.0.0.1`, one client (`198.51.100.1, 203.0.113.10`) signs in with a wrong password up to a limit of 2, then retries with a faked first entry (`198.51.100.99, 203.0.113.10`). A second client (`203.0.113.20`) then tries once. With the address limit high and the username limit at 2, sign in twice as the same gate username in different case, then once more, then twice as a missing username and once more, then once as a different username. |
| Expected response | Calls within the limit return 401 `unauthenticated`. The next call returns 429 `rate_limited` and says too many attempts. The faked first entry is still 429. The second client is still 401. The third try for one username is 429 and the body does not contain that username. A missing username reaches the same 429 sentence. A different username is still 401. |
| Failure cases | E2E; failure cases are covered by the expected response. |
| Artifact | none |

### `auth-resident-onboard` Resident self-onboard

| Field | Content |
|---|---|
| Test | `backend/app/shared/auth/tests/test_onboard.py` |
| Purpose | A resident can self-onboard with full name, enrolment, password, own phone, guardian details, block, and room; the account is active immediately. When `ONBOARD_ENABLED` is false, signup and the enrolment check both ask her to go to the hall office and do not say whether the number is already an account. An office-created resident can still sign in. |
| Actor | Anyone (no token) for onboard and later resident sign-in. |
| Preconditions | Empty enrolment. An active room exists in the selected block. Clock frozen at 2026-09-30T12:00:00Z. |
| Action | `POST /api/v1/auth/onboard/enrolment` for a free number. `POST /api/v1/auth/onboard` with required fields and optional course; a body that omits phone; a password shorter than 10 characters; passwords of at least 10 characters that each miss one character class; a resident phone and a guardian phone that are not +91 followed by exactly 10 digits; a room that is not in the selected block; the same enrolment with different capitals. Check that enrolment again. Then sign in. Then repeat the taken enrolment until the sign-in attempt limit is exceeded. With the bed check forced to pass on a room that already holds two residents, submit again. |
| Expected response | A free enrolment check returns 204 and no body. Onboard returns 201 with `enrolment_number`, `status` `active`, and the ready message, and no tokens. The stored resident is active, inside, on that room, with a hall pass that is not in the artifact. A missing phone and a short password return 422 `validation_error`. A password missing a character class returns 422 `validation_error` on `password` and says to include an uppercase letter, a lowercase letter, a number, and a symbol. A resident phone or guardian phone that is not an Indian mobile (+91 and exactly 10 digits) returns 422 `validation_error` on that field and says to use an Indian mobile: +91 and exactly 10 digits. A room outside the block returns 422 `validation_error`. A taken enrolment, ignoring capitals, returns 422 `validation_error` on `enrolment_number` and says that enrolment number is already an account. It does not say username or password is wrong. The same sentence is returned by `POST /api/v1/auth/onboard/enrolment` before signup is finished, and by `POST /api/v1/auth/onboard` if that number is sent anyway. Sign-in returns 200 tokens immediately. After the attempt limit, the next onboard returns 429 `rate_limited`. One `auth.onboard` audit entry names the new resident as actor and entity. When the room is already full and the earlier bed check is forced to pass, signup returns 422 `validation_error` on `room_id` and says the room already has as many residents as it has beds. The two residents already in the room stay; a third row is not stored. With `ONBOARD_ENABLED` false, a new enrolment and an existing enrolment both return 403 `onboard_closed` and the same sentence, on signup and on the enrolment check. No account is added. The existing resident can sign in. Turning the switch back on lets a free enrolment check return 204. |
| Failure cases | E2E; failure cases are covered by the expected response. |
| Artifact | `backend/app/shared/auth/tests/artifacts/auth-resident-onboard.json` |

### `auth-onboard-options` Onboard room picker

| Field | Content |
|---|---|
| Test | `backend/app/shared/auth/tests/test_onboard_options.py` |
| Purpose | The onboard form always lists resident blocks A–D and the active rooms that still have a free bed, without a token and without office fields. |
| Actor | Anyone (no token). |
| Preconditions | The hall from `hall-created` exists, including seeded rooms A-1…A-50, B-1…B-58, C-1…C-42, and D-1…D-40. Utility has no rooms. |
| Action | `GET /api/v1/auth/onboard/options` with no token on the fresh inventory. Deactivate A-1, assign one resident to B-1 (two beds), and fill every bed in Block-C. Call options again. Repeat until the sign-in attempt limit is exceeded. On a fresh hall, put one resident in A-2, then a second, then one resident in A-3 after setting that room to one bed. |
| Expected response | 200 list matching the artifact. The four blocks A–D are always present in code order; Utility is absent. Fresh inventory lists every seeded room as `id` and `label` only, ordered by door number. After the mutations, A-1 is omitted, B-1 stays because one bed is free, Block-C has an empty `rooms` array, and Block-D is unchanged. No office fields. The call past its own attempt limit returns 429 `rate_limited`, and the sign-in budget is untouched: an enrolment check right after still returns 204. One resident in a 2-bed room leaves the room listed. A second resident hides it. One resident in a 1-bed room hides it. |
| Failure cases | E2E; failure cases are covered by the expected response. |
| Artifact | `backend/app/shared/auth/tests/artifacts/auth-onboard-options.json` |


### `dev-accounts` Local sign-in accounts

| Field | Content |
|---|---|
| Test | `backend/tests/test_dev_seed.py` |
| Purpose | A development command adds the local sign-in accounts from settings (shell env or the untracked `backend/.env`) or one-time generated passwords. Starting the service does not add them, and the command does not replace an account that is already there unless `--reset-passwords` is passed. A password that came from settings is never printed. The seed source embeds no password literals, and the command refuses Render as well as non-development environments. |
| Actor | System job. The development seed command. |
| Preconditions | The database file may be absent. `ENVIRONMENT` is `development` for the accounts, then anything else for the refusal. The clock is frozen at 2026-09-30T00:00:00Z while the accounts are added. Resident blocks already have seeded rooms 1 through each published count; room B-204 is added by this command for the local resident. |
| Action | Assert the seed module source has no reconstructable password literals. Set per-role `BSJ_SEED_PASSWORD_*` values, run the seed, and check values written only to a temporary `.env` file are used (the shared `BSJ_SEED_PASSWORD` and a per-role override too), and that the report never contains them. With nothing configured, check generated passwords log in and appear once in the report; a second run reports "Left unchanged" and prints no password; `--reset-passwords` replaces them. `POST /api/v1/auth/login` as `gate.fatima` with the wrong password, as `nobody`, as `gate.suspended` with that account's password, then as `GATE.FATIMA`, `24-gllb-118`, `warden.sara`, and `provost.halima` with the env passwords. Run the seed again. Run the seed with `RENDER=true`, then with `ENVIRONMENT` set to `production`. |
| Expected response | The first run matches the artifact: room B-204, Fatima Khan (`gate.fatima`, Gatekeeper), Aisha Khan (`24-GLLB-118`, B.A. LL.B. (Hons.), guardian Rashid Khan at +919876543210, inside), Noor Ali (`gate.suspended`, suspended), Sara Malik (`warden.sara`, Warden), and Halima Begum (`provost.halima`, Provost). No password, hall-pass code, or session secret is in the artifact. The wrong password and an unknown username both return 401 and say username or password is wrong. The suspended account returns 401 and says the account is suspended and to contact the Hall Office. Each active account returns 200 with that account's stored username and role. The second run leaves the password, the last sign-in, the sessions, and the audit log as they were. On Render, and outside development, the command raises and does not create the database. The seed module source has no joined password helper and no pass string fragments used to build seed passwords. |
| Failure cases | E2E; failure cases are covered by the expected response. |
| Artifact | `backend/tests/artifacts/dev-accounts.json` |

### `first-provost` Create the first provost

| Field | Content |
|---|---|
| Test | `backend/tests/test_create_provost.py` |
| Purpose | An operator can create the first provost from a hidden password prompt. A second run does not change that password. The password is never an argument and is never printed. |
| Actor | System job / operator. |
| Preconditions | The hall from startup exists. No provost account exists yet. |
| Action | Call the script function with a strong password, then again with a different username and password. Sign in as the provost. Run the script with `--password`, then run it with a hidden prompt twice. |
| Expected response | The first call creates one provost with job title Provost and that password. The second call reports that a provost exists and leaves the password unchanged. Sign-in returns 200 and role `provost`. `--password` exits without creating an account and without printing the password. The prompted run prints that the account was created and does not print the password. The next run prints that a provost already exists and does not ask again. |
| Failure cases | E2E for the created account. The refused argument is isolated because the password must not be accepted on the command line. |
| Artifact | none |

### `resident-home` What the resident sees on opening the phone

| Field | Content |
|---|---|
| Test | `backend/app/residents/home/tests/test_home.py` |
| Purpose | A resident opening the phone sees her name, block, and room, whether an ordinary outing is inside its show window, whether she is inside, the outing that is still planned or outside, her planned future ordinary outings, the newest permission she is waiting on or cleared to use, and her last ten exits and returns. |
| Actor | A resident. A gate account is refused. |
| Preconditions | The hall from `hall-created` exists. The clock is frozen at 2026-09-30T13:00:00Z. Aisha Khan is an active resident, username `24-GLLB-118`, room B-204, course B.A. LL.B. (Hons.), presence inside. Fatima Khan is active gate staff. No outing, permission, or history exists yet. |
| Action | `GET /api/v1/me/home` with no access token, then as Fatima Khan, then as Aisha Khan. Store an outside ordinary outing for Aisha whose grace ended at 12:30, five returned outings, a cancelled plan, a pending late-night permission, an older approved permission, a newer rejected permission, a newer completed permission, and another resident's open outing and pending permission. `GET /api/v1/me/home` again as Aisha. Set the open outing's grace end to 13:00:00Z and call again, then to 12:59:59Z and call again. Store a planned library outing whose window is already open, planned outings to Women's College and Shamshad Market on later days, and a planned outing whose expected return has passed. `GET /api/v1/me/home` again. |
| Expected response | No token returns 401 `unauthenticated` and says to sign in again. The gate account returns 403 `forbidden` and says this account cannot do that. Aisha's first call matches the `empty` object in the artifact: Aisha Khan, Begum Sultan Jahan Hall, room B-204, Block-B, inside, no requests yet, `ordinary_outing_active` false, no outing, no upcoming outing, no permission, and no history. The outside call reports four permissions requested, one rejected, and five ordinary returns. The second call matches `outside`: she is outside, `ordinary_outing_active` is true, the open outing is the library with `lateness` `late`, the active permission is the pending late-night request, and the history is the ten newest of her own exits and returns (`exited_at`/`returned_at`/`recorded_by` shape, no `occurred_at`). The other resident's records are absent. The cancelled plan is absent. At the grace instant `lateness` is `on_time`. One second after grace it is `late`. The call does not add an audit entry and does not change the outing. `upcoming_outings` on that outside screen is empty. After the later plans are stored, `upcoming_outings` is the library (window open, `can_modify` false), then Women's College (`can_modify` true), then Shamshad Market (`can_modify` true). The passed plan, the cancelled plan, the returned outings, and the outing she is outside on are not in that list. |
| Failure cases | E2E; failure cases are covered by the expected response. |
| Artifact | `backend/app/residents/home/tests/artifacts/resident-home.json` |

### `resident-notifications` Permission decision inbox

| Field | Content |
|---|---|
| Test | `backend/app/residents/notifications/tests/test_inbox.py` |
| Purpose | Approving or rejecting a permission writes one inbox row for that resident. She lists a page without marking them read. A separate call marks every unread row read and returns her unread count. Home shows whether any are unread. |
| Actor | Resident, and a warden who decides. |
| Preconditions | The hall from `hall-created` exists. The clock starts at 2026-09-30T13:00:00Z and advances one second between decisions. Aisha Khan and Zara Ahmed are active residents. Sara Malik is warden. |
| Action | `GET /api/v1/me/notifications` and `GET /api/v1/me/home` with no token, as Sara, as Aisha (empty), then after Sara approves Aisha's late-night permission, after Sara approves Zara's late-night permission, and after Sara rejects Aisha's home-going permission. Repeat the decision on the rejected permission. `POST /api/v1/me/notifications/read` as Aisha, then again. Store 51 newer unread rows for Aisha and list again, then mark read. |
| Expected response | No token returns 401 `unauthenticated`. Sara returns 403 `forbidden`. Aisha's empty list is `{"items":[],"next_cursor":null}` and home `notifications_unread` is false. After her late-night approval the list has one unread row and home is true; listing again leaves the row unread. Zara does not see Aisha's row. A second decision on the same permission returns 409 and does not add a row. After the rejection the list is newest first and matches the artifact, including each permission's departure, expected return, and the decider's name. Mark-read returns `{"marked":2,"unread_count":0}`; the next list is all read and home is false; a second mark returns `{"marked":0,"unread_count":0}`. Zara's home stays true. With `limit=50` the list returns 50 rows and a `next_cursor`, not the older decisions. Mark-read returns `{"marked":51,"unread_count":0}` and home is false. |
| Failure cases | E2E; failure cases are covered by the expected response. |
| Artifact | `backend/app/residents/notifications/tests/artifacts/resident-notifications.json` |

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
| Purpose | A resident saves a destination, a start, and an expected return before the gate scan. No warden approval. She may save several future outings, including two on the same hall day. She cannot start another while one ordinary outing is inside its show window. The call does not record the exit. The start and the expected return must be in the future, the return after the start, on the same hall day, and inside ordinary hours. The end of ordinary hours is included. The start of ordinary hours is not. A time after the window needs late-night permission or home going. A second plan for the same expected return is refused. Other stores the words she types and no list id. A planned outing whose expected return has already passed is cancelled by the system, with no staff member, and her other plans stay. |
| Actor | A resident. A gate account is refused. |
| Preconditions | The hall from `hall-created` exists. The clock is frozen at 2026-09-30T00:30:00Z, which is 6:00 AM in India. Aisha Khan is an active resident, username `24-GLLB-118`, inside, with no outing. Fatima Khan is active gate staff. Grace is 30 minutes. |
| Action | `POST /api/v1/me/outings` with no access token, then as Fatima Khan, then as Aisha Khan with a return that is not in the future, a return at 6:30 AM, a return one second after 6:30 PM, a return at 6:30 PM on 1 October, an unknown destination, and Other with no words. Also a start that is not in the future, a return that is not after the start, a start at 6:30 AM, and a start and return on different hall days. Mark Aisha outside and plan Shamshad Market for 4:00 PM on 2 October. Mark her inside, store a library plan whose expected return was 29 September, and plan the library at 6:30 PM with an extra text field. Plan Women's College for 12:00 PM the same day. Plan the library again for 6:30 PM. Read `GET /api/v1/me/outings` and `GET /api/v1/me/outings/current`. Clear the planned rows and plan Women's College for 5:30 PM on 1 October. Clear those rows and plan Other as City bookshop for 5:30 PM on 30 September. Then set grace to 60 minutes. With the clock at 7:30 AM, plan a library outing that starts in four minutes, refuse a second plan, and refuse cancelling the first. |
| Expected response | No token returns 401 `unauthenticated` and says to sign in again. The gate account returns 403 `forbidden` and says this account cannot do that. A return that is not in the future returns 422 `validation_error` and says the expected return must be in the future. 6:30 AM returns 409 `outside_ordinary_hours` and says that return is outside ordinary hours. One second after 6:30 PM, and 6:30 PM on 1 October, return 409 `permission_required` and say that return is outside ordinary hours. Please submit a permission request. An unknown destination returns 422 and says to choose a destination from the list. Other without words returns 422 and says destination text is required. A start that is not in the future returns 422 and says the outing start must be in the future. A return that is not after the start returns 422 and says the expected return must be after the start. A start at 6:30 AM returns 409 `outside_ordinary_hours` and says that start is outside ordinary hours. A start and return on different hall days returns 422 and says an ordinary outing starts and returns on the same hall day. While her presence is outside and no outing window is open, Shamshad Market on 2 October returns 201 and matches `ahead`. The library plan returns 201 and matches `library` in the artifact, apart from the new id. The passed plan is cancelled at 2026-09-30T00:30:00Z. The extra text is ignored. Women's College at 12:00 PM returns 201 and matches `same_day`. A second library plan for the same 6:30 PM returns 409 `return_already_planned` and says she already has an outing ending at that time. The plan list is paginated (`total`/`limit`/`offset`) and is Women's College, then the library, then Shamshad Market. The open outing is Women's College, because that is the soonest plan for today. The later plan today and the 2 October plan stay on the list. The winter plan matches `winter_end`. The Other plan matches `other`, and its stored destination id is empty. Each saved row stores `starts_at` and the hall day of its expected return. At 7:30 AM a start four minutes later returns 201 with `qr_visible` true. A second plan then returns 409 `outing_window_open`. Cancelling the outing whose window is open returns 409 `outing_window_open` and says she cannot change this outing while its window is open. That plan stays planned, and another plan is still refused. She is inside again after the outside plan, with the presence time restored by the test. Raising grace does not change the outing already saved. The audit log gains one system `outing.cancelled` for the passed plan and one `outing.planned` for each saved plan. |
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
| Purpose | A resident cancels one ordinary outing while it is still planned and its show window is shut. Another plan the same day, and a later day, stay. The exit is not recorded and she stays inside. A plan whose expected return has already passed is cancelled by the system first, so cancelling that id finds nothing planned. Once that outing's show window is open, cancel is refused. An outing that is already outside is closed by a return scan, not by this call. |
| Actor | A resident. A gate account is refused. |
| Preconditions | The hall from `hall-created` exists. The clock is frozen at 2026-09-30T08:00:00Z. Aisha Khan is an active resident, username `24-GLLB-118`, inside, with no outing. Fatima Khan is active gate staff. |
| Action | `POST /api/v1/me/outings/{outing_id}/cancel` with no access token, then as Fatima Khan, then as Aisha Khan for an id that is not on file. Store a library plan whose expected return was 29 September and cancel that id. Plan the library for 6:30 PM, Shamshad Market for 4:00 PM on 2 October, and Women's College for 4:00 PM the same day as the library. Cancel the library. Read the open outing and the plan list. Cancel the library again, then cancel Women's College, and read both again. Cancel Shamshad Market. Plan the library to start in four minutes, so its window is already open, and cancel that id. Store an outside outing to Shamshad Market, mark her outside, and cancel that id. |
| Expected response | No token returns 401 `unauthenticated` and says to sign in again. The gate account returns 403 `forbidden` and says this account cannot do that. An unknown id returns 404 `not_found` and says that record was not found. The passed plan is cancelled at 2026-09-30T08:00:00Z by an audit entry with no actor, and cancelling that id returns 409 `no_outing_planned` and says there is no planned outing. The library cancel returns 200 and matches `cancelled` in the artifact, apart from the new id. The stored destination id is the library, `cancelled_at` is 2026-09-30T08:00:00Z, and she stays inside. The audit entry is `outing.cancelled` by Aisha Khan. The open outing is Women's College, and the plan list is Women's College then Shamshad Market. Cancelling the library id again returns 409 `no_outing_planned`. Cancelling Women's College returns 200 with status `cancelled`. The open outing is then empty, because the remaining plan is for 2 October, and that plan is the only row on the plan list. Cancelling the 2 October plan returns 200 with status `cancelled`. The plan whose window is open returns 409 `outing_window_open` and says she cannot change this outing while its window is open. That plan stays planned. The outside outing returns 409 `already_outside` and says she is already outside. That outing stays outside. |
| Failure cases | E2E; failure cases are covered by the expected response. |
| Artifact | `backend/app/residents/outings/tests/artifacts/cancel-outing.json` |


### `update-outing` Change a planned outing

| Field | Content |
|---|---|
| Test | `backend/app/residents/outings/tests/test_update.py` |
| Purpose | A resident changes the destination, start, and expected return of one ordinary outing while it is still planned and its show window is shut. She can still change that plan when a different outing's window is open, as long as the new start does not open a second show window. She cannot change the outing whose window is open, or an outing she is already outside on. |
| Actor | A resident. A gate account is refused. |
| Preconditions | The hall from `hall-created` exists. The clock is frozen at 2026-09-30T08:00:00Z. Aisha Khan is an active resident, username `24-GLLB-118`, inside, with no outing. Fatima Khan is active gate staff. Grace is 30 minutes. |
| Action | `PATCH /api/v1/me/outings/{outing_id}` with no access token, then as Fatima Khan, then as Aisha Khan for an id that is not on file. Plan the library for 6:30 PM and Shamshad Market for 4:00 PM on 2 October. Change the library to Women's College, leaving at 3:00 PM and returning at 5:30 PM. Change it again to end when the Shamshad plan ends. Change it so the return is not after the start. Plan the library to start in four minutes and change that id. Change the Women's College plan while that window is open. Store an outside outing and change that id. Separately, plan a later library outing and a Shamshad outing whose window is already open, then move the library start into that open lead. |
| Expected response | No token returns 401 `unauthenticated` and says to sign in again. The gate account returns 403 `forbidden` and says this account cannot do that. An unknown id returns 404 `not_found` and says that record was not found. The Women's College change returns 200 and matches `updated` in the artifact, apart from the new id. The stored destination is Women's College, grace ends 30 minutes after the new return, the hall day is 30 September, and she stays inside. The audit entry is `outing.updated` by Aisha Khan. Ending at the Shamshad instant returns 409 `return_already_planned`. A return that is not after the start returns 422 `validation_error`. The row is unchanged. The plan whose window is open returns 409 `outing_window_open` and says she cannot change this outing while its window is open. The other plan still changes. Moving that other plan so its show window would also be open returns 409 `outing_window_open` and says she cannot start another outing while one is inside its window, and the later start is unchanged. The outside outing returns 409 `already_outside` and says she is already outside. |
| Failure cases | E2E; failure cases are covered by the expected response. |
| Artifact | `backend/app/residents/outings/tests/artifacts/update-outing.json` |

### `register-presence` Register presence board

| Field | Content |
|---|---|
| Test | `backend/app/staff/register/tests/test_presence.py` |
| Purpose | A warden or the provost reads who is inside, outside, or late, the same counts for each block, and one resident's open outside outing (or null when she is inside). Suspended residents are left out of the counts. Guests and waiting permissions follow `docs/database/database.md`. |
| Actor | A warden. A gate or resident account is refused. The provost may call the same routes. |
| Preconditions | The hall from `hall-created` exists. The clock is frozen at 2026-09-30T13:00:00Z. Fatima Khan is active gate staff. Sara Malik is an active warden. Halima Begum is an active provost. Active residents: Aisha Khan in B-204 (inside, with one cancelled outing, one returned outing, and one pending late-night permission), Maryam Siddiqui in B-205 (outside to the library, grace ends at 14:00), and Zara Ahmed in A-101 (outside to Shamshad Market, grace ended at 12:30, late notice sent). Noor Fatima is a suspended resident in A-102 and is inside. Guest stays: one pending for Aisha, one arrived in Aisha's block whose end date was yesterday, and one arrived in Maryam's block whose end date is tomorrow. Zara also has a pending permission. |
| Action | `GET /api/v1/register/summary`, `GET /api/v1/register/residents`, `GET /api/v1/register/residents/{resident_id}`, and `GET /api/v1/register/late` with no token, as Fatima Khan, as Aisha Khan, then as Sara Malik. As Sara, read the summary on the empty hall before the people are stored, then after they are stored. Filter residents by `q`, `state`, and `block_id`. Read Aisha, Maryam, Zara, an unknown id, and the late list. As Halima Begum, read the summary once. |
| Expected response | No token returns 401 `unauthenticated` and says to sign in again. Gate and resident accounts return 403 `forbidden` and say this account cannot do that. The empty summary matches `empty` in the artifact: every count is 0 and each published block appears. The filled summary matches `summary`: hall totals are the sum of the blocks; Block-B has Aisha inside, Maryam outside, one pending permission, two guests in hall including one who should have left, and one pending guest stay; Block-A has Zara late and one pending permission; the suspended resident is absent from every count. The unfiltered resident list matches `residents` (Aisha, Maryam, Zara by name); each row uses `outside_destination` for the open outing place and `outing_type` for its source (both null when inside), and carries `block_name`. The summary carries `notifications_unread`. Search, `state=late`, and Block-A each match their artifact slices. The late list is Zara only. Aisha's record matches `aisha` (inside, `outing` null despite cancelled and returned outings on file, guardian notice not due). Maryam's matches `maryam` (outside, `outing` is that outside outing, not late, notice not due). Zara's matches `zara` (late, `outing` is that outside outing, notice sent). An unknown id returns 404 `not_found`. The provost summary matches the warden summary. The register reads do not add an audit entry; only the sign-ins do. |
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
| Expected response | No token returns 401 `unauthenticated`. Gate on resident routes and gate or resident on staff routes return 403 `forbidden`. A departure clearly in the past returns 422 `validation_error` on `departure_at`. A departure a few minutes before now is accepted. Return not after departure returns 422 `validation_error`. Overlapping late-night and home-going submissions return 201. Own list is newest first and each item is a Permission (no resident_id/name/room); GET does not expire; submit (and `POST /api/v1/me/expire-passed`) expire that resident's unused approved permission past its return. Another resident's id returns 404. Cancel pending or approved returns 200 `cancelled`. Cancel after exit returns 409 `permission_in_use`. Staff default list is pending; GET does not expire; `POST /api/v1/permissions/expire-passed` expires unused approved permissions past their return. Approve returns 200 `approved`, stores the decider, writes `permission.approved`, and leaves outings empty for that permission. A second decision returns 409 `not_pending` and says only a pending permission can be approved or rejected, naming the current status. Reject returns 200 `rejected`. Expired permissions stay `expired` when looked at again, with a system `permission.expired` audit entry from the first look. A pending change records `permission.updated`. |
| Failure cases | E2E; failure cases are covered by the expected response. |
| Artifact | `backend/app/residents/permissions/tests/artifacts/permission-lifecycle.json` |

### `permission-pending-edit` Change a pending permission

| Field | Content |
|---|---|
| Test | `backend/app/residents/permissions/tests/test_lifecycle.py` |
| Purpose | A resident may replace the details of her own permission only while it is pending. The same checks as a new request apply, and the permission stays pending. Once a warden has approved it, a further change is refused. |
| Actor | A resident changes her request. A warden approves it. |
| Preconditions | The hall from `hall-created` exists. The clock is frozen at 2026-09-30T13:00:00Z. Aisha Khan is an active resident, username `24-GLLB-118`. Sara Malik is an active warden. |
| Action | As Aisha, `POST /api/v1/me/permissions` a late-night request, then `PATCH /api/v1/me/permissions/{permission_id}` with a new place, reason, departure, and return. Patch again with the return equal to the departure. As Sara, `POST /api/v1/permissions/{permission_id}/decision` with `approved`. As Aisha, patch the same body again. |
| Expected response | The first patch returns 200, status stays `pending`, and the new place, reason, and times are stored. A return that is not after the departure returns 422 `validation_error`. After approval, the patch returns 409 `not_editable`. |
| Failure cases | E2E; failure cases are covered by the expected response. |
| Artifact | none |

### `late-night-same-night` Late-night returns the same night

| Field | Content |
|---|---|
| Test | `backend/app/residents/permissions/tests/test_lifecycle.py` |
| Purpose | A late-night return is the same hall day as the departure. 12:00 AM on the next hall day is allowed. A later time the next day is refused. Home going may still cover several dates. |
| Actor | A resident. |
| Preconditions | The hall from `hall-created` exists. The clock is frozen at 2026-09-30T13:00:00Z. Aisha Khan is an active resident, username `24-GLLB-118`. The hall timezone is Asia/Kolkata. |
| Action | As Aisha, `POST /api/v1/me/permissions` a late-night request that returns the same evening, one that returns at 12:00 AM the next hall day, and one that returns at 12:30 AM the next hall day. `PATCH` the same-evening request to that 12:30 AM return. `POST` a home-going request that spans several hall dates. |
| Expected response | The same-evening request and the 12:00 AM return each return 201. The 12:30 AM return, including the patch, returns 422 `validation_error` on `expected_return_at`. The home-going request returns 201. |
| Failure cases | E2E; failure cases are covered by the expected response. |
| Artifact | none |

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


### `late-returns` Late returns, current and past

| Field | Content |
|---|---|
| Test | `backend/app/staff/register/tests/test_late_returns.py` |
| Purpose | A warden or the provost reads every outing that went past grace: still out (`state=now`) or returned after grace (`state=past`), with source, due time, return time, and minutes late. |
| Actor | A warden and the provost. Gate staff are refused. |
| Preconditions | The `permission-queue` people. Clock 2026-09-30T13:00:00Z. Aisha is outside on an ordinary outing due 12:00 (grace 12:15). Zara returned at 16:45 from a late-night outing due 2026-09-29T16:00 (grace 16:15), and returned on time from an ordinary outing on 2026-09-28. |
| Action | `GET /api/v1/register/late-returns` as gate, then unfiltered, `state=now`, `state=past`, `source=late_night`, `from=to=2026-09-30`, `limit=1&offset=1`, `from` after `to`, and an unknown `source`. |
| Expected response | Gate returns 403. Each page matches the artifact: Aisha 60 minutes late with `returned_at` null, Zara 45 minutes late; the on-time outing never appears. `from` after `to` and an unknown source return 422 `validation_error`. |
| Failure cases | E2E; failure cases are covered by the expected response. |
| Artifact | `backend/app/staff/register/tests/artifacts/late-returns.json` |

### `staff-notifications` Staff inbox

| Field | Content |
|---|---|
| Test | `backend/app/staff/register/tests/test_staff_notifications.py` |
| Purpose | A warden's inbox lists requested permissions and guest stays and outings that passed grace, newest first, a page at a time, each with its outcome so far. She marks one event read, or all up to an instant, for herself only. A new staff account starts with nothing unread. The register summary carries `notifications_unread` and `notifications_unread_count`. |
| Actor | A warden and the provost, and the provost creating a new warden. Gate staff are refused. |
| Preconditions | The `permission-queue` people (created 2026-09-30T00:00:00Z) and pending permissions, the `late-returns` outings, and two pending guest stays. Clock 2026-09-30T13:00:00Z. |
| Action | List and mark read as gate. As Sara: summary; list; walk the list three at a time; a bad cursor; `filter=unread`, `filter=needs_action`, `q=b-204`, `q=zara&from=2026-09-29&to=2026-09-29`; Halima declines Zara's home-going request and Sara lists one; Sara marks one late event read twice and an unknown id once; marks up to 11:00; marks all; summary; marks again. As Halima: summary. The provost creates warden Nadia, who signs in and reads her summary and list (`test_new_staff_inbox_starts_read`). |
| Expected response | Gate returns 403. The summary is unread with count 7. The list matches `before`: seven events after the accounts were created are unread and need action; the two before are read at 2026-09-30T00:00:00Z, the late one `returned` by Fatima Khan and the permission `approved` by Sara Malik. Walking pages returns the same list; a bad cursor is 422. Filters return the expected ids. After the decline the top event is `declined` by Halima Begum at 13:00 and no longer needs action, with a `next_cursor`. One read returns `{"unread_count":6}` twice; an unknown event is 404. Marking up to 11:00 returns `{"marked":4,"unread_count":2}`, then all `{"marked":2,"unread_count":0}`; the summary is false with count 0; a further call marks 0. Halima still has 7 unread. Nadia has nothing unread although the list has events. |
| Failure cases | E2E; failure cases are covered by the expected response. |
| Artifact | `backend/app/staff/register/tests/artifacts/staff-notifications.json` |

### `push-messages` Push tokens and the pushes each event sends

| Field | Content |
|---|---|
| Test | `backend/app/shared/devices/tests/test_push.py` (`test_push_tokens_and_messages`) |
| Purpose | Any account registers and removes its Expo push token. Wardens and the provost are pushed a new request and a resident becoming late; a resident is pushed her decisions and her own late notice, which also writes her inbox row. A late push goes once per outing. The data carries `notification_id`, `kind`, `record_id`, `resident_id`; the badge is the unread count. |
| Actor | Resident Aisha, warden Sara, provost Halima, gate Fatima. |
| Preconditions | The `permission-queue` people, the `late-returns` outings (Aisha out and late since 12:15), two pending guest stays. Clock 2026-09-30T13:00:00Z. Mock push driver. |
| Action | Register with no token; with three malformed tokens; with a bad platform. Sara registers a token, then Aisha registers the same token (twice); Sara, Halima, and Fatima register their own. Sara deletes Aisha's token. Sara and then Halima open the summary. Aisha lists her inbox. Sara declines Aisha's guest stay. Aisha asks for a late-night permission. Fatima scans Aisha back in. Aisha lists, reads home, filters `needs_action`, marks her late row read, and marks an unknown row. Aisha deletes her token; Sara approves the permission. |
| Expected response | 401, then 422 for each bad token and platform; registrations return 204 and the shared token moves to Aisha; Sara's delete of it changes nothing. The first summary sends three pushes (Aisha "You are late" badge 1 with her row id; Sara and Halima "Resident late" badge 3 with `resident_late:<outing>`); the second sends none. Her late row needs action. The decline pushes Aisha "Guest stay for Noor Khan declined" badge 2. The request pushes Sara and Halima "New request" badge 4. The return scan sends nothing new; her late row is `returned` by Fatima Khan, the guest-stay row `declined` by Sara Malik; home count 2; `needs_action` empty; one read returns `{"unread_count":1}`; the unknown row 404. After sign-out no push is sent. |
| Failure cases | E2E; failure cases are covered by the expected response. |
| Artifact | `backend/app/shared/devices/tests/artifacts/push-messages.json` (generated ids replaced) |

### `push-expo` Expo push API answers

| Field | Content |
|---|---|
| Test | `backend/app/shared/devices/tests/test_push.py` (`test_expo_tickets_name_dead_tokens`, `test_expo_failure_never_raises`, `test_expo_driver_refused_outside_production`) |
| Purpose | The Expo HTTP API cannot be called from a test, so the ticket handling is checked in isolation against a recorded Expo response body. |
| Actor | System job: push delivery. |
| Preconditions | An httpx mock transport stands in for `https://exp.host/--/api/v2/push/send`. |
| Action | Send three messages and answer with tickets ok, `DeviceNotRegistered`, and `MessageTooBig`. Then answer 500, a non-JSON body, and a read timeout. Build settings with `PUSH_DRIVER=expo` outside and inside production. |
| Expected response | Only the `DeviceNotRegistered` token is returned for deletion and the request went to the Expo URL. Each failure returns no tokens and raises nothing. The expo driver is refused outside production and accepted in production. |
| Failure cases | Expo down (5xx); a body that is not JSON; a timeout; a ticket error other than `DeviceNotRegistered` (logged, token kept); the live driver on a non-production process (refused at startup). |
| Artifact | None; the recorded Expo body is in the test file. |

### `notifications-upgrade` Inbox upgrade on a live hall

| Field | Content |
|---|---|
| Test | `backend/tests/test_migrate.py` (`test_notifications_upgrade_keeps_her_inbox_and_quiets_the_past`) |
| Purpose | The notifications migration keeps every existing decision row, leaves no staff member with an empty mark-all instant, and gives a resident who is already late a read late row, so the deploy sends no burst of late pushes. |
| Actor | System job: startup migration. |
| Preconditions | A hall migrated through 0017 with the `permission-queue` people, the `late-returns` outings, and one stored permission decision row. |
| Action | Run the remaining migrations. |
| Expected response | Her decision row is now `permission_decided` with the same record and still unread; Aisha's current late outing has a `resident_late` row that is read; no staff row has an empty `notifications_read_at`. |
| Failure cases | E2E; failure cases are covered by the expected response. |
| Artifact | None; the expected rows are in the test. |

### `staff-search` Staff search and sort

| Field | Content |
|---|---|
| Test | `backend/app/staff/register/tests/test_staff_search.py` |
| Purpose | `q` on the permission queue and guest stays, `block_id` on guest stays, `order=departure` on permissions, and `state=out`, `order=back_by`, `outing_type`, and `block_name` on the register. |
| Actor | A warden. |
| Preconditions | Same records as `staff-notifications`; Aisha is marked outside. |
| Action | `GET /api/v1/permissions` with `q` by name, by room, and a quote-and-comment string, and `order=departure`; `GET /api/v1/guest-stays` with `q` by guest and host name and `block_id`; `GET /api/v1/register/residents` with `state=out` and `order=back_by`; `q` longer than 80 characters. |
| Expected response | Each id list matches the artifact. The quote string matches nothing and is not run as SQL. The out row is Aisha, `outing_type` ordinary, state late. An 81-character `q` returns 422. |
| Failure cases | E2E; failure cases are covered by the expected response. |
| Artifact | `backend/app/staff/register/tests/artifacts/staff-search.json` |


### `resident-history` Own finished and unused history

| Field | Content |
|---|---|
| Test | `backend/app/residents/home/tests/test_history.py` |
| Purpose | A resident reads one history row per ordinary outing, late-night permission, home-going permission, or guest stay that is finished or unused. Newest `ended_at` first. Optional `kind`, one Asia/Kolkata hall date `on`, or a `from` and `to` range. No page control and no status field. |
| Actor | A resident. A gate account is refused. |
| Preconditions | The hall from `hall-created` exists. The clock is frozen at 2026-09-30T13:00:00Z, which is 30 September 2026 in Asia/Kolkata. Aisha Khan is an active resident, username `24-GLLB-118`. Fatima Khan is active gate staff. Sara Malik is an active warden. Maryam Siddiqui is another active resident. |
| Action | `GET /api/v1/me/history` with no token, as Fatima, then as Aisha when empty; again after the seeded rows exist; with `kind=all`, `kind=outing`, `kind=late_night`, `kind=home_going`, and `kind=guest_stay`; with `on` on a start day, a middle day, an end day, the day outside a span, and the hall day of a gate return whose UTC date is the day before; with `kind` and `on` together, and with `from` and `to`. Walk the full list two rows at a time with `limit` and `cursor`, and send a bad cursor. |
| Expected response | No token returns 401 `unauthenticated`. Gate returns 403 `forbidden`. Empty is `{ "items": [] }`. The full list is the twelve rows in the test, newest `ended_at` first. A finished outing uses gate exit and return times and the two staff names, with `unused` false. An unused outing whose planned return has passed, including one stored as cancelled, uses the planned leave and planned return, with both recorder names null and `unused` true. A cancelled plan whose return is still in the future is the same unused row. An exit with no return is absent even though the planned return has passed. A future plan she has not cancelled is absent. An expired late-night permission, a cancelled late-night permission, a rejected late-night permission, and an approved home-going permission whose window has ended are unused rows on the permission window. A completed late-night permission is `unused` false on that same window, and names the gate staff from its outing. A pending, still-open approved, or in-use permission is absent. An approved guest stay whose dates ended without an arrival, and a rejected guest stay, have `who` set to the guest name, `place` null, and `unused` true. A departed guest stay is `unused` false on the stay dates, with both recorder names null. A stay still inside its dates, and an arrived stay that has not departed, are absent. Another resident's outing is absent. `kind=all` matches the unfiltered list. `on` matches the hall calendar day of `started_at`, of `ended_at`, or a day between them. Omitting `on` does not filter by date. The reads do not add an audit entry beyond sign-in. |
| Failure cases | E2E; failure cases are covered by the expected response. |
| Artifact | None. The test states each row. |


### `resident-hall-pass` Hall pass inside the outing window

| Field | Content |
|---|---|
| Test | `backend/app/residents/hall_pass/tests/test_hall_pass.py` |
| Purpose | A resident reads the hall-pass QR for one outing. The code is her permanent token. It is returned only inside the show window. The gate scan still decides the movement. |
| Actor | A resident. Gate and warden accounts are refused. |
| Preconditions | The hall from `hall-created` exists. The clock is frozen at 2026-09-30T13:00:00Z. Aisha Khan is an active resident, username `24-GLLB-118`, room B-204, hall-pass token `bsj:v1:test-resident-hall-pass`. Fatima Khan is active gate staff. Sara Malik is an active warden. |
| Action | `GET /api/v1/me/hall-pass` with no token, as Fatima, as Sara, then as Aisha with no outing. Store a planned ordinary outing that starts at 7:30 PM and read again. Move that start to 6:34 PM and read again. |
| Expected response | No token returns 401 `unauthenticated`. Gate and warden return 403 `forbidden`. With no outing, Aisha's call matches `hidden`: `qr_payload` is null, `qr_visible` is false, `outing_type` and `permission_id` are null, and `place`, `starts_at`, and `expected_return_at` are null. The later start matches `waiting`: the outing id and window are set, `qr_payload` is still null, and `place`, `starts_at`, and `expected_return_at` are the stored outing lines. The start inside the 30-minute lead matches `showing`: `qr_payload` is the stored `qr_token`, and those three lines are still the outing's place, leave, and return. The read does not change the token and does not add an audit entry beyond sign-in. |
| Failure cases | E2E; failure cases are covered by the expected response. |
| Artifact | `backend/app/residents/hall_pass/tests/artifacts/resident-hall-pass.json` |


### `guest-stays-resident` Own guest stay applications

| Field | Content |
|---|---|
| Test | `backend/app/residents/guests/tests/test_lifecycle.py` |
| Purpose | A resident applies for a guest stay (lead days and inclusive length from hall settings), lists and reads her own, edits only while pending and before arrival (the stay stays pending), and cancels while pending or approved before arrival. An approved stay and a stay after arrival cannot be edited. Another resident's stay is not visible. |
| Actor | A resident. A gate account is refused. |
| Preconditions | The hall from `hall-created` exists. The clock is frozen at 2026-09-30T13:00:00Z (hall date 30 September 2026). Aisha Khan is an active resident in B-204. Maryam Siddiqui is another active resident. Fatima Khan is active gate staff. Sara Malik is an active warden (used only to seed an approved stay and an arrived stay in the fixture). Hall settings keep `guest_min_lead_days` 1 and `guest_max_inclusive_days` 7. |
| Action | `POST/GET /api/v1/me/guest-stays`, `GET/PATCH /api/v1/me/guest-stays/{id}`, `POST .../cancel` with no token, as Fatima, then as Aisha: refuse start on today and over-long stays; submit a valid stay; list and get; cancel pending; submit again and cancel; cancel a seeded approved stay before arrival; refuse cancel after arrival; refuse get/cancel of Maryam's stay. Also `GET` three seeded approved stays that have not arrived: paid from 30 September through 2 October, unpaid on those dates, and paid from 20 September through 28 September. |
| Expected response | No token returns 401 `unauthenticated`. Gate returns 403 `forbidden`. Request and response stay fields are `guest_start_date` / `guest_end_date`. Start on today's hall date, end before start, and inclusive length over 7 return 422 `validation_error`. A valid apply returns 201 `pending` / `unpaid` / bucket `pending` and matches `submitted` in the artifact (apart from the new id). Own list is newest first and each list item is a GuestStaySummary card (no reason, decision note, or staff recorder ids). Get by id returns the full GuestStay (`decided_by`, `arrived_recorded_by`, and `departed_recorded_by` are staff user UUIDs or null, not display names). Get another host's id returns 404. PATCH of her own pending stay, before arrival, with all five fields returns 200 and the stay stays `pending` (decision empty, payment unchanged). PATCH of an approved stay returns 409 `not_editable` and leaves it approved. PATCH after arrival returns 409 `not_editable`, including when the stay is still pending and when only a date is sent. PATCH on rejected returns 409 `not_editable`. Cancel pending or approved (before arrival) returns 200 `cancelled`. Cancel after arrival, or cancel a terminal stay, returns 409 `not_cancellable`. Audit gains `guest_stay.submitted`, `guest_stay.edited`, and `guest_stay.cancelled` for the resident's own actions. A paid approved stay that has not arrived, from 30 September 2026 through 2 October 2026, is bucket `expected`. The same dates unpaid are bucket `not_expected`. A paid approved stay that has not arrived, from 20 September 2026 through 28 September 2026, is bucket `not_expected`. |
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
| Expected response | No token returns 401. Gate and resident return 403. Default list excludes cancelled and rejected ids; `include_terminal=true` includes them; `bucket=rejected` and `bucket=cancelled` return those subsets without the flag. List items are GuestStaySummary cards; GET by id returns the full GuestStay including `payment_note`. Pending bucket matches the artifact id order. `bucket=in_hall` includes in-hall and should-have-left; `should_have_left` is that subset alone. Approve with empty note stores `approved` unpaid and clears the note; `decided_by` is the deciding staff user UUID; a second decision returns 409 `not_pending`. A resident edit after arrival returns 409 `not_editable` and leaves the stay approved. Gate may still record departure of that approved stay. Reject stores the note. Marking paid without `payment_note` (or with only whitespace) returns 422 `validation_error`. Payment paid with a note then unpaid on an approved stay before arrival succeeds; unpaid clears `payment_note`, the payment staff fields, and any payment evidence. Payment on pending with a note succeeds; payment after arrival or on departed/rejected returns 409 `payment_locked`. Audit records `guest_stay.approved`, `guest_stay.rejected`, `guest_stay.payment_marked`, and `guest_stay.departed`. |
| Failure cases | E2E; failure cases are covered by the expected response. |
| Artifact | `backend/app/residents/guests/tests/artifacts/guest-stays-staff.json` |


### `guest-payment-evidence` Optional guest payment evidence upload

| Field | Content |
|---|---|
| Test | `backend/app/residents/guests/tests/test_payment_evidence.py` |
| Purpose | A warden or the provost may optionally upload, replace, download, or clear a JPEG/PNG/PDF receipt on a guest stay while payment is mutable. Evidence is never required to mark paid. Marking unpaid clears evidence. |
| Actor | A warden. The provost may call the same routes. Gate and resident accounts are refused. |
| Preconditions | The hall from `hall-created` exists. The clock is frozen. An approved unpaid stay before arrival is seeded. |
| Action | `POST /api/v1/guest-stays/{id}/payment/evidence` with multipart field `evidence`; `GET` and `DELETE` the same path; mark paid without evidence; mark unpaid after upload; refuse after arrival and for disallowed types/size. |
| Expected response | No token returns 401. Gate and resident return 403. Warden and provost may upload. A JPEG, PNG, or PDF round-trips as the same bytes. A PNG sent as `image/jpeg` is stored as `image/png`. Download sends `Cache-Control: private, no-store`, `X-Content-Type-Options: nosniff`, and `Content-Disposition: attachment` with the name `payment-evidence-<stay id>.<ext>`. A path in the filename is stripped. A second upload replaces the first blob. DELETE then GET is 404 and leaves `payment_status` unchanged. Marking unpaid removes the blob. After arrival returns 409 `payment_locked`. Wrong magic bytes return 415 `unsupported_media_type`. More than 2 MiB returns 413 `payload_too_large`. Exactly 2 MiB is stored and returned unchanged. An empty or truncated file returns 422 `validation_error`. Metadata without a blob row returns 404. Staff and resident lists do not include the bytes and their queries do not name the blob table. Migration `0019` clears the five legacy evidence columns where a file had been recorded, leaves `payment_evidence_path` on the table, and leaves the audit row. Audit records `guest_stay.payment_evidence_uploaded` and `guest_stay.payment_evidence_cleared`. |
| Failure cases | E2E; failure cases are covered by the expected response. |
| Artifact | `backend/app/residents/guests/tests/artifacts/guest-payment-evidence.json` |

### `outing-types` Which outing she can use now, at the gate and on the phone

| Field | Content |
|---|---|
| Test | `backend/app/staff/gate/tests/test_outing_types.py` |
| Purpose | One rule decides the outing a resident can use now, for the gate scan and `GET /api/v1/me/hall-pass`: ordinary plans, late-night and home-going permissions, and an outside resident. The gate enforces the window. An overlapping permission beats an ordinary plan. Approval refuses an overlapping permission. A late return on a permission is marked late and noticed. |
| Actor | Gate staff (scan), a resident (hall pass), a warden (decision, late returns). |
| Preconditions | The hall from `hall-created` exists. The clock is moved by the test. `permission_lead_minutes` is 30. Aisha Khan is an active resident with the hall-pass code `bsj:v1:test-resident-hall-pass`, inside. Fatima Khan is gate staff and Sara Malik is a warden. Plans and permissions are stored directly. |
| Action | Ordinary plan starting 8:00Z: hall pass and scan at 7:00Z, then at 7:31Z. Approved late-night and home-going permission 15:00Z to 17:00Z: hall pass and scan at 14:00Z, then at 14:40Z, then while outside. Late-night permission used at 15:00Z, scanned back at 17:40Z. A permission and an ordinary plan open together. A plan with no start. Two overlapping permissions, one pending, decided as a warden. Back-to-back permissions. |
| Expected response | Before the lead: `qr_visible` false, `qr_payload` null, `qr_visible_from` set, `outing_type` and `permission_id` named, and the scan returns 409 `outing_not_yet_open` (ordinary) or `permission_not_yet_valid` (permission). Inside the window: the QR is shown with that `outing_type`, and the scan records the exit. Outside: the QR stays visible past the permission window. The late return is `late`, one `late_notice` and one `return_notice` are stored, the permission is `completed`, and the warden's late-returns list has the outing. When a permission and an ordinary plan are both open, the hall pass and the exit use the permission, and the plan stays `planned`. A plan with no start is shown until it ends. Approving an overlapping permission returns 409 `permission_overlap` and leaves it `pending`; rejecting it is allowed. A permission that starts when the other ends is approved. |
| Failure cases | E2E; failure cases are covered by the expected response. |
| Artifact | none |

### `gate-scans` Hall-pass scan and recent gate activity

| Field | Content |
|---|---|
| Test | `backend/app/staff/gate/tests/test_scans.py` |
| Purpose | Gate (or warden/provost) scans a hall pass to record an ordinary exit or return (discriminated envelope: exit nests `outing` with `recorded_at` and `lateness`, and no `return_timeliness`; return nests `return_record` with `return_timeliness` `on_time`|`within_grace`|`late` plus `recorded_at`/…; no envelope `recorded_at`), refuses unknown passes and scans with no usable plan, refuses a second scan inside the duplicate window, and lists recent exit/return activity newest first. Tied lines keep one order so a later page does not repeat or skip. |
| Actor | Gate staff. Warden may read activity. Resident is refused on scan. |
| Preconditions | The hall from `hall-created` exists. Clock starts at 2026-09-30T12:00:00Z (inside summer ordinary hours). Aisha Khan is an active resident with hall-pass `bsj:v1:test-resident-hall-pass`, inside. Fatima Khan is gate staff. Sara Malik is warden. |
| Action | `POST /api/v1/gate/scans` and `GET /api/v1/gate/activity` with no token, as Aisha, as Fatima (unknown QR; no plan; plan then exit with bare token; duplicate; return after 60s), then activity as Fatima and Sara. |
| Expected response | No token returns 401. Resident returns 403. Unknown QR returns 404 `unknown_hall_pass`. No plan returns 409 `no_outing_planned` with name/room details. Exit returns 200 `exit_recorded` with envelope keys only `outcome`, `full_name`, `room_label`, `message`, plus nested `outing` (movement fields including `outing_type` and `lateness` `on_time`, and `recorded_at`; no bare `type`, no `is_late`, and no `return_timeliness`); no top-level `recorded_at`/`return_record`. Immediate rescan returns 409 `duplicate_scan`. After the window (return at 12:01Z, expected 12:30Z, grace 13:00Z), return returns 200 `return_recorded` with nested `return_record` (`recorded_at`, `return_timeliness` `on_time`, `returned_at`, `return_recorded_by_name`, `outing_type` `ordinary`, `place` `Maulana Azad Library`, `expected_return_at` 12:30Z, `minutes_late` 0; no booleans and no `status`); no `outing`. A second run returns at 13:45:30Z, past grace: `return_timeliness` `late` and `minutes_late` 75, counted from `expected_return_at`. Activity total 2 with events return then exit. Each resident activity line has `resident_name` and `room_label` set and `guest_name`, `host_name`, and `host_room_label` null. Warden can read activity. Audit gains `outing.exit` and `outing.return`. A permission exit that would end when another outing ends returns 409 `return_already_planned` and inserts no outside outing. Two exits at the same instant for two residents with the same name stay in outing-id order: limit 1 returns the lower id's `room_label` first, and the next page returns the other room. |
| Failure cases | E2E; failure cases are covered by the expected response. |
| Artifact | `backend/app/staff/gate/tests/artifacts/gate-scans.json` |









### `gate-guests` Gate guest list, arrival, and departure

| Field | Content |
|---|---|
| Test | `backend/app/staff/gate/tests/test_guests.py` |
| Purpose | Gate (or warden/provost) lists guests expected today or currently in the hall on a timing-based bucket, optionally filters by `payment_status` (`paid` or `unpaid`; omit returns every guest in the bucket), records arrival when the stay is approved, paid, and within dates, and records departure for a guest still dining (including after the end date). Arrival and departure flashes return `recorded_by` (staff display name) and a movement time (`arrival_time` / `departure_time`) that must equal `recorded_at`. |
| Actor | Gate staff. Warden may list. Resident is refused. |
| Preconditions | The hall from `hall-created` exists. Clock frozen at 2026-09-30T12:00:00Z. Fatima Khan is gate staff. Sara Malik is warden. Aisha Khan and Maryam Siddiqui are residents with rooms. Seeded stays: expected paid today, in-hall, should-have-left dining, unpaid within stay, and upcoming paid. |
| Action | `GET /api/v1/gate/guests?bucket=expected|in_hall` with and without `payment_status=paid|unpaid`, with `limit`, `offset`, and `q`, `POST /api/v1/gate/guests/{id}/arrival`, `POST /api/v1/gate/guests/{id}/departure` with no token, as Aisha, as Fatima (list both buckets; paid/unpaid/omit filters on expected; page and search; refuse unpaid/upcoming/already-in-hall arrival; arrive expected; refuse double arrival; refuse departure for not-in-hall; depart should-have-left), then list as Sara. Empty POST bodies; no client-supplied times. |
| Expected response | No token returns 401. Resident returns 403. Omit on expected matches artifact ids (paid and unpaid within stay) and returns `total`, `limit` 50, and `offset` 0. `payment_status=paid` returns only paid; `payment_status=unpaid` returns only unpaid. `limit=1&offset=1` returns the second expected guest and `total` 2. `q` matches a guest name, a host name, or a room label, and a `%` search does not match every row. `limit=51` returns 422 `validation_error`. In-hall list includes dining and should-have-left ordered by start date. Unpaid arrival returns 409 `payment_required`. Upcoming or already-arrived returns 409 `guest_not_expected`. Successful arrival matches artifact message and the response does not include `guests_in_hall_count`. `recorded_by` is Fatima Khan; `arrival_time` equals `recorded_at`; body has no `departure_time`. Activity then includes a `guest_arrival` line with `guest_name`, `host_name`, and `host_room_label` set and `resident_name` and `room_label` null. Departure of overstay returns artifact message and the response does not include `guests_in_hall_count`. `recorded_by` is Fatima Khan; `departure_time` equals `recorded_at`; body has no `arrival_time`; status becomes `departed`. Audit gains `guest_stay.arrived` then `guest_stay.departed`. |
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
| Purpose | Provost reads the single hall settings record and patches only the fields that change. The hall office allows only the roles in one list, which is the provost, so a warden is refused. Ordinary outing windows use `summer_outing_*` / `winter_outing_*`. Permission leave window uses `permission_lead_minutes`. Grace changes do not rewrite existing outing grace ends. Outing end must stay after start; season starts must differ. Timezone is not patchable. SMS templates are not on this resource. |
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



### `e2e-resident` Resident app flows on an iOS simulator

| Field | Content |
|---|---|
| Test | `e2e/tests/resident.e2e.ts` |
| Purpose | The real app signs a resident in and her main screens work end to end: Home, hall pass tab, Permissions, planning an ordinary outing, Settings, and changing the password. |
| Actor | Resident. |
| Preconditions | macOS with Xcode, an iOS simulator, the release app built against the throwaway API from `e2e/scripts/serve-api.sh` (fresh SQLite hall, dev-seed accounts, mock SMS). Passwords from `E2E_*_PASSWORD` or the seed output. Never Render or Turso. |
| Action | Sign in as `24-GLLB-118`. Open Home, Pass, Permissions (open late-night and go back), plan an outing to Maulana Azad Library tomorrow (the date and time pickers use the one agent step), open Settings and Change password, then change the password and sign in with the new one. |
| Expected response | Home shows Plan an outing and Notifications. Pass shows no pass or a planned outing. Permissions lists late-night, home going and guest stay. The planned outing appears under Upcoming outings. Change password stays disabled until filled, then returns to Sign in and the new password signs in. |
| Failure cases | E2E; failure cases are covered by the expected response. |
| Artifact | Report under `e2e/.e2e/` (gitignored) and the replay cache `e2e/.e2e/cache/` for the one agent step. |

### `e2e-staff` Staff app flows on an iOS simulator

| Field | Content |
|---|---|
| Test | `e2e/tests/staff.e2e.ts` |
| Purpose | The real app signs a warden and a gate account in and shows the right tabs. A simulator has no camera, so the gate records a scan by typed pass code. |
| Actor | Warden and gate. |
| Preconditions | macOS with Xcode, an iOS simulator, the release app built against the throwaway API from `e2e/scripts/serve-api.sh` (fresh SQLite hall, dev-seed accounts, mock SMS). Passwords from `E2E_*_PASSWORD` or the seed output. Never Render or Turso. |
| Action | Sign in as `warden.sara`; open Out now, go back, open Requests. Relaunch fresh and sign in as `gate.fatima`, check there is no Requests tab, type the dev resident pass code in Scan and tap Record. |
| Expected response | The warden sees the Home, Out now and Requests screens. The gate has no Requests tab and the scan shows the resident name or that she has no planned outing. |
| Failure cases | E2E; failure cases are covered by the expected response. |
| Artifact | Report under `e2e/.e2e/` (gitignored) and the replay cache `e2e/.e2e/cache/` for the one agent step. |

### `admin-residents` Resident accounts and hall-pass reissue

| Field | Content |
|---|---|
| Test | `backend/app/staff/office/tests/test_residents.py` |
| Purpose | Provost lists resident accounts (including suspended, no QR), creates a resident with a one-time hall pass and temporary password, reads and patches an account (enrolment changes username; course and phone may clear; suspend revokes sessions), and reissues a hall pass once. A null name is refused. A resident is placed only in an active room. The resident's own `phone` is required on create (E.164); patch may still clear it to null. |
| Actor | Provost. Warden and resident are refused. |
| Preconditions | The hall from `hall-created` exists. Clock frozen at 2026-09-30T12:00:00Z. Halima Begum is provost. Sara Malik is warden. Aisha Khan is an active resident in B-204 with no own phone yet. Room B-205 exists empty in Block-B. The retired-room check marks B-205 inactive. |
| Action | `GET/POST /api/v1/admin/residents`, `GET/PATCH /api/v1/admin/residents/{id}`, `POST .../hall-pass/reissue` with no token, as Aisha, as Sara, as Halima (list/search; create Maryam in B-205 with required `phone`; refuse create without `phone`; refuse duplicate enrolment; get without QR; patch course/room/enrolment/phone; suspend and confirm refresh revoked; reinstate; reissue QR; unknown id 404). Separately, as Halima, refuse a null full name, clear course, clear phone, and refuse create and a room move onto retired B-205. |
| Expected response | No token returns 401. Non-provost returns 403. Create returns 201 with account+hall_pass (`bsj:v1:`) and the submitted `phone`. Create without `phone` returns 422 `validation_error`. List/get echo `phone` (null when unset on legacy rows). Duplicate returns 409 `duplicate_username`. GET/list omit QR. Suspend audits `resident.suspended` and revokes sessions. Reissue returns new HallPass and audits `hall_pass.reissued`; old token stops matching. A null full name returns 422 `validation_error` and the stored name stays Aisha Khan. Clearing course or phone returns 200 with that field null. Create or a room move onto the retired room returns 409 `room_inactive` and the resident stays in B-204. A real resident whose username starts with `deleted-` is still listed; after she deletes her own account (moved to the former room) the list is empty. |
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
| Action | `POST /api/v1/admin/users/{user_id}/password` with no token, as Aisha, as Sara, as Halima (reset Aisha; sign in with new password; old refresh fails; short password 422; password missing a character class 422; unknown id 404; reset Sara). |
| Expected response | No token returns 401. Non-provost returns 403. Success returns 204. A short temporary password returns 422 on `temporary_password` and says to use at least 10 characters. A temporary password missing a character class returns 422 on `temporary_password` and says to include an uppercase letter, a lowercase letter, a number, and a symbol. Unknown user returns 404. |
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

### `connection-teardown` Request connection closes without its state entry

| Field | Content |
|---|---|
| Test | `backend/tests/test_connection_teardown.py` |
| Purpose | The request's database connection is closed even when `request.state.hall_connection` was already removed, instead of teardown raising `AttributeError`. |
| Actor | System. |
| Preconditions | A local hall database. |
| Action | Open the request connection through `get_connection`, delete the state entry, then end the request. |
| Expected response | Teardown does not raise. The state entry is `None` and the connection is closed. |
| Failure cases | Isolated: the end-to-end path cannot remove the state entry mid-request. A missing entry used to raise `AttributeError` from teardown. |
| Artifact | None. The test states each check. |

### `migrate-atomic` Migration files and their records commit together

| Field | Content |
|---|---|
| Test | `backend/tests/test_migrate.py` |
| Purpose | A crash cannot leave a migration file applied but unrecorded, so a restart never runs it twice. A hall from before `schema_migrations` is not guessed to be current. |
| Actor | System job (startup). |
| Preconditions | A local hall database created by startup. |
| Action | Run `migrate()` with an extra file that creates a table and then fails. Separately, clear `schema_migrations` with `PRAGMA user_version` set to the file count, then to 0, and run `migrate()`. |
| Expected response | The failing file raises, its table is absent, and it is not recorded. With `user_version` equal to the file count every file is recorded. With `user_version` 0 startup refuses with a `RuntimeError`. |
| Failure cases | Isolated: the end-to-end startup path cannot inject a failing file or an old database. A partial file and a guessed baseline are the two failures. |
| Artifact | None. The test states each check. |

### `mobile-launch-route` A link-opened screen settles the launch splash

| Field | Content |
|---|---|
| Test | `mobile/src/__tests__/launch.test.ts` |
| Purpose | A signed-in user who opens a top-level screen by link, such as `/change-password`, must not stay on the launch splash. Only a screen the launch redirect is leaving (index, sign-in, onboard) keeps it up. |
| Actor | Resident, warden, or signed-out visitor opening the app. |
| Preconditions | None. `routeSettled` in `mobile/src/launch.ts` is a pure function of session readiness, user, current screen, and whether signup was opened from sign-in. |
| Action | Call `routeSettled(ready, user, here, onSignUp)` for a signed-in resident and warden on `change-password`, `(resident)` and `staff`, and on `index`, `sign-in` and `onboard`. Call it before the session is ready and signed out on `sign-in`, `onboard` and `change-password`. Run with `npm test` in `mobile/`. |
| Expected response | Settled (true) on `change-password`, `(resident)` and `staff` when signed in. Not settled while on `index`, `sign-in` or `onboard` when signed in. Not settled before the session is ready. Signed out settles only on `sign-in`, or on `onboard` opened from sign-in. |
| Failure cases | Isolated: the splash cannot be driven by a link inside the end-to-end path. The failures are a link-opened screen that never settles, and a launch redirect that settles too early. |
| Artifact | None. The test states each check. |

### `mobile-format-when` Hall dates keep the leading zero

| Field | Content |
|---|---|
| Test | `mobile/src/__tests__/format-when.test.ts` |
| Purpose | Dates shown in the app keep the two-digit day (`05 October 2026`) on the Asia/Kolkata hall clock. A date chip uses the short month (`05 Oct 2026`). A dropped zero made the same date read two ways. |
| Actor | Resident or staff reading a date in the app. |
| Preconditions | None. `formatWhen`, `formatHallDate`, and `formatChipDay` in `mobile/src/format-when.ts` are pure. |
| Action | `formatWhen("2026-10-05T13:30:00Z")`. `formatHallDate("2026-10-05")` and `formatHallDate("2026-10-15")`. `formatChipDay` for those same instants. Run with `npm test` in `mobile/`. |
| Expected response | `05 October 2026, 7:00 PM` (13:30 UTC is 7:00 PM in Asia/Kolkata). `05 October 2026` and `15 October 2026`. The chips read `05 Oct 2026` and `15 Oct 2026`. |
| Failure cases | Isolated: the display string is a view detail, not an API response. The failure is a day below 10 shown without its leading zero, or a chip using the long month. |
| Artifact | None. The test states each check. |

### `mobile-history-rows` Older history does not repeat a row

| Field | Content |
|---|---|
| Test | `mobile/src/__tests__/mobile-history-rows.test.ts` |
| Purpose | Show older adds the next page after the rows already on screen, and drops a row whose id is already shown. |
| Actor | Resident opening History. |
| Preconditions | None. `mergeHistoryRows` in `mobile/src/history-rows.ts` is pure. The History screen calls it when an older page loads. |
| Action | Append one new id. Append a page that repeats an id already shown and repeats an id inside itself. Append a page that adds nothing. Run with `npm test` in `mobile/`. |
| Expected response | The new id follows the current rows. Repeated ids appear once. A page that adds nothing returns the same list. |
| Failure cases | Isolated: the History screen is not driven here. Showing the same outing twice after Show older is the failure. |
| Artifact | None. The test states each check. |

### `mobile-notification-settings` The notifications row appears only after a denial

| Field | Content |
|---|---|
| Test | `mobile/src/__tests__/mobile-notification-settings.test.ts` |
| Purpose | Settings offers "Turn on in Settings" only when a resident, warden, or provost has denied notifications. Gate is not asked. Android hides the row while push is switched off. |
| Actor | Resident, gate, warden, or provost on Settings. |
| Preconditions | None. `notificationRowVisible` in `mobile/src/notification-settings.ts` is pure. `ANDROID_PUSH_ENABLED` is false. |
| Action | Ask for iOS with a denied permission for resident, warden, and provost. Ask again for granted, undetermined, Android, web, and a gate account. Run with `npm test` in `mobile/`. |
| Expected response | Denied on iOS is shown for resident, warden, and provost. Granted, undetermined, Android, web, and gate are hidden. |
| Failure cases | Isolated: the Settings screen is not driven here. Showing the row on Android without Firebase, or to gate, is the failure. |
| Artifact | None. The test states each check. |

### `session-expiry` A rejected refresh ends the session only on 401

| Field | Content |
|---|---|
| Test | `mobile/src/__tests__/session-expiry.test.ts` |
| Purpose | A refresh that returns 401 ends that session. A network error, 5xx, 429, 400, or 422 leaves her signed in. A newer session is not wiped. Parallel 401s share one refresh. |
| Actor | Resident or staff whose access token has expired. |
| Preconditions | None. `refreshEffect` and `singleFlight` in `mobile/src/session-refresh.ts` are pure. The phone calls them from `renew` in `mobile/src/session.tsx`. |
| Action | Call `refreshEffect` for 401, `network`, 500, 503, 429, 400, 422, and 200, with the same refresh token and with a newer one. Start two `singleFlight` calls on one slot. Run with `npm test` in `mobile/`. |
| Expected response | 401 with the same token is `end`. The other statuses are `keep`. 200 with the same token is `apply`. A different live token is `keep`. The two calls share one run. |
| Failure cases | Isolated: the refresh call cannot be forced from the end-to-end hall path without a second client. Ending the session on a network error, or wiping a newer sign-in, is the failure. |
| Artifact | None. The test states each check. |

### `session-end` Sign-out, password change, deletion, and a rejected refresh clear the phone the same way

| Field | Content |
|---|---|
| Test | `mobile/src/__tests__/session-end.test.ts` |
| Purpose | One cleanup cancels outing reminders, zeroes the badge, dismisses banners, clears the last tap, the stored push token, and the session. A failed step does not skip the rest. Running it again is safe. |
| Actor | Resident or staff signing out, changing her password, deleting her account, or being signed out by a 401 refresh. |
| Preconditions | None. `runEach` in `mobile/src/session-refresh.ts` is what `endSession` uses. |
| Action | Run the cleanup steps in that order, once with a throwing middle step, and once again on an already cleared phone. Run with `npm test` in `mobile/`. |
| Expected response | Reminders, badge, banners, last tap, push token, and session are clear. The steps after a throw still run. The second run stays clear. |
| Failure cases | Isolated: notification permissions and SecureStore are not available in the unit run. A throw that skips the session clear is the failure. |
| Artifact | None. The test states each check. |

### `mobile-push-token` Push registration saves a 204, retries once, and refuses a 422

| Field | Content |
|---|---|
| Test | `mobile/src/__tests__/mobile-push-token.test.ts` |
| Purpose | The phone stores a push token only after the hall returns 204. A failed call is tried once more. A 422 is not tried again. A thrown call, such as Android without Firebase, does not escape. |
| Actor | Resident, warden, or provost after sign-in. Gate staff are not registered. |
| Preconditions | None. `registerPushToken` in `mobile/src/session-refresh.ts` is what the sign-in effect calls. |
| Action | Post a token that returns 204, 500 then 204, 503 twice, 422, and a throw. Run with `npm test` in `mobile/`. |
| Expected response | 204 is `saved` in one call. 500 then 204 is `saved` in two calls. Two 503s are `failed`. 422 is `refused` in one call. A throw is `failed` after one retry and does not reject the caller. |
| Failure cases | Isolated: the unit run has no Firebase and no hall. Retrying a 422, or letting the Firebase error escape, is the failure. |
| Artifact | None. The test states each check. |

### `mobile-hall-office` Provost office shows hall hours, keeps inactive places, and confirms the destructive actions

| Field | Content |
|---|---|
| Test | `mobile/src/__tests__/office.test.ts` |
| Purpose | The provost office shows outing hours on a 12-hour clock and season starts as a day and month, sends only the settings that changed, keeps inactive destinations on the office list and off the resident catalog, and confirms before a hall-pass reissue or a password reset. Account reads do not keep a password or a hall-pass token. |
| Actor | Provost, in the phone office. |
| Preconditions | None. The checks call pure functions in `mobile/src/office.ts`. |
| Action | Format `06:30`, `18:30`, `17:30`, `04-01`, and `10-01`. Parse `6:30 PM` and `01 April`. Build a settings patch that changes grace only. Split an admin destination list that includes an inactive place. Build a resident create, a resident patch, a staff create, and a staff patch. Read an account that includes a hall-pass token, a staff row that includes a temporary password, and an audit row that includes a token. Check the register CSV header. Run with `npm test` in `mobile/`. |
| Expected response | `6:30 AM`, `6:30 PM`, `5:30 PM`, `01 April`, and `01 October`. `6:30 PM` stores as `18:30` and `01 April` stores as `04-01`. The settings patch is `grace_minutes` only. The inactive place stays in the office list and is absent from the resident catalog. Create bodies use `temporary_password` and no `password` field. A staff patch does not change role or username. A token on an account, a staff row, or an audit row is refused. The CSV is accepted only when the header matches the contract. Reissue copy is "The old QR stops working". Reset copy is "Sessions end". |
| Failure cases | Isolated: the office screens cannot be driven from the hall end-to-end path in this check. Showing an inactive place to residents, sending an unchanged setting, or skipping the reissue and reset warning is the failure. |
| Artifact | None. The test states each check. |

### `mobile-outing-reminder` Return reminders follow the plan, the permission, or the outing she is on

| Field | Content |
|---|---|
| Test | `mobile/src/__tests__/mobile-outing-reminder.test.ts` |
| Purpose | An ordinary plan and an approved late-night permission each get a return reminder. An overlapping ordinary plan is dropped. Home-going, and a cancelled or expired permission, get none. While she is out, only that outing is reminded. The reminder is 15 minutes before the return. |
| Actor | Resident, on her phone. |
| Preconditions | None. `reminderPlan` and `endingReminderAt` in `mobile/src/reminder.ts` are pure. Home calls them after it reads approved permissions. |
| Action | Plan two ordinary outings, one approved late-night permission, an overlap with a late-night permission and with a home-going permission, a plan that only touches a permission, a plan with no start, and cancelled, expired, pending, and in-use permissions. Then she is outside on an ordinary outing, a late-night outing, and a home-going outing. Ask for the reminder time 15 minutes ahead, at that instant, and for a missing time. Run with `npm test` in `mobile/`. |
| Expected response | Each ordinary plan and each approved late-night permission is one reminder. The overlapping plan is absent and the later plan remains. Home-going adds no reminder. A touching boundary and a missing start stay. Cancelled, expired, pending, and in-use permissions add none. While she is out, the only reminder is that outing, and a home-going outing adds none. The reminder time is 15 minutes before the return, and null once that moment has passed. |
| Failure cases | Isolated: notification permissions are not available in the unit run. Scheduling a home-going reminder, or keeping an ordinary plan that overlaps an approved permission, is the failure. |
| Artifact | None. The test states each check. |

### `mobile-push-router` A repeated notification tap is a new tap

| Field | Content |
|---|---|
| Test | `mobile/src/__tests__/mobile-push-router.test.ts` |
| Purpose | The phone tells two taps of the same notification apart by its identifier and its date, so a later tap is not dropped. |
| Actor | Resident or staff tapping a notification. |
| Preconditions | None. `responseKey` in `mobile/src/reminder.ts` is pure. The push router uses it before opening a screen. |
| Action | Key one identifier at two dates, and two identifiers at one date. Run with `npm test` in `mobile/`. |
| Expected response | The same identifier at a later date is a different key. Two identifiers at the same date are different keys. |
| Failure cases | Isolated: a notification response cannot be delivered inside the unit run. Dropping the second tap of the same identifier is the failure. |
| Artifact | None. The test states each check. |

### `mobile-push-target` A tapped push opens the screen that owns it

| Field | Content |
|---|---|
| Test | `mobile/src/__tests__/mobile-push-target.test.ts` |
| Purpose | A resident tap opens her permission, guest stay, or hall pass. A warden or provost tap opens the request sheet or the late tab. Gate opens nothing. An unknown kind, or a record with no id, opens nothing. |
| Actor | Resident, gate, warden, or provost tapping a push. |
| Preconditions | None. `pushTarget` in `mobile/src/push-target.ts` is pure. |
| Action | Ask for each resident kind, each staff kind, a gate role, a missing id, and an unknown kind. Run with `npm test` in `mobile/`. |
| Expected response | Resident permission and guest stay open those screens with the id encoded. Late and outing-ending open `/pass`. Staff permission and guest stay open `/staff/requests` with the tab and id. Late opens `/staff/out?tab=late`. Gate, a missing id, and an unknown kind open nothing. |
| Failure cases | Isolated: the router cannot be tapped in the unit run. Opening a gate screen, or a decided request with no id, is the failure. |
| Artifact | None. The test states each check. |

### `mobile-notices` Inbox cards keep a waiting request open and close a decided one

| Field | Content |
|---|---|
| Test | `mobile/src/__tests__/mobile-notices.test.ts` |
| Purpose | A staff card for a waiting request opens that request. A decided request stays on the card and does not open the sheet. A late return still opens. A resident decision and guest stay read their own sentences. A kind the phone does not know is skipped. The unread count accepts zero and refuses a missing or negative count. |
| Actor | Resident, warden, or provost reading the inbox. |
| Preconditions | None. `readNoticePage` and `readUnreadCount` in `mobile/src/notices.ts` are pure. |
| Action | Read a warden page with one waiting permission and one approved permission, a provost late return that is already back, and a resident page with an approved permission, an unknown kind, a declined guest stay, and a late return. Read unread counts of 0, 3, -1, and a missing count. Run with `npm test` in `mobile/`. |
| Expected response | The waiting card targets the permissions sheet. The approved card has no target and says it was approved by Sara Malik. The late card still targets the late tab. The resident page keeps the permission and skips the unknown row. The guest stay names the guest. A zero count is 0. A missing or negative count is null. |
| Failure cases | Isolated: the inbox screen is not driven here. Opening a decided request from its card, or dropping a known row, is the failure. |
| Artifact | None. The test states each check. |

### `http-errors` One JSON shape for missing routes, bad methods, validation, and failures

| Field | Content |
|---|---|
| Test | `backend/app/shared/tests/test_http_errors.py` |
| Purpose | 404, 405, 422, 500, and a commit that fails all return `detail` plus `error.code`, `error.message`, and `error.request_id`. The id is echoed. Security headers are on the response. The body and the log do not carry the exception text. |
| Actor | Anyone (no token). |
| Preconditions | The hall exists. `ENVIRONMENT` is development, then production for the transport header. |
| Action | `GET` a path that is not in the contract with `X-Request-ID: req-404`. `POST /health`. `POST /api/v1/auth/login` with an empty body. `GET /api/v1/auth/onboard/options` while the options limiter raises. `GET /health` with a safe id and with an id that contains a space. `GET /health` in production. `GET /health` while the commit raises. |
| Expected response | 404 `not_found` "Not found." echoes `req-404`. 405 `method_not_allowed`. 422 `validation_error` with `detail` equal to the message. 500 `internal_error` "The hall could not finish that." and the body does not contain the raised secret or `RuntimeError`. A safe id is echoed. An unsafe id is replaced. Development has no `Strict-Transport-Security`. Production sends `max-age=31536000; includeSubDomains`. Every response has `nosniff`, `no-referrer`, and `DENY`. A failed commit is the same 500 JSON, not plain text, and does not say the database is locked. The access log contains the request ids and not the secret. |
| Failure cases | E2E; failure cases are covered by the expected response. |
| Artifact | None. The test states each check. |

### `mobile-onboard-room` A full room returns her to the room step

| Field | Content |
|---|---|
| Test | `mobile/src/__tests__/mobile-onboard-room.test.ts` |
| Purpose | When signup says the room is full, the phone goes back to the room step and reloads the room list. A taken enrolment still goes to the first step. Other refusals stay where she is. |
| Actor | Resident signing up. |
| Preconditions | None. `signupRecovery` in `mobile/src/onboard-room.ts` is pure. The onboard screen calls it and reloads `GET /api/v1/auth/onboard/options` only for a full room. Typed fields stay in the screen state. |
| Action | Ask with the room-full sentence, the taken-enrolment sentence, and an unreachable sentence. Run with `npm test` in `mobile/`. |
| Expected response | The room-full sentence returns step 2 and refetch. The taken enrolment returns step 0 and does not refetch. Any other sentence returns nothing, so the screen keeps the current step. |
| Failure cases | Isolated: the onboard screen is not driven here. Leaving her on the submit step after the room filled is the failure. |
| Artifact | None. The test states each check. |

### `integrity-errors` Plain SQLite and Turso uniqueness errors are both caught

| Field | Content |
|---|---|
| Test | `backend/tests/test_integrity_errors.py` |
| Purpose | Turso's `IntegrityError` is not a `sqlite3.IntegrityError`, so `except sqlite3.IntegrityError` misses it in production and a duplicate create returns 500. `INTEGRITY_ERRORS` in `backend/app/shared/db.py` covers both, and ruff bans the old pattern. |
| Actor | System. |
| Preconditions | None. No database. |
| Action | Raise each driver's `IntegrityError` with a UNIQUE message inside `try ... except INTEGRITY_ERRORS`. Check the Turso class is not a subclass of the SQLite class. |
| Expected response | Both errors are caught and the message is intact. The Turso class is not a `sqlite3.IntegrityError` subclass. |
| Failure cases | Isolated: tests run on plain SQLite, so the end-to-end path cannot raise Turso's error. Catching only `sqlite3.IntegrityError` lets Turso's error escape as a 500. |
| Artifact | None. The test states each check. |

