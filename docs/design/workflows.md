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
| **API** | `POST /auth/login`, `/auth/refresh`, `/auth/logout`, `GET /auth/me`, `POST /auth/change-password`. Provost creates accounts and resets passwords under `/admin/residents*` and `/admin/staff*` (temporary password fields). |

**How an account starts**

1. Provost creates the person at the hall office (resident or staff). Resident username is the **enrolment number**. Staff get a hall-issued username.
2. Provost sets a **temporary password** (not chosen by the person on a public form).
3. There is **no public self-sign-up** and no guardian login.

**Screens / steps**

1. Username + password.
2. Route by `role` from `/auth/me` into the correct shell.
3. Change password (settings, or after a reset when the temporary password must be replaced).
4. Sign out revokes the refresh session.

**Critical states:** wrong password; unknown user; suspended account; expired session → re-auth; temporary password after create/reset.

**Success:** correct shell for role with valid tokens; no public registration UI.

---

## 2. Homepage / role home

| Role | Goal | Key screens | Critical states | Success |
|---|---|---|---|---|
| **Resident** | Know presence; start outing / permission / guest; open hall pass or history | `GET /me/home` hub: name, room, presence chip, open outing or active permission summary; CTAs: Plan outing, Request permission, Guest stay; tiles: Hall pass, History | Inside idle; planned ready to leave; outside with expected return + grace; pending permission; approved usable; suspended (read-only messaging) | One glance answers "where am I?" and the next action |
| **Gate** | Ready to scan; see recent activity | Dark home: primary Scan; list from `GET /gate/activity`; entry to guests | Idle; last result flash | Thumb on Scan in under a second |
| **Warden** | Hall pulse | Register summary counts; shortcuts to Late, Permissions waiting, Guest stays waiting | Quiet night vs busy late list | Counts match `/register/summary` |
| **Provost** | Same as warden + office entry | Warden home + Hall office | (none special) | Office reachable without burying register |

---

## 3. Permissions (late-night / home going)

| | |
|---|---|
| **Actors** | Resident requests; warden or provost decide |
| **Goal** | Late-night or home going approved before exit |
| **API** | Resident: `/me/permissions*`. Staff: `/permissions`, `/permissions/{id}`, `/permissions/{id}/decision` |

**Resident steps**

1. List own permissions.
2. Request (type, short place, reason, departure, expected return).
3. Pending detail → Approved (show when usable) / Rejected.
4. Cancel while **pending**, or while **approved and unused** (before leaving). Cancel is forbidden once `in_use`.

**Staff steps**

1. Queue (default pending).
2. Detail.
3. Approve or Reject (reason when the API requires it).

**Edge cases by date / time**

- Use window: departure minus `permission_early_minutes` through expected return. Gate may open an outing from the permission only inside that window.
- Approved unused whose expected return has passed becomes **expired** when listed or fetched (no separate expiry list). Gate cannot use it.
- Ordinary plan past ordinary hours → `permission_required`; resident must request late-night or home going instead.
- Resident may hold more than one permission; she may not be outside on two outings at once.

**Critical states:** pending; approved unused; `in_use`; expired unused; rejected; permission_required on ordinary plan.

**Success:** no exit on a permission until approved and the gate scan falls inside the use window.

---

## 4. Register / presence board

| | |
|---|---|
| **Actors** | Warden, provost |
| **Goal** | Who is inside, outside, late; drill into a resident |
| **API** | `/register/summary`, `/register/residents`, `/register/residents/{id}`, `/register/late` |

**Screens**

1. Summary counts (hall + per block): Inside / Outside / Late / Waiting.
2. Filterable list (search name or room, block).
3. Late list.
4. Resident record (open outing when outside: place, exit, expected return, grace, type, guardian told).

**Critical states:** empty late; heavy late; outside within grace vs late; suspended excluded from presence counts.

**Success:** duty warden can answer "is she in?" and "who is late?" without spreadsheets.

Provost may also export CSV via `/admin/register/export`.

---

## 5. Hall pass and gate scanning

| | |
|---|---|
| **Actors** | Gate (warden/provost may scan). Resident shows the pass. |
| **Goal** | Record exit or return from the permanent QR; never double-undo |
| **API** | Resident: plan `POST /me/outings`, show `GET /me/hall-pass`, history `GET /me/history`. Gate: `POST /gate/scans`, `GET /gate/activity` |

**Resident loop**

1. Plan ordinary outing (destination + expected return) when inside ordinary hours, or hold an approved permission for late-night / home going.
2. Open hall pass (permanent QR; same code both ways).
3. Gate scan → home shows outside (or refusal).
4. Return scan → history lines.

**Gate screens**

1. Scan CTA → camera / viewfinder (no confirm button).
2. Full-screen result (exit / return / refusal) → auto back to ready.
3. Activity list.

**Critical states:** exit recorded; return recorded; already outside (duplicate window); no plan / outside ordinary hours / permission not usable; resident suspended; pass unknown.

**Copy:** prefer API `message` (for example already outside; present the same pass on return).

**Success:** correct presence flip; second scan inside `scan_duplicate_window_seconds` refused; resident uses the same QR both ways.

---

## 6. Guest stays

| | |
|---|---|
| **Actors** | Resident hosts; warden/provost review + payment mark; gate arrival/departure |
| **Goal** | Paid guest in hall for dining/register without a hall pass |
| **API** | Resident `/me/guest-stays*`; staff `/guest-stays*` + payment; gate `/gate/guests*` |

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
| **API** | `/admin/settings`, `/admin/blocks`, `/admin/rooms`, `/admin/destinations`, `/admin/residents`, `/admin/staff`, password reset, hall-pass reissue, `/admin/register/export`, `/admin/sms`, `/admin/audit` |

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

Same as [`docs/design/design-system.md`](design-system.md) §9 (clock, dates, presence ≠ login, ordinary outing vs permission, grace copy, one primary CTA). Do not invent SMS timing beyond hall settings.

*End of workflows document.*
