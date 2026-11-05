# Sign in

A hall account exchanges username and password for access and refresh tokens. Wrong credentials share one message. The scratch resident signs in with her enrolment number.

## Sub-features

- `login-ok` returns 200 with `access_token` and `user`.
- `login-bad` returns 401 `unauthenticated` for a wrong password.

## How to get to it (user POV)

- Phone or Swagger: sign-in form → `POST /api/v1/auth/login`.
- Resident username is the enrolment number (`24-GLLB-118` on scratch).

## Driving it with verify-bsj-hall HTTP

Preconditions:

- Launch + doctor green.
- Password from `password.sh 24-GLLB-118`.

- **Sign in.** `http.sh POST /api/v1/auth/login …/login.json '{"username":"24-GLLB-118","password":"<seed>"}'`. Status `200`. Body has `access_token` and `user.role` `resident`.
- **Wrong password.** Same path with a wrong password. Status `401`. Body `error.code` is `unauthenticated`.
- **Proof.** Write `proof.txt` with username, role, and token length. Keep both JSON bodies under `artifacts/<run>/sign-in/`.

Or run `scripts/prove-sign-in.sh` (launch → doctor → both calls → cleanup).

## Gotchas

- Do not use port 8000; seeding and doctor refuse non-scratch halls.
- Generated passwords change every launch; never hard-code them.
- Username/password wrong share one message — assert code and status, not a unique string that distinguishes unknown users.
