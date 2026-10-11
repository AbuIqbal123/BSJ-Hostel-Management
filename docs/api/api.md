# Begum Sultan Jahan Hall API

API version: **1**

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
  - [POST `/api/v1/auth/onboard` — Resident self-onboard](#post-api-v1-auth-onboard)
  - [POST `/api/v1/auth/onboard/enrolment` — Check an enrolment number](#post-api-v1-auth-onboard-enrolment)
  - [GET `/api/v1/auth/onboard/options` — Onboard room picker](#get-api-v1-auth-onboard-options)
- [Resident](#tag-resident)
  - [GET `/api/v1/me/home` — Resident home](#get-api-v1-me-home)
  - [GET `/api/v1/me/notifications` — Own permission decisions, newest first](#get-api-v1-me-notifications)
  - [POST `/api/v1/me/notifications/read` — Mark her unread permission decisions read](#post-api-v1-me-notifications-read)
  - [GET `/api/v1/me/hall-pass` — Hall pass for the outing in its window](#get-api-v1-me-hall-pass)
  - [POST `/api/v1/me/account/delete` — Delete own account](#post-api-v1-me-account-delete)
  - [GET `/api/v1/me/history` — Own history](#get-api-v1-me-history)
  - [GET `/api/v1/destinations` — Ordinary outing destinations](#get-api-v1-destinations)
  - [GET `/api/v1/me/outings` — Ordinary outing plans](#get-api-v1-me-outings)
  - [POST `/api/v1/me/outings` — Plan an ordinary outing](#post-api-v1-me-outings)
  - [GET `/api/v1/me/outings/current` — Open outing](#get-api-v1-me-outings-current)
  - [PATCH `/api/v1/me/outings/{outing_id}` — Change a planned outing](#patch-api-v1-me-outings-outing_id)
  - [POST `/api/v1/me/outings/{outing_id}/cancel` — Cancel a planned outing](#post-api-v1-me-outings-outing_id-cancel)
  - [POST `/api/v1/me/expire-passed` — Expire own passed plans and permissions](#post-api-v1-me-expire-passed)
- [Permissions](#tag-permissions)
  - [GET `/api/v1/me/permissions` — Own special permissions](#get-api-v1-me-permissions)
  - [POST `/api/v1/me/permissions` — Request late-night or home going](#post-api-v1-me-permissions)
  - [GET `/api/v1/me/permissions/{permission_id}` — Own permission](#get-api-v1-me-permissions-permission_id)
  - [PATCH `/api/v1/me/permissions/{permission_id}` — Change a pending permission](#patch-api-v1-me-permissions-permission_id)
  - [POST `/api/v1/me/permissions/{permission_id}/cancel` — Cancel own permission](#post-api-v1-me-permissions-permission_id-cancel)
  - [GET `/api/v1/permissions` — Permission queue](#get-api-v1-permissions)
  - [POST `/api/v1/permissions/expire-passed` — Expire passed unused permissions](#post-api-v1-permissions-expire-passed)
  - [GET `/api/v1/permissions/{permission_id}` — Permission for review](#get-api-v1-permissions-permission_id)
  - [POST `/api/v1/permissions/{permission_id}/decision` — Approve or reject a permission](#post-api-v1-permissions-permission_id-decision)
- [Guest Stays](#tag-guest-stays)
  - [GET `/api/v1/me/guest-stays` — Own guest applications](#get-api-v1-me-guest-stays)
  - [POST `/api/v1/me/guest-stays` — Apply for a guest stay](#post-api-v1-me-guest-stays)
  - [GET `/api/v1/me/guest-stays/{guest_stay_id}` — Own guest stay](#get-api-v1-me-guest-stays-guest_stay_id)
  - [PATCH `/api/v1/me/guest-stays/{guest_stay_id}` — Edit own guest stay](#patch-api-v1-me-guest-stays-guest_stay_id)
  - [POST `/api/v1/me/guest-stays/{guest_stay_id}/cancel` — Cancel own guest application](#post-api-v1-me-guest-stays-guest_stay_id-cancel)
  - [GET `/api/v1/guest-stays` — Guest stays](#get-api-v1-guest-stays)
  - [GET `/api/v1/guest-stays/{guest_stay_id}` — Guest stay for review](#get-api-v1-guest-stays-guest_stay_id)
  - [POST `/api/v1/guest-stays/{guest_stay_id}/decision` — Approve or reject a guest stay](#post-api-v1-guest-stays-guest_stay_id-decision)
  - [POST `/api/v1/guest-stays/{guest_stay_id}/payment` — Mark guest payment](#post-api-v1-guest-stays-guest_stay_id-payment)
  - [POST `/api/v1/guest-stays/{guest_stay_id}/payment/evidence` — Upload guest payment evidence](#post-api-v1-guest-stays-guest_stay_id-payment-evidence)
  - [GET `/api/v1/guest-stays/{guest_stay_id}/payment/evidence` — Download guest payment evidence](#get-api-v1-guest-stays-guest_stay_id-payment-evidence)
  - [DELETE `/api/v1/guest-stays/{guest_stay_id}/payment/evidence` — Clear guest payment evidence](#delete-api-v1-guest-stays-guest_stay_id-payment-evidence)
- [Gate](#tag-gate)
  - [POST `/api/v1/gate/scans` — Scan a hall pass](#post-api-v1-gate-scans)
  - [GET `/api/v1/gate/activity` — Recent gate activity](#get-api-v1-gate-activity)
  - [GET `/api/v1/gate/occupancy` — Guest dining occupancy at the gate](#get-api-v1-gate-occupancy)
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
  - [GET `/api/v1/admin/notifications` — Hall notification settings](#get-api-v1-admin-notifications)
  - [PATCH `/api/v1/admin/notifications` — Update hall notification settings](#patch-api-v1-admin-notifications)
  - [GET `/api/v1/admin/register/export` — Export the register](#get-api-v1-admin-register-export)
  - [GET `/api/v1/admin/sms` — SMS log](#get-api-v1-admin-sms)
  - [GET `/api/v1/admin/audit` — Audit log](#get-api-v1-admin-audit)
- [Payloads](#tag-payloads)

## How to call the API

HTTP contract for the hostel movement system. Stored data is in
`docs/database/database.md`.

This version is the contract. Auth, resident phone (home, history, hall pass,
destinations, ordinary outings, permissions, guest stays, permission-decision
inbox), register, staff
permission queue, staff guest stays, gate scans, guests, and occupancy, and hall office
(settings, notifications, blocks, rooms, destinations, residents, staff, password reset,
audit, SMS log, register export) respond. Swagger on this server is the
review surface for purpose, payload, and response.

JSON names are snake_case. Instants are UTC `YYYY-MM-DDTHH:MM:SSZ`. Calendar
dates are hall-local `YYYY-MM-DD` in Asia/Kolkata. A time of day is `HH:MM`.
A season start is `MM-DD`. A phone number includes the country code, `+`
then digits. Clients show India time on a 12-hour clock and a date as the
day, the month name, and the year. `2026-09-18T13:30:00Z` is shown as
18 September 2026, 7:00 PM. This API returns the stored form.

The caller sends an access token as `Authorization: Bearer`, except on
`GET /health`, `POST /api/v1/auth/login`, `POST /api/v1/auth/refresh`, and
`POST /api/v1/auth/onboard`.

Access tokens last 15 minutes. Refresh tokens last 30 days. A password chosen
on self-onboard, on change-password, or on a provost password reset is at
least 10 characters and includes an uppercase letter, a lowercase letter, a
number, and a symbol. Passwords are stored as Argon2id. Residents may
self-onboard at `POST /api/v1/auth/onboard` (public on dev). On that form the
resident phone and the guardian phone are Indian mobiles: `+91` followed by
exactly 10 digits. The form selects the block and room and creates an active
resident who can sign in immediately. The provost may still create residents
and must create staff.
A resident username is the enrolment number.

Stored state and lifecycles live in `docs/database/database.md`. This file does not
repeat the column list. The reading copy of this contract is `docs/api/api.md`.

| Server | Use |
|---|---|
| `http://localhost:8000` | Local development |
| `https://bsj-hostel-api.onrender.com` | Hall API used by release phone builds |

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

Opens the hall database and reports the schema version.
`GET /health` stays shallow.

**Responses**

#### 200

The database opened and the schema version was read.

Body: [Ready](#schema-ready).

| Field | Required | Type | Notes |
|---|---|---|---|
| `status` | yes | `ready` |  |
| `user_version` | yes | integer | Schema version after migrations. minimum 0. |

**Example**

```json
{
  "status": "ready",
  "user_version": 1
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

Sign-in, resident self-onboard, and the onboard room picker under /api/v1/auth. Staff accounts stay office-created. No guardian login. Do not confuse with Register (presence board).

| Method | Path | Purpose | Who |
|---|---|---|---|
| POST | `/api/v1/auth/login` | [Sign in](#post-api-v1-auth-login) | anyone with a hall-issued account |
| POST | `/api/v1/auth/refresh` | [Exchange a refresh token](#post-api-v1-auth-refresh) | Anyone |
| POST | `/api/v1/auth/logout` | [Sign out](#post-api-v1-auth-logout) | Signed-in account |
| GET | `/api/v1/auth/me` | [Current account](#get-api-v1-auth-me) | Signed-in account |
| POST | `/api/v1/auth/change-password` | [Change own password](#post-api-v1-auth-change-password) | Signed-in account |
| POST | `/api/v1/auth/onboard` | [Resident self-onboard](#post-api-v1-auth-onboard) | anyone (no token) |
| POST | `/api/v1/auth/onboard/enrolment` | [Check an enrolment number](#post-api-v1-auth-onboard-enrolment) | anyone (no token) |
| GET | `/api/v1/auth/onboard/options` | [Onboard room picker](#get-api-v1-auth-onboard-options) | anyone (no token) |

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
The new password is at least 10 characters and includes an uppercase letter,
a lowercase letter, a number, and a symbol.

**Request.** Required.

Body: [ChangePasswordRequest](#schema-changepasswordrequest).

| Field | Required | Type | Notes |
|---|---|---|---|
| `current_password` | yes | string | 1–200 characters. |
| `new_password` | yes | string | At least 10 characters, with one uppercase letter, one lowercase letter, one number, and one symbol (a character that is not a letter or number). Shorter than 10 says "Use at least 10 characters." Missing a class says "Include an uppercase letter, a lowercase letter, a number, and a symbol.". 10–200 characters. pattern `^(?=.*[A-Z])(?=.*[a-z])(?=.*[0-9])(?=.*[^A-Za-z0-9]).+$`. |

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


### <a id="post-api-v1-auth-onboard"></a>POST `/api/v1/auth/onboard` — Resident self-onboard

`onboard_resident`

**Who.** anyone (no token). No token.

Caller: anyone (no token). Public resident self-sign-up on dev. Creates
an **active** resident from the phone. Required fields: `full_name`,
`enrolment_number`, `password`, `phone`, `block_id`, `room_id`,
`guardian_name`, and `guardian_phone`. Optional: `course`.

She chooses the block and room on this form from the seeded resident
inventory returned by `GET /api/v1/auth/onboard/options`. The account can
sign in immediately at `POST /api/v1/auth/login`; this call does not
return access or refresh tokens.

Enrolment is unique hall-wide (ignoring capitals) and becomes the
username. Staff cannot use this path. Rate-limited like sign-in. A taken
enrolment is refused on `enrolment_number` before the rest of the form
is needed, and again if signup is sent with that number.

**Request.** Required.

Body: [ResidentOnboardRequest](#schema-residentonboardrequest).

| Field | Required | Type | Notes |
|---|---|---|---|
| `full_name` | yes | string | 1–120 characters. |
| `enrolment_number` | yes | string | Roll / enrolment number. Becomes the username. Unique hall-wide, ignoring capitals. 1–40 characters. |
| `password` | yes | string | First password she chooses. Stored as Argon2id. Not returned. Sample bodies in this repository omit the value; the field is required. At least 10 characters, with one uppercase letter, one lowercase letter, one number, and one symbol (a character that is not a letter or number). Shorter than 10 says "Use at least 10 characters." Missing a class says "Include an uppercase letter, a lowercase letter, a number, and a symbol.". 10–200 characters. pattern `^(?=.*[A-Z])(?=.*[a-z])(?=.*[0-9])(?=.*[^A-Za-z0-9]).+$`. |
| `course` | no | string | Optional. For example B.A. LL.B. (Hons.). at most 120 characters. |
| `phone` | yes | string | The resident's own Indian mobile. +91 followed by exactly 10 digits. Required on self-onboard. Not the guardian phone. Another country or another length says "Use an Indian mobile: +91 and exactly 10 digits.". pattern `^\+91[0-9]{10}$`. |
| `block_id` | yes | uuid | The block selected for self-onboard. The room must belong to it. |
| `room_id` | yes | uuid | The active room selected for self-onboard. |
| `guardian_name` | yes | string | Parent or guardian the hall contacts. 1–120 characters. |
| `guardian_phone` | yes | string | Guardian Indian mobile. +91 followed by exactly 10 digits. Late and return SMS go here. Another country or another length says "Use an Indian mobile: +91 and exactly 10 digits.". pattern `^\+91[0-9]{10}$`. |

**Example**

```json
{
  "full_name": "Aisha Khan",
  "enrolment_number": "24-GLLB-118",
  "phone": "+919811112222",
  "block_id": "00000000-0000-4000-8000-0000000000b1",
  "room_id": "00000000-0000-4000-8000-000000000204",
  "guardian_name": "Rashid Khan",
  "guardian_phone": "+919876543210"
}
```

**Responses**

#### 201

Active resident kept. No access token or refresh token is returned;
sign in with the submitted enrolment number and password.

Body: [ResidentOnboardResponse](#schema-residentonboardresponse).

| Field | Required | Type | Notes |
|---|---|---|---|
| `enrolment_number` | yes | string | Stored spelling of the enrolment number. |
| `status` | yes | `active` |  |
| `message` | yes | string | Ready copy for the phone. Exact sentence for clients. |

**Example**

```json
{
  "enrolment_number": "24-GLLB-118",
  "status": "active",
  "message": "Your account is ready. Sign in with your enrolment number and password."
}
```

#### 422

A field is missing or invalid. A taken enrolment, ignoring
capitals, names `enrolment_number` and says that number is already
an account.

Body: [ErrorResponse](#schema-errorresponse).

**Example**

```json
{
  "error": {
    "code": "validation_error",
    "message": "That enrolment number is already an account.",
    "details": {
      "field": "enrolment_number"
    }
  }
}
```

#### 429

Too many onboard attempts from this client in a short window.

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


### <a id="post-api-v1-auth-onboard-enrolment"></a>POST `/api/v1/auth/onboard/enrolment` — Check an enrolment number

`check_onboard_enrolment`

**Who.** anyone (no token). No token.

Caller: anyone (no token). Used on the enrolment field before the rest
of signup. A free number returns no body. A number that is already an
account, ignoring capitals, names `enrolment_number`. Rate-limited like
sign-in.

**Request.** Required.

Body: object.

| Field | Required | Type | Notes |
|---|---|---|---|
| `enrolment_number` | yes | string | 1–40 characters. |

**Example**

```json
{
  "enrolment_number": "24-GLLB-220"
}
```

**Responses**

#### 204

That enrolment number is free.

No body.

#### 422

The enrolment number is already an account, or it is missing.

Body: [ErrorResponse](#schema-errorresponse).

**Example**

```json
{
  "error": {
    "code": "validation_error",
    "message": "That enrolment number is already an account.",
    "details": {
      "field": "enrolment_number"
    }
  }
}
```

#### 429

Too many enrolment checks from this client in a short window.

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


### <a id="get-api-v1-auth-onboard-options"></a>GET `/api/v1/auth/onboard/options` — Onboard room picker

`onboard_options`

**Who.** anyone (no token). No token.

Caller: anyone (no token). Public list for the resident self-onboard
form only. Returns the four resident blocks A, B, C, and D (by code),
in that order. Utility and any other non-resident block are never
included. A block stays in the list even when every room is taken; its
`rooms` array may be empty.

Each room entry comes from a stored room row. Only active rooms with no
resident assigned are listed. A room that already has a resident is
omitted, even when a bed remains. Inactive rooms are omitted. The
response does not invent room rows.

Each block is `id` and `name` only. Each room is `id` and `label` only.
Rooms inside a block are ordered by door number. This is not the
provost block or room record.

Rate-limited like sign-in.

**Responses**

#### 200

Blocks and rooms the onboard form may offer.

Body: list of [OnboardBlockOption](#schema-onboardblockoption).

No fields.

**Example**

```json
[
  {
    "id": "01b885ad-e40d-56a4-81ab-2371f654f558",
    "name": "Block-A",
    "rooms": [
      {
        "id": "70ca72d7-95e1-52c9-865e-3663cddb45e5",
        "label": "A-1"
      }
    ]
  },
  {
    "id": "d032aad6-a203-5ea0-ba9a-3a9257edbfc8",
    "name": "Block-B",
    "rooms": [
      {
        "id": "b9d8a3e2-9c67-50e2-a1a4-8f241f823ab1",
        "label": "B-1"
      }
    ]
  },
  {
    "id": "dad52ee9-0b9a-53e2-a792-1dbee295ada9",
    "name": "Block-C",
    "rooms": []
  },
  {
    "id": "f75a0c4d-cf9e-5b03-9ba5-13f77337453d",
    "name": "Block-D",
    "rooms": [
      {
        "id": "df9f29b7-4c46-5373-9de0-36cfcf8b9338",
        "label": "D-40"
      }
    ]
  }
]
```

#### 429

Too many onboard-options attempts from this client in a short window.

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


## <a id="tag-resident"></a>Resident

The resident phone. Ordinary outings, home, destinations, and the hall pass.

| Method | Path | Purpose | Who |
|---|---|---|---|
| GET | `/api/v1/me/home` | [Resident home](#get-api-v1-me-home) | resident |
| GET | `/api/v1/me/notifications` | [Own permission decisions, newest first](#get-api-v1-me-notifications) | resident |
| POST | `/api/v1/me/notifications/read` | [Mark her unread permission decisions read](#post-api-v1-me-notifications-read) | resident |
| GET | `/api/v1/me/hall-pass` | [Hall pass for the outing in its window](#get-api-v1-me-hall-pass) | resident |
| POST | `/api/v1/me/account/delete` | [Delete own account](#post-api-v1-me-account-delete) | resident |
| GET | `/api/v1/me/history` | [Own history](#get-api-v1-me-history) | resident |
| GET | `/api/v1/destinations` | [Ordinary outing destinations](#get-api-v1-destinations) | Signed-in account |
| GET | `/api/v1/me/outings` | [Ordinary outing plans](#get-api-v1-me-outings) | resident |
| POST | `/api/v1/me/outings` | [Plan an ordinary outing](#post-api-v1-me-outings) | resident |
| GET | `/api/v1/me/outings/current` | [Open outing](#get-api-v1-me-outings-current) | resident |
| PATCH | `/api/v1/me/outings/{outing_id}` | [Change a planned outing](#patch-api-v1-me-outings-outing_id) | resident |
| POST | `/api/v1/me/outings/{outing_id}/cancel` | [Cancel a planned outing](#post-api-v1-me-outings-outing_id-cancel) | resident |
| POST | `/api/v1/me/expire-passed` | [Expire own passed plans and permissions](#post-api-v1-me-expire-passed) | resident |

### <a id="get-api-v1-me-home"></a>GET `/api/v1/me/home` — Resident home

`resident_home`

**Who.** resident. Bearer access token.

Caller: resident. Her name, hall, block, and room, how many ordinary
outings, late-night outings, and home-going outings she has returned
from, how many permissions she has sent and how many were rejected,
and how many guest stays she has requested, whether an ordinary
outing is inside its show window now (`ordinary_outing_active`),
presence, the open outing if there is one, her planned future ordinary
outings (`upcoming_outings`), the permission the resident is waiting
on or cleared to use, the last ten exit and return lines, and
`notifications_unread` (true when a permission decision is still unread).
`upcoming_outings` is soonest start first. It leaves off returned,
cancelled, outside, and plans whose expected return has already
passed. A plan inside its show window stays on the list with
`can_modify` false. Does not cancel passed plans or expire
permissions; call POST /api/v1/me/expire-passed first when the phone
needs a fresh home screen.

**Responses**

#### 200

Home screen.

Body: [ResidentHome](#schema-residenthome).

| Field | Required | Type | Notes |
|---|---|---|---|
| `resident` | yes | [HomeResident](#schema-homeresident) |  |
| `ordinary_outing_active` | yes | boolean | True when one of her ordinary outings is inside its show window now. That window opens 30 minutes before `starts_at` (immediately when the start is within 5 minutes, because the lead has already begun) and lasts until the outing ends. |
| `current_outing` | yes | [Outing](#schema-outing) or null |  |
| `upcoming_outings` | yes | list of [UpcomingOuting](#schema-upcomingouting) | Planned ordinary outings whose expected return is still in the future. Soonest start first. Not returned, cancelled, outside, or already past. |
| `active_permission` | yes | [Permission](#schema-permission) or null | The newest permission in `pending`, `approved`, or `in_use`, if any. |
| `recent_history` | yes | list of [HistoryEvent](#schema-historyevent) |  |
| `notifications_unread` | yes | boolean | True when she has at least one permission decision she has not marked read. False when the inbox is empty or every row is read. |

**Example**

```json
{
  "resident": {
    "full_name": "Aisha Khan",
    "enrolment_number": "24-GLLB-118",
    "course": "B.A. LL.B. (Hons.)",
    "room_label": "B-204",
    "block_name": "Block-B",
    "presence": "inside",
    "hall_name": "Begum Sultan Jahan Hall",
    "permissions_requested": 0,
    "permissions_rejected": 0,
    "ordinary_returns": 0,
    "late_night_returns": 0,
    "home_going_returns": 0,
    "guest_stays": 0
  },
  "ordinary_outing_active": false,
  "current_outing": null,
  "upcoming_outings": [
    {
      "id": "00000000-0000-4000-8000-000000000002",
      "place": "Women's College",
      "starts_at": "2026-10-01T04:00:00Z",
      "expected_return_at": "2026-10-01T08:00:00Z",
      "can_modify": true
    }
  ],
  "active_permission": null,
  "notifications_unread": false,
  "recent_history": [
    {
      "event": "returned",
      "place": "Maulana Azad Library",
      "outing_id": "00000000-0000-4000-8000-000000000001",
      "exited_at": null,
      "returned_at": "2026-09-12T15:16:00Z",
      "recorded_by": "Fatima Khan"
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


### <a id="get-api-v1-me-notifications"></a>GET `/api/v1/me/notifications` — Own permission decisions, newest first

`list_resident_notifications`

**Who.** resident. Bearer access token.

Caller: resident. The newest 50 rows written when a warden or the
provost approved or rejected her permission. Does not mark them read.
Call POST /api/v1/me/notifications/read for that.

**Responses**

#### 200

Her notification rows, newest first, at most 50.

Body: [ResidentNotificationList](#schema-residentnotificationlist).

| Field | Required | Type | Notes |
|---|---|---|---|
| `items` | yes | list of [ResidentNotification](#schema-residentnotification) |  |

**Example**

```json
{
  "items": [
    {
      "id": "00000000-0000-4000-8000-0000000000a1",
      "permission_id": "00000000-0000-4000-8000-0000000000b1",
      "permission_type": "late_night",
      "decision": "approved",
      "place": "Women's College",
      "departure_at": "2026-09-30T14:00:00Z",
      "expected_return_at": "2026-09-30T18:00:00Z",
      "decided_by": "Sara Malik",
      "created_at": "2026-09-30T13:00:00Z",
      "unread": true
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


### <a id="post-api-v1-me-notifications-read"></a>POST `/api/v1/me/notifications/read` — Mark her unread permission decisions read

`mark_resident_notifications_read`

**Who.** resident. Bearer access token.

Caller: resident. Sets read on every unread row of hers, including
any older than the 50 returned by the list. Returns how many rows
changed. A second call marks nothing.

**Responses**

#### 200

How many rows were marked read.

Body: [ResidentNotificationsMarked](#schema-residentnotificationsmarked).

| Field | Required | Type | Notes |
|---|---|---|---|
| `marked` | yes | integer | How many of her rows changed from unread to read. minimum 0. |

**Example**

```json
{
  "marked": 1
}
```

#### 401

The access token is missing or expired, or the username and password were refused.

Body: [ErrorResponse](#schema-errorresponse).

#### 403

The signed-in role cannot call this operation.

Body: [ErrorResponse](#schema-errorresponse).


### <a id="get-api-v1-me-hall-pass"></a>GET `/api/v1/me/hall-pass` — Hall pass for the outing in its window

`resident_hall_pass`

**Who.** resident. Bearer access token.

Caller: resident. The hall-pass code is still the resident's permanent
token (the gate scans that same code). The phone shows it for one
outing only. `qr_payload` is set only while that window is open.
`place`, `starts_at`, and `expected_return_at` are that outing's
lines, the same values as on home `upcoming_outings`. All three are
null when `outing_id` is null.

An ordinary outing's window opens 30 minutes before `starts_at`. If
`starts_at` is within 5 minutes, the 30-minute lead has already begun,
so the QR is shown immediately. A planned outing's window ends at
`expected_return_at`. An outside outing has not ended until the return
scan, so the payload stays available until then, including a permission
outing she is already outside on. The gate scan still decides whether
the movement is recorded.

**Responses**

#### 200

Hall pass payload.

Body: [ResidentHallPass](#schema-residenthallpass).

| Field | Required | Type | Notes |
|---|---|---|---|
| `qr_payload` | yes | string or null | Permanent hall-pass text (`bsj:v1:` plus the token) when `qr_visible` is true. Null when the phone must not show a QR yet. The gate still scans this same text. |
| `full_name` | yes | string |  |
| `room_label` | yes | string |  |
| `outing_id` | yes | uuid or null | The outing this pass is for, if she has a planned or outside outing. |
| `place` | yes | string or null | Stored place on that outing: the list name, the words typed for Other, or the permission's short place. Same meaning as `place` on an outing. Null when `outing_id` is null. |
| `starts_at` | yes | date-time or null | When she leaves. Null when `outing_id` is null, on a permission outing, and on an ordinary plan saved before this field existed. |
| `expected_return_at` | yes | date-time or null | When she comes back. Null when `outing_id` is null. |
| `qr_visible` | yes | boolean |  |
| `qr_visible_from` | yes | date-time or null | When the QR may be shown. Null when she has no upcoming ordinary outing. |
| `qr_visible_until` | yes | date-time or null | Planned ordinary outings close at `expected_return_at`. Null while she is outside, because the outing ends at the return scan. |

**Example**

```json
{
  "qr_payload": "bsj:v1:example-token",
  "full_name": "Aisha Khan",
  "room_label": "B-204",
  "outing_id": "00000000-0000-4000-8000-000000000001",
  "place": "Maulana Azad Library",
  "starts_at": "2026-09-30T08:00:00Z",
  "expected_return_at": "2026-09-30T13:00:00Z",
  "qr_visible": true,
  "qr_visible_from": "2026-09-30T07:30:00Z",
  "qr_visible_until": "2026-09-30T13:00:00Z"
}
```

#### 401

The access token is missing or expired, or the username and password were refused.

Body: [ErrorResponse](#schema-errorresponse).

#### 403

The signed-in role cannot call this operation.

Body: [ErrorResponse](#schema-errorresponse).


### <a id="post-api-v1-me-account-delete"></a>POST `/api/v1/me/account/delete` — Delete own account

`delete_own_account`

**Who.** resident. Bearer access token.

Caller: resident. She confirms with her current password. The hall
revokes her sessions, cancels planned outings and permissions and
guest stays that have not arrived, frees her room, and removes the
name, phone, guardian, enrolment, and hall pass from the account.
Sign-in with the old enrolment then fails. History the hall must keep
stays, without her name. Refused while she is outside or a guest of
hers is still in the hall.

**Request.** Required.

Body: [DeleteAccountRequest](#schema-deleteaccountrequest).

| Field | Required | Type | Notes |
|---|---|---|---|
| `password` | yes | string | Her current password, sent once to confirm the deletion. 1–200 characters. |

**Responses**

#### 204

The account can no longer sign in. No body.

No body.

#### 401

Wrong password, or no token. Wrong password says the current
password is wrong. No token says to sign in again.

Body: [ErrorResponse](#schema-errorresponse).

#### 403

The signed-in role cannot call this operation.

Body: [ErrorResponse](#schema-errorresponse).

#### 409

`account_in_use` says to return to the hall first, or that a guest
is still in the hall.

Body: [ErrorResponse](#schema-errorresponse).

#### 422

The JSON is the wrong shape, or a field fails a constraint that does not depend on existing rows.

Body: [ErrorResponse](#schema-errorresponse).


### <a id="get-api-v1-me-history"></a>GET `/api/v1/me/history` — Own history

`resident_history`

**Who.** resident. Bearer access token.

Caller: resident. One row per record that has left live use, newest
`ended_at` first. No page control.

An ordinary outing is a row in three cases. Unused (`unused` true): no
gate exit, and the planned return has passed, or she cancelled the
plan. `started_at` and `ended_at` are the planned leave and the
planned return. Finished (`unused` false): the gate recorded both the
exit and the return. Those gate times are `started_at` and
`ended_at`. An exit with no return is not a row, even when the
planned return has passed. A future plan she has not cancelled is
not a row.

A late-night or home-going permission is a row when she cancelled it,
when it was rejected, when it was approved and the window ended
without use (`unused` true; status `approved` or `expired`), or when
it was approved and then completed (`unused` false; status
`completed`). `started_at` and `ended_at` are `departure_at` and
`expected_return_at`. A cancelled or rejected permission is `unused`
true on that same window. Pending, and still-open approved or in-use
permissions are not rows.

A guest stay is a row when it was rejected or cancelled (`unused`
true), when it was approved and the stay dates ended without an
arrival (`unused` true), or when it was approved and then departed
(`unused` false; status `departed`). `started_at` and `ended_at` are
the start of `guest_start_date` and the end of `guest_end_date` in
Asia/Kolkata. Pending stays, stays still inside the window, and an
arrived stay that has not departed are not rows.

`who` is the guest name for a guest stay and null otherwise. `place`
is null when the record has nowhere (a guest stay). `exit_recorded_by`
and `return_recorded_by` are staff display names from the gate exit
and return on a finished ordinary outing, or on the outing of a
completed permission. Otherwise both are null. There is no status
field.

**Parameters**

| Name | In | Required | Type | Notes |
|---|---|---|---|---|
| `kind` | query | no | `all` or `late_night` or `home_going` or `guest_stay` or `outing` | Omit or `all` for every kind. Otherwise exactly one of `late_night`, `home_going`, `guest_stay`, or `outing`. |
| `on` | query | no | date | One calendar date in Asia/Kolkata, `YYYY-MM-DD`. Omit when she has not chosen a day. A row matches when that hall date is the calendar day of `started_at`, of `ended_at`, or a day between them (inclusive). |
| `from` | query | no | date | First calendar date in Asia/Kolkata, `YYYY-MM-DD`. A row matches when its hall days overlap the range from this date through `to`. Omit for no lower bound. |
| `to` | query | no | date | Last calendar date in Asia/Kolkata, `YYYY-MM-DD`. A row matches when its hall days overlap the range through this date. Omit for no upper bound. |

**Responses**

#### 200

History rows, newest ended_at first.

Body: [HistoryList](#schema-historylist).

| Field | Required | Type | Notes |
|---|---|---|---|
| `items` | yes | list of [HistoryItem](#schema-historyitem) |  |

**Example**

```json
{
  "items": [
    {
      "id": "00000000-0000-4000-8000-000000000031",
      "kind": "outing",
      "place": "Maulana Azad Library",
      "who": null,
      "started_at": "2026-09-29T20:00:00Z",
      "ended_at": "2026-09-29T21:00:00Z",
      "exit_recorded_by": "Fatima Khan",
      "return_recorded_by": "Sara Malik",
      "unused": false
    },
    {
      "id": "00000000-0000-4000-8000-000000000032",
      "kind": "outing",
      "place": "Women's College",
      "who": null,
      "started_at": "2026-09-29T04:00:00Z",
      "ended_at": "2026-09-29T08:00:00Z",
      "exit_recorded_by": null,
      "return_recorded_by": null,
      "unused": true
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
      "source": "preset",
      "status": "active"
    },
    {
      "id": "fc2da7c5-8d65-5680-8034-d8acb69745eb",
      "name": "Maulana Azad Library",
      "source": "preset",
      "status": "active"
    },
    {
      "id": "924e5c75-e9b6-57a9-bb04-720028253526",
      "name": "Shamshad Market",
      "source": "preset",
      "status": "active"
    },
    {
      "id": "df29c4b7-63c5-525d-a9ec-798a980c64c8",
      "name": "Women's College",
      "source": "preset",
      "status": "active"
    },
    {
      "id": "f2008ef3-a1df-5ff0-b936-3466d0914781",
      "name": "Other",
      "source": "custom",
      "status": "active"
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
when the phone needs a fresh list. Paginated with `limit` and `offset`
(default limit 50).

**Parameters**

| Name | In | Required | Type | Notes |
|---|---|---|---|---|
| `limit` | query | no | integer | 1–500. default `50`. |
| `offset` | query | no | integer | minimum 0. default `0`. |

**Responses**

#### 200

Planned and outside outings.

Body: [OutingList](#schema-outinglist).

| Field | Required | Type | Notes |
|---|---|---|---|
| `total` | yes | integer | minimum 0. |
| `limit` | yes | integer |  |
| `offset` | yes | integer |  |
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
scan does not ask for a destination or an expected return. She may hold
several future ordinary outings, including two on the same hall day.
She cannot start another while one ordinary outing is inside its show
window. Two planned or outside outings cannot end at the same instant.

Sets destination, start, and expected return. Does not record the exit.
The gate scan does that. No warden approval. Grace is the hall's
`grace_minutes` added to the expected return, and is returned on the
outing so the phone can show when the guardian would be told.

`starts_at` and `expected_return_at` must both be in the future, the
return after the start, on the same hall day, and inside ordinary hours
on that hall date. The start of ordinary hours is not included. The end
is included. Summer, 1 April through 30 September, is 6:30 AM to 6:30 PM.
Winter, 1 October through 31 March, is 6:30 AM to 5:30 PM. A time at or
before the start is outside ordinary hours. A time after the end needs
late-night permission or home going. When the chosen destination is the
Other row, `destination_text` is required. A planned outing whose
expected return has already passed is cancelled by the system, with no
staff member, before this plan is saved.

**Request.** Required.

Body: [PlanOutingRequest](#schema-planoutingrequest).

| Field | Required | Type | Notes |
|---|---|---|---|
| `destination_id` | yes | uuid |  |
| `destination_text` | no | string | Required when the destination is the Other row. Ignored otherwise. 1–120 characters. |
| `starts_at` | yes | date-time | When she plans to leave. UTC instant. Same hall day as the expected return, inside ordinary hours. |
| `expected_return_at` | yes | date-time |  |

**Example**

```json
{
  "destination_id": "fc2da7c5-8d65-5680-8034-d8acb69745eb",
  "starts_at": "2026-09-30T08:00:00Z",
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
| `outing_type` | yes | `ordinary` or `late_night` or `home_going` |  |
| `status` | yes | `planned` or `outside` or `returned` or `cancelled` |  |
| `place` | yes | string | List name, the words typed for Other, or the permission's short place. |
| `starts_at` | yes | date-time or null | When she planned to leave. Empty on a permission outing and on an ordinary outing saved before this field existed. |
| `qr_visible` | yes | boolean | True when the phone may show this outing's hall-pass QR now. Ordinary only. Opens 30 minutes before `starts_at` (immediately when the start is within 5 minutes) and lasts until the outing ends. |
| `qr_visible_from` | yes | date-time or null |  |
| `qr_visible_until` | yes | date-time or null | `expected_return_at` while the ordinary outing is still planned. Null while she is outside, until the return scan. |
| `expected_return_at` | yes | date-time | UTC instant. Clients show India time on a 12-hour clock. |
| `grace_ends_at` | yes | date-time |  |
| `exited_at` | no | date-time or null | Empty only while an ordinary outing is still planned. Required once the resident has left. |
| `exit_recorded_by_name` | no | string or null | Staff member who scanned the exit. Empty only while exited_at is empty. |
| `returned_at` | no | date-time or null | Empty until the return scan. Required once the resident has returned. |
| `return_recorded_by_name` | no | string or null | Staff member who scanned the return. Empty only while returned_at is empty. |
| `lateness` | yes | `on_time` or `late` | For a planned or outside outing, `late` when now is after `grace_ends_at`; otherwise `on_time`. Returned and cancelled outings keep the value at read time. |
| `created_at` | yes | date-time |  |

#### 401

The access token is missing or expired, or the username and password were refused.

Body: [ErrorResponse](#schema-errorresponse).

#### 403

The signed-in role cannot call this operation.

Body: [ErrorResponse](#schema-errorresponse).

#### 409

`outing_window_open` says she cannot start another outing while one
is inside its window. `return_already_planned` says she already has
an outing ending at that time. `outside_ordinary_hours` says that
start or return is outside ordinary hours. `permission_required`
says that start or return is outside ordinary hours. Please submit
a permission request.

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


### <a id="patch-api-v1-me-outings-outing_id"></a>PATCH `/api/v1/me/outings/{outing_id}` — Change a planned outing

`update_outing`

**Who.** resident. Bearer access token.

Caller: resident. She chooses which ordinary plan. The body is the
same as planning: destination, start, and expected return. Allowed
only while that outing is still `planned` and its hall-pass window
is not open. Once the window is open, or she is already outside on
it, this call is refused. Her other plans stay as they are. The same
hour and return rules as planning apply. Grace is recalculated from
the new expected return and the hall's current grace. A passed plan
is cancelled by the system first, with no staff member.

**Parameters**

| Name | In | Required | Type | Notes |
|---|---|---|---|---|
| `outing_id` | path | yes | uuid |  |

**Request.** Required.

Body: [PlanOutingRequest](#schema-planoutingrequest).

| Field | Required | Type | Notes |
|---|---|---|---|
| `destination_id` | yes | uuid |  |
| `destination_text` | no | string | Required when the destination is the Other row. Ignored otherwise. 1–120 characters. |
| `starts_at` | yes | date-time | When she plans to leave. UTC instant. Same hall day as the expected return, inside ordinary hours. |
| `expected_return_at` | yes | date-time |  |

**Example**

```json
{
  "destination_id": "df29c4b7-63c5-525d-a9ec-798a980c64c8",
  "starts_at": "2026-09-30T09:30:00Z",
  "expected_return_at": "2026-09-30T12:00:00Z"
}
```

**Responses**

#### 200

Outing changed. Her presence is unchanged.

Body: [Outing](#schema-outing).

| Field | Required | Type | Notes |
|---|---|---|---|
| `id` | yes | uuid |  |
| `permission_id` | no | uuid or null | Empty for an ordinary outing. Set when the exit used a permission. |
| `outing_type` | yes | `ordinary` or `late_night` or `home_going` |  |
| `status` | yes | `planned` or `outside` or `returned` or `cancelled` |  |
| `place` | yes | string | List name, the words typed for Other, or the permission's short place. |
| `starts_at` | yes | date-time or null | When she planned to leave. Empty on a permission outing and on an ordinary outing saved before this field existed. |
| `qr_visible` | yes | boolean | True when the phone may show this outing's hall-pass QR now. Ordinary only. Opens 30 minutes before `starts_at` (immediately when the start is within 5 minutes) and lasts until the outing ends. |
| `qr_visible_from` | yes | date-time or null |  |
| `qr_visible_until` | yes | date-time or null | `expected_return_at` while the ordinary outing is still planned. Null while she is outside, until the return scan. |
| `expected_return_at` | yes | date-time | UTC instant. Clients show India time on a 12-hour clock. |
| `grace_ends_at` | yes | date-time |  |
| `exited_at` | no | date-time or null | Empty only while an ordinary outing is still planned. Required once the resident has left. |
| `exit_recorded_by_name` | no | string or null | Staff member who scanned the exit. Empty only while exited_at is empty. |
| `returned_at` | no | date-time or null | Empty until the return scan. Required once the resident has returned. |
| `return_recorded_by_name` | no | string or null | Staff member who scanned the return. Empty only while returned_at is empty. |
| `lateness` | yes | `on_time` or `late` | For a planned or outside outing, `late` when now is after `grace_ends_at`; otherwise `on_time`. Returned and cancelled outings keep the value at read time. |
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

`outing_window_open` says she cannot change this outing while its
window is open, or that she cannot start another outing while one
is inside its window when the new start would open a second show
window. `already_outside` says she is already outside.
`no_outing_planned` says there is no planned outing.
`return_already_planned` says she already has an outing ending at
that time. `outside_ordinary_hours` and `permission_required` are
the same refusals as planning.

Body: [ErrorResponse](#schema-errorresponse).

#### 422

The JSON is the wrong shape, or a field fails a constraint that does not depend on existing rows.

Body: [ErrorResponse](#schema-errorresponse).


### <a id="post-api-v1-me-outings-outing_id-cancel"></a>POST `/api/v1/me/outings/{outing_id}/cancel` — Cancel a planned outing

`cancel_outing`

**Who.** resident. Bearer access token.

Caller: resident. She chooses which plan. Allowed only while that
outing is `planned` and its hall-pass window is not open. Once the
window is open, or she is already outside on it, this call is refused.
Other plans stay planned, including another return today. An exit that
has already been scanned is closed by a return scan, not by cancel. A
plan whose expected return has already passed is cancelled by the
system first, with no staff member.

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
| `outing_type` | yes | `ordinary` or `late_night` or `home_going` |  |
| `status` | yes | `planned` or `outside` or `returned` or `cancelled` |  |
| `place` | yes | string | List name, the words typed for Other, or the permission's short place. |
| `starts_at` | yes | date-time or null | When she planned to leave. Empty on a permission outing and on an ordinary outing saved before this field existed. |
| `qr_visible` | yes | boolean | True when the phone may show this outing's hall-pass QR now. Ordinary only. Opens 30 minutes before `starts_at` (immediately when the start is within 5 minutes) and lasts until the outing ends. |
| `qr_visible_from` | yes | date-time or null |  |
| `qr_visible_until` | yes | date-time or null | `expected_return_at` while the ordinary outing is still planned. Null while she is outside, until the return scan. |
| `expected_return_at` | yes | date-time | UTC instant. Clients show India time on a 12-hour clock. |
| `grace_ends_at` | yes | date-time |  |
| `exited_at` | no | date-time or null | Empty only while an ordinary outing is still planned. Required once the resident has left. |
| `exit_recorded_by_name` | no | string or null | Staff member who scanned the exit. Empty only while exited_at is empty. |
| `returned_at` | no | date-time or null | Empty until the return scan. Required once the resident has returned. |
| `return_recorded_by_name` | no | string or null | Staff member who scanned the return. Empty only while returned_at is empty. |
| `lateness` | yes | `on_time` or `late` | For a planned or outside outing, `late` when now is after `grace_ends_at`; otherwise `on_time`. Returned and cancelled outings keep the value at read time. |
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

`outing_window_open` says she cannot change this outing while its
window is open. `no_outing_planned` says there is no planned outing.
`already_outside` says she is already outside.

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
| PATCH | `/api/v1/me/permissions/{permission_id}` | [Change a pending permission](#patch-api-v1-me-permissions-permission_id) | resident |
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
`short_place`, `address`, and `reason`. On the resident phone, home going
is a leave date and a return date: the departure is the start of that
hall day (or the current time when the leave day is today) and the
expected return is the end of the return hall day. A late-night return
is the same hall day as the departure. The only later instant is
12:00 AM on the next hall day. Late-night requires `short_place`
and `reason`, and may include `destination_detail`. `short_place` is
typed on this form. It is not chosen from the ordinary destination list.

**Request.** Required.

One of: [LateNightCreate](#schema-latenightcreate), [HomeGoingCreate](#schema-homegoingcreate).

**LateNightCreate**

| Field | Required | Type | Notes |
|---|---|---|---|
| `permission_type` | yes | `late_night` |  |
| `short_place` | yes | string | Typed by the resident. Not chosen from the ordinary destination list. 1–120 characters. |
| `destination_detail` | no | string | 1–120 characters. |
| `reason` | yes | string | 1–500 characters. |
| `departure_at` | yes | date-time |  |
| `expected_return_at` | yes | date-time |  |

**HomeGoingCreate**

| Field | Required | Type | Notes |
|---|---|---|---|
| `permission_type` | yes | `home_going` |  |
| `short_place` | yes | string | Short place on the warden card, such as Lucknow. 1–120 characters. |
| `address` | yes | string | 1–300 characters. |
| `reason` | yes | string | 1–500 characters. |
| `departure_at` | yes | date-time |  |
| `expected_return_at` | yes | date-time |  |

**late_night**

```json
{
  "permission_type": "late_night",
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
  "permission_type": "home_going",
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
| `permission_type` | yes | `late_night` or `home_going` |  |
| `status` | yes | `pending` or `approved` or `rejected` or `cancelled` or `in_use` or `completed` or `expired` |  |
| `short_place` | yes | string |  |
| `destination_detail` | no | string or null |  |
| `address` | no | string or null |  |
| `reason` | yes | string |  |
| `departure_at` | yes | date-time |  |
| `expected_return_at` | yes | date-time |  |
| `decision_note` | no | string or null |  |
| `decided_at` | no | date-time or null |  |
| `decided_by` | no | string or null | Display name of the warden or provost who decided. Not a user id. Empty while waiting. |
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
| `permission_type` | yes | `late_night` or `home_going` |  |
| `status` | yes | `pending` or `approved` or `rejected` or `cancelled` or `in_use` or `completed` or `expired` |  |
| `short_place` | yes | string |  |
| `destination_detail` | no | string or null |  |
| `address` | no | string or null |  |
| `reason` | yes | string |  |
| `departure_at` | yes | date-time |  |
| `expected_return_at` | yes | date-time |  |
| `decision_note` | no | string or null |  |
| `decided_at` | no | date-time or null |  |
| `decided_by` | no | string or null | Display name of the warden or provost who decided. Not a user id. Empty while waiting. |
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


### <a id="patch-api-v1-me-permissions-permission_id"></a>PATCH `/api/v1/me/permissions/{permission_id}` — Change a pending permission

`update_own_permission`

**Who.** resident. Bearer access token.

Caller: resident. Allowed only while the permission is `pending`.
The kind cannot change. The same checks as a new request apply:
departure must not be in the past, the expected return must be
after the departure, and a late-night return stays on that hall day
(12:00 AM the next hall day is allowed). Home going still requires an
address. The permission stays pending.

**Parameters**

| Name | In | Required | Type | Notes |
|---|---|---|---|---|
| `permission_id` | path | yes | uuid |  |

**Request.** Required.

One of: [LateNightCreate](#schema-latenightcreate), [HomeGoingCreate](#schema-homegoingcreate).

**LateNightCreate**

| Field | Required | Type | Notes |
|---|---|---|---|
| `permission_type` | yes | `late_night` |  |
| `short_place` | yes | string | Typed by the resident. Not chosen from the ordinary destination list. 1–120 characters. |
| `destination_detail` | no | string | 1–120 characters. |
| `reason` | yes | string | 1–500 characters. |
| `departure_at` | yes | date-time |  |
| `expected_return_at` | yes | date-time |  |

**HomeGoingCreate**

| Field | Required | Type | Notes |
|---|---|---|---|
| `permission_type` | yes | `home_going` |  |
| `short_place` | yes | string | Short place on the warden card, such as Lucknow. 1–120 characters. |
| `address` | yes | string | 1–300 characters. |
| `reason` | yes | string | 1–500 characters. |
| `departure_at` | yes | date-time |  |
| `expected_return_at` | yes | date-time |  |

**Responses**

#### 200

Permission still pending, with the new details.

Body: [Permission](#schema-permission).

| Field | Required | Type | Notes |
|---|---|---|---|
| `id` | yes | uuid |  |
| `permission_type` | yes | `late_night` or `home_going` |  |
| `status` | yes | `pending` or `approved` or `rejected` or `cancelled` or `in_use` or `completed` or `expired` |  |
| `short_place` | yes | string |  |
| `destination_detail` | no | string or null |  |
| `address` | no | string or null |  |
| `reason` | yes | string |  |
| `departure_at` | yes | date-time |  |
| `expected_return_at` | yes | date-time |  |
| `decision_note` | no | string or null |  |
| `decided_at` | no | date-time or null |  |
| `decided_by` | no | string or null | Display name of the warden or provost who decided. Not a user id. Empty while waiting. |
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

`not_editable` when the permission is no longer pending.

Body: [ErrorResponse](#schema-errorresponse).

#### 422

The JSON is the wrong shape, or a field fails a constraint that does not depend on existing rows.

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
| `permission_type` | yes | `late_night` or `home_going` |  |
| `status` | yes | `pending` or `approved` or `rejected` or `cancelled` or `in_use` or `completed` or `expired` |  |
| `short_place` | yes | string |  |
| `destination_detail` | no | string or null |  |
| `address` | no | string or null |  |
| `reason` | yes | string |  |
| `departure_at` | yes | date-time |  |
| `expected_return_at` | yes | date-time |  |
| `decision_note` | no | string or null |  |
| `decided_at` | no | date-time or null |  |
| `decided_by` | no | string or null | Display name of the warden or provost who decided. Not a user id. Empty while waiting. |
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
| `permission_type` | query | no | `late_night` or `home_going` | Limit to late-night or home-going permissions. |
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
| `permission_type` | yes | `late_night` or `home_going` |  |
| `status` | yes | `pending` or `approved` or `rejected` or `cancelled` or `in_use` or `completed` or `expired` |  |
| `short_place` | yes | string |  |
| `destination_detail` | no | string or null |  |
| `address` | no | string or null |  |
| `reason` | yes | string |  |
| `departure_at` | yes | date-time |  |
| `expected_return_at` | yes | date-time |  |
| `decision_note` | no | string or null |  |
| `decided_at` | no | date-time or null |  |
| `decided_by` | no | string or null | Display name of the warden or provost who decided. Not a user id. Empty while waiting. |
| `created_at` | yes | date-time |  |
| `resident_id` | yes | uuid |  |
| `resident_name` | yes | string |  |
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
| `permission_type` | yes | `late_night` or `home_going` |  |
| `status` | yes | `pending` or `approved` or `rejected` or `cancelled` or `in_use` or `completed` or `expired` |  |
| `short_place` | yes | string |  |
| `destination_detail` | no | string or null |  |
| `address` | no | string or null |  |
| `reason` | yes | string |  |
| `departure_at` | yes | date-time |  |
| `expected_return_at` | yes | date-time |  |
| `decision_note` | no | string or null |  |
| `decided_at` | no | date-time or null |  |
| `decided_by` | no | string or null | Display name of the warden or provost who decided. Not a user id. Empty while waiting. |
| `created_at` | yes | date-time |  |
| `resident_id` | yes | uuid |  |
| `resident_name` | yes | string |  |
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

#### 409

Only a pending permission can be approved or rejected. The message
names the current status. Code `not_pending`.

Body: [ErrorResponse](#schema-errorresponse).


## <a id="tag-guest-stays"></a>Guest Stays

Guest applications. Resident applies and edits under /api/v1/me/guest-stays; warden or provost review under /api/v1/guest-stays. A resident may edit only while the stay is pending and before arrival; the stay stays pending. Gate arrival and departure stay under Gate.

| Method | Path | Purpose | Who |
|---|---|---|---|
| GET | `/api/v1/me/guest-stays` | [Own guest applications](#get-api-v1-me-guest-stays) | resident |
| POST | `/api/v1/me/guest-stays` | [Apply for a guest stay](#post-api-v1-me-guest-stays) | resident |
| GET | `/api/v1/me/guest-stays/{guest_stay_id}` | [Own guest stay](#get-api-v1-me-guest-stays-guest_stay_id) | resident, and only for a stay they host |
| PATCH | `/api/v1/me/guest-stays/{guest_stay_id}` | [Edit own guest stay](#patch-api-v1-me-guest-stays-guest_stay_id) | resident, and only for a stay they host |
| POST | `/api/v1/me/guest-stays/{guest_stay_id}/cancel` | [Cancel own guest application](#post-api-v1-me-guest-stays-guest_stay_id-cancel) | resident |
| GET | `/api/v1/guest-stays` | [Guest stays](#get-api-v1-guest-stays) | warden or provost |
| GET | `/api/v1/guest-stays/{guest_stay_id}` | [Guest stay for review](#get-api-v1-guest-stays-guest_stay_id) | warden or provost |
| POST | `/api/v1/guest-stays/{guest_stay_id}/decision` | [Approve or reject a guest stay](#post-api-v1-guest-stays-guest_stay_id-decision) | warden or provost |
| POST | `/api/v1/guest-stays/{guest_stay_id}/payment` | [Mark guest payment](#post-api-v1-guest-stays-guest_stay_id-payment) | warden or provost |
| POST | `/api/v1/guest-stays/{guest_stay_id}/payment/evidence` | [Upload guest payment evidence](#post-api-v1-guest-stays-guest_stay_id-payment-evidence) | warden or provost |
| GET | `/api/v1/guest-stays/{guest_stay_id}/payment/evidence` | [Download guest payment evidence](#get-api-v1-guest-stays-guest_stay_id-payment-evidence) | warden or provost |
| DELETE | `/api/v1/guest-stays/{guest_stay_id}/payment/evidence` | [Clear guest payment evidence](#delete-api-v1-guest-stays-guest_stay_id-payment-evidence) | warden or provost |

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
| `guest_start_date` | yes | date |  |
| `guest_end_date` | yes | date |  |
| `reason` | yes | string | 1–500 characters. |

**Example**

```json
{
  "guest_name": "Zara Ahmed",
  "relation": "Cousin",
  "guest_start_date": "2026-09-18",
  "guest_end_date": "2026-09-21",
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
| `guest_start_date` | yes | date |  |
| `guest_end_date` | yes | date |  |
| `inclusive_days` | yes | integer |  |
| `reason` | yes | string |  |
| `status` | yes | `pending` or `approved` or `rejected` or `cancelled` or `departed` |  |
| `payment_status` | yes | `unpaid` or `paid` |  |
| `payment_note` | no | string or null | Off-system payment proof (transaction reference, who collected cash, screenshot mention, and similar). Set when payment is marked paid; null when unpaid. |
| `bucket` | yes | `pending` or `upcoming` or `expected` or `not_expected` or `in_hall` or `should_have_left` or `departed` or `rejected` or `cancelled` |  |
| `decision_note` | no | string or null |  |
| `decided_by` | no | uuid or null | UUID of the warden or provost who decided. Empty while waiting, and empty if the resident cancels before a decision. Set once a warden or the provost approves or rejects. |
| `arrived_recorded_by` | no | uuid or null | UUID of the staff member who recorded arrival. Empty until arrival is recorded. |
| `departed_recorded_by` | no | uuid or null | UUID of the staff member who recorded departure. Empty until departure is recorded. |
| `arrived_at` | no | date-time or null |  |
| `departed_at` | no | date-time or null |  |
| `payment_evidence_original_name` | no | string or null | Original client filename when optional payment evidence was uploaded. Empty when no evidence is stored. Never a filesystem path. |
| `payment_evidence_content_type` | no | string or null | Stored content type when evidence exists (`image/jpeg`, `image/png`, or `application/pdf`). Empty when no evidence is stored. |
| `payment_evidence_uploaded_at` | no | date-time or null | UTC instant when evidence was last uploaded. Empty when none. |
| `payment_evidence_uploaded_by` | no | uuid or null | UUID of the warden or provost who uploaded the evidence. Empty when no evidence is stored. |
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
| `guest_start_date` | yes | date |  |
| `guest_end_date` | yes | date |  |
| `inclusive_days` | yes | integer |  |
| `reason` | yes | string |  |
| `status` | yes | `pending` or `approved` or `rejected` or `cancelled` or `departed` |  |
| `payment_status` | yes | `unpaid` or `paid` |  |
| `payment_note` | no | string or null | Off-system payment proof (transaction reference, who collected cash, screenshot mention, and similar). Set when payment is marked paid; null when unpaid. |
| `bucket` | yes | `pending` or `upcoming` or `expected` or `not_expected` or `in_hall` or `should_have_left` or `departed` or `rejected` or `cancelled` |  |
| `decision_note` | no | string or null |  |
| `decided_by` | no | uuid or null | UUID of the warden or provost who decided. Empty while waiting, and empty if the resident cancels before a decision. Set once a warden or the provost approves or rejects. |
| `arrived_recorded_by` | no | uuid or null | UUID of the staff member who recorded arrival. Empty until arrival is recorded. |
| `departed_recorded_by` | no | uuid or null | UUID of the staff member who recorded departure. Empty until departure is recorded. |
| `arrived_at` | no | date-time or null |  |
| `departed_at` | no | date-time or null |  |
| `payment_evidence_original_name` | no | string or null | Original client filename when optional payment evidence was uploaded. Empty when no evidence is stored. Never a filesystem path. |
| `payment_evidence_content_type` | no | string or null | Stored content type when evidence exists (`image/jpeg`, `image/png`, or `application/pdf`). Empty when no evidence is stored. |
| `payment_evidence_uploaded_at` | no | date-time or null | UTC instant when evidence was last uploaded. Empty when none. |
| `payment_evidence_uploaded_by` | no | uuid or null | UUID of the warden or provost who uploaded the evidence. Empty when no evidence is stored. |
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


### <a id="patch-api-v1-me-guest-stays-guest_stay_id"></a>PATCH `/api/v1/me/guest-stays/{guest_stay_id}` — Edit own guest stay

`edit_guest_stay`

**Who.** resident, and only for a stay they host. Bearer access token.

Caller: resident, and only for a stay they host.

Allowed only while the stay is `pending` and arrival has not been
recorded. Send all of `guest_name`, `relation`, `guest_start_date`,
`guest_end_date`, and `reason` (full replace of those fields). Status,
payment, arrival, and departure are not editable here.

An approved stay cannot be edited. A stay cannot be edited after
arrival, including when it is still `pending`. `departed`, `rejected`,
and `cancelled` cannot be edited. Each of those returns 409
`not_editable`.

A successful edit leaves the stay `pending` (it stays pending, and the
decision fields stay empty) and leaves `payment_status` unchanged.
Staff still have to approve it.

**Parameters**

| Name | In | Required | Type | Notes |
|---|---|---|---|---|
| `guest_stay_id` | path | yes | uuid |  |

**Request.** Required.

Body: [GuestStayUpdate](#schema-gueststayupdate).

| Field | Required | Type | Notes |
|---|---|---|---|
| `guest_name` | no | string | 1–120 characters. |
| `relation` | no | string | 1–80 characters. |
| `guest_start_date` | no | date |  |
| `guest_end_date` | no | date |  |
| `reason` | no | string | 1–500 characters. |

**Example**

```json
{
  "guest_name": "Zara Ahmed",
  "relation": "Cousin",
  "guest_start_date": "2026-10-02",
  "guest_end_date": "2026-10-06",
  "reason": "Family wedding in Aligarh. Staying with Aisha, B-204."
}
```

**Responses**

#### 200

Guest stay updated and still pending. Decision fields stay empty;
payment_status is unchanged.

Body: [GuestStay](#schema-gueststay).

| Field | Required | Type | Notes |
|---|---|---|---|
| `id` | yes | uuid |  |
| `host_resident_id` | yes | uuid |  |
| `host_name` | yes | string |  |
| `host_room_label` | yes | string |  |
| `guest_name` | yes | string |  |
| `relation` | yes | string |  |
| `guest_start_date` | yes | date |  |
| `guest_end_date` | yes | date |  |
| `inclusive_days` | yes | integer |  |
| `reason` | yes | string |  |
| `status` | yes | `pending` or `approved` or `rejected` or `cancelled` or `departed` |  |
| `payment_status` | yes | `unpaid` or `paid` |  |
| `payment_note` | no | string or null | Off-system payment proof (transaction reference, who collected cash, screenshot mention, and similar). Set when payment is marked paid; null when unpaid. |
| `bucket` | yes | `pending` or `upcoming` or `expected` or `not_expected` or `in_hall` or `should_have_left` or `departed` or `rejected` or `cancelled` |  |
| `decision_note` | no | string or null |  |
| `decided_by` | no | uuid or null | UUID of the warden or provost who decided. Empty while waiting, and empty if the resident cancels before a decision. Set once a warden or the provost approves or rejects. |
| `arrived_recorded_by` | no | uuid or null | UUID of the staff member who recorded arrival. Empty until arrival is recorded. |
| `departed_recorded_by` | no | uuid or null | UUID of the staff member who recorded departure. Empty until departure is recorded. |
| `arrived_at` | no | date-time or null |  |
| `departed_at` | no | date-time or null |  |
| `payment_evidence_original_name` | no | string or null | Original client filename when optional payment evidence was uploaded. Empty when no evidence is stored. Never a filesystem path. |
| `payment_evidence_content_type` | no | string or null | Stored content type when evidence exists (`image/jpeg`, `image/png`, or `application/pdf`). Empty when no evidence is stored. |
| `payment_evidence_uploaded_at` | no | date-time or null | UTC instant when evidence was last uploaded. Empty when none. |
| `payment_evidence_uploaded_by` | no | uuid or null | UUID of the warden or provost who uploaded the evidence. Empty when no evidence is stored. |
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

The stay cannot be edited. Code `not_editable` when it is not
pending (approved, rejected, cancelled, or departed) or when the
guest has already arrived.

Body: [ErrorResponse](#schema-errorresponse).

#### 422

The JSON is the wrong shape, or a field fails a constraint that does not depend on existing rows.

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
| `guest_start_date` | yes | date |  |
| `guest_end_date` | yes | date |  |
| `inclusive_days` | yes | integer |  |
| `reason` | yes | string |  |
| `status` | yes | `pending` or `approved` or `rejected` or `cancelled` or `departed` |  |
| `payment_status` | yes | `unpaid` or `paid` |  |
| `payment_note` | no | string or null | Off-system payment proof (transaction reference, who collected cash, screenshot mention, and similar). Set when payment is marked paid; null when unpaid. |
| `bucket` | yes | `pending` or `upcoming` or `expected` or `not_expected` or `in_hall` or `should_have_left` or `departed` or `rejected` or `cancelled` |  |
| `decision_note` | no | string or null |  |
| `decided_by` | no | uuid or null | UUID of the warden or provost who decided. Empty while waiting, and empty if the resident cancels before a decision. Set once a warden or the provost approves or rejects. |
| `arrived_recorded_by` | no | uuid or null | UUID of the staff member who recorded arrival. Empty until arrival is recorded. |
| `departed_recorded_by` | no | uuid or null | UUID of the staff member who recorded departure. Empty until departure is recorded. |
| `arrived_at` | no | date-time or null |  |
| `departed_at` | no | date-time or null |  |
| `payment_evidence_original_name` | no | string or null | Original client filename when optional payment evidence was uploaded. Empty when no evidence is stored. Never a filesystem path. |
| `payment_evidence_content_type` | no | string or null | Stored content type when evidence exists (`image/jpeg`, `image/png`, or `application/pdf`). Empty when no evidence is stored. |
| `payment_evidence_uploaded_at` | no | date-time or null | UTC instant when evidence was last uploaded. Empty when none. |
| `payment_evidence_uploaded_by` | no | uuid or null | UUID of the warden or provost who uploaded the evidence. Empty when no evidence is stored. |
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
`should_have_left` for that subset. By default the list omits terminal
buckets `cancelled` and `rejected` so the warden queue stays clean.
Pass `include_terminal=true` to include those rows. An explicit
`bucket=cancelled` or `bucket=rejected` still returns that subset
without needing `include_terminal`. Each item is a GuestStaySummary
card; open GET by id for the full GuestStay.

**Parameters**

| Name | In | Required | Type | Notes |
|---|---|---|---|---|
| `bucket` | query | no | `pending` or `upcoming` or `expected` or `not_expected` or `in_hall` or `should_have_left` or `departed` or `rejected` or `cancelled` |  |
| `include_terminal` | query | no | boolean | When false (default), omit buckets `cancelled` and `rejected` unless `bucket` is set to one of those values. When true, include terminal rows (still subject to `bucket` when set). default `False`. |
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
| `guest_start_date` | yes | date |  |
| `guest_end_date` | yes | date |  |
| `inclusive_days` | yes | integer |  |
| `reason` | yes | string |  |
| `status` | yes | `pending` or `approved` or `rejected` or `cancelled` or `departed` |  |
| `payment_status` | yes | `unpaid` or `paid` |  |
| `payment_note` | no | string or null | Off-system payment proof (transaction reference, who collected cash, screenshot mention, and similar). Set when payment is marked paid; null when unpaid. |
| `bucket` | yes | `pending` or `upcoming` or `expected` or `not_expected` or `in_hall` or `should_have_left` or `departed` or `rejected` or `cancelled` |  |
| `decision_note` | no | string or null |  |
| `decided_by` | no | uuid or null | UUID of the warden or provost who decided. Empty while waiting, and empty if the resident cancels before a decision. Set once a warden or the provost approves or rejects. |
| `arrived_recorded_by` | no | uuid or null | UUID of the staff member who recorded arrival. Empty until arrival is recorded. |
| `departed_recorded_by` | no | uuid or null | UUID of the staff member who recorded departure. Empty until departure is recorded. |
| `arrived_at` | no | date-time or null |  |
| `departed_at` | no | date-time or null |  |
| `payment_evidence_original_name` | no | string or null | Original client filename when optional payment evidence was uploaded. Empty when no evidence is stored. Never a filesystem path. |
| `payment_evidence_content_type` | no | string or null | Stored content type when evidence exists (`image/jpeg`, `image/png`, or `application/pdf`). Empty when no evidence is stored. |
| `payment_evidence_uploaded_at` | no | date-time or null | UTC instant when evidence was last uploaded. Empty when none. |
| `payment_evidence_uploaded_by` | no | uuid or null | UUID of the warden or provost who uploaded the evidence. Empty when no evidence is stored. |
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

Caller: warden or provost. Only while `pending`. A resident cannot edit
an approved stay, and cannot edit after arrival, so those stays are not
sent back for another decision. When the guest has already arrived, only
`approved` is allowed — reject is refused (the guest is in the hall).
Approval does not mark payment and does not clear or set arrival.

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
| `guest_start_date` | yes | date |  |
| `guest_end_date` | yes | date |  |
| `inclusive_days` | yes | integer |  |
| `reason` | yes | string |  |
| `status` | yes | `pending` or `approved` or `rejected` or `cancelled` or `departed` |  |
| `payment_status` | yes | `unpaid` or `paid` |  |
| `payment_note` | no | string or null | Off-system payment proof (transaction reference, who collected cash, screenshot mention, and similar). Set when payment is marked paid; null when unpaid. |
| `bucket` | yes | `pending` or `upcoming` or `expected` or `not_expected` or `in_hall` or `should_have_left` or `departed` or `rejected` or `cancelled` |  |
| `decision_note` | no | string or null |  |
| `decided_by` | no | uuid or null | UUID of the warden or provost who decided. Empty while waiting, and empty if the resident cancels before a decision. Set once a warden or the provost approves or rejects. |
| `arrived_recorded_by` | no | uuid or null | UUID of the staff member who recorded arrival. Empty until arrival is recorded. |
| `departed_recorded_by` | no | uuid or null | UUID of the staff member who recorded departure. Empty until departure is recorded. |
| `arrived_at` | no | date-time or null |  |
| `departed_at` | no | date-time or null |  |
| `payment_evidence_original_name` | no | string or null | Original client filename when optional payment evidence was uploaded. Empty when no evidence is stored. Never a filesystem path. |
| `payment_evidence_content_type` | no | string or null | Stored content type when evidence exists (`image/jpeg`, `image/png`, or `application/pdf`). Empty when no evidence is stored. |
| `payment_evidence_uploaded_at` | no | date-time or null | UTC instant when evidence was last uploaded. Empty when none. |
| `payment_evidence_uploaded_by` | no | uuid or null | UUID of the warden or provost who uploaded the evidence. Empty when no evidence is stored. |
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
taken payment outside the system. Allowed before arrival, whether the
stay is pending or approved. The app does not collect money. When
marking paid, `payment_note` is required (off-system proof such as a
transaction reference, who collected cash, or a screenshot mention).
When marking unpaid, `payment_note` is optional and any stored note is
cleared together with the payment staff member, the payment time, and
any optional payment evidence. A file is never required to mark paid.

**Parameters**

| Name | In | Required | Type | Notes |
|---|---|---|---|---|
| `guest_stay_id` | path | yes | uuid |  |

**Request.** Required.

Body: [PaymentRequest](#schema-paymentrequest).

| Field | Required | Type | Notes |
|---|---|---|---|
| `payment_status` | yes | `paid` or `unpaid` |  |
| `payment_note` | no | string | Off-system payment proof for the hall office (transaction reference, who collected cash, screenshot mention, and similar). Required when marking paid. Optional when marking unpaid; cleared on unpaid. at most 500 characters. |

**Example**

```json
{
  "payment_status": "paid",
  "payment_note": "UPI ref TXN123456; collected at desk"
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
| `guest_start_date` | yes | date |  |
| `guest_end_date` | yes | date |  |
| `inclusive_days` | yes | integer |  |
| `reason` | yes | string |  |
| `status` | yes | `pending` or `approved` or `rejected` or `cancelled` or `departed` |  |
| `payment_status` | yes | `unpaid` or `paid` |  |
| `payment_note` | no | string or null | Off-system payment proof (transaction reference, who collected cash, screenshot mention, and similar). Set when payment is marked paid; null when unpaid. |
| `bucket` | yes | `pending` or `upcoming` or `expected` or `not_expected` or `in_hall` or `should_have_left` or `departed` or `rejected` or `cancelled` |  |
| `decision_note` | no | string or null |  |
| `decided_by` | no | uuid or null | UUID of the warden or provost who decided. Empty while waiting, and empty if the resident cancels before a decision. Set once a warden or the provost approves or rejects. |
| `arrived_recorded_by` | no | uuid or null | UUID of the staff member who recorded arrival. Empty until arrival is recorded. |
| `departed_recorded_by` | no | uuid or null | UUID of the staff member who recorded departure. Empty until departure is recorded. |
| `arrived_at` | no | date-time or null |  |
| `departed_at` | no | date-time or null |  |
| `payment_evidence_original_name` | no | string or null | Original client filename when optional payment evidence was uploaded. Empty when no evidence is stored. Never a filesystem path. |
| `payment_evidence_content_type` | no | string or null | Stored content type when evidence exists (`image/jpeg`, `image/png`, or `application/pdf`). Empty when no evidence is stored. |
| `payment_evidence_uploaded_at` | no | date-time or null | UTC instant when evidence was last uploaded. Empty when none. |
| `payment_evidence_uploaded_by` | no | uuid or null | UUID of the warden or provost who uploaded the evidence. Empty when no evidence is stored. |
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


### <a id="post-api-v1-guest-stays-guest_stay_id-payment-evidence"></a>POST `/api/v1/guest-stays/{guest_stay_id}/payment/evidence` — Upload guest payment evidence

`upload_guest_payment_evidence`

**Who.** warden or provost. Bearer access token.

Caller: warden or provost. Optional file proof that payment was taken
off-system (receipt photo or PDF). Uploading is never required to mark
a stay paid. Allowed while payment is still mutable (pending or approved,
before arrival), whether the stay is unpaid or already paid. Replaces any
previous evidence file. Multipart field name is `evidence`. Allowed types:
`image/jpeg`, `image/png`, `application/pdf`. Maximum size 5 MiB. Stored
name is UUID-based under the hall payment-evidence directory; clients
never receive filesystem absolute paths.

**Parameters**

| Name | In | Required | Type | Notes |
|---|---|---|---|---|
| `guest_stay_id` | path | yes | uuid |  |

**Request.** Required.

Body: object.

| Field | Required | Type | Notes |
|---|---|---|---|
| `evidence` | yes | binary | Receipt image (JPEG/PNG) or PDF, at most 5 MiB. |

**Responses**

#### 200

Evidence stored. Full GuestStay with evidence metadata (no binary).

Body: [GuestStay](#schema-gueststay).

| Field | Required | Type | Notes |
|---|---|---|---|
| `id` | yes | uuid |  |
| `host_resident_id` | yes | uuid |  |
| `host_name` | yes | string |  |
| `host_room_label` | yes | string |  |
| `guest_name` | yes | string |  |
| `relation` | yes | string |  |
| `guest_start_date` | yes | date |  |
| `guest_end_date` | yes | date |  |
| `inclusive_days` | yes | integer |  |
| `reason` | yes | string |  |
| `status` | yes | `pending` or `approved` or `rejected` or `cancelled` or `departed` |  |
| `payment_status` | yes | `unpaid` or `paid` |  |
| `payment_note` | no | string or null | Off-system payment proof (transaction reference, who collected cash, screenshot mention, and similar). Set when payment is marked paid; null when unpaid. |
| `bucket` | yes | `pending` or `upcoming` or `expected` or `not_expected` or `in_hall` or `should_have_left` or `departed` or `rejected` or `cancelled` |  |
| `decision_note` | no | string or null |  |
| `decided_by` | no | uuid or null | UUID of the warden or provost who decided. Empty while waiting, and empty if the resident cancels before a decision. Set once a warden or the provost approves or rejects. |
| `arrived_recorded_by` | no | uuid or null | UUID of the staff member who recorded arrival. Empty until arrival is recorded. |
| `departed_recorded_by` | no | uuid or null | UUID of the staff member who recorded departure. Empty until departure is recorded. |
| `arrived_at` | no | date-time or null |  |
| `departed_at` | no | date-time or null |  |
| `payment_evidence_original_name` | no | string or null | Original client filename when optional payment evidence was uploaded. Empty when no evidence is stored. Never a filesystem path. |
| `payment_evidence_content_type` | no | string or null | Stored content type when evidence exists (`image/jpeg`, `image/png`, or `application/pdf`). Empty when no evidence is stored. |
| `payment_evidence_uploaded_at` | no | date-time or null | UTC instant when evidence was last uploaded. Empty when none. |
| `payment_evidence_uploaded_by` | no | uuid or null | UUID of the warden or provost who uploaded the evidence. Empty when no evidence is stored. |
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

#### 422

Missing file, disallowed type/extension, or over size limit. Code `validation_error`.

Body: [ErrorResponse](#schema-errorresponse).


### <a id="get-api-v1-guest-stays-guest_stay_id-payment-evidence"></a>GET `/api/v1/guest-stays/{guest_stay_id}/payment/evidence` — Download guest payment evidence

`download_guest_payment_evidence`

**Who.** warden or provost. Bearer access token.

Caller: warden or provost. Returns the stored evidence file when one
exists. Auth required; absolute paths are never exposed.

**Parameters**

| Name | In | Required | Type | Notes |
|---|---|---|---|---|
| `guest_stay_id` | path | yes | uuid |  |

**Responses**

#### 200

The evidence file bytes.

Body: binary.

No fields.

#### 401

The access token is missing or expired, or the username and password were refused.

Body: [ErrorResponse](#schema-errorresponse).

#### 403

The signed-in role cannot call this operation.

Body: [ErrorResponse](#schema-errorresponse).

#### 404

Stay not found, or no evidence on this stay. Code `not_found`.

Body: [ErrorResponse](#schema-errorresponse).


### <a id="delete-api-v1-guest-stays-guest_stay_id-payment-evidence"></a>DELETE `/api/v1/guest-stays/{guest_stay_id}/payment/evidence` — Clear guest payment evidence

`clear_guest_payment_evidence`

**Who.** warden or provost. Bearer access token.

Caller: warden or provost. Removes stored evidence without changing
payment_status. Allowed while payment is still mutable. Marking unpaid
also clears evidence.

**Parameters**

| Name | In | Required | Type | Notes |
|---|---|---|---|---|
| `guest_stay_id` | path | yes | uuid |  |

**Responses**

#### 200

Evidence cleared. Full GuestStay.

Body: [GuestStay](#schema-gueststay).

| Field | Required | Type | Notes |
|---|---|---|---|
| `id` | yes | uuid |  |
| `host_resident_id` | yes | uuid |  |
| `host_name` | yes | string |  |
| `host_room_label` | yes | string |  |
| `guest_name` | yes | string |  |
| `relation` | yes | string |  |
| `guest_start_date` | yes | date |  |
| `guest_end_date` | yes | date |  |
| `inclusive_days` | yes | integer |  |
| `reason` | yes | string |  |
| `status` | yes | `pending` or `approved` or `rejected` or `cancelled` or `departed` |  |
| `payment_status` | yes | `unpaid` or `paid` |  |
| `payment_note` | no | string or null | Off-system payment proof (transaction reference, who collected cash, screenshot mention, and similar). Set when payment is marked paid; null when unpaid. |
| `bucket` | yes | `pending` or `upcoming` or `expected` or `not_expected` or `in_hall` or `should_have_left` or `departed` or `rejected` or `cancelled` |  |
| `decision_note` | no | string or null |  |
| `decided_by` | no | uuid or null | UUID of the warden or provost who decided. Empty while waiting, and empty if the resident cancels before a decision. Set once a warden or the provost approves or rejects. |
| `arrived_recorded_by` | no | uuid or null | UUID of the staff member who recorded arrival. Empty until arrival is recorded. |
| `departed_recorded_by` | no | uuid or null | UUID of the staff member who recorded departure. Empty until departure is recorded. |
| `arrived_at` | no | date-time or null |  |
| `departed_at` | no | date-time or null |  |
| `payment_evidence_original_name` | no | string or null | Original client filename when optional payment evidence was uploaded. Empty when no evidence is stored. Never a filesystem path. |
| `payment_evidence_content_type` | no | string or null | Stored content type when evidence exists (`image/jpeg`, `image/png`, or `application/pdf`). Empty when no evidence is stored. |
| `payment_evidence_uploaded_at` | no | date-time or null | UTC instant when evidence was last uploaded. Empty when none. |
| `payment_evidence_uploaded_by` | no | uuid or null | UUID of the warden or provost who uploaded the evidence. Empty when no evidence is stored. |
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
| GET | `/api/v1/gate/occupancy` | [Guest dining occupancy at the gate](#get-api-v1-gate-occupancy) | gate, warden, or provost |
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

The 200 body is a discriminated union on `outcome`. Shared envelope
fields are only `outcome`, `full_name`, `room_label`, and `message`.
`recorded_at` is not on the envelope: it sits inside the nested variant.
On `exit_recorded` the nest is `outing` (outing movement fields, including
`lateness` `on_time` or `late`, plus `recorded_at`). Exit has no
`return_timeliness`. On `return_recorded` the nest is `return_record`
(`recorded_at`, `return_timeliness`, `returned_at`, `return_recorded_by_name`).
`return_timeliness` is `on_time` (at or before expected return),
`within_grace` (after expected return, at or before grace), or `late`
(after grace). No booleans on the scan response. Exit has no
`return_record`; return has no `outing`. The JSON key is
`return_record` (not `return`) so OpenAPI and Python clients avoid the
reserved word.

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

One of: [ScanExitResult](#schema-scanexitresult), [ScanReturnResult](#schema-scanreturnresult).

**ScanExitResult**

| Field | Required | Type | Notes |
|---|---|---|---|
| `outcome` | yes | `exit_recorded` |  |
| `full_name` | yes | string |  |
| `room_label` | yes | string |  |
| `message` | yes | string |  |
| `outing` | yes | [ScanExitOuting](#schema-scanexitouting) |  |

**ScanReturnResult**

| Field | Required | Type | Notes |
|---|---|---|---|
| `outcome` | yes | `return_recorded` |  |
| `full_name` | yes | string |  |
| `room_label` | yes | string |  |
| `message` | yes | string |  |
| `return_record` | yes | [ScanReturnRecord](#schema-scanreturnrecord) | Nested return payload. Named `return_record` (not `return`) so OpenAPI and Python clients avoid the reserved word. |

**exit**

```json
{
  "outcome": "exit_recorded",
  "full_name": "Aisha Khan",
  "room_label": "B-204",
  "message": "The resident is now outside.",
  "outing": {
    "id": "e7700000-0000-4000-8000-000000000011",
    "permission_id": null,
    "outing_type": "ordinary",
    "status": "outside",
    "place": "Library",
    "expected_return_at": "2026-09-13T13:00:00Z",
    "grace_ends_at": "2026-09-13T13:15:00Z",
    "exited_at": "2026-09-13T12:42:00Z",
    "exit_recorded_by_name": "Fatima Khan",
    "returned_at": null,
    "return_recorded_by_name": null,
    "created_at": "2026-09-13T12:30:00Z",
    "recorded_at": "2026-09-13T12:42:00Z"
  }
}
```

**return**

```json
{
  "outcome": "return_recorded",
  "full_name": "Aisha Khan",
  "room_label": "B-204",
  "message": "On time. Status is now inside.",
  "return_record": {
    "recorded_at": "2026-09-13T13:24:00Z",
    "return_timeliness": "on_time",
    "returned_at": "2026-09-13T13:24:00Z",
    "return_recorded_by_name": "Fatima Khan"
  }
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

**Resident exit**

```json
{
  "total": 3,
  "limit": 50,
  "offset": 0,
  "items": [
    {
      "event": "exit",
      "occurred_at": "2026-09-13T14:39:00Z",
      "resident_name": "Zoya Siddiqui",
      "room_label": "A-118",
      "guest_name": null,
      "host_name": null,
      "host_room_label": null
    }
  ]
}
```

**Guest arrival**

```json
{
  "total": 3,
  "limit": 50,
  "offset": 0,
  "items": [
    {
      "event": "guest_arrival",
      "occurred_at": "2026-09-18T10:11:00Z",
      "resident_name": null,
      "room_label": null,
      "guest_name": "Fatima Begum",
      "host_name": "Aisha Khan",
      "host_room_label": "B-204"
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


### <a id="get-api-v1-gate-occupancy"></a>GET `/api/v1/gate/occupancy` — Guest dining occupancy at the gate

`gate_occupancy`

**Who.** gate, warden, or provost. Bearer access token.

Caller: gate, warden, or provost. Hall-wide guest dining counts for the
gate home strip. `guests_in_hall_count` is every stay that has arrived
and has not departed (includes should-have-left).
`guests_should_have_left_count` is the subset whose hall date is after
`guest_end_date`. This is not the full register presence board; use
`GET /api/v1/register/summary` for resident inside/outside/late counts.

**Responses**

#### 200

Dining occupancy counts.

Body: [GateOccupancy](#schema-gateoccupancy).

| Field | Required | Type | Notes |
|---|---|---|---|
| `guests_in_hall_count` | yes | integer | Dining count: arrived_at IS NOT NULL AND departed_at IS NULL (includes should-have-left). minimum 0. |
| `guests_should_have_left_count` | yes | integer | Subset of dining where the hall date is after guest_end_date. minimum 0. |

**Example**

```json
{
  "guests_in_hall_count": 2,
  "guests_should_have_left_count": 1
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

Caller: gate, warden, or provost. Buckets are timing-based. `expected` is
approved, not yet arrived, and the hall date is inside the stay.
`in_hall` includes guests who should already have left, because departure
is still recorded here. Optional `payment_status` is a separate axis
(`paid` or `unpaid`); omit it to return every guest that matches the
bucket.

**Parameters**

| Name | In | Required | Type | Notes |
|---|---|---|---|---|
| `bucket` | query | yes | `expected` or `in_hall` |  |
| `payment_status` | query | no | `paid` or `unpaid` | When set, keep only guests with that payment status. Omit to include both paid and unpaid for the chosen bucket. |

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
not scanned. Empty POST body; no client-supplied time.
`arrival_time` equals `recorded_at` (same server clock tick).

**Parameters**

| Name | In | Required | Type | Notes |
|---|---|---|---|---|
| `guest_stay_id` | path | yes | uuid |  |

**Responses**

#### 200

Arrival recorded.
`arrival_time` equals `recorded_at` (same server clock tick; no client-supplied time).

Body: [GuestArrivalResult](#schema-guestarrivalresult).

| Field | Required | Type | Notes |
|---|---|---|---|
| `guest_name` | yes | string |  |
| `host_name` | yes | string |  |
| `host_room_label` | yes | string |  |
| `recorded_at` | yes | date-time | When the API wrote the arrival record and audit entry. |
| `recorded_by` | yes | string | Full display name of the staff member who recorded the arrival. |
| `arrival_time` | yes | date-time | When the guest entered the hall (stored `arrived_at`). Must equal `recorded_at` (same clock tick; no independent second timestamp). |
| `message` | yes | string |  |

**Example**

```json
{
  "guest_name": "Zara Ahmed",
  "host_name": "Aisha Khan",
  "host_room_label": "B-204",
  "recorded_at": "2026-09-18T10:11:00Z",
  "recorded_by": "Fatima Khan",
  "arrival_time": "2026-09-18T10:11:00Z",
  "message": "The guest is now in the hall."
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
Closes the stay. Departure is still recorded when the end date has
already passed. Empty POST body; no client-supplied time.
`departure_time` equals `recorded_at` (same server clock tick).

**Parameters**

| Name | In | Required | Type | Notes |
|---|---|---|---|---|
| `guest_stay_id` | path | yes | uuid |  |

**Responses**

#### 200

Departure recorded.
`departure_time` equals `recorded_at` (same server clock tick; no client-supplied time).

Body: [GuestDepartureResult](#schema-guestdepartureresult).

| Field | Required | Type | Notes |
|---|---|---|---|
| `guest_name` | yes | string |  |
| `host_name` | yes | string |  |
| `host_room_label` | yes | string |  |
| `recorded_at` | yes | date-time | When the API wrote the departure record and audit entry. |
| `recorded_by` | yes | string | Full display name of the staff member who recorded the departure. |
| `departure_time` | yes | date-time | When the guest left the hall (stored `departed_at`). Must equal `recorded_at` (same clock tick; no independent second timestamp). |
| `message` | yes | string |  |

**Example**

```json
{
  "guest_name": "Zara Ahmed",
  "host_name": "Aisha Khan",
  "host_room_label": "B-204",
  "recorded_at": "2026-09-18T10:11:00Z",
  "recorded_by": "Fatima Khan",
  "departure_time": "2026-09-18T10:11:00Z",
  "message": "The guest has left the hall."
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
| GET | `/api/v1/admin/notifications` | [Hall notification settings](#get-api-v1-admin-notifications) | provost only (same gate as hall settings) |
| PATCH | `/api/v1/admin/notifications` | [Update hall notification settings](#patch-api-v1-admin-notifications) | provost only (same gate as hall settings) |
| GET | `/api/v1/admin/register/export` | [Export the register](#get-api-v1-admin-register-export) | provost |
| GET | `/api/v1/admin/sms` | [SMS log](#get-api-v1-admin-sms) | provost |
| GET | `/api/v1/admin/audit` | [Audit log](#get-api-v1-admin-audit) | provost |

### <a id="get-api-v1-admin-residents"></a>GET `/api/v1/admin/residents` — List resident accounts

`admin_list_residents`

**Who.** provost. Bearer access token.

Caller: provost. Includes active and suspended residents. Does not include hall-pass tokens.

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

Caller: provost. Username is the enrolment number. Required fields include
the resident's own phone in E.164 form, as well as the room, guardian
details, and temporary password. The response includes the hall pass
payload once, so the office can place it on the resident's phone. Later
reads of the account do not return the token.

**Request.** Required.

Body: [ResidentCreate](#schema-residentcreate).

| Field | Required | Type | Notes |
|---|---|---|---|
| `full_name` | yes | string | 1–120 characters. |
| `enrolment_number` | yes | string | 1–40 characters. |
| `course` | no | string | at most 120 characters. |
| `room_id` | yes | uuid |  |
| `phone` | yes | string | The resident's own phone in E.164 with country code. Required on office create. Not the guardian phone. pattern `^\+[1-9][0-9]{7,14}$`. |
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
| `phone` | no | string or null | The resident's own phone in E.164 with country code. Empty when the hall has not entered it. Optional; not the guardian phone. |
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

Caller: provost. Send only the fields that change. `course` and `phone`
may be set to null to clear them. `guardian_name` and `guardian_phone`
may be replaced and may not be cleared. A phone includes the country
code. Changing `enrolment_number` changes the username. `status`
suspends or reinstates. Suspension revokes refresh tokens.

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
| `phone` | no | string or null | The resident's own phone. Set to null to clear. Same E.164 pattern as guardian_phone when present. |
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
| `phone` | no | string or null | The resident's own phone in E.164 with country code. Empty when the hall has not entered it. Optional; not the guardian phone. |
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
refresh tokens. Works for residents and staff. The temporary password
is at least 10 characters and includes an uppercase letter, a lowercase
letter, a number, and a symbol.

**Parameters**

| Name | In | Required | Type | Notes |
|---|---|---|---|---|
| `user_id` | path | yes | uuid |  |

**Request.** Required.

Body: [PasswordResetRequest](#schema-passwordresetrequest).

| Field | Required | Type | Notes |
|---|---|---|---|
| `temporary_password` | yes | string | At least 10 characters, with one uppercase letter, one lowercase letter, one number, and one symbol (a character that is not a letter or number). Shorter than 10 says "Use at least 10 characters." Missing a class says "Include an uppercase letter, a lowercase letter, a number, and a symbol.". 10–200 characters. pattern `^(?=.*[A-Z])(?=.*[a-z])(?=.*[0-9])(?=.*[^A-Za-z0-9]).+$`. |

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
| `status` | yes | `active` or `inactive` | `active` while the hall uses this block. `inactive` when retired. |

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

Caller: provost. Deactivate with `status` `inactive`. Rooms in the block remain.

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
| `status` | no | `active` or `inactive` |  |

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
| `status` | yes | `active` or `inactive` | `active` while the hall uses this block. `inactive` when retired. |

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
| `status` | yes | `active` or `inactive` | `active` while the room can be assigned. `inactive` when retired. |

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
| `status` | no | `active` or `inactive` |  |

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
| `status` | yes | `active` or `inactive` | `active` while the room can be assigned. `inactive` when retired. |

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

Caller: provost. Only one active destination may have `source` `custom`.

**Request.** Required.

Body: [DestinationCreate](#schema-destinationcreate).

| Field | Required | Type | Notes |
|---|---|---|---|
| `name` | yes | string | 1–80 characters. |
| `source` | no | `preset` or `custom` | `preset` for a fixed named place. `custom` for the free-text Other choice. default `preset`. |

**Responses**

#### 201

Destination created.

Body: [Destination](#schema-destination).

| Field | Required | Type | Notes |
|---|---|---|---|
| `id` | yes | uuid |  |
| `name` | yes | string | Named places are shown alphabetical by this name, ignoring capitals. The free-text choice is last. |
| `source` | yes | `preset` or `custom` | Where the place comes from. `preset` is a fixed named place on the list. `custom` is the single free-text (Other) choice. |
| `status` | yes | `active` or `inactive` | `active` while it can be chosen. `inactive` when retired. |

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
| `source` | no | `preset` or `custom` | `preset` for a fixed named place. `custom` for the free-text Other choice. |
| `status` | no | `active` or `inactive` |  |

**Responses**

#### 200

Destination updated.

Body: [Destination](#schema-destination).

| Field | Required | Type | Notes |
|---|---|---|---|
| `id` | yes | uuid |  |
| `name` | yes | string | Named places are shown alphabetical by this name, ignoring capitals. The free-text choice is last. |
| `source` | yes | `preset` or `custom` | Where the place comes from. `preset` is a fixed named place on the list. `custom` is the single free-text (Other) choice. |
| `status` | yes | `active` or `inactive` | `active` while it can be chosen. `inactive` when retired. |

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

Caller: provost. Ordinary outing windows are hall-local HH:MM. Season starts are MM-DD. Clients show both on a 12-hour clock and as a day and month. SMS templates are under /api/v1/admin/notifications.

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
| `summer_outing_start` | yes | string | Ordinary outing window start (summer). Kept as HH:MM. Shown as 6:30 AM. Starts as 06:30. pattern `^([01][0-9]|2[0-3]):[0-5][0-9]$`. |
| `summer_outing_end` | yes | string | Ordinary outing window end (summer). Kept as HH:MM. Shown as 6:30 PM. Starts as 18:30. pattern `^([01][0-9]|2[0-3]):[0-5][0-9]$`. |
| `winter_outing_start` | yes | string | Ordinary outing window start (winter). Kept as HH:MM. Shown as 6:30 AM. Starts as 06:30. pattern `^([01][0-9]|2[0-3]):[0-5][0-9]$`. |
| `winter_outing_end` | yes | string | Ordinary outing window end (winter). Kept as HH:MM. Shown as 5:30 PM. Starts as 17:30. pattern `^([01][0-9]|2[0-3]):[0-5][0-9]$`. |
| `summer_season_start` | yes | string | Month and day the summer ordinary outing window begins. Shown as 01 April. Starts as 04-01. pattern `^(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$`. |
| `winter_season_start` | yes | string | Month and day the winter ordinary outing window begins. Shown as 01 October. Starts as 10-01. pattern `^(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$`. |
| `permission_lead_minutes` | yes | integer | Minutes before a permission start when a resident may leave. Aligns with guest_min_lead_days naming. |
| `guest_max_inclusive_days` | yes | integer |  |
| `guest_min_lead_days` | yes | integer |  |
| `scan_duplicate_window_seconds` | yes | integer |  |

#### 401

The access token is missing or expired, or the username and password were refused.

Body: [ErrorResponse](#schema-errorresponse).

#### 403

The signed-in role cannot call this operation.

Body: [ErrorResponse](#schema-errorresponse).


### <a id="patch-api-v1-admin-settings"></a>PATCH `/api/v1/admin/settings` — Update hall settings

`update_settings`

**Who.** provost. Bearer access token.

Caller: provost. Send only the fields that change. Summer and winter
ordinary outing windows, and the two season start dates, are always set.
Changing grace does not rewrite outings that already have a
`grace_ends_at`. SMS templates live under `/api/v1/admin/notifications`.
A time of day is sent as HH:MM. A season start is sent as MM-DD.

**Request.** Required.

Body: [HallSettingsUpdate](#schema-hallsettingsupdate).

| Field | Required | Type | Notes |
|---|---|---|---|
| `hall_name` | no | string | 1–160 characters. |
| `university_name` | no | string | 1–160 characters. |
| `grace_minutes` | no | integer | 0–180. |
| `summer_outing_start` | no | string | pattern `^([01][0-9]|2[0-3]):[0-5][0-9]$`. |
| `summer_outing_end` | no | string | pattern `^([01][0-9]|2[0-3]):[0-5][0-9]$`. |
| `winter_outing_start` | no | string | pattern `^([01][0-9]|2[0-3]):[0-5][0-9]$`. |
| `winter_outing_end` | no | string | pattern `^([01][0-9]|2[0-3]):[0-5][0-9]$`. |
| `summer_season_start` | no | string | pattern `^(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$`. |
| `winter_season_start` | no | string | pattern `^(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$`. |
| `permission_lead_minutes` | no | integer | 0–180. |
| `guest_max_inclusive_days` | no | integer | 1–30. |
| `guest_min_lead_days` | no | integer | 0–14. |
| `scan_duplicate_window_seconds` | no | integer | 0–600. |

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
| `summer_outing_start` | yes | string | Ordinary outing window start (summer). Kept as HH:MM. Shown as 6:30 AM. Starts as 06:30. pattern `^([01][0-9]|2[0-3]):[0-5][0-9]$`. |
| `summer_outing_end` | yes | string | Ordinary outing window end (summer). Kept as HH:MM. Shown as 6:30 PM. Starts as 18:30. pattern `^([01][0-9]|2[0-3]):[0-5][0-9]$`. |
| `winter_outing_start` | yes | string | Ordinary outing window start (winter). Kept as HH:MM. Shown as 6:30 AM. Starts as 06:30. pattern `^([01][0-9]|2[0-3]):[0-5][0-9]$`. |
| `winter_outing_end` | yes | string | Ordinary outing window end (winter). Kept as HH:MM. Shown as 5:30 PM. Starts as 17:30. pattern `^([01][0-9]|2[0-3]):[0-5][0-9]$`. |
| `summer_season_start` | yes | string | Month and day the summer ordinary outing window begins. Shown as 01 April. Starts as 04-01. pattern `^(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$`. |
| `winter_season_start` | yes | string | Month and day the winter ordinary outing window begins. Shown as 01 October. Starts as 10-01. pattern `^(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$`. |
| `permission_lead_minutes` | yes | integer | Minutes before a permission start when a resident may leave. Aligns with guest_min_lead_days naming. |
| `guest_max_inclusive_days` | yes | integer |  |
| `guest_min_lead_days` | yes | integer |  |
| `scan_duplicate_window_seconds` | yes | integer |  |

#### 401

The access token is missing or expired, or the username and password were refused.

Body: [ErrorResponse](#schema-errorresponse).

#### 403

The signed-in role cannot call this operation.

Body: [ErrorResponse](#schema-errorresponse).

#### 422

The JSON is the wrong shape, or a field fails a constraint that does not depend on existing rows.

Body: [ErrorResponse](#schema-errorresponse).


### <a id="get-api-v1-admin-notifications"></a>GET `/api/v1/admin/notifications` — Hall notification settings

`get_notifications`

**Who.** provost only (same gate as hall settings). Bearer access token.

Caller: provost only (same gate as hall settings). Returns the late and
return SMS templates used for guardian notices. Placeholders are listed
on `HallNotifications`.

**Responses**

#### 200

Notification settings.

Body: [HallNotifications](#schema-hallnotifications).

| Field | Required | Type | Notes |
|---|---|---|---|
| `late_sms_template` | yes | string | Placeholders: {resident_name}, {room}, {expected_return_local}, {hall_name}. |
| `return_sms_template` | yes | string | Placeholders: {resident_name}, {room}, {returned_at_local}, {hall_name}. |

#### 401

The access token is missing or expired, or the username and password were refused.

Body: [ErrorResponse](#schema-errorresponse).

#### 403

The signed-in role cannot call this operation.

Body: [ErrorResponse](#schema-errorresponse).


### <a id="patch-api-v1-admin-notifications"></a>PATCH `/api/v1/admin/notifications` — Update hall notification settings

`update_notifications`

**Who.** provost only (same gate as hall settings). Bearer access token.

Caller: provost only (same gate as hall settings). Send only the fields
that change. Each template must keep the placeholders listed on
`HallNotifications`.

**Request.** Required.

Body: [HallNotificationsUpdate](#schema-hallnotificationsupdate).

| Field | Required | Type | Notes |
|---|---|---|---|
| `late_sms_template` | no | string | at least 1 characters. |
| `return_sms_template` | no | string | at least 1 characters. |

**Responses**

#### 200

Notification settings saved.

Body: [HallNotifications](#schema-hallnotifications).

| Field | Required | Type | Notes |
|---|---|---|---|
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

`record_type,full_name,enrolment_number,room_label,block_code,course,presence,state,place,exited_at,expected_return_at,grace_ends_at,returned_at,outing_type,guardian_name,guardian_phone,guest_name,relation,host_name,host_room_label,guest_start_date,guest_end_date,payment_status,guest_bucket,arrived_at,departed_at`

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
| `user_version` | yes | integer | Schema version after migrations. minimum 0. |

### <a id="schema-errorresponse"></a>ErrorResponse

| Field | Required | Type | Notes |
|---|---|---|---|
| `error` | yes | [Error](#schema-error) |  |

### <a id="schema-error"></a>Error

| Field | Required | Type | Notes |
|---|---|---|---|
| `code` | yes | string | Stable machine code. Known codes: `unauthenticated`, `rate_limited`, `not_ready`, `forbidden`, `not_found`, `validation_error`, `duplicate_username`, `duplicate_block`, `duplicate_room`, `duplicate_destination`, `room_in_use`, `room_inactive`, `other_exists`, `already_outside`, `return_already_planned`, `open_outing_exists`, `outside_ordinary_hours`, `permission_required`, `no_outing_planned`, `permission_not_yet_valid`, `duplicate_scan`, `resident_suspended`, `unknown_hall_pass`, `not_pending`, `permission_in_use`, `not_cancellable`, `not_editable`, `guest_not_expected`, `guest_not_in_hall`, `payment_required`, `payment_locked`, `account_in_use`. |
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

### <a id="schema-deleteaccountrequest"></a>DeleteAccountRequest

| Field | Required | Type | Notes |
|---|---|---|---|
| `password` | yes | string | Her current password, sent once to confirm the deletion. 1–200 characters. |

### <a id="schema-changepasswordrequest"></a>ChangePasswordRequest

| Field | Required | Type | Notes |
|---|---|---|---|
| `current_password` | yes | string | 1–200 characters. |
| `new_password` | yes | string | At least 10 characters, with one uppercase letter, one lowercase letter, one number, and one symbol (a character that is not a letter or number). Shorter than 10 says "Use at least 10 characters." Missing a class says "Include an uppercase letter, a lowercase letter, a number, and a symbol.". 10–200 characters. pattern `^(?=.*[A-Z])(?=.*[a-z])(?=.*[0-9])(?=.*[^A-Za-z0-9]).+$`. |

### <a id="schema-residentonboardrequest"></a>ResidentOnboardRequest

| Field | Required | Type | Notes |
|---|---|---|---|
| `full_name` | yes | string | 1–120 characters. |
| `enrolment_number` | yes | string | Roll / enrolment number. Becomes the username. Unique hall-wide, ignoring capitals. 1–40 characters. |
| `password` | yes | string | First password she chooses. Stored as Argon2id. Not returned. Sample bodies in this repository omit the value; the field is required. At least 10 characters, with one uppercase letter, one lowercase letter, one number, and one symbol (a character that is not a letter or number). Shorter than 10 says "Use at least 10 characters." Missing a class says "Include an uppercase letter, a lowercase letter, a number, and a symbol.". 10–200 characters. pattern `^(?=.*[A-Z])(?=.*[a-z])(?=.*[0-9])(?=.*[^A-Za-z0-9]).+$`. |
| `course` | no | string | Optional. For example B.A. LL.B. (Hons.). at most 120 characters. |
| `phone` | yes | string | The resident's own Indian mobile. +91 followed by exactly 10 digits. Required on self-onboard. Not the guardian phone. Another country or another length says "Use an Indian mobile: +91 and exactly 10 digits.". pattern `^\+91[0-9]{10}$`. |
| `block_id` | yes | uuid | The block selected for self-onboard. The room must belong to it. |
| `room_id` | yes | uuid | The active room selected for self-onboard. |
| `guardian_name` | yes | string | Parent or guardian the hall contacts. 1–120 characters. |
| `guardian_phone` | yes | string | Guardian Indian mobile. +91 followed by exactly 10 digits. Late and return SMS go here. Another country or another length says "Use an Indian mobile: +91 and exactly 10 digits.". pattern `^\+91[0-9]{10}$`. |

### <a id="schema-residentonboardresponse"></a>ResidentOnboardResponse

| Field | Required | Type | Notes |
|---|---|---|---|
| `enrolment_number` | yes | string | Stored spelling of the enrolment number. |
| `status` | yes | `active` |  |
| `message` | yes | string | Ready copy for the phone. Exact sentence for clients. |

### <a id="schema-onboardblockoption"></a>OnboardBlockOption

| Field | Required | Type | Notes |
|---|---|---|---|
| `id` | yes | uuid |  |
| `name` | yes | string |  |
| `rooms` | yes | list of [OnboardRoomOption](#schema-onboardroomoption) | Active unassigned rooms in this block. May be empty when every room is taken or inactive. |

### <a id="schema-onboardroomoption"></a>OnboardRoomOption

| Field | Required | Type | Notes |
|---|---|---|---|
| `id` | yes | uuid |  |
| `label` | yes | string |  |

### <a id="schema-passwordresetrequest"></a>PasswordResetRequest

| Field | Required | Type | Notes |
|---|---|---|---|
| `temporary_password` | yes | string | At least 10 characters, with one uppercase letter, one lowercase letter, one number, and one symbol (a character that is not a letter or number). Shorter than 10 says "Use at least 10 characters." Missing a class says "Include an uppercase letter, a lowercase letter, a number, and a symbol.". 10–200 characters. pattern `^(?=.*[A-Z])(?=.*[a-z])(?=.*[0-9])(?=.*[^A-Za-z0-9]).+$`. |

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

`active` may sign in. `suspended` may not.

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

### <a id="schema-homeresident"></a>HomeResident

| Field | Required | Type | Notes |
|---|---|---|---|
| `full_name` | yes | string |  |
| `enrolment_number` | yes | string |  |
| `course` | no | string or null |  |
| `room_label` | yes | string |  |
| `block_name` | yes | string |  |
| `presence` | yes | `inside` or `outside` |  |
| `hall_name` | yes | string | The hall's name, from hall settings. |
| `permissions_requested` | yes | integer | Late-night and home-going permissions she has sent. minimum 0. |
| `permissions_rejected` | yes | integer | Permissions a warden or the provost rejected. minimum 0. |
| `ordinary_returns` | yes | integer | Ordinary outings she has returned from. minimum 0. |
| `late_night_returns` | yes | integer | Late-night outings she has returned from. minimum 0. |
| `home_going_returns` | yes | integer | Home-going outings she has returned from. minimum 0. |
| `guest_stays` | yes | integer | Guest stays she has requested. minimum 0. |

### <a id="schema-residenthome"></a>ResidentHome

| Field | Required | Type | Notes |
|---|---|---|---|
| `resident` | yes | [HomeResident](#schema-homeresident) |  |
| `ordinary_outing_active` | yes | boolean | True when one of her ordinary outings is inside its show window now. That window opens 30 minutes before `starts_at` (immediately when the start is within 5 minutes, because the lead has already begun) and lasts until the outing ends. |
| `current_outing` | yes | [Outing](#schema-outing) or null |  |
| `upcoming_outings` | yes | list of [UpcomingOuting](#schema-upcomingouting) | Planned ordinary outings whose expected return is still in the future. Soonest start first. Not returned, cancelled, outside, or already past. |
| `active_permission` | yes | [Permission](#schema-permission) or null | The newest permission in `pending`, `approved`, or `in_use`, if any. |
| `recent_history` | yes | list of [HistoryEvent](#schema-historyevent) |  |
| `notifications_unread` | yes | boolean | True when she has at least one permission decision she has not marked read. False when the inbox is empty or every row is read. |

### <a id="schema-residentnotification"></a>ResidentNotification

| Field | Required | Type | Notes |
|---|---|---|---|
| `id` | yes | uuid |  |
| `permission_id` | yes | uuid | The permission this decision is about. |
| `permission_type` | yes | `late_night` or `home_going` |  |
| `decision` | yes | `approved` or `rejected` |  |
| `place` | yes | string | The permission's short place, such as Women's College or Lucknow. |
| `departure_at` | yes | string | When she planned to leave. The same instant as on the permission. |
| `expected_return_at` | yes | string | When she planned to be back. The same instant as on the permission. |
| `decided_by` | yes | string | Display name of the warden or provost who decided. Not a user id. |
| `created_at` | yes | string | UTC instant when the decision was recorded. |
| `unread` | yes | boolean |  |

### <a id="schema-residentnotificationlist"></a>ResidentNotificationList

| Field | Required | Type | Notes |
|---|---|---|---|
| `items` | yes | list of [ResidentNotification](#schema-residentnotification) |  |

### <a id="schema-residentnotificationsmarked"></a>ResidentNotificationsMarked

| Field | Required | Type | Notes |
|---|---|---|---|
| `marked` | yes | integer | How many of her rows changed from unread to read. minimum 0. |

### <a id="schema-hallpass"></a>HallPass

| Field | Required | Type | Notes |
|---|---|---|---|
| `qr_payload` | yes | string | Text encoded in the QR image. Prefix `bsj:v1:`. |
| `full_name` | yes | string |  |
| `room_label` | yes | string |  |

### <a id="schema-residenthallpass"></a>ResidentHallPass

| Field | Required | Type | Notes |
|---|---|---|---|
| `qr_payload` | yes | string or null | Permanent hall-pass text (`bsj:v1:` plus the token) when `qr_visible` is true. Null when the phone must not show a QR yet. The gate still scans this same text. |
| `full_name` | yes | string |  |
| `room_label` | yes | string |  |
| `outing_id` | yes | uuid or null | The outing this pass is for, if she has a planned or outside outing. |
| `place` | yes | string or null | Stored place on that outing: the list name, the words typed for Other, or the permission's short place. Same meaning as `place` on an outing. Null when `outing_id` is null. |
| `starts_at` | yes | date-time or null | When she leaves. Null when `outing_id` is null, on a permission outing, and on an ordinary plan saved before this field existed. |
| `expected_return_at` | yes | date-time or null | When she comes back. Null when `outing_id` is null. |
| `qr_visible` | yes | boolean |  |
| `qr_visible_from` | yes | date-time or null | When the QR may be shown. Null when she has no upcoming ordinary outing. |
| `qr_visible_until` | yes | date-time or null | Planned ordinary outings close at `expected_return_at`. Null while she is outside, because the outing ends at the return scan. |

### <a id="schema-historyevent"></a>HistoryEvent

| Field | Required | Type | Notes |
|---|---|---|---|
| `event` | yes | `exited` or `returned` |  |
| `place` | yes | string | Place remembered on the outing. |
| `outing_id` | yes | uuid |  |
| `exited_at` | yes | date-time or null | Set when event is exited; null when event is returned. |
| `returned_at` | yes | date-time or null | Set when event is returned; null when event is exited. |
| `recorded_by` | yes | string | Display name of the staff member who recorded that exit or return (from outings.exit_recorded_by or outings.return_recorded_by). |

### <a id="schema-historyitem"></a>HistoryItem

| Field | Required | Type | Notes |
|---|---|---|---|
| `id` | yes | uuid |  |
| `kind` | yes | `late_night` or `home_going` or `guest_stay` or `outing` |  |
| `place` | yes | string or null | Null when the record has nowhere, such as a guest stay. |
| `who` | yes | string or null | Guest name for a guest stay. Null for every other kind. |
| `started_at` | yes | date-time | Outing: planned leave when unused, gate exit when finished. Permission: departure_at. Guest stay: start of guest_start_date in Asia/Kolkata. |
| `ended_at` | yes | date-time | Outing: planned return when unused, gate return when finished. Permission: expected_return_at. Guest stay: end of guest_end_date in Asia/Kolkata (23:59:59). |
| `exit_recorded_by` | yes | string or null | Display name of the staff member who recorded the gate exit. Null when there was no gate exit, including every unused row and every guest stay. |
| `return_recorded_by` | yes | string or null | Display name of the staff member who recorded the gate return. Null when there was no gate return, including every unused row and every guest stay. |
| `unused` | yes | boolean | True when an approved window or planned outing ended without use. False when the outing has both a gate exit and a gate return, the permission status is completed, or the guest stay status is departed. |

### <a id="schema-historylist"></a>HistoryList

| Field | Required | Type | Notes |
|---|---|---|---|
| `items` | yes | list of [HistoryItem](#schema-historyitem) |  |

### <a id="schema-destination"></a>Destination

| Field | Required | Type | Notes |
|---|---|---|---|
| `id` | yes | uuid |  |
| `name` | yes | string | Named places are shown alphabetical by this name, ignoring capitals. The free-text choice is last. |
| `source` | yes | `preset` or `custom` | Where the place comes from. `preset` is a fixed named place on the list. `custom` is the single free-text (Other) choice. |
| `status` | yes | `active` or `inactive` | `active` while it can be chosen. `inactive` when retired. |

### <a id="schema-destinationlist"></a>DestinationList

| Field | Required | Type | Notes |
|---|---|---|---|
| `items` | yes | list of [Destination](#schema-destination) |  |

### <a id="schema-destinationcreate"></a>DestinationCreate

| Field | Required | Type | Notes |
|---|---|---|---|
| `name` | yes | string | 1–80 characters. |
| `source` | no | `preset` or `custom` | `preset` for a fixed named place. `custom` for the free-text Other choice. default `preset`. |

### <a id="schema-destinationupdate"></a>DestinationUpdate

| Field | Required | Type | Notes |
|---|---|---|---|
| `name` | no | string | 1–80 characters. |
| `source` | no | `preset` or `custom` | `preset` for a fixed named place. `custom` for the free-text Other choice. |
| `status` | no | `active` or `inactive` |  |

### <a id="schema-planoutingrequest"></a>PlanOutingRequest

| Field | Required | Type | Notes |
|---|---|---|---|
| `destination_id` | yes | uuid |  |
| `destination_text` | no | string | Required when the destination is the Other row. Ignored otherwise. 1–120 characters. |
| `starts_at` | yes | date-time | When she plans to leave. UTC instant. Same hall day as the expected return, inside ordinary hours. |
| `expected_return_at` | yes | date-time |  |

### <a id="schema-upcomingouting"></a>UpcomingOuting

| Field | Required | Type | Notes |
|---|---|---|---|
| `id` | yes | uuid |  |
| `place` | yes | string | List name, or the words typed for Other. |
| `starts_at` | yes | date-time or null | When she plans to leave. Empty only on an ordinary plan saved before this field existed. |
| `expected_return_at` | yes | date-time | When she plans to be back. |
| `can_modify` | yes | boolean | True only while she may still change or cancel this outing. False once its hall-pass window is open, and false while she is outside on it. The phone does not decide this from the clock. |

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
| `outing_type` | yes | `ordinary` or `late_night` or `home_going` |  |
| `status` | yes | `planned` or `outside` or `returned` or `cancelled` |  |
| `place` | yes | string | List name, the words typed for Other, or the permission's short place. |
| `starts_at` | yes | date-time or null | When she planned to leave. Empty on a permission outing and on an ordinary outing saved before this field existed. |
| `qr_visible` | yes | boolean | True when the phone may show this outing's hall-pass QR now. Ordinary only. Opens 30 minutes before `starts_at` (immediately when the start is within 5 minutes) and lasts until the outing ends. |
| `qr_visible_from` | yes | date-time or null |  |
| `qr_visible_until` | yes | date-time or null | `expected_return_at` while the ordinary outing is still planned. Null while she is outside, until the return scan. |
| `expected_return_at` | yes | date-time | UTC instant. Clients show India time on a 12-hour clock. |
| `grace_ends_at` | yes | date-time |  |
| `exited_at` | no | date-time or null | Empty only while an ordinary outing is still planned. Required once the resident has left. |
| `exit_recorded_by_name` | no | string or null | Staff member who scanned the exit. Empty only while exited_at is empty. |
| `returned_at` | no | date-time or null | Empty until the return scan. Required once the resident has returned. |
| `return_recorded_by_name` | no | string or null | Staff member who scanned the return. Empty only while returned_at is empty. |
| `lateness` | yes | `on_time` or `late` | For a planned or outside outing, `late` when now is after `grace_ends_at`; otherwise `on_time`. Returned and cancelled outings keep the value at read time. |
| `created_at` | yes | date-time |  |

### <a id="schema-outinglist"></a>OutingList

| Field | Required | Type | Notes |
|---|---|---|---|
| `total` | yes | integer | minimum 0. |
| `limit` | yes | integer |  |
| `offset` | yes | integer |  |
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
| `permission_type` | yes | `late_night` |  |
| `short_place` | yes | string | Typed by the resident. Not chosen from the ordinary destination list. 1–120 characters. |
| `destination_detail` | no | string | 1–120 characters. |
| `reason` | yes | string | 1–500 characters. |
| `departure_at` | yes | date-time |  |
| `expected_return_at` | yes | date-time |  |

### <a id="schema-homegoingcreate"></a>HomeGoingCreate

| Field | Required | Type | Notes |
|---|---|---|---|
| `permission_type` | yes | `home_going` |  |
| `short_place` | yes | string | Short place on the warden card, such as Lucknow. 1–120 characters. |
| `address` | yes | string | 1–300 characters. |
| `reason` | yes | string | 1–500 characters. |
| `departure_at` | yes | date-time |  |
| `expected_return_at` | yes | date-time |  |

### <a id="schema-permission"></a>Permission

| Field | Required | Type | Notes |
|---|---|---|---|
| `id` | yes | uuid |  |
| `permission_type` | yes | `late_night` or `home_going` |  |
| `status` | yes | `pending` or `approved` or `rejected` or `cancelled` or `in_use` or `completed` or `expired` |  |
| `short_place` | yes | string |  |
| `destination_detail` | no | string or null |  |
| `address` | no | string or null |  |
| `reason` | yes | string |  |
| `departure_at` | yes | date-time |  |
| `expected_return_at` | yes | date-time |  |
| `decision_note` | no | string or null |  |
| `decided_at` | no | date-time or null |  |
| `decided_by` | no | string or null | Display name of the warden or provost who decided. Not a user id. Empty while waiting. |
| `created_at` | yes | date-time |  |

### <a id="schema-permissionreview"></a>PermissionReview

| Field | Required | Type | Notes |
|---|---|---|---|
| `id` | yes | uuid |  |
| `permission_type` | yes | `late_night` or `home_going` |  |
| `status` | yes | `pending` or `approved` or `rejected` or `cancelled` or `in_use` or `completed` or `expired` |  |
| `short_place` | yes | string |  |
| `destination_detail` | no | string or null |  |
| `address` | no | string or null |  |
| `reason` | yes | string |  |
| `departure_at` | yes | date-time |  |
| `expected_return_at` | yes | date-time |  |
| `decision_note` | no | string or null |  |
| `decided_at` | no | date-time or null |  |
| `decided_by` | no | string or null | Display name of the warden or provost who decided. Not a user id. Empty while waiting. |
| `created_at` | yes | date-time |  |
| `resident_id` | yes | uuid |  |
| `resident_name` | yes | string |  |
| `room_label` | yes | string |  |

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
| `guest_start_date` | yes | date |  |
| `guest_end_date` | yes | date |  |
| `reason` | yes | string | 1–500 characters. |

### <a id="schema-gueststayupdate"></a>GuestStayUpdate

Editable fields for PATCH own guest stay. Only while the stay is pending
and before arrival. Send all five fields (full replace of name, relation,
dates, and reason). The stay stays pending and the decision stays empty;
payment_status is left unchanged. An approved stay, and any stay after
arrival, is refused.

| Field | Required | Type | Notes |
|---|---|---|---|
| `guest_name` | no | string | 1–120 characters. |
| `relation` | no | string | 1–80 characters. |
| `guest_start_date` | no | date |  |
| `guest_end_date` | no | date |  |
| `reason` | no | string | 1–500 characters. |

### <a id="schema-gueststay"></a>GuestStay

| Field | Required | Type | Notes |
|---|---|---|---|
| `id` | yes | uuid |  |
| `host_resident_id` | yes | uuid |  |
| `host_name` | yes | string |  |
| `host_room_label` | yes | string |  |
| `guest_name` | yes | string |  |
| `relation` | yes | string |  |
| `guest_start_date` | yes | date |  |
| `guest_end_date` | yes | date |  |
| `inclusive_days` | yes | integer |  |
| `reason` | yes | string |  |
| `status` | yes | `pending` or `approved` or `rejected` or `cancelled` or `departed` |  |
| `payment_status` | yes | `unpaid` or `paid` |  |
| `payment_note` | no | string or null | Off-system payment proof (transaction reference, who collected cash, screenshot mention, and similar). Set when payment is marked paid; null when unpaid. |
| `bucket` | yes | `pending` or `upcoming` or `expected` or `not_expected` or `in_hall` or `should_have_left` or `departed` or `rejected` or `cancelled` |  |
| `decision_note` | no | string or null |  |
| `decided_by` | no | uuid or null | UUID of the warden or provost who decided. Empty while waiting, and empty if the resident cancels before a decision. Set once a warden or the provost approves or rejects. |
| `arrived_recorded_by` | no | uuid or null | UUID of the staff member who recorded arrival. Empty until arrival is recorded. |
| `departed_recorded_by` | no | uuid or null | UUID of the staff member who recorded departure. Empty until departure is recorded. |
| `arrived_at` | no | date-time or null |  |
| `departed_at` | no | date-time or null |  |
| `payment_evidence_original_name` | no | string or null | Original client filename when optional payment evidence was uploaded. Empty when no evidence is stored. Never a filesystem path. |
| `payment_evidence_content_type` | no | string or null | Stored content type when evidence exists (`image/jpeg`, `image/png`, or `application/pdf`). Empty when no evidence is stored. |
| `payment_evidence_uploaded_at` | no | date-time or null | UTC instant when evidence was last uploaded. Empty when none. |
| `payment_evidence_uploaded_by` | no | uuid or null | UUID of the warden or provost who uploaded the evidence. Empty when no evidence is stored. |
| `created_at` | yes | date-time |  |

### <a id="schema-gueststaysummary"></a>GuestStaySummary

Card fields for guest-stay list rows. Full stay detail (reason, decision
note, decided_by / recorder staff ids, arrival/departure instants) is on
GuestStay via GET by id.

| Field | Required | Type | Notes |
|---|---|---|---|
| `id` | yes | uuid |  |
| `guest_name` | yes | string |  |
| `host_name` | yes | string |  |
| `host_room_label` | yes | string |  |
| `guest_start_date` | yes | date |  |
| `guest_end_date` | yes | date |  |
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

Marks guest-stay payment that happened outside the system. `payment_note`
is required when `payment_status` is `paid` (non-empty after trim; max
500). When `payment_status` is `unpaid`, `payment_note` may be omitted or
empty; any stored note is cleared with `payment_marked_by` and
`payment_marked_at`, and any optional payment evidence.

| Field | Required | Type | Notes |
|---|---|---|---|
| `payment_status` | yes | `paid` or `unpaid` |  |
| `payment_note` | no | string | Off-system payment proof for the hall office (transaction reference, who collected cash, screenshot mention, and similar). Required when marking paid. Optional when marking unpaid; cleared on unpaid. at most 500 characters. |

### <a id="schema-scanrequest"></a>ScanRequest

| Field | Required | Type | Notes |
|---|---|---|---|
| `qr_payload` | yes | string | Raw QR text, either `bsj:v1:{token}` or the token alone. 1–300 characters. |

### <a id="schema-scanreturntimeliness"></a>ScanReturnTimeliness

How the return sits against expected return and grace.
`on_time`: at or before `expected_return_at`.
`within_grace`: after expected return, at or before `grace_ends_at`.
`late`: after `grace_ends_at`.

One of: `on_time`, `within_grace`, `late`.

### <a id="schema-scanexitouting"></a>ScanExitOuting

Exit nest for the scan response. Explicit property list (not allOf
Outing). Includes outing `lateness` (`on_time` or `late`). Omits
`return_timeliness`, which is only on a return.

| Field | Required | Type | Notes |
|---|---|---|---|
| `id` | yes | uuid |  |
| `permission_id` | no | uuid or null |  |
| `outing_type` | yes | `ordinary` or `late_night` or `home_going` |  |
| `status` | yes | `planned` or `outside` or `returned` or `cancelled` | Outing lifecycle status (typically `outside` on exit). |
| `place` | yes | string |  |
| `expected_return_at` | yes | date-time |  |
| `grace_ends_at` | yes | date-time |  |
| `exited_at` | no | date-time or null |  |
| `exit_recorded_by_name` | no | string or null |  |
| `returned_at` | no | date-time or null |  |
| `return_recorded_by_name` | no | string or null |  |
| `lateness` | yes | `on_time` or `late` | For a planned or outside outing, `late` when now is after `grace_ends_at`; otherwise `on_time`. Returned and cancelled outings keep the value at read time. |
| `created_at` | yes | date-time |  |
| `recorded_at` | yes | date-time | When this exit was recorded at the gate (UTC). |

### <a id="schema-scanreturnrecord"></a>ScanReturnRecord

| Field | Required | Type | Notes |
|---|---|---|---|
| `recorded_at` | yes | date-time | When this return was recorded at the gate (UTC). |
| `return_timeliness` | yes | `on_time` or `within_grace` or `late` |  |
| `returned_at` | yes | date-time |  |
| `return_recorded_by_name` | yes | string | Staff member who scanned the return. |

### <a id="schema-scanexitresult"></a>ScanExitResult

| Field | Required | Type | Notes |
|---|---|---|---|
| `outcome` | yes | `exit_recorded` |  |
| `full_name` | yes | string |  |
| `room_label` | yes | string |  |
| `message` | yes | string |  |
| `outing` | yes | [ScanExitOuting](#schema-scanexitouting) |  |

### <a id="schema-scanreturnresult"></a>ScanReturnResult

| Field | Required | Type | Notes |
|---|---|---|---|
| `outcome` | yes | `return_recorded` |  |
| `full_name` | yes | string |  |
| `room_label` | yes | string |  |
| `message` | yes | string |  |
| `return_record` | yes | [ScanReturnRecord](#schema-scanreturnrecord) | Nested return payload. Named `return_record` (not `return`) so OpenAPI and Python clients avoid the reserved word. |

### <a id="schema-scanresult"></a>ScanResult

Discriminated union on `outcome`. Shared envelope fields are only
`outcome`, `full_name`, `room_label`, and `message`. Variant nests are
mutually exclusive: `outing` on exit, `return_record` on return.
`recorded_at` lives inside each nest, not on the envelope. No boolean
timeliness fields: return uses `return_record.return_timeliness`
(`on_time` | `within_grace` | `late`). Exit outing includes `lateness`
and omits `return_timeliness`.

The `type` field selects the object:

- `exit_recorded` → [ScanExitResult](#schema-scanexitresult)
- `return_recorded` → [ScanReturnResult](#schema-scanreturnresult)

### <a id="schema-gateactivityitem"></a>GateActivityItem

One gate activity line. Always has `event` and `occurred_at`. The five
name/room fields are always present and nullable. Invariant: for
`exit` or `return`, `resident_name` and `room_label` are strings and
`guest_name`, `host_name`, and `host_room_label` are null. For
`guest_arrival` or `guest_departure`, `guest_name`, `host_name`, and
`host_room_label` are strings and `resident_name` and `room_label`
are null.

| Field | Required | Type | Notes |
|---|---|---|---|
| `event` | yes | `exit` or `return` or `guest_arrival` or `guest_departure` | What the gate recorded. |
| `occurred_at` | yes | date-time |  |
| `resident_name` | yes | string or null | Resident display name for exit/return. Null for guest lines. |
| `room_label` | yes | string or null | Resident room label for exit/return. Null for guest lines. |
| `guest_name` | yes | string or null | Guest display name for guest arrival/departure. Null for resident lines. |
| `host_name` | yes | string or null | Host resident display name for guest lines. Null for resident lines. |
| `host_room_label` | yes | string or null | Host room label for guest lines. Null for resident lines. |

### <a id="schema-gateactivitypage"></a>GateActivityPage

| Field | Required | Type | Notes |
|---|---|---|---|
| `total` | yes | integer | minimum 0. |
| `limit` | yes | integer |  |
| `offset` | yes | integer |  |
| `items` | yes | list of [GateActivityItem](#schema-gateactivityitem) |  |

### <a id="schema-gateoccupancy"></a>GateOccupancy

| Field | Required | Type | Notes |
|---|---|---|---|
| `guests_in_hall_count` | yes | integer | Dining count: arrived_at IS NOT NULL AND departed_at IS NULL (includes should-have-left). minimum 0. |
| `guests_should_have_left_count` | yes | integer | Subset of dining where the hall date is after guest_end_date. minimum 0. |

### <a id="schema-gateguestcard"></a>GateGuestCard

| Field | Required | Type | Notes |
|---|---|---|---|
| `id` | yes | uuid |  |
| `guest_name` | yes | string |  |
| `host_name` | yes | string |  |
| `host_room_label` | yes | string |  |
| `guest_start_date` | yes | date |  |
| `guest_end_date` | yes | date |  |
| `payment_status` | yes | `paid` or `unpaid` |  |
| `bucket` | yes | `pending` or `upcoming` or `expected` or `not_expected` or `in_hall` or `should_have_left` or `departed` or `rejected` or `cancelled` |  |

### <a id="schema-gateguestlist"></a>GateGuestList

| Field | Required | Type | Notes |
|---|---|---|---|
| `items` | yes | list of [GateGuestCard](#schema-gateguestcard) |  |

### <a id="schema-guestarrivalresult"></a>GuestArrivalResult

Gate flash after recording arrival. Human labels for the screen.
`arrival_time` and `recorded_at` are distinct field names but must be
equal: both are the same server UTC instant written to `arrived_at` and
the audit/write timestamp. No client-supplied time in this release.

| Field | Required | Type | Notes |
|---|---|---|---|
| `guest_name` | yes | string |  |
| `host_name` | yes | string |  |
| `host_room_label` | yes | string |  |
| `recorded_at` | yes | date-time | When the API wrote the arrival record and audit entry. |
| `recorded_by` | yes | string | Full display name of the staff member who recorded the arrival. |
| `arrival_time` | yes | date-time | When the guest entered the hall (stored `arrived_at`). Must equal `recorded_at` (same clock tick; no independent second timestamp). |
| `message` | yes | string |  |

### <a id="schema-guestdepartureresult"></a>GuestDepartureResult

Gate flash after recording departure. Human labels for the screen.
`departure_time` and `recorded_at` are distinct field names but must be
equal: both are the same server UTC instant written to `departed_at` and
the audit/write timestamp. No client-supplied time in this release.

| Field | Required | Type | Notes |
|---|---|---|---|
| `guest_name` | yes | string |  |
| `host_name` | yes | string |  |
| `host_room_label` | yes | string |  |
| `recorded_at` | yes | date-time | When the API wrote the departure record and audit entry. |
| `recorded_by` | yes | string | Full display name of the staff member who recorded the departure. |
| `departure_time` | yes | date-time | When the guest left the hall (stored `departed_at`). Must equal `recorded_at` (same clock tick; no independent second timestamp). |
| `message` | yes | string |  |

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
| `phone` | no | string or null | The resident's own phone in E.164 with country code. Empty when the hall has not entered it. Optional; not the guardian phone. |
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
| `phone` | yes | string | The resident's own phone in E.164 with country code. Required on office create. Not the guardian phone. pattern `^\+[1-9][0-9]{7,14}$`. |
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
| `phone` | no | string or null | The resident's own phone. Set to null to clear. Same E.164 pattern as guardian_phone when present. |
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
| `status` | yes | `active` or `inactive` | `active` while the hall uses this block. `inactive` when retired. |

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
| `status` | no | `active` or `inactive` |  |

### <a id="schema-room"></a>Room

| Field | Required | Type | Notes |
|---|---|---|---|
| `id` | yes | uuid |  |
| `block_id` | yes | uuid |  |
| `number` | yes | string | Door number, kept as written. The hall page does not publish door numbers. |
| `label` | yes | string |  |
| `bed_count` | yes | integer | Copied from the block when the room is created. Active residents assigned here, including a suspended resident who has not moved, cannot exceed this. |
| `status` | yes | `active` or `inactive` | `active` while the room can be assigned. `inactive` when retired. |

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
| `status` | no | `active` or `inactive` |  |

### <a id="schema-hallsettings"></a>HallSettings

| Field | Required | Type | Notes |
|---|---|---|---|
| `hall_name` | yes | string |  |
| `university_name` | yes | string |  |
| `timezone` | yes | string |  |
| `grace_minutes` | yes | integer |  |
| `summer_outing_start` | yes | string | Ordinary outing window start (summer). Kept as HH:MM. Shown as 6:30 AM. Starts as 06:30. pattern `^([01][0-9]|2[0-3]):[0-5][0-9]$`. |
| `summer_outing_end` | yes | string | Ordinary outing window end (summer). Kept as HH:MM. Shown as 6:30 PM. Starts as 18:30. pattern `^([01][0-9]|2[0-3]):[0-5][0-9]$`. |
| `winter_outing_start` | yes | string | Ordinary outing window start (winter). Kept as HH:MM. Shown as 6:30 AM. Starts as 06:30. pattern `^([01][0-9]|2[0-3]):[0-5][0-9]$`. |
| `winter_outing_end` | yes | string | Ordinary outing window end (winter). Kept as HH:MM. Shown as 5:30 PM. Starts as 17:30. pattern `^([01][0-9]|2[0-3]):[0-5][0-9]$`. |
| `summer_season_start` | yes | string | Month and day the summer ordinary outing window begins. Shown as 01 April. Starts as 04-01. pattern `^(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$`. |
| `winter_season_start` | yes | string | Month and day the winter ordinary outing window begins. Shown as 01 October. Starts as 10-01. pattern `^(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$`. |
| `permission_lead_minutes` | yes | integer | Minutes before a permission start when a resident may leave. Aligns with guest_min_lead_days naming. |
| `guest_max_inclusive_days` | yes | integer |  |
| `guest_min_lead_days` | yes | integer |  |
| `scan_duplicate_window_seconds` | yes | integer |  |

### <a id="schema-hallsettingsupdate"></a>HallSettingsUpdate

| Field | Required | Type | Notes |
|---|---|---|---|
| `hall_name` | no | string | 1–160 characters. |
| `university_name` | no | string | 1–160 characters. |
| `grace_minutes` | no | integer | 0–180. |
| `summer_outing_start` | no | string | pattern `^([01][0-9]|2[0-3]):[0-5][0-9]$`. |
| `summer_outing_end` | no | string | pattern `^([01][0-9]|2[0-3]):[0-5][0-9]$`. |
| `winter_outing_start` | no | string | pattern `^([01][0-9]|2[0-3]):[0-5][0-9]$`. |
| `winter_outing_end` | no | string | pattern `^([01][0-9]|2[0-3]):[0-5][0-9]$`. |
| `summer_season_start` | no | string | pattern `^(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$`. |
| `winter_season_start` | no | string | pattern `^(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$`. |
| `permission_lead_minutes` | no | integer | 0–180. |
| `guest_max_inclusive_days` | no | integer | 1–30. |
| `guest_min_lead_days` | no | integer | 0–14. |
| `scan_duplicate_window_seconds` | no | integer | 0–600. |

### <a id="schema-hallnotifications"></a>HallNotifications

| Field | Required | Type | Notes |
|---|---|---|---|
| `late_sms_template` | yes | string | Placeholders: {resident_name}, {room}, {expected_return_local}, {hall_name}. |
| `return_sms_template` | yes | string | Placeholders: {resident_name}, {room}, {returned_at_local}, {hall_name}. |

### <a id="schema-hallnotificationsupdate"></a>HallNotificationsUpdate

| Field | Required | Type | Notes |
|---|---|---|---|
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
