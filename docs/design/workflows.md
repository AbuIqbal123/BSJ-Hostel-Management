# BSJ Hall: product workflows

**Status:** design lock for Expo screens. Not implemented UI.
**Owns:** who does what, in what order, against the live contract.
**Sources:** `backend/openapi.yaml`, `docs/api/api.md`, `docs/database/database.md`, `docs/architecture/system-architecture.md`, `reference/prototype/`, `reference/demo/`.
**Visual language:** [`docs/design/design-system.md`](design-system.md).

Actors: **resident**, **gate**, **warden**, **provost**. Emergency alert flows are **out of scope for v1**.

Keep this document Fowler-simple: one workflow per section, steps a person can name, states the UI must show. Do not invent backend behavior. Prefer the smallest screen set that feels fast and smooth; elaborate multi-step wizards are not a goal.

---

## 1. Auth

| | |
|---|---|
| **Actors** | Anyone with a hall-issued account |
| **Goal** | Sign in, stay signed in, change password, sign out |
| **API** | `POST /api/v1/auth/login`, `POST /api/v1/auth/refresh`, `POST /api/v1/auth/logout`, `GET /api/v1/auth/me`, `POST /api/v1/auth/change-password`. The provost creates residents at `POST /api/v1/admin/residents` and staff at `POST /api/v1/admin/staff`. Password reset is `POST /api/v1/admin/users/{user_id}/password`. |

**How an account starts**

1. Provost creates the person at the hall office (resident or staff). Resident username is the **enrolment number**. Staff get a hall-issued username.
2. Provost sets the password (not chosen by the person on a public form). Login accepts that password and returns tokens. There is no must-change flag.
3. There is **no public self-sign-up** and no guardian login.

**Screens / steps**

1. Username + password.
2. Route by `role` from `GET /api/v1/auth/me` into the correct shell.
3. Change password from settings when she chooses. The call needs the current password and a new one. The shell does not block until she does this.
4. Sign out revokes the refresh session.

**Critical states:** a bad username and a wrong password are the same refusal, `Username or password is wrong.`; a suspended account says `This account is suspended. Please contact the Hall Office.`; too many attempts says `Too many attempts. Try again shortly.`; an expired session returns to sign-in. Do not show a screen that says the username is missing.

**Success:** correct shell for role with valid tokens; no public registration UI.

---

## 2. Homepage / role home

| Role | Goal | Key screens | Critical states | Success |
|---|---|---|---|---|
| **Resident** | Know presence; start outing / permission / guest; open hall pass or history | `GET /api/v1/me/home` hub: name, room, presence chip, open outing or active permission summary; actions that can sit together: Plan outing, Request permission, Guest stay, Hall pass, History | Inside idle; one or more plans, including two returns on the same hall day; outside with expected return and grace, and she may still plan another return; pending permission; approved permission usable. A suspended account never reaches this screen: sign-in and the next refresh fail, and she sees the Hall Office sentence | One glance answers "where am I?" and the next action |
| **Gate** | Ready to scan; see recent activity | Dark home: primary Scan; list from `GET /api/v1/gate/activity`; entry to guests | Idle; last result flash | Thumb on Scan in under a second |
| **Warden** | Hall pulse | Register summary counts; shortcuts to Late, Permissions waiting, Guest stays waiting | Quiet night vs busy late list | Counts match `GET /api/v1/register/summary` |
| **Provost** | Same as warden + office entry | Warden home + Hall office | (none special) | Office reachable without burying register |

---

## 3. Permissions (late-night / home going)

| | |
|---|---|
| **Actors** | Resident requests; warden or provost decide |
| **Goal** | Late-night or home going approved before exit |
| **API** | Resident: `GET` and `POST /api/v1/me/permissions`, `GET /api/v1/me/permissions/{permission_id}`, `POST /api/v1/me/permissions/{permission_id}/cancel`. Staff: `GET /api/v1/permissions`, `GET /api/v1/permissions/{permission_id}`, `POST /api/v1/permissions/{permission_id}/decision` |

**Resident steps**

1. List own permissions.
2. Two forms. Late-night: type, short place (typed, not chosen from `GET /api/v1/destinations`), reason, optional further detail, departure, expected return. Home going: those fields plus address. Home going does not use the destination list.
3. Pending detail, then approved (show when usable) or rejected.
4. Cancel while **pending**, or while **approved and unused** (before leaving). Cancel is forbidden once `in_use`.

**Staff steps**

1. Queue (default pending).
2. Detail.
3. Approve or reject. The note is optional. The API does not require a reason.

**Edge cases by date / time**

- Use window: departure minus `permission_lead_minutes` through expected return. Gate may open an outing from the permission only inside that window.
- Approved unused whose expected return has passed becomes **expired** when listed or fetched (no separate expiry list). Gate cannot use it.
- A return at or before that hall date's ordinary-hours start is 409 `outside_ordinary_hours`: "That return is outside ordinary hours." Do not send her to late-night or home going.
- A return after the end is 409 `permission_required`: "That return is outside ordinary hours. Please submit a permission request." Summer, 1 April through 30 September, is 6:30 AM to 6:30 PM. Winter, 1 October through 31 March, is 6:30 AM to 5:30 PM. The start is not included. The end is included.
- She may hold more than one permission. She may not be outside on two outings at once. Two planned or outside outings cannot share an expected return (`return_already_planned`).

**Critical states:** pending; approved unused; `in_use`; expired unused; rejected; permission_required on ordinary plan.

**Success:** no exit on a permission until approved and the gate scan falls inside the use window.

---

## 4. Register / presence board

| | |
|---|---|
| **Actors** | Warden, provost |
| **Goal** | Who is inside, outside, late; drill into a resident |
| **API** | `GET /api/v1/register/summary`, `GET /api/v1/register/residents`, `GET /api/v1/register/residents/{resident_id}`, `GET /api/v1/register/late` |

**Screens**

1. Summary counts (hall + per block): Inside / Outside / Late / Waiting.
2. Filterable list (search name or room, block).
3. Late list.
4. Resident record (open outing when outside: place, exit, expected return, grace, type, guardian told).

**Critical states:** empty late; heavy late; outside within grace vs late; suspended excluded from presence counts.

**Success:** duty warden can answer "is she in?" and "who is late?" without spreadsheets.

Provost may also export CSV via `GET /api/v1/admin/register/export`.

---

## 5. Hall pass and gate scanning

| | |
|---|---|
| **Actors** | Gate (warden/provost may scan). Resident shows the pass. |
| **Goal** | Record exit or return from the permanent QR; never double-undo |
| **API** | Resident: plan `POST /api/v1/me/outings`, list `GET /api/v1/me/outings`, open outing `GET /api/v1/me/outings/current`, cancel `POST /api/v1/me/outings/{outing_id}/cancel`, show `GET /api/v1/me/hall-pass`, history `GET /api/v1/me/history`. Gate: `POST /api/v1/gate/scans`, `GET /api/v1/gate/activity` |

**Resident loop**

1. Plan an ordinary outing with a destination and an expected return. She may save several plans, including two on the same hall day, and she may plan while she is already outside. Planning does not change presence. The check is the expected return (in the future, inside that hall date's window), not whether the clock is inside ordinary hours when she plans. She may also hold an approved late-night or home-going permission.
2. Open the hall pass. The QR is permanent and the same code is used both ways. The pass stays available while a plan or an outside outing exists.
3. At an exit scan, today's earliest ordinary plan whose return has not passed is used when the current time is inside today's ordinary hours. A later plan today, and any other day's plan, stay planned. An approved permission is opened only if no such plan is used. If she meant the permission, or a later trip today, she cancels the plan the gate would use and shows the pass again.
4. The scan updates home to outside, or shows the refusal.
5. A return scan adds the history line.

**Gate screens**

1. Scan CTA → camera / viewfinder (no confirm button).
2. Full-screen result (exit / return / refusal) → auto back to ready.
3. Activity list.

**Critical states:** exit recorded; return recorded; `duplicate_scan` inside `scan_duplicate_window_seconds` (she is already recorded as outside and should present the same pass on return); `already_outside` only when she cancels an outing that is already outside ("You are already outside."); `no_outing_planned`; `outside_ordinary_hours`; `permission_not_yet_valid`; `resident_suspended`; `unknown_hall_pass` (404).

**Copy:** prefer API `message` (for example already outside; present the same pass on return).

**Success:** correct presence flip; second scan inside `scan_duplicate_window_seconds` refused; resident uses the same QR both ways.

---

## 6. Guest stays

| | |
|---|---|
| **Actors** | Resident hosts; warden/provost review + payment mark; gate arrival/departure |
| **Goal** | Paid guest in hall for dining/register without a hall pass |
| **API** | Resident `GET` and `POST /api/v1/me/guest-stays`, `GET /api/v1/me/guest-stays/{guest_stay_id}`, `POST /api/v1/me/guest-stays/{guest_stay_id}/cancel`. Staff `GET /api/v1/guest-stays`, `GET /api/v1/guest-stays/{guest_stay_id}`, `POST /api/v1/guest-stays/{guest_stay_id}/decision`, `POST /api/v1/guest-stays/{guest_stay_id}/payment`. Gate `GET /api/v1/gate/guests`, `POST /api/v1/gate/guests/{guest_stay_id}/arrival`, `POST /api/v1/gate/guests/{guest_stay_id}/departure` |

**Resident steps:** apply (≥ `guest_min_lead_days`, ≤ `guest_max_inclusive_days`) → Pending → Approved / Rejected → Cancel before arrival.

**Staff steps:** queue → Decide → Mark paid / unpaid.

**Gate steps:** expected list → Record arrival → In-hall list → Record departure.

**Critical states:** waiting; approved unpaid (gate must not admit: approved **and** paid); in hall; should-have-left; departed.

**Success:** dining/register guest counts move only on gate arrival/departure. Guests never get a QR.

---

## 7. Hall office (provost)

| | |
|---|---|
| **Actors** | Provost only |
| **Goal** | Keep people, places, and settings accurate |
| **API** | `/api/v1/admin/settings`, `/api/v1/admin/blocks`, `/api/v1/admin/rooms`, `/api/v1/admin/destinations`, `/api/v1/admin/residents`, `/api/v1/admin/staff`, `POST /api/v1/admin/users/{user_id}/password`, `POST /api/v1/admin/residents/{resident_id}/hall-pass/reissue`, `GET /api/v1/admin/register/export`, `GET /api/v1/admin/sms`, `GET /api/v1/admin/audit` |

**Screens:** settings (hours, grace, seasons, guest rules, SMS templates; show 12-hour + day-month as contract) → blocks/rooms → destinations → residents (create/edit, suspend, reissue pass) → staff → password reset → SMS log → audit → CSV export.

**Critical states:** destructive confirms (reissue pass invalidates old QR; reset revokes sessions); inactive destinations hidden from resident catalog but visible in admin.

**Success:** provost can run the hall without database tools.

---

## 8. Explicitly not designing for v1

- Emergency alert flows (prototype / proposal only).
- Parent or guardian app.
- Payment gateway or amounts (mark paid/unpaid only).
- Push notification product design (guardian SMS is backend; client local notifications optional later).
- Multi-role users.

---

## 9. Cross-cutting rules (UI must honor)

Same as [`docs/design/design-system.md`](design-system.md) §9 (clock, dates, presence is not login, ordinary outing vs permission, grace copy, actions that can be true together). Do not invent SMS timing beyond hall settings.

*End of workflows document.*
