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
| 4 | **Add authentication.** | Dev allows public resident self-sign-up (`POST /api/v1/auth/onboard`) for testing; production exposure requires an explicit review. Sessions revoke on logout, password change, password reset, and suspend. |
| 5 | **Verify permissions server-side.** | Role checks live in the API (resident / gate / warden / provost). Do not gate sensitive actions only in the Expo UI. |
| 6 | **Don't trust frontend user IDs.** | Derive the actor from the access token / session. Ignore client-supplied `user_id` or role claims for authorization. |
| 7 | **Isolate user data.** | Residents see only `/api/v1/me/*` for their own outings, permissions, guests, history, and hall pass. Staff routes require staff roles. No cross-resident reads via ID guessing. |
| 8 | **Lock down your database.** | Least privilege for the DB user. SQLite file permissions / host volume access locked on the server. Backups encrypted at rest where hosted. |
| 9 | **Secure Firebase, Supabase, and storage.** | **N/A for core BSJ today** (no Firebase/Supabase). If any object storage or file host is added later, lock buckets, signed URLs, and public ACLs. Hall-pass QR is not a public file upload path. |
| 10 | **Protect admin routes.** | `/api/v1/admin/*` is **provost only**, including settings, residents, staff, `POST /api/v1/admin/users/{user_id}/password`, `POST /api/v1/admin/residents/{resident_id}/hall-pass/reissue`, export, SMS, and audit. Verify on every call. |
| 11 | **Disable production debug mode.** | `environment=production`: no dev seed, no debug tool surfaces, OpenAPI/docs exposure only if deliberately allowed. |
| 12 | **Hide detailed errors.** | Clients get contract-shaped errors, not stack traces or SQL. Log detail server-side only. |
| 13 | **Validate inputs server-side.** | OpenAPI + server validation for lengths, enums, dates, and roles. Client validation is UX only. |
| 14 | **Sanitize user content.** | Treat names, reasons, destinations, SMS template text as untrusted when shown or exported. No HTML/script injection into web views. |
| 15 | **Secure file uploads.** | Guest payment evidence: `POST /api/v1/guest-stays/{id}/payment/evidence` (warden/provost only). Multipart field `evidence`; allowlist `image/jpeg`, `image/png`, `application/pdf`; max 5 MiB; UUID stored names under `PAYMENT_EVIDENCE_DIR` (never user-controlled paths); no absolute paths in API responses. Optional — never required to mark paid. CSV export remains download-only. |
| 16 | **Prevent SQL and NoSQL injection.** | Parameterized queries / ORM only. No string-built SQL from user input. |
| 17 | **Rate-limit login and signup.** | Rate-limit `POST /api/v1/auth/login`, `POST /api/v1/auth/refresh`, and dev public `POST /api/v1/auth/onboard`. A bad username, wrong password, or taken enrolment uses one generic authentication sentence, so enumeration stays hard. |
| 18 | **Check Git history for secrets.** | Run Gitleaks / pre-commit (`docs/engineering/dev-pre-commit.md`) before release. Scrub history if anything slipped. |
| 19 | **Add security headers and restrict CORS.** | Production CORS allowlist (Expo / hall origins only). Sensible headers on the API host (e.g. no wide `*`). TLS everywhere. |
| 20 | **Test as an untrusted user.** | Manual or automated: suspended resident, wrong role calling admin, forged IDs, replayed refresh tokens, gate scan without auth. Expect 401/403, never data. |

---

## How to use

1. Before first production cut (and after major auth or admin changes), walk the table top to bottom.
2. Mark each row done, N/A (with reason), or open with an owner.
3. Do not ship with open rows on auth, admin, secrets, or injection.

Related: product data rules in [`docs/database/database.md`](../database/database.md); HTTP contract in [`docs/api/api.md`](../api/api.md); visual/UX lock in [`docs/design/design-system.md`](../design/design-system.md).

*End of pre-ship security checklist.*
