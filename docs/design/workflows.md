# BSJ Hall: product workflows

**Status:** resident and staff Expo screens are in use in `mobile/`.
**Owns:** who does what, in what order, against the live contract.
**Sources:** `backend/openapi.yaml`, `docs/api/api.md`, `docs/database/database.md`, `docs/architecture/system-architecture.md`, `reference/prototype/`, `reference/demo/`.
**Visual language:** [`docs/design/design-system.md`](design-system.md).

Actors: **resident**, **gate**, **warden**, **provost**. Emergency alert flows are **out of scope for v1**.

Keep this document Fowler-simple: one workflow per section, steps a person can name, states the UI must show. Do not invent backend behavior. Prefer the smallest screen set that feels fast and smooth; elaborate multi-step wizards are not a goal.

---

## 1. Auth

| | |
|---|---|
| **Actors** | Resident (self-onboard or office-provisioned), gate, warden, provost |
| **Goal** | Resident onboarding, sign in, stay signed in, change password, sign out |
| **API** | `POST /api/v1/auth/onboard` (resident self-onboard, public). `GET /api/v1/auth/onboard/options` (public room picker: stored blocks A–D, including a block with no free room; inactive and assigned rooms omitted; Utility omitted). `POST /api/v1/auth/login`, `POST /api/v1/auth/refresh`, `POST /api/v1/auth/logout`, `GET /api/v1/auth/me`, `POST /api/v1/auth/change-password`. Provost still creates residents at `POST /api/v1/admin/residents` and staff at `POST /api/v1/admin/staff`. Password reset is `POST /api/v1/admin/users/{user_id}/password`. Do not put onboarding under the Register tag: Register is the presence board at `/api/v1/register`. |

**How a resident account starts (two paths)**

1. **Self-onboard (new).** From sign-in, open Onboard. That screen slides in from the right in 220ms. Reduced motion fades it in. The form loads `GET /api/v1/auth/onboard/options` (no token): blocks A, B, C, and D from stored rows (`id` and `name`), in that order, including a block whose `rooms` array is empty. Utility is absent. Each room is an active stored row with no resident (`id` and `label`). Inactive and assigned rooms are absent. She enters `full_name`, `enrolment_number` (her roll number; becomes the username), `password`, `phone` (her own), `block_id`, `room_id`, `guardian_name`, and `guardian_phone`. Optional: `course`. She sends those existing ids. The hall does not accept a room number and does not create a room. Submit calls `POST /api/v1/auth/onboard`. The hall keeps an **active** resident with the selected room and returns no tokens. The phone signs in with the submitted enrolment number and password and opens Home.
2. **Office-provisioned (unchanged).** Provost creates the resident at the hall office with room, the resident's phone, guardian details, and a `temporary_password`. Account starts **active**. Login accepts that password and returns tokens.
3. There is **no guardian login**. Guardians do not use the app.

**Critical-engineer decisions (locked for this stack)**

| Decision | Choice | Rationale |
|---|---|---|
| Who may self-onboard | Residents only. Gate, warden, and provost stay office-created (`POST /api/v1/admin/staff`). | Staff roles grant gate and hall records. Self-service staff accounts would bypass office control. |
| Enrolment uniqueness | Hall-wide, ignoring capitals. Same rule as username. | One person per enrolment in this hall. Matches existing unique enrolment / username. |
| Room / block at onboard | The form offers only `GET /api/v1/auth/onboard/options`: stored blocks A–D (`id`+`name`), including one with no free room, and nested active unassigned rooms (`id`+`label`). Utility is omitted. She sends the chosen `block_id` and `room_id`. She does not call the provost lists, and signup does not create a room. | The picker is the onboard form only. |
| Guardian and phones | `guardian_name`, `guardian_phone`, and resident `phone` are required on both self-onboard and office create. | Hall already requires a guardian phone for late and return SMS. Both resident-entry paths collect the resident's own phone so it is on file from creation. |
| Activation | Self-onboard creates an active resident with a room and hall pass; login is allowed immediately. | Dev/testing needs a complete path. |
| First password | She chooses `password` on self-onboard (at least 10 characters). No must-change flag. Office path still uses `temporary_password`. After she can sign in, change-password from settings is optional. | Full onboarding means she owns the first password. Matches current "no must-change" for office accounts. |
| Staff creation | Office only. No public staff onboard. | Same as today. |

**Screens / steps**

1. Sign-in: enrolment number (or staff username) + password. Under Sign in, in the same gap as the fields: "Don't have an account?" in body ink and "Sign up" in forest. If the error would cover that link, the error sits under the link. The sign-in block is otherwise unchanged.
2. Onboard sits below the notch and above the home indicator. One three-part progress bar, with a gap between the parts. A part fills only after she leaves that step. Tapping an earlier part goes back and keeps what was typed. Tapping ahead does nothing. A sideways swipe moves one step: back to a step she has already reached, or forward when this step is valid. The first step shows Sign in, with a back chevron, and that returns to sign-in. On a later step it returns to the previous step and keeps what was typed. The steps slide horizontally in 220ms. Opacity stays at 1. What she types stays until signup succeeds, including if she leaves this screen and comes back. Person is full name, enrolment, phone, and password. Continuing from that step checks the enrolment number. A taken number stays on the field and says that enrolment number is already an account. Contact is guardian name and guardian phone. Room is block, room, and course. Phones show the India flag, a locked +91, and exactly 10 digits on the number keypad, and are sent as +91 and those digits. Block, room, and course are dropdowns. A chevron opens one list, and search narrows it. Opening the block list shows A–D. Opening the room list shows that block's stored rooms. Course is one of these labels, with no year and no BSW: BA LLB, LLM, BSc Industrial Chemistry, MSc Industrial Chemistry, MSc Wildlife and Biodiversity, MTech Agricultural Process and Food Engineering, MBA, MBA International Business, PG Islamic Banking and Finance, BA Theology (Sunni), BA Theology (Shia), PhD Agriculture, PhD Arts, PhD Commerce, PhD Law, PhD Life Sciences, PhD Theology. Notes wait for a short pause or for Continue or Sign up. A missed field shows one short message in the error color. The block stays empty until she chooses it. Sign up sends the chosen `block_id` and `room_id`. Success signs her in and opens Home. If that sign-in does not succeed, Sign up tries again without creating another account. A taken enrolment is named on the enrolment field: That enrolment number is already an account.
3. A successful signup opens Home. Signing in later routes a resident to Home and gate, warden, or provost to the staff Home, using the role from sign-in.
4. Change password from settings when she chooses. Needs current password and a new one. The shell does not block until she does this.
5. Sign out revokes the refresh session.

**Critical states:** a bad username and a wrong password are the same refusal, `Username or password is wrong.`; a taken onboard enrolment says `That enrolment number is already an account.` on the enrolment field, on purpose, so she knows her number is taken; a suspended account says `This account is suspended. Please contact the Hall Office.`; too many attempts says `Too many attempts. Try again shortly.`; an expired session returns to sign-in. Do not show a screen that says the username is missing.

**Success:** self-onboard returns no tokens. The phone signs in with the submitted enrolment number and password and opens Home. A later sign-in returns the correct shell for the role. Staff stay office-created only.

---

## 2. Homepage / role home

| Role | Goal | Key screens | Critical states | Success |
|---|---|---|---|---|
| **Resident** | Know presence; plan an ordinary outing; open permissions, guest stays, hall pass, history, and settings from tabs | `GET /api/v1/me/home`: Welcome with name, room, a bell, the plan form when she may plan, and upcoming ordinary outings. Pass, Permissions (late-night / home-going / guest stays tabs), and Settings are separate tabs | Inside idle; several future plans, including two returns on the same hall day, until one ordinary outing is inside its show window. While that window is open, including when she is outside on it, she cannot plan another. Pending permission; approved permission usable. A suspended account never reaches this screen: sign-in and the next refresh fail, and she sees the Hall Office sentence | One glance answers "where am I?" and the next action |
| **Gate** | Ready to scan; see recent activity | Dark home: primary Scan; list from `GET /api/v1/gate/activity`; entry to guests | Idle; last result flash | Thumb on Scan in under a second |
| **Warden** | Hall pulse | Register summary counts; shortcuts to Late, Permissions waiting, Guest stays waiting | Quiet night vs busy late list | Counts match `GET /api/v1/register/summary` |
| **Provost** | Same as warden + office entry | Warden home + Hall office | (none special) | Office reachable without burying register |

The resident phone home shows her name and her room, then the plan form when she may plan, then each upcoming ordinary outing. She opens a row in Plan only when she can still change it, and that screen pushes in over the tabs. Plan asks for the place, when she will leave, and when she will be back, and sends those as `starts_at` and `expected_return_at`. An Other place opens with Other selected and the typed where filled in. While she is outside, or while one ordinary outing is inside its show window, Plan does not show the form. The hall pass shows her name, her room, and the place. Other shows the typed where as well. Before the code is visible it says she has a planned outing and that her QR code appears 30 minutes before she leaves. When the code is up, her name and room sit above it. Below it she is told to show the pass to the gate staff, with the destination and when she is due back. Settings shows her name, enrolment, and room, then Appearance, then Profile. Profile shows her name, the hall, her room and block, her enrolment, her course, and a Stats grid. Each card shows the count, then its label on one line: permissions requested, permissions rejected, ordinary returns, late-night returns, home-going returns, and guest stays. Settings also has her history, with kind filters and a from and to date, one row per record, and opening a row shows that record, change password, the privacy policy, and sign out. Delete account asks for her password, then asks "Are you sure you want to delete?" before the account is removed. Permissions opens a guest stay request, which is only the form. After the hall accepts it, the phone shows the confirmation. On Permissions, Late-night, Home going, and Guest stays are separate tabs, and each tab lists only those requests. Staff open their own tabs: Home, Scan, Requests (warden and provost only), and Settings.

---

## 3. Permissions (late-night / home going)

| | |
|---|---|
| **Actors** | Resident requests; warden or provost decide |
| **Goal** | Late-night or home going approved before exit |
| **API** | Resident: `GET` and `POST /api/v1/me/permissions`, `GET` and `PATCH /api/v1/me/permissions/{permission_id}`, `POST /api/v1/me/permissions/{permission_id}/cancel`. Staff: `GET /api/v1/permissions`, `GET /api/v1/permissions/{permission_id}`, `POST /api/v1/permissions/{permission_id}/decision` |

**Resident steps**

1. List own permissions. The phone shows the soonest departure first.
2. Two forms. Late-night asks for the place, the reason, and when she leaves and returns. The return is the same hall day as the departure. The only later instant is 12:00 AM on the next hall day. Home going asks for the city, the home address, the reason, the leave date, and the return date. It does not ask for a time. A trip of several days is those two dates. Neither is chosen from the ordinary destination list. After a request is sent, the phone tells her it has been submitted, and she sees it on the Permissions tab.
3. Opening a pending request shows the same form, so she can change it before anyone decides. The form says that any change needs approval again. The same checks as a new request apply, and it stays pending. Once it is approved, she can read it but not change it. It tells her to show it to the gate staff shortly before she leaves, and until she is due back. Rejected shows the decision.
4. Cancel while **pending**, or while **approved and unused** (before leaving). Cancel is forbidden once `in_use`.

**Staff steps**

1. Queue (default pending).
2. Detail.
3. Approve or reject. The note is optional. The API does not require a reason.

**Edge cases by date / time**

- Use window: departure minus `permission_lead_minutes` through expected return. Gate may open an outing from the permission only inside that window.
- Approved unused whose expected return has passed becomes **expired**. Gate cannot use it.
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

1. Plan an ordinary outing with a destination, a start, and an expected return. She may save several future plans, including two on the same hall day. She cannot start another while one ordinary outing is inside its show window. Planning does not change presence. No warden approval. She may also hold an approved late-night or home-going permission.
2. Open the hall pass. The code is still the permanent hall-pass token, and the gate scan still decides the movement. The phone shows the QR for one outing: from 30 minutes before its start (immediately when the start is within 5 minutes) until the outing ends. While she is outside, it stays up until the return scan.
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
| **API** | Resident `GET` and `POST /api/v1/me/guest-stays`, `GET` and `PATCH /api/v1/me/guest-stays/{guest_stay_id}`, `POST /api/v1/me/guest-stays/{guest_stay_id}/cancel`. Staff `GET /api/v1/guest-stays`, `GET /api/v1/guest-stays/{guest_stay_id}`, `POST /api/v1/guest-stays/{guest_stay_id}/decision`, `POST /api/v1/guest-stays/{guest_stay_id}/payment`. Gate `GET /api/v1/gate/guests`, `POST /api/v1/gate/guests/{guest_stay_id}/arrival`, `POST /api/v1/gate/guests/{guest_stay_id}/departure` |

**Resident steps:** apply (≥ `guest_min_lead_days`, ≤ `guest_max_inclusive_days`) → Pending. While it is pending and the guest has not arrived, she can change the name, relation, dates, and reason, and it stays pending. An approved stay cannot be changed. She can cancel before arrival, whether the stay is pending or approved.

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

**Screens:** settings (hours, grace, seasons, guest rules, SMS templates; show 12-hour + day-month as contract) → blocks/rooms → destinations → residents (create/edit; suspend; reissue pass) → staff → password reset → SMS log → audit → CSV export.

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
