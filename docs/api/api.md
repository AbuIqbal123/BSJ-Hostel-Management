# Begum Sultan Jahan Hall API

API version: **0.2.12**

This is the reading copy of [`backend/openapi.yaml`](../../backend/openapi.yaml). Swagger at `/docs` serves that file. Stored data is in [`database.md`](../database/database.md). When an endpoint changes, edit the YAML and regenerate this page from the repository root:

```bash
backend/.venv/bin/python backend/scripts/render_api_md.py
```

Do not edit this page by hand.

## Contents

- [How to call the API](#how-to-call-the-api)
- [Operations](#tag-operations)
  - [GET `/health` — Process health](#get-health)
  - [GET `/ready` — Process readiness](#get-ready)
- [Auth](#tag-auth)
  - [POST `/api/v1/auth/login` — Sign in](#post-api-v1-auth-login)
  - [POST `/api/v1/auth/refresh` — Exchange a refresh token](#post-api-v1-auth-refresh)
  - [POST `/api/v1/auth/logout` — Sign out](#post-api-v1-auth-logout)
  - [GET `/api/v1/auth/me` — Current account](#get-api-v1-auth-me)
  - [POST `/api/v1/auth/change-password` — Change own password](#post-api-v1-auth-change-password)
- [Resident](#tag-resident)
  - [GET `/api/v1/me/home` — Resident home](#get-api-v1-me-home)
  - [GET `/api/v1/me/hall-pass` — Permanent hall pass](#get-api-v1-me-hall-pass)
  - [GET `/api/v1/me/history` — Own exit and return history](#get-api-v1-me-history)
  - [GET `/api/v1/destinations` — Ordinary outing destinations](#get-api-v1-destinations)
  - [GET `/api/v1/me/outings` — Ordinary outing plans](#get-api-v1-me-outings)
  - [POST `/api/v1/me/outings` — Plan an ordinary outing](#post-api-v1-me-outings)
  - [GET `/api/v1/me/outings/current` — Open outing](#get-api-v1-me-outings-current)
  - [POST `/api/v1/me/outings/{outing_id}/cancel` — Cancel a planned outing](#post-api-v1-me-outings-outing_id-cancel)
  - [POST `/api/v1/me/expire-passed` — Expire own passed plans and permissions](#post-api-v1-me-expire-passed)
- [Permissions](#tag-permissions)
  - [GET `/api/v1/me/permissions` — Own special permissions](#get-api-v1-me-permissions)
  - [POST `/api/v1/me/permissions` — Request late-night or home going](#post-api-v1-me-permissions)
  - [GET `/api/v1/me/permissions/{permission_id}` — Own permission](#get-api-v1-me-permissions-permission_id)
  - [POST `/api/v1/me/permissions/{permission_id}/cancel` — Cancel own permission](#post-api-v1-me-permissions-permission_id-cancel)
  - [GET `/api/v1/permissions` — Permission queue](#get-api-v1-permissions)
  - [POST `/api/v1/permissions/expire-passed` — Expire passed unused permissions](#post-api-v1-permissions-expire-passed)
  - [GET `/api/v1/permissions/{permission_id}` — Permission for review](#get-api-v1-permissions-permission_id)
  - [POST `/api/v1/permissions/{permission_id}/decision` — Approve or reject a permission](#post-api-v1-permissions-permission_id-decision)
- [Guest Stays](#tag-guest-stays)
  - [GET `/api/v1/me/guest-stays` — Own guest applications](#get-api-v1-me-guest-stays)
  - [POST `/api/v1/me/guest-stays` — Apply for a guest stay](#post-api-v1-me-guest-stays)
  - [GET `/api/v1/me/guest-stays/{guest_stay_id}` — Own guest stay](#get-api-v1-me-guest-stays-guest_stay_id)
  - [POST `/api/v1/me/guest-stays/{guest_stay_id}/cancel` — Cancel own guest application](#post-api-v1-me-guest-stays-guest_stay_id-cancel)
  - [GET `/api/v1/guest-stays` — Guest stays](#get-api-v1-guest-stays)
  - [GET `/api/v1/guest-stays/{guest_stay_id}` — Guest stay for review](#get-api-v1-guest-stays-guest_stay_id)
  - [POST `/api/v1/guest-stays/{guest_stay_id}/decision` — Approve or reject a guest stay](#post-api-v1-guest-stays-guest_stay_id-decision)
  - [POST `/api/v1/guest-stays/{guest_stay_id}/payment` — Mark guest payment](#post-api-v1-guest-stays-guest_stay_id-payment)
- [Gate](#tag-gate)
  - [POST `/api/v1/gate/scans` — Scan a hall pass](#post-api-v1-gate-scans)
  - [GET `/api/v1/gate/activity` — Recent gate activity](#get-api-v1-gate-activity)
  - [GET `/api/v1/gate/guests` — Guests for the gate](#get-api-v1-gate-guests)
  - [POST `/api/v1/gate/guests/{guest_stay_id}/arrival` — Record guest arrival](#post-api-v1-gate-guests-guest_stay_id-arrival)
  - [POST `/api/v1/gate/guests/{guest_stay_id}/departure` — Record guest departure](#post-api-v1-gate-guests-guest_stay_id-departure)
- [Register](#tag-register)
  - [GET `/api/v1/register/summary` — Hall register counts](#get-api-v1-register-summary)
  - [GET `/api/v1/register/residents` — Resident register](#get-api-v1-register-residents)
  - [GET `/api/v1/register/residents/{resident_id}` — Resident record](#get-api-v1-register-residents-resident_id)
  - [GET `/api/v1/register/late` — Late list](#get-api-v1-register-late)
- [Hall office](#tag-hall-office)
  - [GET `/api/v1/admin/residents` — List resident accounts](#get-api-v1-admin-residents)
  - [POST `/api/v1/admin/residents` — Create a resident](#post-api-v1-admin-residents)
  - [GET `/api/v1/admin/residents/{resident_id}` — Resident account](#get-api-v1-admin-residents-resident_id)
  - [PATCH `/api/v1/admin/residents/{resident_id}` — Update a resident](#patch-api-v1-admin-residents-resident_id)
  - [POST `/api/v1/admin/residents/{resident_id}/hall-pass/reissue` — Reissue a hall pass](#post-api-v1-admin-residents-resident_id-hall-pass-reissue)
  - [GET `/api/v1/admin/staff` — List staff accounts](#get-api-v1-admin-staff)
  - [POST `/api/v1/admin/staff` — Create a staff account](#post-api-v1-admin-staff)
  - [PATCH `/api/v1/admin/staff/{user_id}` — Update a staff account](#patch-api-v1-admin-staff-user_id)
  - [POST `/api/v1/admin/users/{user_id}/password` — Reset a password](#post-api-v1-admin-users-user_id-password)
  - [GET `/api/v1/admin/blocks` — List blocks](#get-api-v1-admin-blocks)
  - [POST `/api/v1/admin/blocks` — Create a block](#post-api-v1-admin-blocks)
  - [PATCH `/api/v1/admin/blocks/{block_id}` — Update a block](#patch-api-v1-admin-blocks-block_id)
  - [GET `/api/v1/admin/rooms` — List rooms](#get-api-v1-admin-rooms)
  - [POST `/api/v1/admin/rooms` — Create a room](#post-api-v1-admin-rooms)
  - [PATCH `/api/v1/admin/rooms/{room_id}` — Update a room](#patch-api-v1-admin-rooms-room_id)
  - [GET `/api/v1/admin/destinations` — List destinations](#get-api-v1-admin-destinations)
  - [POST `/api/v1/admin/destinations` — Create a destination](#post-api-v1-admin-destinations)
  - [PATCH `/api/v1/admin/destinations/{destination_id}` — Update a destination](#patch-api-v1-admin-destinations-destination_id)
  - [GET `/api/v1/admin/settings` — Hall settings](#get-api-v1-admin-settings)
  - [PATCH `/api/v1/admin/settings` — Update hall settings](#patch-api-v1-admin-settings)
  - [GET `/api/v1/admin/register/export` — Export the register](#get-api-v1-admin-register-export)
  - [GET `/api/v1/admin/sms` — SMS log](#get-api-v1-admin-sms)
  - [GET `/api/v1/admin/audit` — Audit log](#get-api-v1-admin-audit)
- [Payloads](#tag-payloads)

## How to call the API

HTTP contract for the hostel movement system. Schema version of the database
is tracked separately in `docs/database/database.md` (0.3.4).

This version is the contract. Auth, resident phone (home, history, hall pass,
destinations, ordinary outings, permissions, guest stays), register, staff
permission queue, staff guest stays, gate scans and guests, and hall office
(settings, blocks, rooms, destinations, residents, staff, password reset,
audit, SMS log, register export) respond. Swagger on this server is the
review surface for purpose, payload, and response.

JSON names are snake_case. Instants are UTC `YYYY-MM-DDTHH:MM:SSZ`. Calendar
dates are hall-local `YYYY-MM-DD` in Asia/Kolkata. A time of day is `HH:MM`.
A season start is `MM-DD`. A phone number includes the country code, `+`
then digits. Clients show India time on a 12-hour clock and a date as the
day, the month name, and the year. `2026-09-18T13:30:00Z` is shown as
18 September 2026, 7:00 PM. This API returns the stored form.

The caller sends an access token as `Authorization: Bearer`, except on
`GET /health`, `POST /api/v1/auth/login`, and `POST /api/v1/auth/refresh`.

Access tokens last 15 minutes. Refresh tokens last 30 days. Passwords are
at least 10 characters and are stored as Argon2id. Accounts are issued by
the hall office. A resident username is the enrolment number.

Stored state and lifecycles live in `docs/database/database.md`. This file does not
repeat the column list. The reading copy of this contract is `docs/api/api.md`.

| Server | Use |
|---|---|
| `http://localhost:8000` | Local development |
| `https://api-dev.domain.com` | Development environment, mock SMS only |
| `https://api.domain.com` | Production |

JSON names are snake_case. Send `Authorization: Bearer` plus the access token, except where an operation says no token.

## Operations

## <a id="tag-operations"></a>Operations

Process health. No hall data.

| Method | Path | Purpose | Who |
|---|---|---|---|
| GET | `/health` | [Process health](#get-health) | Anyone |
| GET | `/ready` | [Process readiness](#get-ready) | Anyone |

### <a id="get-health"></a>GET `/health` — Process health

`health`

**Who.** Anyone. No token.

Reports that the API process is up. It does not check the database.

**Responses**

#### 200

The process is up.

Body: [Health](#schema-health).

| Field | Required | Type | Notes |
|---|---|---|---|
| `status` | yes | `ok` |  |

**Example**

```json
{
  "status": "ok"
}
```


### <a id="get-ready"></a>GET `/ready` — Process readiness

`ready`

**Who.** Anyone. No token.

Opens the hall database and reports `PRAGMA user_version`. Use this to
confirm the process can read the hall file. `GET /health` stays shallow.

**Responses**

#### 200

The database opened and the schema version was read.

Body: [Ready](#schema-ready).

| Field | Required | Type | Notes |
|---|---|---|---|
| `status` | yes | `ready` |  |
| `user_version` | yes | integer | SQLite PRAGMA user_version after migrations. minimum 0. |

**Example**

```json
{
  "status": "ready",
  "user_version": 5
}
```

#### 503

The database could not be opened.

Body: [ErrorResponse](#schema-errorresponse).

**Example**

```json
{
  "error": {
    "code": "not_ready",
    "message": "The hall database could not be opened."
  }
}
```


## <a id="tag-auth"></a>Auth

Hall-issued accounts. No public registration and no guardian login.

| Method | Path | Purpose | Who |
|---|---|---|---|
| POST | `/api/v1/auth/login` | [Sign in](#post-api-v1-auth-login) | anyone with a hall-issued account |
| POST | `/api/v1/auth/refresh` | [Exchange a refresh token](#post-api-v1-auth-refresh) | Anyone |
| POST | `/api/v1/auth/logout` | [Sign out](#post-api-v1-auth-logout) | Signed-in account |
| GET | `/api/v1/auth/me` | [Current account](#get-api-v1-auth-me) | Signed-in account |
| POST | `/api/v1/auth/change-password` | [Change own password](#post-api-v1-auth-change-password) | Signed-in account |

### <a id="post-api-v1-auth-login"></a>POST `/api/v1/auth/login` — Sign in

`login`

**Who.** anyone with a hall-issued account. No token.

Caller: anyone with a hall-issued account. A resident uses the enrolment
number as the username. The sample body leaves the password field out of
this repository. The field is required.

An unknown username and a known username with the wrong password both
return the same message, so a caller cannot tell whether the username
exists. A correct password on a suspended account says the account is
suspended and asks the caller to contact the Hall Office. Repeated
attempts from the same client are limited; further attempts return 429.

**Request.** Required.

Body: [LoginRequest](#schema-loginrequest).

| Field | Required | Type | Notes |
|---|---|---|---|
| `username` | yes | string | 1–80 characters. |
| `password` | yes | string | 1–200 characters. |

**Example**

```json
{
  "username": "24-GLLB-118"
}
```

**Responses**

#### 200

New access token and refresh token.

Body: [TokenResponse](#schema-tokenresponse).

| Field | Required | Type | Notes |
|---|---|---|---|
| `access_token` | yes | string |  |
| `token_type` | yes | `bearer` |  |
| `expires_in` | yes | integer | Access token lifetime in seconds. |
| `refresh_token` | yes | string |  |
| `user` | yes | [UserSummary](#schema-usersummary) |  |

#### 401

Sign-in was refused. Unknown username and wrong password share one
message. A suspended account asks the caller to contact the Hall Office.

Body: [ErrorResponse](#schema-errorresponse).

**Username or password is wrong**

```json
{
  "error": {
    "code": "unauthenticated",
    "message": "Username or password is wrong."
  }
}
```

**Account is suspended**

```json
{
  "error": {
    "code": "unauthenticated",
    "message": "This account is suspended. Please contact the Hall Office."
  }
}
```

#### 429

Too many sign-in attempts from this client in a short window.

Body: [ErrorResponse](#schema-errorresponse).

**Example**

```json
{
  "error": {
    "code": "rate_limited",
    "message": "Too many attempts. Try again shortly."
  }
}
```

#### 422

The JSON is the wrong shape, or a field fails a constraint that does not depend on existing rows.

Body: [ErrorResponse](#schema-errorresponse).


### <a id="post-api-v1-auth-refresh"></a>POST `/api/v1/auth/refresh` — Exchange a refresh token

`refresh`

**Who.** Anyone. No token.

Issues a new access token and a new refresh token. The presented refresh
token is revoked. A revoked, expired, or unknown token is refused.
Repeated attempts from the same client are limited; further attempts
return 429.

**Request.** Required.

Body: [RefreshRequest](#schema-refreshrequest).

| Field | Required | Type | Notes |
|---|---|---|---|
| `refresh_token` | yes | string |  |

**Responses**

#### 200

Rotated tokens.

Body: [TokenResponse](#schema-tokenresponse).

| Field | Required | Type | Notes |
|---|---|---|---|
| `access_token` | yes | string |  |
| `token_type` | yes | `bearer` |  |
| `expires_in` | yes | integer | Access token lifetime in seconds. |
| `refresh_token` | yes | string |  |
| `user` | yes | [UserSummary](#schema-usersummary) |  |

#### 401

The access token is missing or expired, or the username and password were refused.

Body: [ErrorResponse](#schema-errorresponse).

#### 429

Too many refresh attempts from this client in a short window.

Body: [ErrorResponse](#schema-errorresponse).

**Example**

```json
{
  "error": {
    "code": "rate_limited",
    "message": "Too many attempts. Try again shortly."
  }
}
```


### <a id="post-api-v1-auth-logout"></a>POST `/api/v1/auth/logout` — Sign out

`logout`

**Who.** Signed-in account. Bearer access token.

Revokes the caller's refresh tokens.

**Responses**

#### 204

Refresh tokens revoked.

No body.

#### 401

The access token is missing or expired, or the username and password were refused.

Body: [ErrorResponse](#schema-errorresponse).


### <a id="get-api-v1-auth-me"></a>GET `/api/v1/auth/me` — Current account

`current_user`

**Who.** Signed-in account. Bearer access token.

The signed-in user, including the resident or staff profile summary.

**Responses**

#### 200

Current account.

Body: [CurrentUser](#schema-currentuser).

| Field | Required | Type | Notes |
|---|---|---|---|
| `id` | yes | uuid |  |
| `role` | yes | `resident` or `gate` or `warden` or `provost` |  |
| `full_name` | yes | string |  |
| `username` | yes | string |  |
| `status` | yes | `active` or `suspended` |  |
| `resident` | no | [ResidentSummary](#schema-residentsummary) or null |  |
| `staff` | no | [StaffSummary](#schema-staffsummary) or null |  |

#### 401

The access token is missing or expired, or the username and password were refused.

Body: [ErrorResponse](#schema-errorresponse).


### <a id="post-api-v1-auth-change-password"></a>POST `/api/v1/auth/change-password` — Change own password

`change_password`

**Who.** Signed-in account. Bearer access token.

Checks the current password, stores a new hash, and revokes refresh tokens.

**Request.** Required.

Body: [ChangePasswordRequest](#schema-changepasswordrequest).

| Field | Required | Type | Notes |
|---|---|---|---|
| `current_password` | yes | string | 1–200 characters. |
| `new_password` | yes | string | 10–200 characters. |

**Responses**

#### 204

Password changed.

No body.

#### 401

The access token is missing or expired, or the username and password were refused.

Body: [ErrorResponse](#schema-errorresponse).

#### 422

The JSON is the wrong shape, or a field fails a constraint that does not depend on existing rows.

Body: [ErrorResponse](#schema-errorresponse).


## <a id="tag-resident"></a>Resident

The resident phone. Ordinary outings, home, destinations, and the hall pass.

| Method | Path | Purpose | Who |
|---|---|---|---|
| GET | `/api/v1/me/home` | [Resident home](#get-api-v1-me-home) | resident |
| GET | `/api/v1/me/hall-pass` | [Permanent hall pass](#get-api-v1-me-hall-pass) | resident |
| GET | `/api/v1/me/history` | [Own exit and return history](#get-api-v1-me-history) | resident |
| GET | `/api/v1/destinations` | [Ordinary outing destinations](#get-api-v1-destinations) | Signed-in account |
| GET | `/api/v1/me/outings` | [Ordinary outing plans](#get-api-v1-me-outings) | resident |
| POST | `/api/v1/me/outings` | [Plan an ordinary outing](#post-api-v1-me-outings) | resident |
| GET | `/api/v1/me/outings/current` | [Open outing](#get-api-v1-me-outings-current) | resident |
| POST | `/api/v1/me/outings/{outing_id}/cancel` | [Cancel a planned outing](#post-api-v1-me-outings-outing_id-cancel) | resident |
| POST | `/api/v1/me/expire-passed` | [Expire own passed plans and permissions](#post-api-v1-me-expire-passed) | resident |

### <a id="get-api-v1-me-home"></a>GET `/api/v1/me/home` — Resident home

`resident_home`

**Who.** resident. Bearer access token.

Caller: resident. Presence, room, the open outing if there is one, the
permission the resident is waiting on or cleared to use, and the last
ten exit and return lines. Does not cancel passed plans or expire
permissions; call POST /api/v1/me/expire-passed first when the phone
needs a fresh home screen.

**Responses**

#### 200

Home screen.

Body: [ResidentHome](#schema-residenthome).

| Field | Required | Type | Notes |
|---|---|---|---|
| `resident` | yes | [ResidentSummary](#schema-residentsummary) |  |
| `current_outing` | yes | [Outing](#schema-outing) or null |  |
| `active_permission` | yes | [Permission](#schema-permission) or null | The newest permission in `pending`, `approved`, or `in_use`, if any. |
| `recent_history` | yes | list of [HistoryEvent](#schema-historyevent) |  |

**Example**

```json
{
  "resident": {
    "enrolment_number": "24-GLLB-118",
    "course": "B.A. LL.B. (Hons.)",
    "room_label": "B-204",
    "block_name": "Block-B",
    "presence": "inside"
  },
  "current_outing": null,
  "active_permission": null,
  "recent_history": [
    {
      "event": "returned",
      "place": "Maulana Azad Library",
      "occurred_at": "2026-09-12T15:16:00Z",
      "outing_id": "00000000-0000-4000-8000-000000000001"
    }
  ]
}
```

#### 401

The access token is missing or expired, or the username and password were refused.

Body: [ErrorResponse](#schema-errorresponse).

#### 403

The signed-in role cannot call this operation.

Body: [ErrorResponse](#schema-errorresponse).


### <a id="get-api-v1-me-hall-pass"></a>GET `/api/v1/me/hall-pass` — Permanent hall pass

`resident_hall_pass`

**Who.** resident. Bearer access token.

Caller: resident. Returns the payload the phone encodes as a QR image.
The same payload is used to leave and to come back. It changes only when
the provost reissues it.

**Responses**

#### 200

Hall pass payload.

Body: [HallPass](#schema-hallpass).

| Field | Required | Type | Notes |
|---|---|---|---|
| `qr_payload` | yes | string | Text encoded in the QR image. Prefix `bsj:v1:`. |
| `full_name` | yes | string |  |
| `room_label` | yes | string |  |

**Example**

```json
{
  "qr_payload": "bsj:v1:example-token",
  "full_name": "Aisha Khan",
  "room_label": "B-204"
}
```

#### 401

The access token is missing or expired, or the username and password were refused.

Body: [ErrorResponse](#schema-errorresponse).

#### 403

The signed-in role cannot call this operation.

Body: [ErrorResponse](#schema-errorresponse).


### <a id="get-api-v1-me-history"></a>GET `/api/v1/me/history` — Own exit and return history

`resident_history`

**Who.** resident. Bearer access token.

Caller: resident. Newest first. Each outing contributes an exit line and, once returned, a return line.

**Parameters**

| Name | In | Required | Type | Notes |
|---|---|---|---|---|
| `limit` | query | no | integer | 1–500. default `50`. |
| `offset` | query | no | integer | minimum 0. default `0`. |

**Responses**

#### 200

History page.

Body: [HistoryPage](#schema-historypage).

| Field | Required | Type | Notes |
|---|---|---|---|
| `total` | yes | integer | minimum 0. |
| `limit` | yes | integer |  |
| `offset` | yes | integer |  |
| `items` | yes | list of [HistoryEvent](#schema-historyevent) |  |

#### 401

The access token is missing or expired, or the username and password were refused.

Body: [ErrorResponse](#schema-errorresponse).

#### 403

The signed-in role cannot call this operation.

Body: [ErrorResponse](#schema-errorresponse).


### <a id="get-api-v1-destinations"></a>GET `/api/v1/destinations` — Ordinary outing destinations

`list_destinations`

**Who.** Signed-in account. Bearer access token.

Active catalog. Named places are alphabetical, ignoring capitals. The
free-text choice, Other, is always last. Any signed-in user may read
it. The provost edits it. A retired destination stays on file and is
left off this list.

**Responses**

#### 200

Active destinations.

Body: [DestinationList](#schema-destinationlist).

| Field | Required | Type | Notes |
|---|---|---|---|
| `items` | yes | list of [Destination](#schema-destination) |  |

**Example**

```json
{
  "items": [
    {
      "id": "1285f918-cd9c-5ef8-9c04-58a69285211c",
      "name": "J.N. Medical College",
      "is_other": false,
      "is_active": true
    },
    {
      "id": "fc2da7c5-8d65-5680-8034-d8acb69745eb",
      "name": "Maulana Azad Library",
      "is_other": false,
      "is_active": true
    },
    {
      "id": "924e5c75-e9b6-57a9-bb04-720028253526",
      "name": "Shamshad Market",
      "is_other": false,
      "is_active": true
    },
    {
      "id": "df29c4b7-63c5-525d-a9ec-798a980c64c8",
      "name": "Women's College",
      "is_other": false,
      "is_active": true
    },
    {
      "id": "f2008ef3-a1df-5ff0-b936-3466d0914781",
      "name": "Other",
      "is_other": true,
      "is_active": true
    }
  ]
}
```

#### 401

The access token is missing or expired, or the username and password were refused.

Body: [ErrorResponse](#schema-errorresponse).


### <a id="get-api-v1-me-outings"></a>GET `/api/v1/me/outings` — Ordinary outing plans

`list_outings`

**Who.** resident. Bearer access token.

Caller: resident. Her planned and outside outings, soonest return
first. Several may fall on the same hall day. A later return today, and
a later day, stay on this list. The open outing is the one she is
outside on, or the soonest plan for today. Does not cancel passed
plans; call POST /api/v1/me/expire-passed (or plan/cancel/scan) first
when the phone needs a fresh list.

**Responses**

#### 200

Planned and outside outings.

Body: [OutingList](#schema-outinglist).

| Field | Required | Type | Notes |
|---|---|---|---|
| `items` | yes | list of [Outing](#schema-outing) |  |

#### 401

The access token is missing or expired, or the username and password were refused.

Body: [ErrorResponse](#schema-errorresponse).

#### 403

The signed-in role cannot call this operation.

Body: [ErrorResponse](#schema-errorresponse).


### <a id="post-api-v1-me-outings"></a>POST `/api/v1/me/outings` — Plan an ordinary outing

`plan_outing`

**Who.** resident. Bearer access token.

Caller: resident. This is required before an ordinary exit scan. The
scan does not ask for a destination or an expected return. She may plan
several returns, including two on the same hall day, such as noon and
5:00 PM. She may already be outside. Two planned or outside outings
cannot end at the same instant.

Sets destination and expected return. Does not record the exit. The gate
scan does that. No warden approval. Grace is the hall's `grace_minutes`
added to the expected return, and is returned on the outing so the phone
can show when the guardian would be told.

The expected return must be in the future and inside ordinary hours on
that hall date. The start of the window is not included. The end is
included. Summer, 1 April through 30 September, is 6:30 AM to 6:30 PM.
Winter, 1 October through 31 March, is 6:30 AM to 5:30 PM. A return at
or before the start is outside ordinary hours. A return after the end
needs late-night permission or home going. When the chosen destination
is the Other row, `destination_text` is required. A planned outing
whose expected return has already passed is cancelled by the system,
with no staff member, before this plan is saved.

**Request.** Required.

Body: [PlanOutingRequest](#schema-planoutingrequest).

| Field | Required | Type | Notes |
|---|---|---|---|
| `destination_id` | yes | uuid |  |
| `destination_text` | no | string | Required when the destination is the Other row. Ignored otherwise. 1–120 characters. |
| `expected_return_at` | yes | date-time |  |

**Example**

```json
{
  "destination_id": "fc2da7c5-8d65-5680-8034-d8acb69745eb",
  "expected_return_at": "2026-09-30T13:00:00Z"
}
```

**Responses**

#### 201

Outing planned. Her presence is unchanged.

Body: [Outing](#schema-outing).

| Field | Required | Type | Notes |
|---|---|---|---|
| `id` | yes | uuid |  |
| `permission_id` | no | uuid or null | Empty for an ordinary outing. Set when the exit used a permission. |
| `type` | yes | `ordinary` or `late_night` or `home_going` |  |
| `status` | yes | `planned` or `outside` or `returned` or `cancelled` |  |
| `place` | yes | string | List name, the words typed for Other, or the permission's short place. |
| `expected_return_at` | yes | date-time | UTC instant. Clients show India time on a 12-hour clock. |
| `grace_ends_at` | yes | date-time |  |
| `exited_at` | no | date-time or null | Empty only while an ordinary outing is still planned. Required once the resident has left. |
| `exit_recorded_by_name` | no | string or null | Staff member who scanned the exit. Empty only while exited_at is empty. |
| `returned_at` | no | date-time or null | Empty until the return scan. Required once the resident has returned. |
| `return_recorded_by_name` | no | string or null | Staff member who scanned the return. Empty only while returned_at is empty. |
| `is_late` | yes | boolean |  |
| `created_at` | yes | date-time |  |

#### 401

The access token is missing or expired, or the username and password were refused.

Body: [ErrorResponse](#schema-errorresponse).

#### 403

The signed-in role cannot call this operation.

Body: [ErrorResponse](#schema-errorresponse).

#### 409

`return_already_planned` says she already has an outing ending at
that time. `outside_ordinary_hours` says that return is outside
ordinary hours. `permission_required` says that return is outside
ordinary hours. Please submit a permission request.

Body: [ErrorResponse](#schema-errorresponse).

#### 422

The JSON is the wrong shape, or a field fails a constraint that does not depend on existing rows.

Body: [ErrorResponse](#schema-errorresponse).


### <a id="get-api-v1-me-outings-current"></a>GET `/api/v1/me/outings/current` — Open outing

`current_outing`

**Who.** resident. Bearer access token.

Caller: resident. The outing she is outside on, or the soonest plan
whose return falls on today's hall date, or null. A later plan today
stays on the plan list. A plan for a later day stays there too. Does
not cancel passed plans; call POST /api/v1/me/expire-passed (or
plan/cancel/scan) first when the phone needs a fresh open outing. An
outside outing stays outside. It is late only after grace.

**Responses**

#### 200

Open outing, if any.

Body: [CurrentOuting](#schema-currentouting).

| Field | Required | Type | Notes |
|---|---|---|---|
| `outing` | yes | [Outing](#schema-outing) or null |  |

#### 401

The access token is missing or expired, or the username and password were refused.

Body: [ErrorResponse](#schema-errorresponse).

#### 403

The signed-in role cannot call this operation.

Body: [ErrorResponse](#schema-errorresponse).


### <a id="post-api-v1-me-outings-outing_id-cancel"></a>POST `/api/v1/me/outings/{outing_id}/cancel` — Cancel a planned outing

`cancel_outing`

**Who.** resident. Bearer access token.

Caller: resident. She chooses which plan. Allowed only while that
outing is `planned`. Other plans stay planned, including another return
today. An exit that has already
been scanned is closed by a return scan, not by cancel. A plan whose
expected return has already passed is cancelled by the system first,
with no staff member.

**Parameters**

| Name | In | Required | Type | Notes |
|---|---|---|---|---|
| `outing_id` | path | yes | uuid |  |

**Responses**

#### 200

Outing cancelled.

Body: [Outing](#schema-outing).

| Field | Required | Type | Notes |
|---|---|---|---|
| `id` | yes | uuid |  |
| `permission_id` | no | uuid or null | Empty for an ordinary outing. Set when the exit used a permission. |
| `type` | yes | `ordinary` or `late_night` or `home_going` |  |
| `status` | yes | `planned` or `outside` or `returned` or `cancelled` |  |
| `place` | yes | string | List name, the words typed for Other, or the permission's short place. |
| `expected_return_at` | yes | date-time | UTC instant. Clients show India time on a 12-hour clock. |
| `grace_ends_at` | yes | date-time |  |
| `exited_at` | no | date-time or null | Empty only while an ordinary outing is still planned. Required once the resident has left. |
| `exit_recorded_by_name` | no | string or null | Staff member who scanned the exit. Empty only while exited_at is empty. |
| `returned_at` | no | date-time or null | Empty until the return scan. Required once the resident has returned. |
| `return_recorded_by_name` | no | string or null | Staff member who scanned the return. Empty only while returned_at is empty. |
| `is_late` | yes | boolean |  |
| `created_at` | yes | date-time |  |

#### 401

The access token is missing or expired, or the username and password were refused.

Body: [ErrorResponse](#schema-errorresponse).

#### 403

The signed-in role cannot call this operation.

Body: [ErrorResponse](#schema-errorresponse).

#### 404

No record with that id is visible to the caller.

Body: [ErrorResponse](#schema-errorresponse).

#### 409

`no_outing_planned` says there is no planned outing. `already_outside`
says she is already outside.

Body: [ErrorResponse](#schema-errorresponse).


### <a id="post-api-v1-me-expire-passed"></a>POST `/api/v1/me/expire-passed` — Expire own passed plans and permissions

`expire_own_passed`

**Who.** resident. Bearer access token.

Caller: resident. Marks this resident's planned ordinary outings whose
expected return has passed as cancelled, and marks unused approved
permissions whose expected return has passed as expired. GET routes do
not perform this work. Safe to call before painting home or lists.

**Responses**

#### 200

Counts of rows updated.

Body: [ExpirePassedResult](#schema-expirepassedresult).

| Field | Required | Type | Notes |
|---|---|---|---|
| `plans_expired` | yes | integer | Planned ordinary outings cancelled because expected return passed. minimum 0. |
| `permissions_expired` | yes | integer | Unused approved permissions marked expired. minimum 0. |

#### 401

The access token is missing or expired, or the username and password were refused.

Body: [ErrorResponse](#schema-errorresponse).

#### 403

The signed-in role cannot call this operation.

Body: [ErrorResponse](#schema-errorresponse).


## <a id="tag-permissions"></a>Permissions

Late-night and home-going permissions. Resident requests under /api/v1/me/permissions; warden or provost queue and decisions under /api/v1/permissions.

| Method | Path | Purpose | Who |
|---|---|---|---|
| GET | `/api/v1/me/permissions` | [Own special permissions](#get-api-v1-me-permissions) | resident |
| POST | `/api/v1/me/permissions` | [Request late-night or home going](#post-api-v1-me-permissions) | resident |
| GET | `/api/v1/me/permissions/{permission_id}` | [Own permission](#get-api-v1-me-permissions-permission_id) | resident |
| POST | `/api/v1/me/permissions/{permission_id}/cancel` | [Cancel own permission](#post-api-v1-me-permissions-permission_id-cancel) | resident |
| GET | `/api/v1/permissions` | [Permission queue](#get-api-v1-permissions) | warden or provost |
| POST | `/api/v1/permissions/expire-passed` | [Expire passed unused permissions](#post-api-v1-permissions-expire-passed) | warden or provost |
| GET | `/api/v1/permissions/{permission_id}` | [Permission for review](#get-api-v1-permissions-permission_id) | warden or provost |
| POST | `/api/v1/permissions/{permission_id}/decision` | [Approve or reject a permission](#post-api-v1-permissions-permission_id-decision) | warden or provost |

### <a id="get-api-v1-me-permissions"></a>GET `/api/v1/me/permissions` — Own special permissions

`list_own_permissions`

**Who.** resident. Bearer access token.

Caller: resident. Newest first. Includes late-night and home going. Each
item is a Permission (no resident_id, resident_name, or room_label — the
caller already is that resident). Does not expire passed permissions;
call POST /api/v1/me/expire-passed first when the phone needs a fresh
status.

**Parameters**

| Name | In | Required | Type | Notes |
|---|---|---|---|---|
| `limit` | query | no | integer | 1–500. default `50`. |
| `offset` | query | no | integer | minimum 0. default `0`. |
| `status` | query | no | `pending` or `approved` or `rejected` or `cancelled` or `in_use` or `completed` or `expired` |  |

**Responses**

#### 200

Permission page.

Body: [PermissionPage](#schema-permissionpage).

| Field | Required | Type | Notes |
|---|---|---|---|
| `total` | yes | integer | minimum 0. |
| `limit` | yes | integer |  |
| `offset` | yes | integer |  |
| `items` | yes | list of [Permission](#schema-permission) | Resident own-list cards. No resident_id/name/room on each row. |

#### 401

The access token is missing or expired, or the username and password were refused.

Body: [ErrorResponse](#schema-errorresponse).

#### 403

The signed-in role cannot call this operation.

Body: [ErrorResponse](#schema-errorresponse).


### <a id="post-api-v1-me-permissions"></a>POST `/api/v1/me/permissions` — Request late-night or home going

`submit_permission`

**Who.** resident. Bearer access token.

Caller: resident. A warden or the provost decides later. Also expires this resident's unused approved permissions whose
expected return has passed. Submitting does
not let the resident leave. The hall pass can be used for this permission
only after it is approved and the gate scans it inside the use window.

`departure_at` must not be in the past. A few minutes of clock skew are
allowed. There is no maximum how far ahead the departure may be.
`expected_return_at` must be after `departure_at`. Home going requires
`short_place`, `address`, and `reason`. Late-night requires `short_place`
and `reason`, and may include `destination_detail`. `short_place` is
typed on this form. It is not chosen from the ordinary destination list.

**Request.** Required.

One of: [LateNightCreate](#schema-latenightcreate), [HomeGoingCreate](#schema-homegoingcreate).

**LateNightCreate**

| Field | Required | Type | Notes |
|---|---|---|---|
| `type` | yes | `late_night` |  |
| `short_place` | yes | string | Typed by the resident. Not chosen from the ordinary destination list. 1–120 characters. |
| `destination_detail` | no | string | 1–120 characters. |
| `reason` | yes | string | 1–500 characters. |
| `departure_at` | yes | date-time |  |
| `expected_return_at` | yes | date-time |  |

**HomeGoingCreate**

| Field | Required | Type | Notes |
|---|---|---|---|
| `type` | yes | `home_going` |  |
| `short_place` | yes | string | Short place on the warden card, such as Lucknow. 1–120 characters. |
| `address` | yes | string | 1–300 characters. |
| `reason` | yes | string | 1–500 characters. |
| `departure_at` | yes | date-time |  |
| `expected_return_at` | yes | date-time |  |

**late_night**

```json
{
  "type": "late_night",
  "short_place": "Women's College",
  "destination_detail": "Seminar Hall",
  "reason": "Faculty seminar ends at 9:00 PM. Requesting late return to hall.",
  "departure_at": "2026-09-13T13:00:00Z",
  "expected_return_at": "2026-09-13T16:00:00Z"
}
```

**home_going**

```json
{
  "type": "home_going",
  "short_place": "Lucknow",
  "address": "14, Civil Lines, Lucknow, U.P. 226001",
  "reason": "Family visit. Eid with parents.",
  "departure_at": "2026-09-19T02:30:00Z",
  "expected_return_at": "2026-09-21T13:30:00Z"
}
```

**Responses**

#### 201

Permission is pending.

Body: [Permission](#schema-permission).

| Field | Required | Type | Notes |
|---|---|---|---|
| `id` | yes | uuid |  |
| `type` | yes | `late_night` or `home_going` |  |
| `status` | yes | `pending` or `approved` or `rejected` or `cancelled` or `in_use` or `completed` or `expired` |  |
| `short_place` | yes | string |  |
| `destination_detail` | no | string or null |  |
| `address` | no | string or null |  |
| `reason` | yes | string |  |
| `departure_at` | yes | date-time |  |
| `expected_return_at` | yes | date-time |  |
| `decision_note` | no | string or null |  |
| `decided_at` | no | date-time or null |  |
| `created_at` | yes | date-time |  |

#### 401

The access token is missing or expired, or the username and password were refused.

Body: [ErrorResponse](#schema-errorresponse).

#### 403

The signed-in role cannot call this operation.

Body: [ErrorResponse](#schema-errorresponse).

#### 422

The JSON is the wrong shape, or a field fails a constraint that does not depend on existing rows.

Body: [ErrorResponse](#schema-errorresponse).


### <a id="get-api-v1-me-permissions-permission_id"></a>GET `/api/v1/me/permissions/{permission_id}` — Own permission

`get_own_permission`

**Who.** resident. Bearer access token.

Caller: resident. Refuses another resident's permission. Does not expire
a passed approved permission; call POST /api/v1/me/expire-passed (or a
write such as cancel) when the phone needs a fresh status.

**Parameters**

| Name | In | Required | Type | Notes |
|---|---|---|---|---|
| `permission_id` | path | yes | uuid |  |

**Responses**

#### 200

Permission.

Body: [Permission](#schema-permission).

| Field | Required | Type | Notes |
|---|---|---|---|
| `id` | yes | uuid |  |
| `type` | yes | `late_night` or `home_going` |  |
| `status` | yes | `pending` or `approved` or `rejected` or `cancelled` or `in_use` or `completed` or `expired` |  |
| `short_place` | yes | string |  |
| `destination_detail` | no | string or null |  |
| `address` | no | string or null |  |
| `reason` | yes | string |  |
| `departure_at` | yes | date-time |  |
| `expected_return_at` | yes | date-time |  |
| `decision_note` | no | string or null |  |
| `decided_at` | no | date-time or null |  |
| `created_at` | yes | date-time |  |

#### 401

The access token is missing or expired, or the username and password were refused.

Body: [ErrorResponse](#schema-errorresponse).

#### 403

The signed-in role cannot call this operation.

Body: [ErrorResponse](#schema-errorresponse).

#### 404

No record with that id is visible to the caller.

Body: [ErrorResponse](#schema-errorresponse).


### <a id="post-api-v1-me-permissions-permission_id-cancel"></a>POST `/api/v1/me/permissions/{permission_id}/cancel` — Cancel own permission

`cancel_permission`

**Who.** resident. Bearer access token.

Caller: resident. Allowed while `pending` or `approved` and unused at
the gate (no exit scan; status is not `in_use`). Not allowed once the
gate has recorded an exit against it.

**Parameters**

| Name | In | Required | Type | Notes |
|---|---|---|---|---|
| `permission_id` | path | yes | uuid |  |

**Responses**

#### 200

Permission cancelled.

Body: [Permission](#schema-permission).

| Field | Required | Type | Notes |
|---|---|---|---|
| `id` | yes | uuid |  |
| `type` | yes | `late_night` or `home_going` |  |
| `status` | yes | `pending` or `approved` or `rejected` or `cancelled` or `in_use` or `completed` or `expired` |  |
| `short_place` | yes | string |  |
| `destination_detail` | no | string or null |  |
| `address` | no | string or null |  |
| `reason` | yes | string |  |
| `departure_at` | yes | date-time |  |
| `expected_return_at` | yes | date-time |  |
| `decision_note` | no | string or null |  |
| `decided_at` | no | date-time or null |  |
| `created_at` | yes | date-time |  |

#### 401

The access token is missing or expired, or the username and password were refused.

Body: [ErrorResponse](#schema-errorresponse).

#### 403

The signed-in role cannot call this operation.

Body: [ErrorResponse](#schema-errorresponse).

#### 404

No record with that id is visible to the caller.

Body: [ErrorResponse](#schema-errorresponse).

#### 409

`permission_in_use` when the gate has already recorded an exit against
this permission. Otherwise only pending or approved may be cancelled;
the message names the current status (`not_cancellable`).

Body: [ErrorResponse](#schema-errorresponse).


### <a id="get-api-v1-permissions"></a>GET `/api/v1/permissions` — Permission queue

`list_permissions`

**Who.** warden or provost. Bearer access token.

Caller: warden or provost. Defaults to `pending`. Ordered by
`created_at`, newest first (`order=newest`). Pass `order=oldest` for
oldest first. Optional filters narrow the page: `block_id` is the block
of the resident's current room; `type` is late-night or home going;
`created_from` and `created_to` are inclusive UTC bounds on
`created_at`. Each item is a PermissionReview (includes resident
identity). Does not expire passed permissions; call
POST /api/v1/permissions/expire-passed first when the queue needs a
fresh status.

**Parameters**

| Name | In | Required | Type | Notes |
|---|---|---|---|---|
| `status` | query | no | `pending` or `approved` or `rejected` or `cancelled` or `in_use` or `completed` or `expired` | Defaults to pending when omitted. |
| `type` | query | no | `late_night` or `home_going` | Limit to late-night or home-going permissions. |
| `block_id` | query | no | uuid | Limit to residents whose current room is in this block. |
| `created_from` | query | no | date-time | Inclusive lower bound on created_at (UTC instant). |
| `created_to` | query | no | date-time | Inclusive upper bound on created_at (UTC instant). |
| `order` | query | no | `newest` or `oldest` | Sort by created_at. Default newest. default `newest`. |
| `limit` | query | no | integer | 1–500. default `50`. |
| `offset` | query | no | integer | minimum 0. default `0`. |

**Responses**

#### 200

Permission page.

Body: [PermissionReviewPage](#schema-permissionreviewpage).

| Field | Required | Type | Notes |
|---|---|---|---|
| `total` | yes | integer | minimum 0. |
| `limit` | yes | integer |  |
| `offset` | yes | integer |  |
| `items` | yes | list of [PermissionReview](#schema-permissionreview) | Staff queue rows, including host resident identity. |

#### 401

The access token is missing or expired, or the username and password were refused.

Body: [ErrorResponse](#schema-errorresponse).

#### 403

The signed-in role cannot call this operation.

Body: [ErrorResponse](#schema-errorresponse).


### <a id="post-api-v1-permissions-expire-passed"></a>POST `/api/v1/permissions/expire-passed` — Expire passed unused permissions

`expire_passed_permissions`

**Who.** warden or provost. Bearer access token.

Caller: warden or provost. Marks every unused approved permission whose
expected return has passed as expired. GET queue and GET-by-id do not
perform this work. Safe to call before opening the queue.

**Responses**

#### 200

Count of permissions updated.

Body: [ExpirePassedPermissionsResult](#schema-expirepassedpermissionsresult).

| Field | Required | Type | Notes |
|---|---|---|---|
| `permissions_expired` | yes | integer | Unused approved permissions marked expired. minimum 0. |

#### 401

The access token is missing or expired, or the username and password were refused.

Body: [ErrorResponse](#schema-errorresponse).

#### 403

The signed-in role cannot call this operation.

Body: [ErrorResponse](#schema-errorresponse).


### <a id="get-api-v1-permissions-permission_id"></a>GET `/api/v1/permissions/{permission_id}` — Permission for review

`get_permission`

**Who.** warden or provost. Bearer access token.

Caller: warden or provost. Does not expire a passed approved permission;
call POST /api/v1/permissions/expire-passed first when review needs a
fresh status.

**Parameters**

| Name | In | Required | Type | Notes |
|---|---|---|---|---|
| `permission_id` | path | yes | uuid |  |

**Responses**

#### 200

Permission, including the resident's name and room.

Body: [PermissionReview](#schema-permissionreview).

| Field | Required | Type | Notes |
|---|---|---|---|
| `id` | yes | uuid |  |
| `type` | yes | `late_night` or `home_going` |  |
| `status` | yes | `pending` or `approved` or `rejected` or `cancelled` or `in_use` or `completed` or `expired` |  |
| `short_place` | yes | string |  |
| `destination_detail` | no | string or null |  |
| `address` | no | string or null |  |
| `reason` | yes | string |  |
| `departure_at` | yes | date-time |  |
| `expected_return_at` | yes | date-time |  |
| `decision_note` | no | string or null |  |
| `decided_at` | no | date-time or null |  |
| `created_at` | yes | date-time |  |
| `resident_id` | yes | uuid |  |
| `resident_name` | yes | string |  |
| `room_label` | yes | string |  |
| `decided_by_name` | no | string or null |  |

#### 401

The access token is missing or expired, or the username and password were refused.

Body: [ErrorResponse](#schema-errorresponse).

#### 403

The signed-in role cannot call this operation.

Body: [ErrorResponse](#schema-errorresponse).

#### 404

No record with that id is visible to the caller.

Body: [ErrorResponse](#schema-errorresponse).


### <a id="post-api-v1-permissions-permission_id-decision"></a>POST `/api/v1/permissions/{permission_id}/decision` — Approve or reject a permission

`decide_permission`

**Who.** warden or provost. Bearer access token.

Caller: warden or provost. Only a `pending` permission can be decided.
Before deciding, expires this permission if it is an unused approved
request whose expected return has already passed. Approval does not
create an outing and does not by itself let a scan succeed before the
use window. Rejection leaves ordinary outings available.

**Parameters**

| Name | In | Required | Type | Notes |
|---|---|---|---|---|
| `permission_id` | path | yes | uuid |  |

**Request.** Required.

Body: [DecisionRequest](#schema-decisionrequest).

| Field | Required | Type | Notes |
|---|---|---|---|
| `decision` | yes | `approved` or `rejected` |  |
| `note` | no | string | at most 500 characters. |

**Example**

```json
{
  "decision": "approved",
  "note": ""
}
```

**Responses**

#### 200

Decision stored.

Body: [PermissionReview](#schema-permissionreview).

| Field | Required | Type | Notes |
|---|---|---|---|
| `id` | yes | uuid |  |
| `type` | yes | `late_night` or `home_going` |  |
| `status` | yes | `pending` or `approved` or `rejected` or `cancelled` or `in_use` or `completed` or `expired` |  |
| `short_place` | yes | string |  |
| `destination_detail` | no | string or null |  |
| `address` | no | string or null |  |
| `reason` | yes | string |  |
| `departure_at` | yes | date-time |  |
| `expected_return_at` | yes | date-time |  |
| `decision_note` | no | string or null |  |
| `decided_at` | no | date-time or null |  |
| `created_at` | yes | date-time |  |
| `resident_id` | yes | uuid |  |
| `resident_name` | yes | string |  |
| `room_label` | yes | string |  |
| `decided_by_name` | no | string or null |  |

#### 401

The access token is missing or expired, or the username and password were refused.

Body: [ErrorResponse](#schema-errorresponse).

#### 403

The signed-in role cannot call this operation.

Body: [ErrorResponse](#schema-errorresponse).

#### 404

No record with that id is visible to the caller.

Body: [ErrorResponse](#schema-errorresponse).

#### 409

Only a pending permission can be approved or rejected. The message
names the current status. Code `not_pending`.

Body: [ErrorResponse](#schema-errorresponse).


## <a id="tag-guest-stays"></a>Guest Stays

Guest applications. Resident applies under /api/v1/me/guest-stays; warden or provost review under /api/v1/guest-stays. Gate arrival and departure stay under Gate.

| Method | Path | Purpose | Who |
|---|---|---|---|
| GET | `/api/v1/me/guest-stays` | [Own guest applications](#get-api-v1-me-guest-stays) | resident |
| POST | `/api/v1/me/guest-stays` | [Apply for a guest stay](#post-api-v1-me-guest-stays) | resident |
| GET | `/api/v1/me/guest-stays/{guest_stay_id}` | [Own guest stay](#get-api-v1-me-guest-stays-guest_stay_id) | resident, and only for a stay they host |
| POST | `/api/v1/me/guest-stays/{guest_stay_id}/cancel` | [Cancel own guest application](#post-api-v1-me-guest-stays-guest_stay_id-cancel) | resident |
| GET | `/api/v1/guest-stays` | [Guest stays](#get-api-v1-guest-stays) | warden or provost |
| GET | `/api/v1/guest-stays/{guest_stay_id}` | [Guest stay for review](#get-api-v1-guest-stays-guest_stay_id) | warden or provost |
| POST | `/api/v1/guest-stays/{guest_stay_id}/decision` | [Approve or reject a guest stay](#post-api-v1-guest-stays-guest_stay_id-decision) | warden or provost |
| POST | `/api/v1/guest-stays/{guest_stay_id}/payment` | [Mark guest payment](#post-api-v1-guest-stays-guest_stay_id-payment) | warden or provost |

### <a id="get-api-v1-me-guest-stays"></a>GET `/api/v1/me/guest-stays` — Own guest applications

`list_own_guest_stays`

**Who.** resident. Bearer access token.

Caller: resident. Stays this resident is hosting. Newest first. Each
item is a GuestStaySummary card; open GET by id for the full GuestStay.

**Parameters**

| Name | In | Required | Type | Notes |
|---|---|---|---|---|
| `limit` | query | no | integer | 1–500. default `50`. |
| `offset` | query | no | integer | minimum 0. default `0`. |

**Responses**

#### 200

Guest stay page of GuestStaySummary cards.

Body: [GuestStayPage](#schema-gueststaypage).

| Field | Required | Type | Notes |
|---|---|---|---|
| `total` | yes | integer | minimum 0. |
| `limit` | yes | integer |  |
| `offset` | yes | integer |  |
| `items` | yes | list of [GuestStaySummary](#schema-gueststaysummary) |  |

#### 401

The access token is missing or expired, or the username and password were refused.

Body: [ErrorResponse](#schema-errorresponse).

#### 403

The signed-in role cannot call this operation.

Body: [ErrorResponse](#schema-errorresponse).


### <a id="post-api-v1-me-guest-stays"></a>POST `/api/v1/me/guest-stays` — Apply for a guest stay

`submit_guest_stay`

**Who.** resident. Bearer access token.

Caller: resident. Start date must be at least `guest_min_lead_days`
after today in Asia/Kolkata (by default, tomorrow or later). Inclusive
days from start through end must be within `guest_max_inclusive_days`
(by default, 7). Friday 18 September through Monday 21 September is 4 days.
Payment is not taken here.

**Request.** Required.

Body: [GuestStayCreate](#schema-gueststaycreate).

| Field | Required | Type | Notes |
|---|---|---|---|
| `guest_name` | yes | string | 1–120 characters. |
| `relation` | yes | string | 1–80 characters. |
| `start_date` | yes | date |  |
| `end_date` | yes | date |  |
| `reason` | yes | string | 1–500 characters. |

**Example**

```json
{
  "guest_name": "Zara Ahmed",
  "relation": "Cousin",
  "start_date": "2026-09-18",
  "end_date": "2026-09-21",
  "reason": "Family wedding in Aligarh. Staying with Aisha, B-204."
}
```

**Responses**

#### 201

Guest stay is pending. Payment is unpaid.

Body: [GuestStay](#schema-gueststay).

| Field | Required | Type | Notes |
|---|---|---|---|
| `id` | yes | uuid |  |
| `host_resident_id` | yes | uuid |  |
| `host_name` | yes | string |  |
| `host_room_label` | yes | string |  |
| `guest_name` | yes | string |  |
| `relation` | yes | string |  |
| `start_date` | yes | date |  |
| `end_date` | yes | date |  |
| `inclusive_days` | yes | integer |  |
| `reason` | yes | string |  |
| `status` | yes | `pending` or `approved` or `rejected` or `cancelled` or `departed` |  |
| `payment_status` | yes | `unpaid` or `paid` |  |
| `bucket` | yes | `pending` or `upcoming` or `expected` or `not_expected` or `in_hall` or `should_have_left` or `departed` or `rejected` or `cancelled` |  |
| `decision_note` | no | string or null |  |
| `decided_by_name` | no | string or null | Empty while waiting, and empty if the resident cancels before a decision. Set once a warden or the provost approves or rejects. |
| `arrived_recorded_by_name` | no | string or null | Staff member who recorded arrival. Empty until arrival is recorded. |
| `departed_recorded_by_name` | no | string or null | Staff member who recorded departure. Empty until departure is recorded. |
| `arrived_at` | no | date-time or null |  |
| `departed_at` | no | date-time or null |  |
| `created_at` | yes | date-time |  |

#### 401

The access token is missing or expired, or the username and password were refused.

Body: [ErrorResponse](#schema-errorresponse).

#### 403

The signed-in role cannot call this operation.

Body: [ErrorResponse](#schema-errorresponse).

#### 422

The JSON is the wrong shape, or a field fails a constraint that does not depend on existing rows.

Body: [ErrorResponse](#schema-errorresponse).


### <a id="get-api-v1-me-guest-stays-guest_stay_id"></a>GET `/api/v1/me/guest-stays/{guest_stay_id}` — Own guest stay

`get_own_guest_stay`

**Who.** resident, and only for a stay they host. Bearer access token.

Caller: resident, and only for a stay they host.

**Parameters**

| Name | In | Required | Type | Notes |
|---|---|---|---|---|
| `guest_stay_id` | path | yes | uuid |  |

**Responses**

#### 200

Guest stay.

Body: [GuestStay](#schema-gueststay).

| Field | Required | Type | Notes |
|---|---|---|---|
| `id` | yes | uuid |  |
| `host_resident_id` | yes | uuid |  |
| `host_name` | yes | string |  |
| `host_room_label` | yes | string |  |
| `guest_name` | yes | string |  |
| `relation` | yes | string |  |
| `start_date` | yes | date |  |
| `end_date` | yes | date |  |
| `inclusive_days` | yes | integer |  |
| `reason` | yes | string |  |
| `status` | yes | `pending` or `approved` or `rejected` or `cancelled` or `departed` |  |
| `payment_status` | yes | `unpaid` or `paid` |  |
| `bucket` | yes | `pending` or `upcoming` or `expected` or `not_expected` or `in_hall` or `should_have_left` or `departed` or `rejected` or `cancelled` |  |
| `decision_note` | no | string or null |  |
| `decided_by_name` | no | string or null | Empty while waiting, and empty if the resident cancels before a decision. Set once a warden or the provost approves or rejects. |
| `arrived_recorded_by_name` | no | string or null | Staff member who recorded arrival. Empty until arrival is recorded. |
| `departed_recorded_by_name` | no | string or null | Staff member who recorded departure. Empty until departure is recorded. |
| `arrived_at` | no | date-time or null |  |
| `departed_at` | no | date-time or null |  |
| `created_at` | yes | date-time |  |

#### 401

The access token is missing or expired, or the username and password were refused.

Body: [ErrorResponse](#schema-errorresponse).

#### 403

The signed-in role cannot call this operation.

Body: [ErrorResponse](#schema-errorresponse).

#### 404

No record with that id is visible to the caller.

Body: [ErrorResponse](#schema-errorresponse).


### <a id="post-api-v1-me-guest-stays-guest_stay_id-cancel"></a>POST `/api/v1/me/guest-stays/{guest_stay_id}/cancel` — Cancel own guest application

`cancel_guest_stay`

**Who.** resident. Bearer access token.

Caller: resident. Allowed while `pending` or `approved`, and only before arrival is recorded.

**Parameters**

| Name | In | Required | Type | Notes |
|---|---|---|---|---|
| `guest_stay_id` | path | yes | uuid |  |

**Responses**

#### 200

Guest stay cancelled.

Body: [GuestStay](#schema-gueststay).

| Field | Required | Type | Notes |
|---|---|---|---|
| `id` | yes | uuid |  |
| `host_resident_id` | yes | uuid |  |
| `host_name` | yes | string |  |
| `host_room_label` | yes | string |  |
| `guest_name` | yes | string |  |
| `relation` | yes | string |  |
| `start_date` | yes | date |  |
| `end_date` | yes | date |  |
| `inclusive_days` | yes | integer |  |
| `reason` | yes | string |  |
| `status` | yes | `pending` or `approved` or `rejected` or `cancelled` or `departed` |  |
| `payment_status` | yes | `unpaid` or `paid` |  |
| `bucket` | yes | `pending` or `upcoming` or `expected` or `not_expected` or `in_hall` or `should_have_left` or `departed` or `rejected` or `cancelled` |  |
| `decision_note` | no | string or null |  |
| `decided_by_name` | no | string or null | Empty while waiting, and empty if the resident cancels before a decision. Set once a warden or the provost approves or rejects. |
| `arrived_recorded_by_name` | no | string or null | Staff member who recorded arrival. Empty until arrival is recorded. |
| `departed_recorded_by_name` | no | string or null | Staff member who recorded departure. Empty until departure is recorded. |
| `arrived_at` | no | date-time or null |  |
| `departed_at` | no | date-time or null |  |
| `created_at` | yes | date-time |  |

#### 401

The access token is missing or expired, or the username and password were refused.

Body: [ErrorResponse](#schema-errorresponse).

#### 404

No record with that id is visible to the caller.

Body: [ErrorResponse](#schema-errorresponse).

#### 409

The guest has already arrived, or the stay is decided in a terminal way.

Body: [ErrorResponse](#schema-errorresponse).

#### 403

The signed-in role cannot call this operation.

Body: [ErrorResponse](#schema-errorresponse).


### <a id="get-api-v1-guest-stays"></a>GET `/api/v1/guest-stays` — Guest stays

`list_guest_stays`

**Who.** warden or provost. Bearer access token.

Caller: warden or provost. Filter by derived bucket. `in_hall` here is
the dining set and includes guests who should have left. Use
`should_have_left` for that subset. Each item is a GuestStaySummary
card; open GET by id for the full GuestStay.

**Parameters**

| Name | In | Required | Type | Notes |
|---|---|---|---|---|
| `bucket` | query | no | `pending` or `upcoming` or `expected` or `not_expected` or `in_hall` or `should_have_left` or `departed` or `rejected` or `cancelled` |  |
| `limit` | query | no | integer | 1–500. default `50`. |
| `offset` | query | no | integer | minimum 0. default `0`. |

**Responses**

#### 200

Guest stay page of GuestStaySummary cards.

Body: [GuestStayPage](#schema-gueststaypage).

| Field | Required | Type | Notes |
|---|---|---|---|
| `total` | yes | integer | minimum 0. |
| `limit` | yes | integer |  |
| `offset` | yes | integer |  |
| `items` | yes | list of [GuestStaySummary](#schema-gueststaysummary) |  |

#### 401

The access token is missing or expired, or the username and password were refused.

Body: [ErrorResponse](#schema-errorresponse).

#### 403

The signed-in role cannot call this operation.

Body: [ErrorResponse](#schema-errorresponse).


### <a id="get-api-v1-guest-stays-guest_stay_id"></a>GET `/api/v1/guest-stays/{guest_stay_id}` — Guest stay for review

`get_guest_stay`

**Who.** warden or provost. Bearer access token.

Caller: warden or provost.

**Parameters**

| Name | In | Required | Type | Notes |
|---|---|---|---|---|
| `guest_stay_id` | path | yes | uuid |  |

**Responses**

#### 200

Guest stay, including the host.

Body: [GuestStay](#schema-gueststay).

| Field | Required | Type | Notes |
|---|---|---|---|
| `id` | yes | uuid |  |
| `host_resident_id` | yes | uuid |  |
| `host_name` | yes | string |  |
| `host_room_label` | yes | string |  |
| `guest_name` | yes | string |  |
| `relation` | yes | string |  |
| `start_date` | yes | date |  |
| `end_date` | yes | date |  |
| `inclusive_days` | yes | integer |  |
| `reason` | yes | string |  |
| `status` | yes | `pending` or `approved` or `rejected` or `cancelled` or `departed` |  |
| `payment_status` | yes | `unpaid` or `paid` |  |
| `bucket` | yes | `pending` or `upcoming` or `expected` or `not_expected` or `in_hall` or `should_have_left` or `departed` or `rejected` or `cancelled` |  |
| `decision_note` | no | string or null |  |
| `decided_by_name` | no | string or null | Empty while waiting, and empty if the resident cancels before a decision. Set once a warden or the provost approves or rejects. |
| `arrived_recorded_by_name` | no | string or null | Staff member who recorded arrival. Empty until arrival is recorded. |
| `departed_recorded_by_name` | no | string or null | Staff member who recorded departure. Empty until departure is recorded. |
| `arrived_at` | no | date-time or null |  |
| `departed_at` | no | date-time or null |  |
| `created_at` | yes | date-time |  |

#### 401

The access token is missing or expired, or the username and password were refused.

Body: [ErrorResponse](#schema-errorresponse).

#### 403

The signed-in role cannot call this operation.

Body: [ErrorResponse](#schema-errorresponse).

#### 404

No record with that id is visible to the caller.

Body: [ErrorResponse](#schema-errorresponse).


### <a id="post-api-v1-guest-stays-guest_stay_id-decision"></a>POST `/api/v1/guest-stays/{guest_stay_id}/decision` — Approve or reject a guest stay

`decide_guest_stay`

**Who.** warden or provost. Bearer access token.

Caller: warden or provost. Only while `pending`. Approval does not mark
payment and does not record arrival.

**Parameters**

| Name | In | Required | Type | Notes |
|---|---|---|---|---|
| `guest_stay_id` | path | yes | uuid |  |

**Request.** Required.

Body: [DecisionRequest](#schema-decisionrequest).

| Field | Required | Type | Notes |
|---|---|---|---|
| `decision` | yes | `approved` or `rejected` |  |
| `note` | no | string | at most 500 characters. |

**Responses**

#### 200

Decision stored.

Body: [GuestStay](#schema-gueststay).

| Field | Required | Type | Notes |
|---|---|---|---|
| `id` | yes | uuid |  |
| `host_resident_id` | yes | uuid |  |
| `host_name` | yes | string |  |
| `host_room_label` | yes | string |  |
| `guest_name` | yes | string |  |
| `relation` | yes | string |  |
| `start_date` | yes | date |  |
| `end_date` | yes | date |  |
| `inclusive_days` | yes | integer |  |
| `reason` | yes | string |  |
| `status` | yes | `pending` or `approved` or `rejected` or `cancelled` or `departed` |  |
| `payment_status` | yes | `unpaid` or `paid` |  |
| `bucket` | yes | `pending` or `upcoming` or `expected` or `not_expected` or `in_hall` or `should_have_left` or `departed` or `rejected` or `cancelled` |  |
| `decision_note` | no | string or null |  |
| `decided_by_name` | no | string or null | Empty while waiting, and empty if the resident cancels before a decision. Set once a warden or the provost approves or rejects. |
| `arrived_recorded_by_name` | no | string or null | Staff member who recorded arrival. Empty until arrival is recorded. |
| `departed_recorded_by_name` | no | string or null | Staff member who recorded departure. Empty until departure is recorded. |
| `arrived_at` | no | date-time or null |  |
| `departed_at` | no | date-time or null |  |
| `created_at` | yes | date-time |  |

#### 401

The access token is missing or expired, or the username and password were refused.

Body: [ErrorResponse](#schema-errorresponse).

#### 403

The signed-in role cannot call this operation.

Body: [ErrorResponse](#schema-errorresponse).

#### 404

No record with that id is visible to the caller.

Body: [ErrorResponse](#schema-errorresponse).

#### 409

Not pending. Code `not_pending`.

Body: [ErrorResponse](#schema-errorresponse).


### <a id="post-api-v1-guest-stays-guest_stay_id-payment"></a>POST `/api/v1/guest-stays/{guest_stay_id}/payment` — Mark guest payment

`mark_guest_payment`

**Who.** warden or provost. Bearer access token.

Caller: warden or provost. Records that the hall office has or has not
taken payment. Allowed before arrival, whether the stay is pending or
approved. The app does not collect money.

**Parameters**

| Name | In | Required | Type | Notes |
|---|---|---|---|---|
| `guest_stay_id` | path | yes | uuid |  |

**Request.** Required.

Body: [PaymentRequest](#schema-paymentrequest).

| Field | Required | Type | Notes |
|---|---|---|---|
| `payment_status` | yes | `paid` or `unpaid` |  |

**Example**

```json
{
  "payment_status": "paid"
}
```

**Responses**

#### 200

Payment status stored.

Body: [GuestStay](#schema-gueststay).

| Field | Required | Type | Notes |
|---|---|---|---|
| `id` | yes | uuid |  |
| `host_resident_id` | yes | uuid |  |
| `host_name` | yes | string |  |
| `host_room_label` | yes | string |  |
| `guest_name` | yes | string |  |
| `relation` | yes | string |  |
| `start_date` | yes | date |  |
| `end_date` | yes | date |  |
| `inclusive_days` | yes | integer |  |
| `reason` | yes | string |  |
| `status` | yes | `pending` or `approved` or `rejected` or `cancelled` or `departed` |  |
| `payment_status` | yes | `unpaid` or `paid` |  |
| `bucket` | yes | `pending` or `upcoming` or `expected` or `not_expected` or `in_hall` or `should_have_left` or `departed` or `rejected` or `cancelled` |  |
| `decision_note` | no | string or null |  |
| `decided_by_name` | no | string or null | Empty while waiting, and empty if the resident cancels before a decision. Set once a warden or the provost approves or rejects. |
| `arrived_recorded_by_name` | no | string or null | Staff member who recorded arrival. Empty until arrival is recorded. |
| `departed_recorded_by_name` | no | string or null | Staff member who recorded departure. Empty until departure is recorded. |
| `arrived_at` | no | date-time or null |  |
| `departed_at` | no | date-time or null |  |
| `created_at` | yes | date-time |  |

#### 401

The access token is missing or expired, or the username and password were refused.

Body: [ErrorResponse](#schema-errorresponse).

#### 403

The signed-in role cannot call this operation.

Body: [ErrorResponse](#schema-errorresponse).

#### 404

No record with that id is visible to the caller.

Body: [ErrorResponse](#schema-errorresponse).

#### 409

The guest has already arrived or the stay is closed. Code `payment_locked`.

Body: [ErrorResponse](#schema-errorresponse).


## <a id="tag-gate"></a>Gate

Scan the permanent hall pass, and record guest arrival and departure. Guests have no hall pass.

| Method | Path | Purpose | Who |
|---|---|---|---|
| POST | `/api/v1/gate/scans` | [Scan a hall pass](#post-api-v1-gate-scans) | gate, warden, or provost |
| GET | `/api/v1/gate/activity` | [Recent gate activity](#get-api-v1-gate-activity) | gate, warden, or provost |
| GET | `/api/v1/gate/guests` | [Guests for the gate](#get-api-v1-gate-guests) | gate, warden, or provost |
| POST | `/api/v1/gate/guests/{guest_stay_id}/arrival` | [Record guest arrival](#post-api-v1-gate-guests-guest_stay_id-arrival) | gate, warden, or provost |
| POST | `/api/v1/gate/guests/{guest_stay_id}/departure` | [Record guest departure](#post-api-v1-gate-guests-guest_stay_id-departure) | gate, warden, or provost |

### <a id="post-api-v1-gate-scans"></a>POST `/api/v1/gate/scans` — Scan a hall pass

`scan_hall_pass`

**Who.** gate, warden, or provost. Bearer access token.

Caller: gate, warden, or provost.

Send the raw QR text. Both `bsj:v1:{token}` and the bare token are accepted.

While the resident is inside, a scan records an exit. Among ordinary
outings planned for today's hall date whose expected return has not
passed, the earliest return is used, and only when the current time is
inside ordinary hours today. A later return today is left planned. A
plan for another day is left planned and is not used today. The scan
records the exit time and the staff member. Otherwise an approved
permission inside its use window is opened as an outing and marked in
use. If neither exists, the scan is refused. An ordinary exit needs a
destination and an expected return saved before the resident reaches
the gate. If she meant a later trip today, or a permission, she cancels
the plan the gate would use and shows the pass again.

While the resident is outside, a scan records the return. Nothing else
is filled in.

A second scan inside `scan_duplicate_window_seconds` of the previous
exit or return for that resident is refused, so one presentation at the
gate cannot undo itself. The refusal for a fresh exit uses the gate
copy: the resident is already outside and should present the same pass
on return.

**Request.** Required.

Body: [ScanRequest](#schema-scanrequest).

| Field | Required | Type | Notes |
|---|---|---|---|
| `qr_payload` | yes | string | Raw QR text, either `bsj:v1:{token}` or the token alone. 1–300 characters. |

**Example**

```json
{
  "qr_payload": "bsj:v1:example-token"
}
```

**Responses**

#### 200

Exit recorded, or return recorded.

Body: [ScanResult](#schema-scanresult).

| Field | Required | Type | Notes |
|---|---|---|---|
| `outcome` | yes | `exit_recorded` or `return_recorded` |  |
| `full_name` | yes | string |  |
| `room_label` | yes | string |  |
| `recorded_at` | yes | date-time |  |
| `message` | yes | string |  |
| `on_time` | no | boolean or null | Present on a return. True when the return is at or before grace. |
| `outing` | yes | [Outing](#schema-outing) |  |

**exit**

```json
{
  "outcome": "exit_recorded",
  "full_name": "Aisha Khan",
  "room_label": "B-204",
  "recorded_at": "2026-09-13T12:42:00Z",
  "message": "The resident is now outside."
}
```

**return**

```json
{
  "outcome": "return_recorded",
  "full_name": "Aisha Khan",
  "room_label": "B-204",
  "recorded_at": "2026-09-13T13:24:00Z",
  "message": "On time. Status is now inside.",
  "on_time": true
}
```

#### 401

The access token is missing or expired, or the username and password were refused.

Body: [ErrorResponse](#schema-errorresponse).

#### 403

The signed-in role cannot call this operation.

Body: [ErrorResponse](#schema-errorresponse).

#### 404

Hall pass not recognised. Code `unknown_hall_pass`.

Body: [ErrorResponse](#schema-errorresponse).

#### 409

`duplicate_scan`, `no_outing_planned`, `outside_ordinary_hours`,
`permission_not_yet_valid`, `open_outing_exists`,
`resident_suspended`, or `return_already_planned`. The body includes
the resident name and room when the pass is known, so the gate
screen can say what to do.

Body: [ErrorResponse](#schema-errorresponse).

**Example**

```json
{
  "error": {
    "code": "duplicate_scan",
    "message": "This resident is already recorded as outside (exit 8:14 PM). Ask the resident to present the same hall pass on return. The register already has an exit.",
    "details": {
      "full_name": "Aisha Khan",
      "room_label": "B-204",
      "presence": "outside"
    }
  }
}
```


### <a id="get-api-v1-gate-activity"></a>GET `/api/v1/gate/activity` — Recent gate activity

`gate_activity`

**Who.** gate, warden, or provost. Bearer access token.

Caller: gate, warden, or provost. Newest first. Lines are resident exits,
resident returns, guest arrivals, and guest departures.

**Parameters**

| Name | In | Required | Type | Notes |
|---|---|---|---|---|
| `limit` | query | no | integer | 1–500. default `50`. |
| `offset` | query | no | integer | minimum 0. default `0`. |

**Responses**

#### 200

Activity page.

Body: [GateActivityPage](#schema-gateactivitypage).

| Field | Required | Type | Notes |
|---|---|---|---|
| `total` | yes | integer | minimum 0. |
| `limit` | yes | integer |  |
| `offset` | yes | integer |  |
| `items` | yes | list of [GateActivityItem](#schema-gateactivityitem) |  |

**Example**

```json
{
  "total": 3,
  "limit": 50,
  "offset": 0,
  "items": [
    {
      "event": "exit",
      "occurred_at": "2026-09-13T14:39:00Z",
      "title": "Zoya Siddiqui",
      "subtitle": "A-118"
    }
  ]
}
```

#### 401

The access token is missing or expired, or the username and password were refused.

Body: [ErrorResponse](#schema-errorresponse).

#### 403

The signed-in role cannot call this operation.

Body: [ErrorResponse](#schema-errorresponse).


### <a id="get-api-v1-gate-guests"></a>GET `/api/v1/gate/guests` — Guests for the gate

`gate_guests`

**Who.** gate, warden, or provost. Bearer access token.

Caller: gate, warden, or provost. `expected` is approved, paid, not yet
arrived, and the hall date is inside the stay. `in_hall` includes guests
who should already have left, because departure is still recorded here.

**Parameters**

| Name | In | Required | Type | Notes |
|---|---|---|---|---|
| `bucket` | query | yes | `expected` or `in_hall` |  |

**Responses**

#### 200

Guest cards for the gate.

Body: [GateGuestList](#schema-gateguestlist).

| Field | Required | Type | Notes |
|---|---|---|---|
| `items` | yes | list of [GateGuestCard](#schema-gateguestcard) |  |

#### 401

The access token is missing or expired, or the username and password were refused.

Body: [ErrorResponse](#schema-errorresponse).

#### 403

The signed-in role cannot call this operation.

Body: [ErrorResponse](#schema-errorresponse).


### <a id="post-api-v1-gate-guests-guest_stay_id-arrival"></a>POST `/api/v1/gate/guests/{guest_stay_id}/arrival` — Record guest arrival

`record_guest_arrival`

**Who.** gate, warden, or provost. Bearer access token.

Caller: gate, warden, or provost. The stay must be approved, paid, not
yet arrived, and today's hall date must fall within the stay. Guests are
not scanned.

**Parameters**

| Name | In | Required | Type | Notes |
|---|---|---|---|---|
| `guest_stay_id` | path | yes | uuid |  |

**Responses**

#### 200

Arrival recorded. The response includes the new dining count.

Body: [GuestMovementResult](#schema-guestmovementresult).

| Field | Required | Type | Notes |
|---|---|---|---|
| `guest_name` | yes | string |  |
| `host_name` | yes | string |  |
| `host_room_label` | yes | string |  |
| `recorded_at` | yes | date-time |  |
| `message` | yes | string |  |
| `guests_in_hall_count` | yes | integer | minimum 0. |

**Example**

```json
{
  "guest_name": "Zara Ahmed",
  "host_name": "Aisha Khan",
  "host_room_label": "B-204",
  "recorded_at": "2026-09-18T10:11:00Z",
  "message": "The guest is now in the hall.",
  "guests_in_hall_count": 6
}
```

#### 401

The access token is missing or expired, or the username and password were refused.

Body: [ErrorResponse](#schema-errorresponse).

#### 403

The signed-in role cannot call this operation.

Body: [ErrorResponse](#schema-errorresponse).

#### 404

No record with that id is visible to the caller.

Body: [ErrorResponse](#schema-errorresponse).

#### 409

`guest_not_expected` or `payment_required`.

Body: [ErrorResponse](#schema-errorresponse).


### <a id="post-api-v1-gate-guests-guest_stay_id-departure"></a>POST `/api/v1/gate/guests/{guest_stay_id}/departure` — Record guest departure

`record_guest_departure`

**Who.** gate, warden, or provost. Bearer access token.

Caller: gate, warden, or provost. The guest must currently be in the hall.
Closes the stay. The dining count drops, including when the end date has
already passed.

**Parameters**

| Name | In | Required | Type | Notes |
|---|---|---|---|---|
| `guest_stay_id` | path | yes | uuid |  |

**Responses**

#### 200

Departure recorded.

Body: [GuestMovementResult](#schema-guestmovementresult).

| Field | Required | Type | Notes |
|---|---|---|---|
| `guest_name` | yes | string |  |
| `host_name` | yes | string |  |
| `host_room_label` | yes | string |  |
| `recorded_at` | yes | date-time |  |
| `message` | yes | string |  |
| `guests_in_hall_count` | yes | integer | minimum 0. |

#### 401

The access token is missing or expired, or the username and password were refused.

Body: [ErrorResponse](#schema-errorresponse).

#### 403

The signed-in role cannot call this operation.

Body: [ErrorResponse](#schema-errorresponse).

#### 404

No record with that id is visible to the caller.

Body: [ErrorResponse](#schema-errorresponse).

#### 409

The guest is not in the hall. Code `guest_not_in_hall`.

Body: [ErrorResponse](#schema-errorresponse).


## <a id="tag-register"></a>Register

Warden and provost presence board under /api/v1/register. Inside, outside, and late for the hall and each block.

| Method | Path | Purpose | Who |
|---|---|---|---|
| GET | `/api/v1/register/summary` | [Hall register counts](#get-api-v1-register-summary) | warden or provost |
| GET | `/api/v1/register/residents` | [Resident register](#get-api-v1-register-residents) | warden or provost |
| GET | `/api/v1/register/residents/{resident_id}` | [Resident record](#get-api-v1-register-residents-resident_id) | warden or provost |
| GET | `/api/v1/register/late` | [Late list](#get-api-v1-register-late) | warden or provost |

### <a id="get-api-v1-register-summary"></a>GET `/api/v1/register/summary` — Hall register counts

`register_summary`

**Who.** warden or provost. Bearer access token.

Caller: warden or provost. Counts for the whole hall, and the same counts
for each block. A resident is counted in the block of her current room.
A guest is counted in the host's block. The hall totals are the sum of
the blocks.

**Responses**

#### 200

Counts.

Body: [RegisterSummary](#schema-registersummary).

| Field | Required | Type | Notes |
|---|---|---|---|
| `inside_count` | yes | integer |  |
| `outside_count` | yes | integer |  |
| `late_count` | yes | integer |  |
| `pending_permission_count` | yes | integer |  |
| `guests_in_hall_count` | yes | integer |  |
| `guests_should_have_left_count` | yes | integer |  |
| `pending_guest_stay_count` | yes | integer |  |
| `blocks` | yes | list of [BlockRegisterCounts](#schema-blockregistercounts) | The same counts for each block. Hall totals are the sum of these rows. |

**Example**

```json
{
  "inside_count": 186,
  "outside_count": 22,
  "late_count": 3,
  "pending_permission_count": 4,
  "guests_in_hall_count": 6,
  "guests_should_have_left_count": 1,
  "pending_guest_stay_count": 2,
  "blocks": [
    {
      "block_id": "00000000-0000-4000-8000-0000000000b1",
      "code": "B",
      "name": "Block-B",
      "inside_count": 40,
      "outside_count": 6,
      "late_count": 1,
      "pending_permission_count": 1,
      "guests_in_hall_count": 2,
      "guests_should_have_left_count": 0,
      "pending_guest_stay_count": 1
    }
  ]
}
```

#### 401

The access token is missing or expired, or the username and password were refused.

Body: [ErrorResponse](#schema-errorresponse).

#### 403

The signed-in role cannot call this operation.

Body: [ErrorResponse](#schema-errorresponse).


### <a id="get-api-v1-register-residents"></a>GET `/api/v1/register/residents` — Resident register

`list_register`

**Who.** warden or provost. Bearer access token.

Caller: warden or provost. Search matches full name or room label.
`block_id` limits the list to one block. `state=late` is outside and
past grace. Results are ordered by name.

**Parameters**

| Name | In | Required | Type | Notes |
|---|---|---|---|---|
| `q` | query | no | string | Name or room. at most 80 characters. |
| `state` | query | no | `inside` or `outside` or `late` |  |
| `block_id` | query | no | uuid | Limit the list to residents whose current room is in this block. |
| `limit` | query | no | integer | 1–500. default `50`. |
| `offset` | query | no | integer | minimum 0. default `0`. |

**Responses**

#### 200

Register page.

Body: [RegisterPage](#schema-registerpage).

| Field | Required | Type | Notes |
|---|---|---|---|
| `total` | yes | integer | minimum 0. |
| `limit` | yes | integer |  |
| `offset` | yes | integer |  |
| `items` | yes | list of [RegisterRow](#schema-registerrow) |  |

#### 401

The access token is missing or expired, or the username and password were refused.

Body: [ErrorResponse](#schema-errorresponse).

#### 403

The signed-in role cannot call this operation.

Body: [ErrorResponse](#schema-errorresponse).


### <a id="get-api-v1-register-residents-resident_id"></a>GET `/api/v1/register/residents/{resident_id}` — Resident record

`register_resident`

**Who.** warden or provost. Bearer access token.

Caller: warden or provost. The open outside outing when she is outside
(status `outside`), or null when she is inside. Cancelled, returned, and
planned outings are not returned here. The outing may be ordinary or a
permission. Whether the guardian was told is included.

**Parameters**

| Name | In | Required | Type | Notes |
|---|---|---|---|---|
| `resident_id` | path | yes | uuid |  |

**Responses**

#### 200

Resident record.

Body: [ResidentRecord](#schema-residentrecord).

| Field | Required | Type | Notes |
|---|---|---|---|
| `id` | yes | uuid |  |
| `full_name` | yes | string |  |
| `enrolment_number` | yes | string |  |
| `course` | no | string or null |  |
| `room_label` | yes | string |  |
| `presence` | yes | `inside` or `outside` |  |
| `state` | yes | `inside` or `outside` or `late` |  |
| `outing` | no | [Outing](#schema-outing) or null | The open outing with status outside, or null when the resident is inside. Cancelled, returned, and planned outings are omitted. |
| `guardian_name` | yes | string | Parent or guardian the hall contacts. |
| `guardian_notice` | yes | `not_due` or `sent` or `failed` |  |

#### 401

The access token is missing or expired, or the username and password were refused.

Body: [ErrorResponse](#schema-errorresponse).

#### 403

The signed-in role cannot call this operation.

Body: [ErrorResponse](#schema-errorresponse).

#### 404

No record with that id is visible to the caller.

Body: [ErrorResponse](#schema-errorresponse).


### <a id="get-api-v1-register-late"></a>GET `/api/v1/register/late` — Late list

`late_list`

**Who.** warden or provost. Bearer access token.

Caller: warden or provost. Residents still outside after grace.
Parent SMS has been sent where a number is on file.

**Parameters**

| Name | In | Required | Type | Notes |
|---|---|---|---|---|
| `limit` | query | no | integer | 1–500. default `50`. |
| `offset` | query | no | integer | minimum 0. default `0`. |

**Responses**

#### 200

Late page.

Body: [RegisterPage](#schema-registerpage).

| Field | Required | Type | Notes |
|---|---|---|---|
| `total` | yes | integer | minimum 0. |
| `limit` | yes | integer |  |
| `offset` | yes | integer |  |
| `items` | yes | list of [RegisterRow](#schema-registerrow) |  |

#### 401

The access token is missing or expired, or the username and password were refused.

Body: [ErrorResponse](#schema-errorresponse).

#### 403

The signed-in role cannot call this operation.

Body: [ErrorResponse](#schema-errorresponse).


## <a id="tag-hall-office"></a>Hall office

Provost only. Residents, staff, rooms, destinations, settings, export, SMS log, and audit.

| Method | Path | Purpose | Who |
|---|---|---|---|
| GET | `/api/v1/admin/residents` | [List resident accounts](#get-api-v1-admin-residents) | provost |
| POST | `/api/v1/admin/residents` | [Create a resident](#post-api-v1-admin-residents) | provost |
| GET | `/api/v1/admin/residents/{resident_id}` | [Resident account](#get-api-v1-admin-residents-resident_id) | provost |
| PATCH | `/api/v1/admin/residents/{resident_id}` | [Update a resident](#patch-api-v1-admin-residents-resident_id) | provost |
| POST | `/api/v1/admin/residents/{resident_id}/hall-pass/reissue` | [Reissue a hall pass](#post-api-v1-admin-residents-resident_id-hall-pass-reissue) | provost |
| GET | `/api/v1/admin/staff` | [List staff accounts](#get-api-v1-admin-staff) | provost |
| POST | `/api/v1/admin/staff` | [Create a staff account](#post-api-v1-admin-staff) | provost |
| PATCH | `/api/v1/admin/staff/{user_id}` | [Update a staff account](#patch-api-v1-admin-staff-user_id) | provost |
| POST | `/api/v1/admin/users/{user_id}/password` | [Reset a password](#post-api-v1-admin-users-user_id-password) | provost |
| GET | `/api/v1/admin/blocks` | [List blocks](#get-api-v1-admin-blocks) | provost |
| POST | `/api/v1/admin/blocks` | [Create a block](#post-api-v1-admin-blocks) | provost |
| PATCH | `/api/v1/admin/blocks/{block_id}` | [Update a block](#patch-api-v1-admin-blocks-block_id) | provost |
| GET | `/api/v1/admin/rooms` | [List rooms](#get-api-v1-admin-rooms) | provost |
| POST | `/api/v1/admin/rooms` | [Create a room](#post-api-v1-admin-rooms) | provost |
| PATCH | `/api/v1/admin/rooms/{room_id}` | [Update a room](#patch-api-v1-admin-rooms-room_id) | provost |
| GET | `/api/v1/admin/destinations` | [List destinations](#get-api-v1-admin-destinations) | provost |
| POST | `/api/v1/admin/destinations` | [Create a destination](#post-api-v1-admin-destinations) | provost |
| PATCH | `/api/v1/admin/destinations/{destination_id}` | [Update a destination](#patch-api-v1-admin-destinations-destination_id) | provost |
| GET | `/api/v1/admin/settings` | [Hall settings](#get-api-v1-admin-settings) | provost |
| PATCH | `/api/v1/admin/settings` | [Update hall settings](#patch-api-v1-admin-settings) | provost |
| GET | `/api/v1/admin/register/export` | [Export the register](#get-api-v1-admin-register-export) | provost |
| GET | `/api/v1/admin/sms` | [SMS log](#get-api-v1-admin-sms) | provost |
| GET | `/api/v1/admin/audit` | [Audit log](#get-api-v1-admin-audit) | provost |

### <a id="get-api-v1-admin-residents"></a>GET `/api/v1/admin/residents` — List resident accounts

`admin_list_residents`

**Who.** provost. Bearer access token.

Caller: provost. Includes suspended residents. Does not include hall-pass tokens.

**Parameters**

| Name | In | Required | Type | Notes |
|---|---|---|---|---|
| `q` | query | no | string | at most 80 characters. |
| `limit` | query | no | integer | 1–500. default `50`. |
| `offset` | query | no | integer | minimum 0. default `0`. |

**Responses**

#### 200

Resident account page.

Body: [ResidentAccountPage](#schema-residentaccountpage).

| Field | Required | Type | Notes |
|---|---|---|---|
| `total` | yes | integer | minimum 0. |
| `limit` | yes | integer |  |
| `offset` | yes | integer |  |
| `items` | yes | list of [ResidentAccount](#schema-residentaccount) |  |

#### 401

The access token is missing or expired, or the username and password were refused.

Body: [ErrorResponse](#schema-errorresponse).

#### 403

The signed-in role cannot call this operation.

Body: [ErrorResponse](#schema-errorresponse).


### <a id="post-api-v1-admin-residents"></a>POST `/api/v1/admin/residents` — Create a resident

`admin_create_resident`

**Who.** provost. Bearer access token.

Caller: provost. Username is the enrolment number. The response includes
the hall pass payload once, so the office can place it on the resident's
phone. Later reads of the account do not return the token.

**Request.** Required.

Body: [ResidentCreate](#schema-residentcreate).

| Field | Required | Type | Notes |
|---|---|---|---|
| `full_name` | yes | string | 1–120 characters. |
| `enrolment_number` | yes | string | 1–40 characters. |
| `course` | no | string | at most 120 characters. |
| `room_id` | yes | uuid |  |
| `guardian_name` | yes | string | Parent or guardian. Required. 1–120 characters. |
| `guardian_phone` | yes | string | E.164 with country code, for example +919876543210. pattern `^\+[1-9][0-9]{7,14}$`. |
| `temporary_password` | yes | string | 10–200 characters. |

**Responses**

#### 201

Resident created.

Body: [ResidentCreated](#schema-residentcreated).

| Field | Required | Type | Notes |
|---|---|---|---|
| `account` | yes | [ResidentAccount](#schema-residentaccount) |  |
| `hall_pass` | yes | [HallPass](#schema-hallpass) |  |

#### 401

The access token is missing or expired, or the username and password were refused.

Body: [ErrorResponse](#schema-errorresponse).

#### 403

The signed-in role cannot call this operation.

Body: [ErrorResponse](#schema-errorresponse).

#### 409

Enrolment number already in use. Code `duplicate_username`.
That room is not in use. Code `room_inactive`.

Body: [ErrorResponse](#schema-errorresponse).

#### 422

The JSON is the wrong shape, or a field fails a constraint that does not depend on existing rows.

Body: [ErrorResponse](#schema-errorresponse).


### <a id="get-api-v1-admin-residents-resident_id"></a>GET `/api/v1/admin/residents/{resident_id}` — Resident account

`admin_get_resident`

**Who.** provost. Bearer access token.

Caller: provost. No hall-pass token.

**Parameters**

| Name | In | Required | Type | Notes |
|---|---|---|---|---|
| `resident_id` | path | yes | uuid |  |

**Responses**

#### 200

Resident account.

Body: [ResidentAccount](#schema-residentaccount).

| Field | Required | Type | Notes |
|---|---|---|---|
| `id` | yes | uuid |  |
| `full_name` | yes | string |  |
| `enrolment_number` | yes | string |  |
| `course` | no | string or null |  |
| `room_id` | yes | uuid |  |
| `room_label` | yes | string |  |
| `guardian_name` | yes | string |  |
| `guardian_phone` | yes | string | E.164, country code required. |
| `status` | yes | `active` or `suspended` |  |
| `presence` | yes | `inside` or `outside` | Inside or outside the hall. Changes when a gate scan records an exit or a return. This is not sign-in. |

#### 401

The access token is missing or expired, or the username and password were refused.

Body: [ErrorResponse](#schema-errorresponse).

#### 403

The signed-in role cannot call this operation.

Body: [ErrorResponse](#schema-errorresponse).

#### 404

No record with that id is visible to the caller.

Body: [ErrorResponse](#schema-errorresponse).


### <a id="patch-api-v1-admin-residents-resident_id"></a>PATCH `/api/v1/admin/residents/{resident_id}` — Update a resident

`admin_update_resident`

**Who.** provost. Bearer access token.

Caller: provost. Send only the fields that change. `course` may be set
to null to clear it. `guardian_name` and `guardian_phone` may be
replaced and may not be cleared. A phone includes the country code.
Changing `enrolment_number` changes the username. `status` suspends or
reinstates the account and revokes refresh tokens on suspension.

**Parameters**

| Name | In | Required | Type | Notes |
|---|---|---|---|---|
| `resident_id` | path | yes | uuid |  |

**Request.** Required.

Body: [ResidentUpdate](#schema-residentupdate).

| Field | Required | Type | Notes |
|---|---|---|---|
| `full_name` | no | string | 1–120 characters. |
| `enrolment_number` | no | string | 1–40 characters. |
| `course` | no | string or null |  |
| `room_id` | no | uuid |  |
| `guardian_name` | no | string | 1–120 characters. |
| `guardian_phone` | no | string | pattern `^\+[1-9][0-9]{7,14}$`. |
| `status` | no | `active` or `suspended` |  |

**Responses**

#### 200

Updated account.

Body: [ResidentAccount](#schema-residentaccount).

| Field | Required | Type | Notes |
|---|---|---|---|
| `id` | yes | uuid |  |
| `full_name` | yes | string |  |
| `enrolment_number` | yes | string |  |
| `course` | no | string or null |  |
| `room_id` | yes | uuid |  |
| `room_label` | yes | string |  |
| `guardian_name` | yes | string |  |
| `guardian_phone` | yes | string | E.164, country code required. |
| `status` | yes | `active` or `suspended` |  |
| `presence` | yes | `inside` or `outside` | Inside or outside the hall. Changes when a gate scan records an exit or a return. This is not sign-in. |

#### 401

The access token is missing or expired, or the username and password were refused.

Body: [ErrorResponse](#schema-errorresponse).

#### 403

The signed-in role cannot call this operation.

Body: [ErrorResponse](#schema-errorresponse).

#### 404

No record with that id is visible to the caller.

Body: [ErrorResponse](#schema-errorresponse).

#### 409

Enrolment number already in use. Code `duplicate_username`.
That room is not in use. Code `room_inactive`.

Body: [ErrorResponse](#schema-errorresponse).

#### 422

The JSON is the wrong shape, or a field fails a constraint that does not depend on existing rows.

Body: [ErrorResponse](#schema-errorresponse).


### <a id="post-api-v1-admin-residents-resident_id-hall-pass-reissue"></a>POST `/api/v1/admin/residents/{resident_id}/hall-pass/reissue` — Reissue a hall pass

`reissue_hall_pass`

**Who.** provost. Bearer access token.

Caller: provost. Replaces the token immediately. The previous QR stops
working. The new payload is returned once.

**Parameters**

| Name | In | Required | Type | Notes |
|---|---|---|---|---|
| `resident_id` | path | yes | uuid |  |

**Responses**

#### 200

New hall pass.

Body: [HallPass](#schema-hallpass).

| Field | Required | Type | Notes |
|---|---|---|---|
| `qr_payload` | yes | string | Text encoded in the QR image. Prefix `bsj:v1:`. |
| `full_name` | yes | string |  |
| `room_label` | yes | string |  |

#### 401

The access token is missing or expired, or the username and password were refused.

Body: [ErrorResponse](#schema-errorresponse).

#### 403

The signed-in role cannot call this operation.

Body: [ErrorResponse](#schema-errorresponse).

#### 404

No record with that id is visible to the caller.

Body: [ErrorResponse](#schema-errorresponse).


### <a id="get-api-v1-admin-staff"></a>GET `/api/v1/admin/staff` — List staff accounts

`admin_list_staff`

**Who.** provost. Bearer access token.

Caller: provost. Gate, warden, and provost accounts.

**Parameters**

| Name | In | Required | Type | Notes |
|---|---|---|---|---|
| `limit` | query | no | integer | 1–500. default `50`. |
| `offset` | query | no | integer | minimum 0. default `0`. |

**Responses**

#### 200

Staff page.

Body: [StaffPage](#schema-staffpage).

| Field | Required | Type | Notes |
|---|---|---|---|
| `total` | yes | integer | minimum 0. |
| `limit` | yes | integer |  |
| `offset` | yes | integer |  |
| `items` | yes | list of [StaffAccount](#schema-staffaccount) |  |

#### 401

The access token is missing or expired, or the username and password were refused.

Body: [ErrorResponse](#schema-errorresponse).

#### 403

The signed-in role cannot call this operation.

Body: [ErrorResponse](#schema-errorresponse).


### <a id="post-api-v1-admin-staff"></a>POST `/api/v1/admin/staff` — Create a staff account

`admin_create_staff`

**Who.** provost. Bearer access token.

Caller: provost. Role is gate, warden, or provost. The sample body leaves the temporary password out of this repository. The field is required.

**Request.** Required.

Body: [StaffCreate](#schema-staffcreate).

| Field | Required | Type | Notes |
|---|---|---|---|
| `full_name` | yes | string | 1–120 characters. |
| `username` | yes | string | 1–80 characters. |
| `role` | yes | `gate` or `warden` or `provost` |  |
| `job_title` | yes | string | Name of the post. Gate staff scan. A warden or the provost approves. The provost also keeps hall records. 1–80 characters. |
| `temporary_password` | yes | string | 10–200 characters. |

**Example**

```json
{
  "full_name": "Imran Qureshi",
  "username": "imran.qureshi",
  "role": "gate",
  "job_title": "Gatekeeper"
}
```

**Responses**

#### 201

Staff account created. The password is not returned.

Body: [StaffAccount](#schema-staffaccount).

| Field | Required | Type | Notes |
|---|---|---|---|
| `id` | yes | uuid |  |
| `full_name` | yes | string |  |
| `username` | yes | string |  |
| `role` | yes | `gate` or `warden` or `provost` |  |
| `job_title` | yes | string |  |
| `status` | yes | `active` or `suspended` |  |

#### 401

The access token is missing or expired, or the username and password were refused.

Body: [ErrorResponse](#schema-errorresponse).

#### 403

The signed-in role cannot call this operation.

Body: [ErrorResponse](#schema-errorresponse).

#### 409

Username already in use. Code `duplicate_username`.

Body: [ErrorResponse](#schema-errorresponse).

#### 422

The JSON is the wrong shape, or a field fails a constraint that does not depend on existing rows.

Body: [ErrorResponse](#schema-errorresponse).


### <a id="patch-api-v1-admin-staff-user_id"></a>PATCH `/api/v1/admin/staff/{user_id}` — Update a staff account

`admin_update_staff`

**Who.** provost. Bearer access token.

Caller: provost. Role cannot be changed on this route, and a staff
account cannot become a resident. Suspension revokes refresh tokens.

**Parameters**

| Name | In | Required | Type | Notes |
|---|---|---|---|---|
| `user_id` | path | yes | uuid |  |

**Request.** Required.

Body: [StaffUpdate](#schema-staffupdate).

| Field | Required | Type | Notes |
|---|---|---|---|
| `full_name` | no | string | 1–120 characters. |
| `job_title` | no | string | 1–80 characters. |
| `status` | no | `active` or `suspended` |  |

**Responses**

#### 200

Updated staff account.

Body: [StaffAccount](#schema-staffaccount).

| Field | Required | Type | Notes |
|---|---|---|---|
| `id` | yes | uuid |  |
| `full_name` | yes | string |  |
| `username` | yes | string |  |
| `role` | yes | `gate` or `warden` or `provost` |  |
| `job_title` | yes | string |  |
| `status` | yes | `active` or `suspended` |  |

#### 401

The access token is missing or expired, or the username and password were refused.

Body: [ErrorResponse](#schema-errorresponse).

#### 403

The signed-in role cannot call this operation.

Body: [ErrorResponse](#schema-errorresponse).

#### 404

No record with that id is visible to the caller.

Body: [ErrorResponse](#schema-errorresponse).


### <a id="post-api-v1-admin-users-user_id-password"></a>POST `/api/v1/admin/users/{user_id}/password` — Reset a password

`reset_password`

**Who.** provost. Bearer access token.

Caller: provost. Sets a temporary password and revokes that user's
refresh tokens. Works for residents and staff.

**Parameters**

| Name | In | Required | Type | Notes |
|---|---|---|---|---|
| `user_id` | path | yes | uuid |  |

**Request.** Required.

Body: [PasswordResetRequest](#schema-passwordresetrequest).

| Field | Required | Type | Notes |
|---|---|---|---|
| `temporary_password` | yes | string | 10–200 characters. |

**Responses**

#### 204

Password reset.

No body.

#### 401

The access token is missing or expired, or the username and password were refused.

Body: [ErrorResponse](#schema-errorresponse).

#### 403

The signed-in role cannot call this operation.

Body: [ErrorResponse](#schema-errorresponse).

#### 404

No record with that id is visible to the caller.

Body: [ErrorResponse](#schema-errorresponse).

#### 422

The JSON is the wrong shape, or a field fails a constraint that does not depend on existing rows.

Body: [ErrorResponse](#schema-errorresponse).


### <a id="get-api-v1-admin-blocks"></a>GET `/api/v1/admin/blocks` — List blocks

`list_blocks`

**Who.** provost. Bearer access token.

Caller: provost. Includes inactive blocks.

**Responses**

#### 200

Blocks.

Body: list of [Block](#schema-block).

No fields.

#### 401

The access token is missing or expired, or the username and password were refused.

Body: [ErrorResponse](#schema-errorresponse).

#### 403

The signed-in role cannot call this operation.

Body: [ErrorResponse](#schema-errorresponse).


### <a id="post-api-v1-admin-blocks"></a>POST `/api/v1/admin/blocks` — Create a block

`create_block`

**Who.** provost. Bearer access token.

Caller: provost. `code` is the short label used in room names, such as B.

**Request.** Required.

Body: [BlockCreate](#schema-blockcreate).

| Field | Required | Type | Notes |
|---|---|---|---|
| `code` | yes | string | 1–16 characters. |
| `name` | yes | string | 1–80 characters. |
| `floors` | no | integer or null |  |
| `room_count` | yes | integer | 1–500. |
| `beds_per_room` | yes | integer | 1–6. |

**Responses**

#### 201

Block created.

Body: [Block](#schema-block).

| Field | Required | Type | Notes |
|---|---|---|---|
| `id` | yes | uuid |  |
| `code` | yes | string | Short code used in room labels. Utility has no letter on the hall page, so its code is Utility. |
| `name` | yes | string |  |
| `floors` | yes | integer or null | A, B, C, and D have 4. The hall page does not state a floor count for Utility. |
| `room_count` | yes | integer | Published room count for this block. Block-A 50, Block-B 58, Block-C 42, Block-D 40, Utility 16. |
| `beds_per_room` | yes | integer | The hall page states a room capacity of 2. |
| `is_active` | yes | boolean |  |

#### 401

The access token is missing or expired, or the username and password were refused.

Body: [ErrorResponse](#schema-errorresponse).

#### 403

The signed-in role cannot call this operation.

Body: [ErrorResponse](#schema-errorresponse).

#### 409

Code already in use. Code `duplicate_block`.

Body: [ErrorResponse](#schema-errorresponse).


### <a id="patch-api-v1-admin-blocks-block_id"></a>PATCH `/api/v1/admin/blocks/{block_id}` — Update a block

`update_block`

**Who.** provost. Bearer access token.

Caller: provost. Deactivate with `is_active` false. Rooms in the block remain.

**Parameters**

| Name | In | Required | Type | Notes |
|---|---|---|---|---|
| `block_id` | path | yes | uuid |  |

**Request.** Required.

Body: [BlockUpdate](#schema-blockupdate).

| Field | Required | Type | Notes |
|---|---|---|---|
| `name` | no | string | 1–80 characters. |
| `floors` | no | integer or null |  |
| `room_count` | no | integer | 1–500. |
| `beds_per_room` | no | integer | 1–6. |
| `is_active` | no | boolean |  |

**Responses**

#### 200

Block updated.

Body: [Block](#schema-block).

| Field | Required | Type | Notes |
|---|---|---|---|
| `id` | yes | uuid |  |
| `code` | yes | string | Short code used in room labels. Utility has no letter on the hall page, so its code is Utility. |
| `name` | yes | string |  |
| `floors` | yes | integer or null | A, B, C, and D have 4. The hall page does not state a floor count for Utility. |
| `room_count` | yes | integer | Published room count for this block. Block-A 50, Block-B 58, Block-C 42, Block-D 40, Utility 16. |
| `beds_per_room` | yes | integer | The hall page states a room capacity of 2. |
| `is_active` | yes | boolean |  |

#### 401

The access token is missing or expired, or the username and password were refused.

Body: [ErrorResponse](#schema-errorresponse).

#### 403

The signed-in role cannot call this operation.

Body: [ErrorResponse](#schema-errorresponse).

#### 404

No record with that id is visible to the caller.

Body: [ErrorResponse](#schema-errorresponse).


### <a id="get-api-v1-admin-rooms"></a>GET `/api/v1/admin/rooms` — List rooms

`list_rooms`

**Who.** provost. Bearer access token.

Caller: provost.

**Parameters**

| Name | In | Required | Type | Notes |
|---|---|---|---|---|
| `block_id` | query | no | uuid |  |

**Responses**

#### 200

Rooms.

Body: list of [Room](#schema-room).

No fields.

#### 401

The access token is missing or expired, or the username and password were refused.

Body: [ErrorResponse](#schema-errorresponse).

#### 403

The signed-in role cannot call this operation.

Body: [ErrorResponse](#schema-errorresponse).


### <a id="post-api-v1-admin-rooms"></a>POST `/api/v1/admin/rooms` — Create a room

`create_room`

**Who.** provost. Bearer access token.

Caller: provost. `label` is stored as `{block code}-{number}`. The number
is text, so `087` stays `087`.

**Request.** Required.

Body: [RoomCreate](#schema-roomcreate).

| Field | Required | Type | Notes |
|---|---|---|---|
| `block_id` | yes | uuid |  |
| `number` | yes | string | 1–12 characters. |

**Example**

```json
{
  "block_id": "00000000-0000-4000-8000-0000000000b1",
  "number": "204"
}
```

**Responses**

#### 201

Room created.

Body: [Room](#schema-room).

| Field | Required | Type | Notes |
|---|---|---|---|
| `id` | yes | uuid |  |
| `block_id` | yes | uuid |  |
| `number` | yes | string | Door number, kept as written. The hall page does not publish door numbers. |
| `label` | yes | string |  |
| `bed_count` | yes | integer | Copied from the block when the room is created. Active residents assigned here, including a suspended resident who has not moved, cannot exceed this. |
| `is_active` | yes | boolean |  |

#### 401

The access token is missing or expired, or the username and password were refused.

Body: [ErrorResponse](#schema-errorresponse).

#### 403

The signed-in role cannot call this operation.

Body: [ErrorResponse](#schema-errorresponse).

#### 404

No record with that id is visible to the caller.

Body: [ErrorResponse](#schema-errorresponse).

#### 409

That number is already used in the block. Code `duplicate_room`.

Body: [ErrorResponse](#schema-errorresponse).


### <a id="patch-api-v1-admin-rooms-room_id"></a>PATCH `/api/v1/admin/rooms/{room_id}` — Update a room

`update_room`

**Who.** provost. Bearer access token.

Caller: provost. A room with residents assigned to it can be deactivated only after they are moved.

**Parameters**

| Name | In | Required | Type | Notes |
|---|---|---|---|---|
| `room_id` | path | yes | uuid |  |

**Request.** Required.

Body: [RoomUpdate](#schema-roomupdate).

| Field | Required | Type | Notes |
|---|---|---|---|
| `number` | no | string | 1–12 characters. |
| `bed_count` | no | integer | 1–6. |
| `is_active` | no | boolean |  |

**Responses**

#### 200

Room updated.

Body: [Room](#schema-room).

| Field | Required | Type | Notes |
|---|---|---|---|
| `id` | yes | uuid |  |
| `block_id` | yes | uuid |  |
| `number` | yes | string | Door number, kept as written. The hall page does not publish door numbers. |
| `label` | yes | string |  |
| `bed_count` | yes | integer | Copied from the block when the room is created. Active residents assigned here, including a suspended resident who has not moved, cannot exceed this. |
| `is_active` | yes | boolean |  |

#### 401

The access token is missing or expired, or the username and password were refused.

Body: [ErrorResponse](#schema-errorresponse).

#### 403

The signed-in role cannot call this operation.

Body: [ErrorResponse](#schema-errorresponse).

#### 404

No record with that id is visible to the caller.

Body: [ErrorResponse](#schema-errorresponse).

#### 409

Residents are still assigned. Code `room_in_use`.

Body: [ErrorResponse](#schema-errorresponse).


### <a id="get-api-v1-admin-destinations"></a>GET `/api/v1/admin/destinations` — List destinations

`admin_list_destinations`

**Who.** provost. Bearer access token.

Caller: provost. Includes inactive rows. Named places are alphabetical, ignoring capitals. The free-text choice is last. The resident catalog route returns active rows only.

**Responses**

#### 200

Destinations.

Body: [DestinationList](#schema-destinationlist).

| Field | Required | Type | Notes |
|---|---|---|---|
| `items` | yes | list of [Destination](#schema-destination) |  |

#### 401

The access token is missing or expired, or the username and password were refused.

Body: [ErrorResponse](#schema-errorresponse).

#### 403

The signed-in role cannot call this operation.

Body: [ErrorResponse](#schema-errorresponse).


### <a id="post-api-v1-admin-destinations"></a>POST `/api/v1/admin/destinations` — Create a destination

`create_destination`

**Who.** provost. Bearer access token.

Caller: provost. Only one active destination may have `is_other` true.

**Request.** Required.

Body: [DestinationCreate](#schema-destinationcreate).

| Field | Required | Type | Notes |
|---|---|---|---|
| `name` | yes | string | 1–80 characters. |
| `is_other` | no | boolean | default `False`. |

**Responses**

#### 201

Destination created.

Body: [Destination](#schema-destination).

| Field | Required | Type | Notes |
|---|---|---|---|
| `id` | yes | uuid |  |
| `name` | yes | string | Named places are shown alphabetical by this name, ignoring capitals. The free-text choice is last. |
| `is_other` | yes | boolean |  |
| `is_active` | yes | boolean |  |

#### 401

The access token is missing or expired, or the username and password were refused.

Body: [ErrorResponse](#schema-errorresponse).

#### 403

The signed-in role cannot call this operation.

Body: [ErrorResponse](#schema-errorresponse).

#### 409

`duplicate_destination` or `other_exists`.

Body: [ErrorResponse](#schema-errorresponse).


### <a id="patch-api-v1-admin-destinations-destination_id"></a>PATCH `/api/v1/admin/destinations/{destination_id}` — Update a destination

`update_destination`

**Who.** provost. Bearer access token.

Caller: provost. Deactivating a destination does not change the place already stored on an outing.

**Parameters**

| Name | In | Required | Type | Notes |
|---|---|---|---|---|
| `destination_id` | path | yes | uuid |  |

**Request.** Required.

Body: [DestinationUpdate](#schema-destinationupdate).

| Field | Required | Type | Notes |
|---|---|---|---|
| `name` | no | string | 1–80 characters. |
| `is_other` | no | boolean |  |
| `is_active` | no | boolean |  |

**Responses**

#### 200

Destination updated.

Body: [Destination](#schema-destination).

| Field | Required | Type | Notes |
|---|---|---|---|
| `id` | yes | uuid |  |
| `name` | yes | string | Named places are shown alphabetical by this name, ignoring capitals. The free-text choice is last. |
| `is_other` | yes | boolean |  |
| `is_active` | yes | boolean |  |

#### 401

The access token is missing or expired, or the username and password were refused.

Body: [ErrorResponse](#schema-errorresponse).

#### 403

The signed-in role cannot call this operation.

Body: [ErrorResponse](#schema-errorresponse).

#### 404

No record with that id is visible to the caller.

Body: [ErrorResponse](#schema-errorresponse).

#### 409

Another active Other row exists. Code `other_exists`.

Body: [ErrorResponse](#schema-errorresponse).

#### 422

The JSON is the wrong shape, or a field fails a constraint that does not depend on existing rows.

Body: [ErrorResponse](#schema-errorresponse).


### <a id="get-api-v1-admin-settings"></a>GET `/api/v1/admin/settings` — Hall settings

`get_settings`

**Who.** provost. Bearer access token.

Caller: provost. Clock times are hall-local HH:MM. Season starts are MM-DD. Clients show both on a 12-hour clock and as a day and month.

**Responses**

#### 200

Settings.

Body: [HallSettings](#schema-hallsettings).

| Field | Required | Type | Notes |
|---|---|---|---|
| `hall_name` | yes | string |  |
| `university_name` | yes | string |  |
| `timezone` | yes | string |  |
| `grace_minutes` | yes | integer |  |
| `summer_hours_start` | yes | string | Kept as HH:MM. Shown as 6:30 AM. Starts as 06:30. pattern `^([01][0-9]|2[0-3]):[0-5][0-9]$`. |
| `summer_hours_end` | yes | string | Kept as HH:MM. Shown as 6:30 PM. Starts as 18:30. pattern `^([01][0-9]|2[0-3]):[0-5][0-9]$`. |
| `winter_hours_start` | yes | string | Kept as HH:MM. Shown as 6:30 AM. Starts as 06:30. pattern `^([01][0-9]|2[0-3]):[0-5][0-9]$`. |
| `winter_hours_end` | yes | string | Kept as HH:MM. Shown as 5:30 PM. Starts as 17:30. pattern `^([01][0-9]|2[0-3]):[0-5][0-9]$`. |
| `summer_season_start` | yes | string | Month and day summer hours begin. Shown as 01 April. Starts as 04-01. pattern `^(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$`. |
| `winter_season_start` | yes | string | Month and day winter hours begin. Shown as 01 October. Starts as 10-01. pattern `^(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$`. |
| `permission_early_minutes` | yes | integer |  |
| `guest_max_inclusive_days` | yes | integer |  |
| `guest_min_lead_days` | yes | integer |  |
| `scan_duplicate_window_seconds` | yes | integer |  |
| `late_sms_template` | yes | string | Placeholders: {resident_name}, {room}, {expected_return_local}, {hall_name}. |
| `return_sms_template` | yes | string | Placeholders: {resident_name}, {room}, {returned_at_local}, {hall_name}. |

#### 401

The access token is missing or expired, or the username and password were refused.

Body: [ErrorResponse](#schema-errorresponse).

#### 403

The signed-in role cannot call this operation.

Body: [ErrorResponse](#schema-errorresponse).


### <a id="patch-api-v1-admin-settings"></a>PATCH `/api/v1/admin/settings` — Update hall settings

`update_settings`

**Who.** provost. Bearer access token.

Caller: provost. Send only the fields that change. Summer hours, winter
hours, and the two season start dates are always set. Changing grace
does not rewrite outings that already have a `grace_ends_at`. SMS
templates keep the placeholders listed on `HallSettings`. A time of day
is sent as HH:MM. A season start is sent as MM-DD.

**Request.** Required.

Body: [HallSettingsUpdate](#schema-hallsettingsupdate).

| Field | Required | Type | Notes |
|---|---|---|---|
| `hall_name` | no | string | 1–160 characters. |
| `university_name` | no | string | 1–160 characters. |
| `grace_minutes` | no | integer | 0–180. |
| `summer_hours_start` | no | string | pattern `^([01][0-9]|2[0-3]):[0-5][0-9]$`. |
| `summer_hours_end` | no | string | pattern `^([01][0-9]|2[0-3]):[0-5][0-9]$`. |
| `winter_hours_start` | no | string | pattern `^([01][0-9]|2[0-3]):[0-5][0-9]$`. |
| `winter_hours_end` | no | string | pattern `^([01][0-9]|2[0-3]):[0-5][0-9]$`. |
| `summer_season_start` | no | string | pattern `^(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$`. |
| `winter_season_start` | no | string | pattern `^(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$`. |
| `permission_early_minutes` | no | integer | 0–180. |
| `guest_max_inclusive_days` | no | integer | 1–30. |
| `guest_min_lead_days` | no | integer | 0–14. |
| `scan_duplicate_window_seconds` | no | integer | 0–600. |
| `late_sms_template` | no | string | at least 1 characters. |
| `return_sms_template` | no | string | at least 1 characters. |

**Responses**

#### 200

Settings saved.

Body: [HallSettings](#schema-hallsettings).

| Field | Required | Type | Notes |
|---|---|---|---|
| `hall_name` | yes | string |  |
| `university_name` | yes | string |  |
| `timezone` | yes | string |  |
| `grace_minutes` | yes | integer |  |
| `summer_hours_start` | yes | string | Kept as HH:MM. Shown as 6:30 AM. Starts as 06:30. pattern `^([01][0-9]|2[0-3]):[0-5][0-9]$`. |
| `summer_hours_end` | yes | string | Kept as HH:MM. Shown as 6:30 PM. Starts as 18:30. pattern `^([01][0-9]|2[0-3]):[0-5][0-9]$`. |
| `winter_hours_start` | yes | string | Kept as HH:MM. Shown as 6:30 AM. Starts as 06:30. pattern `^([01][0-9]|2[0-3]):[0-5][0-9]$`. |
| `winter_hours_end` | yes | string | Kept as HH:MM. Shown as 5:30 PM. Starts as 17:30. pattern `^([01][0-9]|2[0-3]):[0-5][0-9]$`. |
| `summer_season_start` | yes | string | Month and day summer hours begin. Shown as 01 April. Starts as 04-01. pattern `^(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$`. |
| `winter_season_start` | yes | string | Month and day winter hours begin. Shown as 01 October. Starts as 10-01. pattern `^(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$`. |
| `permission_early_minutes` | yes | integer |  |
| `guest_max_inclusive_days` | yes | integer |  |
| `guest_min_lead_days` | yes | integer |  |
| `scan_duplicate_window_seconds` | yes | integer |  |
| `late_sms_template` | yes | string | Placeholders: {resident_name}, {room}, {expected_return_local}, {hall_name}. |
| `return_sms_template` | yes | string | Placeholders: {resident_name}, {room}, {returned_at_local}, {hall_name}. |

#### 401

The access token is missing or expired, or the username and password were refused.

Body: [ErrorResponse](#schema-errorresponse).

#### 403

The signed-in role cannot call this operation.

Body: [ErrorResponse](#schema-errorresponse).

#### 422

The JSON is the wrong shape, or a field fails a constraint that does not depend on existing rows.

Body: [ErrorResponse](#schema-errorresponse).


### <a id="get-api-v1-admin-register-export"></a>GET `/api/v1/admin/register/export` — Export the register

`export_register`

**Who.** provost. Bearer access token.

Caller: provost. One CSV file. UTF-8, comma separated, header row required.
Resident rows and guest rows share one header. Cells that do not apply
to the row are empty.

Header, in this order:

`record_type,full_name,enrolment_number,room_label,block_code,course,presence,state,place,exited_at,expected_return_at,grace_ends_at,returned_at,outing_type,guardian_name,guardian_phone,guest_name,relation,host_name,host_room_label,start_date,end_date,payment_status,guest_bucket,arrived_at,departed_at`

`record_type` is `resident` or `guest`. Instants are UTC. Dates are
YYYY-MM-DD. This export contains guardian phone numbers and is not a
warden route. `block_code` is the resident's block, or the host's block
on a guest row. A data cell whose text starts with `=`, `+`, `-`, `@`,
a tab, or a carriage return is prefixed with one single quote so a
spreadsheet keeps the text. The header row is not prefixed. Other text
is unchanged.

**Responses**

#### 200

CSV file.

Body: string.

No fields.

#### 401

The access token is missing or expired, or the username and password were refused.

Body: [ErrorResponse](#schema-errorresponse).

#### 403

The signed-in role cannot call this operation.

Body: [ErrorResponse](#schema-errorresponse).


### <a id="get-api-v1-admin-sms"></a>GET `/api/v1/admin/sms` — SMS log

`list_sms`

**Who.** provost. Bearer access token.

Caller: provost. Newest first. Each row is a late notice or a return notice sent to the guardian phone.

**Parameters**

| Name | In | Required | Type | Notes |
|---|---|---|---|---|
| `limit` | query | no | integer | 1–500. default `50`. |
| `offset` | query | no | integer | minimum 0. default `0`. |

**Responses**

#### 200

SMS page.

Body: [SmsPage](#schema-smspage).

| Field | Required | Type | Notes |
|---|---|---|---|
| `total` | yes | integer | minimum 0. |
| `limit` | yes | integer |  |
| `offset` | yes | integer |  |
| `items` | yes | list of [SmsMessage](#schema-smsmessage) |  |

#### 401

The access token is missing or expired, or the username and password were refused.

Body: [ErrorResponse](#schema-errorresponse).

#### 403

The signed-in role cannot call this operation.

Body: [ErrorResponse](#schema-errorresponse).


### <a id="get-api-v1-admin-audit"></a>GET `/api/v1/admin/audit` — Audit log

`list_audit`

**Who.** provost. Bearer access token.

Caller: provost. Newest first. Detail never contains a password, a refresh token, or a hall-pass token.

**Parameters**

| Name | In | Required | Type | Notes |
|---|---|---|---|---|
| `entity_type` | query | no | string |  |
| `entity_id` | query | no | string |  |
| `limit` | query | no | integer | 1–500. default `50`. |
| `offset` | query | no | integer | minimum 0. default `0`. |

**Responses**

#### 200

Audit page.

Body: [AuditPage](#schema-auditpage).

| Field | Required | Type | Notes |
|---|---|---|---|
| `total` | yes | integer | minimum 0. |
| `limit` | yes | integer |  |
| `offset` | yes | integer |  |
| `items` | yes | list of [AuditEvent](#schema-auditevent) |  |

#### 401

The access token is missing or expired, or the username and password were refused.

Body: [ErrorResponse](#schema-errorresponse).

#### 403

The signed-in role cannot call this operation.

Body: [ErrorResponse](#schema-errorresponse).


## <a id="tag-payloads"></a>Payloads

Each JSON object used above. An operation section already shows the fields for its own request and success response.

### <a id="schema-health"></a>Health

| Field | Required | Type | Notes |
|---|---|---|---|
| `status` | yes | `ok` |  |

### <a id="schema-ready"></a>Ready

| Field | Required | Type | Notes |
|---|---|---|---|
| `status` | yes | `ready` |  |
| `user_version` | yes | integer | SQLite PRAGMA user_version after migrations. minimum 0. |

### <a id="schema-errorresponse"></a>ErrorResponse

| Field | Required | Type | Notes |
|---|---|---|---|
| `error` | yes | [Error](#schema-error) |  |

### <a id="schema-error"></a>Error

| Field | Required | Type | Notes |
|---|---|---|---|
| `code` | yes | string | Stable machine code. Known codes: `unauthenticated`, `rate_limited`, `not_ready`, `forbidden`, `not_found`, `validation_error`, `duplicate_username`, `duplicate_block`, `duplicate_room`, `duplicate_destination`, `room_in_use`, `room_inactive`, `other_exists`, `already_outside`, `return_already_planned`, `open_outing_exists`, `outside_ordinary_hours`, `permission_required`, `no_outing_planned`, `permission_not_yet_valid`, `duplicate_scan`, `resident_suspended`, `unknown_hall_pass`, `not_pending`, `permission_in_use`, `not_cancellable`, `guest_not_expected`, `guest_not_in_hall`, `payment_required`, `payment_locked`. |
| `message` | yes | string | Sentence the phone can show. Not a stack trace. |
| `details` | no | object |  |

### <a id="schema-listmeta"></a>ListMeta

| Field | Required | Type | Notes |
|---|---|---|---|
| `total` | yes | integer | minimum 0. |
| `limit` | yes | integer |  |
| `offset` | yes | integer |  |

### <a id="schema-loginrequest"></a>LoginRequest

| Field | Required | Type | Notes |
|---|---|---|---|
| `username` | yes | string | 1–80 characters. |
| `password` | yes | string | 1–200 characters. |

### <a id="schema-refreshrequest"></a>RefreshRequest

| Field | Required | Type | Notes |
|---|---|---|---|
| `refresh_token` | yes | string |  |

### <a id="schema-changepasswordrequest"></a>ChangePasswordRequest

| Field | Required | Type | Notes |
|---|---|---|---|
| `current_password` | yes | string | 1–200 characters. |
| `new_password` | yes | string | 10–200 characters. |

### <a id="schema-passwordresetrequest"></a>PasswordResetRequest

| Field | Required | Type | Notes |
|---|---|---|---|
| `temporary_password` | yes | string | 10–200 characters. |

### <a id="schema-tokenresponse"></a>TokenResponse

| Field | Required | Type | Notes |
|---|---|---|---|
| `access_token` | yes | string |  |
| `token_type` | yes | `bearer` |  |
| `expires_in` | yes | integer | Access token lifetime in seconds. |
| `refresh_token` | yes | string |  |
| `user` | yes | [UserSummary](#schema-usersummary) |  |

### <a id="schema-usersummary"></a>UserSummary

| Field | Required | Type | Notes |
|---|---|---|---|
| `id` | yes | uuid |  |
| `role` | yes | `resident` or `gate` or `warden` or `provost` |  |
| `full_name` | yes | string |  |
| `username` | yes | string |  |
| `status` | yes | `active` or `suspended` |  |

### <a id="schema-role"></a>Role

One of: `resident`, `gate`, `warden`, `provost`.

### <a id="schema-staffrole"></a>StaffRole

One of: `gate`, `warden`, `provost`.

### <a id="schema-accountstatus"></a>AccountStatus

One of: `active`, `suspended`.

### <a id="schema-currentuser"></a>CurrentUser

| Field | Required | Type | Notes |
|---|---|---|---|
| `id` | yes | uuid |  |
| `role` | yes | `resident` or `gate` or `warden` or `provost` |  |
| `full_name` | yes | string |  |
| `username` | yes | string |  |
| `status` | yes | `active` or `suspended` |  |
| `resident` | no | [ResidentSummary](#schema-residentsummary) or null |  |
| `staff` | no | [StaffSummary](#schema-staffsummary) or null |  |

### <a id="schema-residentsummary"></a>ResidentSummary

| Field | Required | Type | Notes |
|---|---|---|---|
| `enrolment_number` | yes | string |  |
| `course` | no | string or null |  |
| `room_label` | yes | string |  |
| `block_name` | no | string |  |
| `presence` | yes | `inside` or `outside` |  |

### <a id="schema-staffsummary"></a>StaffSummary

| Field | Required | Type | Notes |
|---|---|---|---|
| `job_title` | yes | string | Name of the post, such as Gatekeeper or Resident warden. The role decides what the account may do. |

### <a id="schema-presence"></a>Presence

One of: `inside`, `outside`.

### <a id="schema-registerstate"></a>RegisterState

One of: `inside`, `outside`, `late`.

### <a id="schema-residenthome"></a>ResidentHome

| Field | Required | Type | Notes |
|---|---|---|---|
| `resident` | yes | [ResidentSummary](#schema-residentsummary) |  |
| `current_outing` | yes | [Outing](#schema-outing) or null |  |
| `active_permission` | yes | [Permission](#schema-permission) or null | The newest permission in `pending`, `approved`, or `in_use`, if any. |
| `recent_history` | yes | list of [HistoryEvent](#schema-historyevent) |  |

### <a id="schema-hallpass"></a>HallPass

| Field | Required | Type | Notes |
|---|---|---|---|
| `qr_payload` | yes | string | Text encoded in the QR image. Prefix `bsj:v1:`. |
| `full_name` | yes | string |  |
| `room_label` | yes | string |  |

### <a id="schema-historyevent"></a>HistoryEvent

| Field | Required | Type | Notes |
|---|---|---|---|
| `event` | yes | `exited` or `returned` |  |
| `place` | yes | string | Place remembered on the outing. |
| `occurred_at` | yes | date-time |  |
| `outing_id` | yes | uuid |  |

### <a id="schema-historypage"></a>HistoryPage

| Field | Required | Type | Notes |
|---|---|---|---|
| `total` | yes | integer | minimum 0. |
| `limit` | yes | integer |  |
| `offset` | yes | integer |  |
| `items` | yes | list of [HistoryEvent](#schema-historyevent) |  |

### <a id="schema-destination"></a>Destination

| Field | Required | Type | Notes |
|---|---|---|---|
| `id` | yes | uuid |  |
| `name` | yes | string | Named places are shown alphabetical by this name, ignoring capitals. The free-text choice is last. |
| `is_other` | yes | boolean |  |
| `is_active` | yes | boolean |  |

### <a id="schema-destinationlist"></a>DestinationList

| Field | Required | Type | Notes |
|---|---|---|---|
| `items` | yes | list of [Destination](#schema-destination) |  |

### <a id="schema-destinationcreate"></a>DestinationCreate

| Field | Required | Type | Notes |
|---|---|---|---|
| `name` | yes | string | 1–80 characters. |
| `is_other` | no | boolean | default `False`. |

### <a id="schema-destinationupdate"></a>DestinationUpdate

| Field | Required | Type | Notes |
|---|---|---|---|
| `name` | no | string | 1–80 characters. |
| `is_other` | no | boolean |  |
| `is_active` | no | boolean |  |

### <a id="schema-planoutingrequest"></a>PlanOutingRequest

| Field | Required | Type | Notes |
|---|---|---|---|
| `destination_id` | yes | uuid |  |
| `destination_text` | no | string | Required when the destination is the Other row. Ignored otherwise. 1–120 characters. |
| `expected_return_at` | yes | date-time |  |

### <a id="schema-outingtype"></a>OutingType

Ordinary, late-night, and home going are one outing record. This says which.

One of: `ordinary`, `late_night`, `home_going`.

### <a id="schema-outingstatus"></a>OutingStatus

One of: `planned`, `outside`, `returned`, `cancelled`.

### <a id="schema-outing"></a>Outing

| Field | Required | Type | Notes |
|---|---|---|---|
| `id` | yes | uuid |  |
| `permission_id` | no | uuid or null | Empty for an ordinary outing. Set when the exit used a permission. |
| `type` | yes | `ordinary` or `late_night` or `home_going` |  |
| `status` | yes | `planned` or `outside` or `returned` or `cancelled` |  |
| `place` | yes | string | List name, the words typed for Other, or the permission's short place. |
| `expected_return_at` | yes | date-time | UTC instant. Clients show India time on a 12-hour clock. |
| `grace_ends_at` | yes | date-time |  |
| `exited_at` | no | date-time or null | Empty only while an ordinary outing is still planned. Required once the resident has left. |
| `exit_recorded_by_name` | no | string or null | Staff member who scanned the exit. Empty only while exited_at is empty. |
| `returned_at` | no | date-time or null | Empty until the return scan. Required once the resident has returned. |
| `return_recorded_by_name` | no | string or null | Staff member who scanned the return. Empty only while returned_at is empty. |
| `is_late` | yes | boolean |  |
| `created_at` | yes | date-time |  |

### <a id="schema-outinglist"></a>OutingList

| Field | Required | Type | Notes |
|---|---|---|---|
| `items` | yes | list of [Outing](#schema-outing) |  |

### <a id="schema-currentouting"></a>CurrentOuting

| Field | Required | Type | Notes |
|---|---|---|---|
| `outing` | yes | [Outing](#schema-outing) or null |  |

### <a id="schema-expirepassedresult"></a>ExpirePassedResult

| Field | Required | Type | Notes |
|---|---|---|---|
| `plans_expired` | yes | integer | Planned ordinary outings cancelled because expected return passed. minimum 0. |
| `permissions_expired` | yes | integer | Unused approved permissions marked expired. minimum 0. |

### <a id="schema-expirepassedpermissionsresult"></a>ExpirePassedPermissionsResult

| Field | Required | Type | Notes |
|---|---|---|---|
| `permissions_expired` | yes | integer | Unused approved permissions marked expired. minimum 0. |

### <a id="schema-permissiontype"></a>PermissionType

One of: `late_night`, `home_going`.

### <a id="schema-permissionstatus"></a>PermissionStatus

One of: `pending`, `approved`, `rejected`, `cancelled`, `in_use`, `completed`, `expired`.

### <a id="schema-permissioncreate"></a>PermissionCreate

The `type` field selects the object:

- `late_night` → [LateNightCreate](#schema-latenightcreate)
- `home_going` → [HomeGoingCreate](#schema-homegoingcreate)

### <a id="schema-latenightcreate"></a>LateNightCreate

| Field | Required | Type | Notes |
|---|---|---|---|
| `type` | yes | `late_night` |  |
| `short_place` | yes | string | Typed by the resident. Not chosen from the ordinary destination list. 1–120 characters. |
| `destination_detail` | no | string | 1–120 characters. |
| `reason` | yes | string | 1–500 characters. |
| `departure_at` | yes | date-time |  |
| `expected_return_at` | yes | date-time |  |

### <a id="schema-homegoingcreate"></a>HomeGoingCreate

| Field | Required | Type | Notes |
|---|---|---|---|
| `type` | yes | `home_going` |  |
| `short_place` | yes | string | Short place on the warden card, such as Lucknow. 1–120 characters. |
| `address` | yes | string | 1–300 characters. |
| `reason` | yes | string | 1–500 characters. |
| `departure_at` | yes | date-time |  |
| `expected_return_at` | yes | date-time |  |

### <a id="schema-permission"></a>Permission

| Field | Required | Type | Notes |
|---|---|---|---|
| `id` | yes | uuid |  |
| `type` | yes | `late_night` or `home_going` |  |
| `status` | yes | `pending` or `approved` or `rejected` or `cancelled` or `in_use` or `completed` or `expired` |  |
| `short_place` | yes | string |  |
| `destination_detail` | no | string or null |  |
| `address` | no | string or null |  |
| `reason` | yes | string |  |
| `departure_at` | yes | date-time |  |
| `expected_return_at` | yes | date-time |  |
| `decision_note` | no | string or null |  |
| `decided_at` | no | date-time or null |  |
| `created_at` | yes | date-time |  |

### <a id="schema-permissionreview"></a>PermissionReview

| Field | Required | Type | Notes |
|---|---|---|---|
| `id` | yes | uuid |  |
| `type` | yes | `late_night` or `home_going` |  |
| `status` | yes | `pending` or `approved` or `rejected` or `cancelled` or `in_use` or `completed` or `expired` |  |
| `short_place` | yes | string |  |
| `destination_detail` | no | string or null |  |
| `address` | no | string or null |  |
| `reason` | yes | string |  |
| `departure_at` | yes | date-time |  |
| `expected_return_at` | yes | date-time |  |
| `decision_note` | no | string or null |  |
| `decided_at` | no | date-time or null |  |
| `created_at` | yes | date-time |  |
| `resident_id` | yes | uuid |  |
| `resident_name` | yes | string |  |
| `room_label` | yes | string |  |
| `decided_by_name` | no | string or null |  |

### <a id="schema-permissionpage"></a>PermissionPage

| Field | Required | Type | Notes |
|---|---|---|---|
| `total` | yes | integer | minimum 0. |
| `limit` | yes | integer |  |
| `offset` | yes | integer |  |
| `items` | yes | list of [Permission](#schema-permission) | Resident own-list cards. No resident_id/name/room on each row. |

### <a id="schema-permissionreviewpage"></a>PermissionReviewPage

| Field | Required | Type | Notes |
|---|---|---|---|
| `total` | yes | integer | minimum 0. |
| `limit` | yes | integer |  |
| `offset` | yes | integer |  |
| `items` | yes | list of [PermissionReview](#schema-permissionreview) | Staff queue rows, including host resident identity. |

### <a id="schema-decisionrequest"></a>DecisionRequest

| Field | Required | Type | Notes |
|---|---|---|---|
| `decision` | yes | `approved` or `rejected` |  |
| `note` | no | string | at most 500 characters. |

### <a id="schema-guestbucket"></a>GuestBucket

One of: `pending`, `upcoming`, `expected`, `not_expected`, `in_hall`, `should_have_left`, `departed`, `rejected`, `cancelled`.

### <a id="schema-gueststaycreate"></a>GuestStayCreate

| Field | Required | Type | Notes |
|---|---|---|---|
| `guest_name` | yes | string | 1–120 characters. |
| `relation` | yes | string | 1–80 characters. |
| `start_date` | yes | date |  |
| `end_date` | yes | date |  |
| `reason` | yes | string | 1–500 characters. |

### <a id="schema-gueststay"></a>GuestStay

| Field | Required | Type | Notes |
|---|---|---|---|
| `id` | yes | uuid |  |
| `host_resident_id` | yes | uuid |  |
| `host_name` | yes | string |  |
| `host_room_label` | yes | string |  |
| `guest_name` | yes | string |  |
| `relation` | yes | string |  |
| `start_date` | yes | date |  |
| `end_date` | yes | date |  |
| `inclusive_days` | yes | integer |  |
| `reason` | yes | string |  |
| `status` | yes | `pending` or `approved` or `rejected` or `cancelled` or `departed` |  |
| `payment_status` | yes | `unpaid` or `paid` |  |
| `bucket` | yes | `pending` or `upcoming` or `expected` or `not_expected` or `in_hall` or `should_have_left` or `departed` or `rejected` or `cancelled` |  |
| `decision_note` | no | string or null |  |
| `decided_by_name` | no | string or null | Empty while waiting, and empty if the resident cancels before a decision. Set once a warden or the provost approves or rejects. |
| `arrived_recorded_by_name` | no | string or null | Staff member who recorded arrival. Empty until arrival is recorded. |
| `departed_recorded_by_name` | no | string or null | Staff member who recorded departure. Empty until departure is recorded. |
| `arrived_at` | no | date-time or null |  |
| `departed_at` | no | date-time or null |  |
| `created_at` | yes | date-time |  |

### <a id="schema-gueststaysummary"></a>GuestStaySummary

Card fields for guest-stay list rows. Full stay detail (reason, decision
note, recorder names, arrival/departure instants) is on GuestStay via
GET by id.

| Field | Required | Type | Notes |
|---|---|---|---|
| `id` | yes | uuid |  |
| `guest_name` | yes | string |  |
| `host_name` | yes | string |  |
| `host_room_label` | yes | string |  |
| `start_date` | yes | date |  |
| `end_date` | yes | date |  |
| `status` | yes | `pending` or `approved` or `rejected` or `cancelled` or `departed` |  |
| `payment_status` | yes | `unpaid` or `paid` |  |
| `bucket` | yes | `pending` or `upcoming` or `expected` or `not_expected` or `in_hall` or `should_have_left` or `departed` or `rejected` or `cancelled` |  |

### <a id="schema-gueststaypage"></a>GuestStayPage

| Field | Required | Type | Notes |
|---|---|---|---|
| `total` | yes | integer | minimum 0. |
| `limit` | yes | integer |  |
| `offset` | yes | integer |  |
| `items` | yes | list of [GuestStaySummary](#schema-gueststaysummary) |  |

### <a id="schema-paymentrequest"></a>PaymentRequest

| Field | Required | Type | Notes |
|---|---|---|---|
| `payment_status` | yes | `paid` or `unpaid` |  |

### <a id="schema-scanrequest"></a>ScanRequest

| Field | Required | Type | Notes |
|---|---|---|---|
| `qr_payload` | yes | string | Raw QR text, either `bsj:v1:{token}` or the token alone. 1–300 characters. |

### <a id="schema-scanresult"></a>ScanResult

| Field | Required | Type | Notes |
|---|---|---|---|
| `outcome` | yes | `exit_recorded` or `return_recorded` |  |
| `full_name` | yes | string |  |
| `room_label` | yes | string |  |
| `recorded_at` | yes | date-time |  |
| `message` | yes | string |  |
| `on_time` | no | boolean or null | Present on a return. True when the return is at or before grace. |
| `outing` | yes | [Outing](#schema-outing) |  |

### <a id="schema-gateactivityitem"></a>GateActivityItem

| Field | Required | Type | Notes |
|---|---|---|---|
| `event` | yes | `exit` or `return` or `guest_arrival` or `guest_departure` | What the gate recorded. |
| `occurred_at` | yes | date-time |  |
| `title` | yes | string | Resident or guest name. |
| `subtitle` | yes | string | Room label, or host and room for a guest. |

### <a id="schema-gateactivitypage"></a>GateActivityPage

| Field | Required | Type | Notes |
|---|---|---|---|
| `total` | yes | integer | minimum 0. |
| `limit` | yes | integer |  |
| `offset` | yes | integer |  |
| `items` | yes | list of [GateActivityItem](#schema-gateactivityitem) |  |

### <a id="schema-gateguestcard"></a>GateGuestCard

| Field | Required | Type | Notes |
|---|---|---|---|
| `id` | yes | uuid |  |
| `guest_name` | yes | string |  |
| `host_name` | yes | string |  |
| `host_room_label` | yes | string |  |
| `start_date` | yes | date |  |
| `end_date` | yes | date |  |
| `payment_status` | yes | `paid` or `unpaid` |  |
| `bucket` | yes | `pending` or `upcoming` or `expected` or `not_expected` or `in_hall` or `should_have_left` or `departed` or `rejected` or `cancelled` |  |

### <a id="schema-gateguestlist"></a>GateGuestList

| Field | Required | Type | Notes |
|---|---|---|---|
| `items` | yes | list of [GateGuestCard](#schema-gateguestcard) |  |

### <a id="schema-guestmovementresult"></a>GuestMovementResult

| Field | Required | Type | Notes |
|---|---|---|---|
| `guest_name` | yes | string |  |
| `host_name` | yes | string |  |
| `host_room_label` | yes | string |  |
| `recorded_at` | yes | date-time |  |
| `message` | yes | string |  |
| `guests_in_hall_count` | yes | integer | minimum 0. |

### <a id="schema-registersummary"></a>RegisterSummary

| Field | Required | Type | Notes |
|---|---|---|---|
| `inside_count` | yes | integer |  |
| `outside_count` | yes | integer |  |
| `late_count` | yes | integer |  |
| `pending_permission_count` | yes | integer |  |
| `guests_in_hall_count` | yes | integer |  |
| `guests_should_have_left_count` | yes | integer |  |
| `pending_guest_stay_count` | yes | integer |  |
| `blocks` | yes | list of [BlockRegisterCounts](#schema-blockregistercounts) | The same counts for each block. Hall totals are the sum of these rows. |

### <a id="schema-blockregistercounts"></a>BlockRegisterCounts

| Field | Required | Type | Notes |
|---|---|---|---|
| `block_id` | yes | uuid |  |
| `code` | yes | string |  |
| `name` | yes | string |  |
| `inside_count` | yes | integer |  |
| `outside_count` | yes | integer |  |
| `late_count` | yes | integer |  |
| `pending_permission_count` | yes | integer |  |
| `guests_in_hall_count` | yes | integer |  |
| `guests_should_have_left_count` | yes | integer |  |
| `pending_guest_stay_count` | yes | integer |  |

### <a id="schema-registerrow"></a>RegisterRow

| Field | Required | Type | Notes |
|---|---|---|---|
| `id` | yes | uuid |  |
| `full_name` | yes | string |  |
| `room_label` | yes | string |  |
| `presence` | yes | `inside` or `outside` |  |
| `state` | yes | `inside` or `outside` or `late` |  |
| `outside_destination` | no | string or null | Place on the open outing. Empty when the resident is inside. |
| `expected_return_at` | no | date-time or null |  |
| `returned_at` | no | date-time or null |  |

### <a id="schema-registerpage"></a>RegisterPage

| Field | Required | Type | Notes |
|---|---|---|---|
| `total` | yes | integer | minimum 0. |
| `limit` | yes | integer |  |
| `offset` | yes | integer |  |
| `items` | yes | list of [RegisterRow](#schema-registerrow) |  |

### <a id="schema-guardiannotice"></a>GuardianNotice

Whether the guardian has been told about the open outing.

One of: `not_due`, `sent`, `failed`.

### <a id="schema-residentrecord"></a>ResidentRecord

| Field | Required | Type | Notes |
|---|---|---|---|
| `id` | yes | uuid |  |
| `full_name` | yes | string |  |
| `enrolment_number` | yes | string |  |
| `course` | no | string or null |  |
| `room_label` | yes | string |  |
| `presence` | yes | `inside` or `outside` |  |
| `state` | yes | `inside` or `outside` or `late` |  |
| `outing` | no | [Outing](#schema-outing) or null | The open outing with status outside, or null when the resident is inside. Cancelled, returned, and planned outings are omitted. |
| `guardian_name` | yes | string | Parent or guardian the hall contacts. |
| `guardian_notice` | yes | `not_due` or `sent` or `failed` |  |

### <a id="schema-residentaccount"></a>ResidentAccount

| Field | Required | Type | Notes |
|---|---|---|---|
| `id` | yes | uuid |  |
| `full_name` | yes | string |  |
| `enrolment_number` | yes | string |  |
| `course` | no | string or null |  |
| `room_id` | yes | uuid |  |
| `room_label` | yes | string |  |
| `guardian_name` | yes | string |  |
| `guardian_phone` | yes | string | E.164, country code required. |
| `status` | yes | `active` or `suspended` |  |
| `presence` | yes | `inside` or `outside` | Inside or outside the hall. Changes when a gate scan records an exit or a return. This is not sign-in. |

### <a id="schema-residentaccountpage"></a>ResidentAccountPage

| Field | Required | Type | Notes |
|---|---|---|---|
| `total` | yes | integer | minimum 0. |
| `limit` | yes | integer |  |
| `offset` | yes | integer |  |
| `items` | yes | list of [ResidentAccount](#schema-residentaccount) |  |

### <a id="schema-residentcreate"></a>ResidentCreate

| Field | Required | Type | Notes |
|---|---|---|---|
| `full_name` | yes | string | 1–120 characters. |
| `enrolment_number` | yes | string | 1–40 characters. |
| `course` | no | string | at most 120 characters. |
| `room_id` | yes | uuid |  |
| `guardian_name` | yes | string | Parent or guardian. Required. 1–120 characters. |
| `guardian_phone` | yes | string | E.164 with country code, for example +919876543210. pattern `^\+[1-9][0-9]{7,14}$`. |
| `temporary_password` | yes | string | 10–200 characters. |

### <a id="schema-residentcreated"></a>ResidentCreated

| Field | Required | Type | Notes |
|---|---|---|---|
| `account` | yes | [ResidentAccount](#schema-residentaccount) |  |
| `hall_pass` | yes | [HallPass](#schema-hallpass) |  |

### <a id="schema-residentupdate"></a>ResidentUpdate

| Field | Required | Type | Notes |
|---|---|---|---|
| `full_name` | no | string | 1–120 characters. |
| `enrolment_number` | no | string | 1–40 characters. |
| `course` | no | string or null |  |
| `room_id` | no | uuid |  |
| `guardian_name` | no | string | 1–120 characters. |
| `guardian_phone` | no | string | pattern `^\+[1-9][0-9]{7,14}$`. |
| `status` | no | `active` or `suspended` |  |

### <a id="schema-staffaccount"></a>StaffAccount

| Field | Required | Type | Notes |
|---|---|---|---|
| `id` | yes | uuid |  |
| `full_name` | yes | string |  |
| `username` | yes | string |  |
| `role` | yes | `gate` or `warden` or `provost` |  |
| `job_title` | yes | string |  |
| `status` | yes | `active` or `suspended` |  |

### <a id="schema-staffpage"></a>StaffPage

| Field | Required | Type | Notes |
|---|---|---|---|
| `total` | yes | integer | minimum 0. |
| `limit` | yes | integer |  |
| `offset` | yes | integer |  |
| `items` | yes | list of [StaffAccount](#schema-staffaccount) |  |

### <a id="schema-staffcreate"></a>StaffCreate

| Field | Required | Type | Notes |
|---|---|---|---|
| `full_name` | yes | string | 1–120 characters. |
| `username` | yes | string | 1–80 characters. |
| `role` | yes | `gate` or `warden` or `provost` |  |
| `job_title` | yes | string | Name of the post. Gate staff scan. A warden or the provost approves. The provost also keeps hall records. 1–80 characters. |
| `temporary_password` | yes | string | 10–200 characters. |

### <a id="schema-staffupdate"></a>StaffUpdate

| Field | Required | Type | Notes |
|---|---|---|---|
| `full_name` | no | string | 1–120 characters. |
| `job_title` | no | string | 1–80 characters. |
| `status` | no | `active` or `suspended` |  |

### <a id="schema-block"></a>Block

| Field | Required | Type | Notes |
|---|---|---|---|
| `id` | yes | uuid |  |
| `code` | yes | string | Short code used in room labels. Utility has no letter on the hall page, so its code is Utility. |
| `name` | yes | string |  |
| `floors` | yes | integer or null | A, B, C, and D have 4. The hall page does not state a floor count for Utility. |
| `room_count` | yes | integer | Published room count for this block. Block-A 50, Block-B 58, Block-C 42, Block-D 40, Utility 16. |
| `beds_per_room` | yes | integer | The hall page states a room capacity of 2. |
| `is_active` | yes | boolean |  |

### <a id="schema-blockcreate"></a>BlockCreate

| Field | Required | Type | Notes |
|---|---|---|---|
| `code` | yes | string | 1–16 characters. |
| `name` | yes | string | 1–80 characters. |
| `floors` | no | integer or null |  |
| `room_count` | yes | integer | 1–500. |
| `beds_per_room` | yes | integer | 1–6. |

### <a id="schema-blockupdate"></a>BlockUpdate

| Field | Required | Type | Notes |
|---|---|---|---|
| `name` | no | string | 1–80 characters. |
| `floors` | no | integer or null |  |
| `room_count` | no | integer | 1–500. |
| `beds_per_room` | no | integer | 1–6. |
| `is_active` | no | boolean |  |

### <a id="schema-room"></a>Room

| Field | Required | Type | Notes |
|---|---|---|---|
| `id` | yes | uuid |  |
| `block_id` | yes | uuid |  |
| `number` | yes | string | Door number, kept as written. The hall page does not publish door numbers. |
| `label` | yes | string |  |
| `bed_count` | yes | integer | Copied from the block when the room is created. Active residents assigned here, including a suspended resident who has not moved, cannot exceed this. |
| `is_active` | yes | boolean |  |

### <a id="schema-roomcreate"></a>RoomCreate

| Field | Required | Type | Notes |
|---|---|---|---|
| `block_id` | yes | uuid |  |
| `number` | yes | string | 1–12 characters. |

### <a id="schema-roomupdate"></a>RoomUpdate

| Field | Required | Type | Notes |
|---|---|---|---|
| `number` | no | string | 1–12 characters. |
| `bed_count` | no | integer | 1–6. |
| `is_active` | no | boolean |  |

### <a id="schema-hallsettings"></a>HallSettings

| Field | Required | Type | Notes |
|---|---|---|---|
| `hall_name` | yes | string |  |
| `university_name` | yes | string |  |
| `timezone` | yes | string |  |
| `grace_minutes` | yes | integer |  |
| `summer_hours_start` | yes | string | Kept as HH:MM. Shown as 6:30 AM. Starts as 06:30. pattern `^([01][0-9]|2[0-3]):[0-5][0-9]$`. |
| `summer_hours_end` | yes | string | Kept as HH:MM. Shown as 6:30 PM. Starts as 18:30. pattern `^([01][0-9]|2[0-3]):[0-5][0-9]$`. |
| `winter_hours_start` | yes | string | Kept as HH:MM. Shown as 6:30 AM. Starts as 06:30. pattern `^([01][0-9]|2[0-3]):[0-5][0-9]$`. |
| `winter_hours_end` | yes | string | Kept as HH:MM. Shown as 5:30 PM. Starts as 17:30. pattern `^([01][0-9]|2[0-3]):[0-5][0-9]$`. |
| `summer_season_start` | yes | string | Month and day summer hours begin. Shown as 01 April. Starts as 04-01. pattern `^(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$`. |
| `winter_season_start` | yes | string | Month and day winter hours begin. Shown as 01 October. Starts as 10-01. pattern `^(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$`. |
| `permission_early_minutes` | yes | integer |  |
| `guest_max_inclusive_days` | yes | integer |  |
| `guest_min_lead_days` | yes | integer |  |
| `scan_duplicate_window_seconds` | yes | integer |  |
| `late_sms_template` | yes | string | Placeholders: {resident_name}, {room}, {expected_return_local}, {hall_name}. |
| `return_sms_template` | yes | string | Placeholders: {resident_name}, {room}, {returned_at_local}, {hall_name}. |

### <a id="schema-hallsettingsupdate"></a>HallSettingsUpdate

| Field | Required | Type | Notes |
|---|---|---|---|
| `hall_name` | no | string | 1–160 characters. |
| `university_name` | no | string | 1–160 characters. |
| `grace_minutes` | no | integer | 0–180. |
| `summer_hours_start` | no | string | pattern `^([01][0-9]|2[0-3]):[0-5][0-9]$`. |
| `summer_hours_end` | no | string | pattern `^([01][0-9]|2[0-3]):[0-5][0-9]$`. |
| `winter_hours_start` | no | string | pattern `^([01][0-9]|2[0-3]):[0-5][0-9]$`. |
| `winter_hours_end` | no | string | pattern `^([01][0-9]|2[0-3]):[0-5][0-9]$`. |
| `summer_season_start` | no | string | pattern `^(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$`. |
| `winter_season_start` | no | string | pattern `^(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$`. |
| `permission_early_minutes` | no | integer | 0–180. |
| `guest_max_inclusive_days` | no | integer | 1–30. |
| `guest_min_lead_days` | no | integer | 0–14. |
| `scan_duplicate_window_seconds` | no | integer | 0–600. |
| `late_sms_template` | no | string | at least 1 characters. |
| `return_sms_template` | no | string | at least 1 characters. |

### <a id="schema-smsmessage"></a>SmsMessage

Provost SMS log row. Transport vendor is not part of the public contract.

| Field | Required | Type | Notes |
|---|---|---|---|
| `id` | yes | uuid |  |
| `outing_id` | yes | uuid |  |
| `resident_id` | yes | uuid |  |
| `resident_name` | no | string |  |
| `notice_type` | yes | `late_notice` or `return_notice` | Late notice, or return notice. |
| `recipient_phone` | yes | string | Guardian phone copied at send time. Country code required. pattern `^\+[1-9][0-9]{7,14}$`. |
| `body` | yes | string | Filled message. Times are described for display as 12-hour; this body is the text that was sent. |
| `status` | yes | `sent` or `failed` |  |
| `created_at` | yes | date-time |  |

### <a id="schema-smspage"></a>SmsPage

| Field | Required | Type | Notes |
|---|---|---|---|
| `total` | yes | integer | minimum 0. |
| `limit` | yes | integer |  |
| `offset` | yes | integer |  |
| `items` | yes | list of [SmsMessage](#schema-smsmessage) |  |

### <a id="schema-auditevent"></a>AuditEvent

| Field | Required | Type | Notes |
|---|---|---|---|
| `id` | yes | uuid |  |
| `occurred_at` | yes | date-time |  |
| `actor_user_id` | no | uuid or null |  |
| `actor_name` | no | string or null |  |
| `action` | yes | string |  |
| `entity_type` | yes | string |  |
| `entity_id` | yes | string |  |
| `summary` | yes | string |  |

### <a id="schema-auditpage"></a>AuditPage

| Field | Required | Type | Notes |
|---|---|---|---|
| `total` | yes | integer | minimum 0. |
| `limit` | yes | integer |  |
| `offset` | yes | integer |  |
| `items` | yes | list of [AuditEvent](#schema-auditevent) |  |
