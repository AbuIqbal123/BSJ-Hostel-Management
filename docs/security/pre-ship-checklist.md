# Don't ship your app until you check this

**Status:** pre-ship checklist for BSJ Hall (FastAPI + Expo). Not a substitute for a pentest.
**Audience:** whoever cuts a release or review for production.
**Scope:** API, client, storage, and ops. Keep it Fowler-simple: tick the box, fix or mark N/A with a reason.

Map each item to this hall before shipping. Prefer server-side enforcement over trusting the phone.

---

## Checklist

| # | Check | BSJ note |
|---|---|---|
| 1 | **Secure your API keys.** | Keep `APP_SECRET_KEY`, SMS credentials, and any cloud keys in untracked env or a secret store. Rotate if leaked. Never put secrets in Expo public config (`EXPO_PUBLIC_*`). |
| 2 | **Hide all `.env` files.** | `backend/.env` (and root `.env`) must stay gitignored. Confirm they are not in the release artifact or CI logs. |
| 3 | **Never hardcode secrets.** | No passwords, tokens, or keys in source, Postman committed samples, screenshots, or design docs. Use placeholders in fixtures. |
| 4 | **Add authentication.** | Dev allows public resident self-sign-up (`POST /api/v1/auth/onboard`) while `ONBOARD_ENABLED` is true. Set it to false at launch. Signup and the enrolment check then return the same 403 and do not say whether an account exists. Only an account the office created can sign in. Sessions revoke on logout, password change, password reset, and suspend. |
| 5 | **Verify permissions server-side.** | Role checks live in the API (resident / gate / warden / provost). Do not gate sensitive actions only in the Expo UI. |
| 6 | **Don't trust frontend user IDs.** | Derive the actor from the access token / session. Ignore client-supplied `user_id` or role claims for authorization. |
| 7 | **Isolate user data.** | Residents see only `/api/v1/me/*` for their own outings, permissions, guests, history, and hall pass. Staff routes require staff roles. No cross-resident reads via ID guessing. |
| 8 | **Lock down your database.** | The hosted database is Turso. Set `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` on Render only, and do not set `DATABASE_PATH` there. The token is a secret: untracked env, not the phone app, not the repository. Render keeps no SQLite file and no database disk. Backups stay with Turso. |
| 9 | **Secure Firebase, Supabase, and storage.** | **N/A for core BSJ today** (no Firebase/Supabase). If any object storage or file host is added later, lock buckets, signed URLs, and public ACLs. Hall-pass QR is not a public file upload path. |
| 10 | **Protect admin routes.** | `/api/v1/admin/*` allows only the roles in one list, which is the provost. That covers settings, residents, staff, `POST /api/v1/admin/users/{user_id}/password`, `POST /api/v1/admin/residents/{resident_id}/hall-pass/reissue`, export, SMS, and audit. A warden is refused. Verify on every call. |
| 11 | **Disable production debug mode.** | `environment=production`: no dev seed, and the process refuses to start while `DEBUG` is on. `/docs`, `/redoc`, and `/openapi.json` return 404 unless `DOCS_ENABLED` is set. |
| 12 | **Hide detailed errors.** | Clients get one JSON shape for 404, 405, 422, and 500: `detail` repeats `error.message`, and `error` carries `code`, `message`, and `request_id`. No stack trace, SQL, or exception text. The access log records the request id and the exception type, not the exception text. |
| 13 | **Validate inputs server-side.** | OpenAPI + server validation for lengths, enums, dates, and roles. Client validation is UX only. |
| 14 | **Sanitize user content.** | Treat names, reasons, destinations, SMS template text as untrusted when shown or exported. No HTML/script injection into web views. |
| 15 | **Secure file uploads.** | Guest payment evidence: `POST /api/v1/guest-stays/{id}/payment/evidence` (warden/provost only). Multipart field `evidence`. The type is sniffed from the file header (JPEG, PNG, or PDF), not the client's content type. Max 2 MiB. The bytes are a blob in the hall database (`guest_stay_payment_evidence`), not a file on Render's disk. The download name is built by the server. The client filename is display only. No file path in API responses. Optional — never required to mark paid. CSV export remains download-only. |
| 16 | **Prevent SQL and NoSQL injection.** | Parameterized queries / ORM only. No string-built SQL from user input. |
| 17 | **Rate-limit login and signup.** | Rate-limit `POST /api/v1/auth/login` per client address and per username, `POST /api/v1/auth/refresh`, `POST /api/v1/auth/onboard/enrolment`, `GET /api/v1/auth/onboard/options`, and dev public `POST /api/v1/auth/onboard`. A missing account and a wrong password use one generic sentence, including when the username limit is reached. While signup is on, a taken enrolment is named on purpose (`That enrolment number is already an account.`); the attempt limit is what keeps enumeration slow. While `ONBOARD_ENABLED` is false, a free number and a taken number return the same office sentence. |
| 18 | **Check Git history for secrets.** | Run Gitleaks / pre-commit (`docs/engineering/dev-pre-commit.md`) before release. Scrub history if anything slipped. |
| 19 | **Add security headers and restrict CORS.** | Every response sends `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `X-Frame-Options: DENY`, and `X-Request-ID`. Production also sends `Strict-Transport-Security`. Production refuses to start when `CORS_ORIGINS` contains `*`. TLS is the host's job. |
| 20 | **Test as an untrusted user.** | Manual or automated: suspended resident, wrong role calling admin, forged IDs, replayed refresh tokens, gate scan without auth. Expect 401/403, never data. |

---

## How to use

1. Before first production cut (and after major auth or admin changes), walk the table top to bottom.
2. Mark each row done, N/A (with reason), or open with an owner.
3. Do not ship with open rows on auth, admin, secrets, or injection.

Related: product data rules in [`docs/database/database.md`](../database/database.md); HTTP contract in [`docs/api/api.md`](../api/api.md); visual/UX lock in [`docs/design/design-system.md`](../design/design-system.md).

*End of pre-ship security checklist.*
