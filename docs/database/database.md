# Begum Sultan Jahan Hall — what the hall keeps

Version: **1**

Status: agreed. The service creates these records when it starts. They match this document.

This document is the source of truth for what is stored and how a record is allowed to change. It is written for the hall. The software follows it. What a person sends and receives is in [`api.md`](../api/api.md). The picture of what is running is [`system-architecture.md`](../architecture/system-architecture.md).

The service records which migration file it has applied in `schema_migrations`, in the same transaction as the file. That list is not a hall record.

## Contents

- [Where this comes from](#where-this-comes-from)
- [What the hall already decided](#what-the-hall-already-decided)
- [Still for the hall to decide](#still-for-the-hall-to-decide)
- [How a value is kept and how it is shown](#how-a-value-is-kept-and-how-it-is-shown)
- [How the records connect](#how-the-records-connect)
- [Hall settings](#hall-settings)
- [Places](#places)
  - [Blocks](#blocks)
  - [Rooms](#rooms)
  - [Destinations](#destinations)
- [Accounts](#accounts)
  - [People](#people)
  - [Residents](#residents)
  - [Staff](#staff)
  - [Signed-in session](#signed-in-session)
- [Permissions](#permissions)
  - [Permission lifecycle](#permission-lifecycle)
- [Resident notifications](#resident-notifications)
- [Outings](#outings)
  - [Ordinary outing](#ordinary-outing)
  - [Leaving on a permission](#leaving-on-a-permission)
  - [Return](#return)
  - [Late](#late)
- [Guest stays](#guest-stays)
  - [Guest lifecycle](#guest-lifecycle)
  - [Guest lists](#guest-lists)
- [Messages to the parent or guardian](#messages-to-the-parent-or-guardian)
- [Audit log](#audit-log)
- [Who can do what](#who-can-do-what)
- [What the register counts](#what-the-register-counts)
- [History that is not its own list](#history-that-is-not-its-own-list)
- [What this version does not keep](#what-this-version-does-not-keep)
- [Indexes](#indexes)

## Where this comes from

The rules in this document are the contract. The room inventory is taken from the hall's own page, [Begum Sultan Jahan Hall](https://www.amu.ac.in/halls/begum-sultan-jahan-hall), read on 30 September 2026. Ordinary hours are taken from the hall's SOP 06, Outing, Late-Night Permission, Home going and Emergency Protocol, and from SOP 07, Maintenance of Register at the Gate. Both were read from the hall's SOP page on the same date. The dates when summer hours become winter hours are taken from the seasonal split published by [AMU University Health Services](https://www.amu.ac.in/miscellaneous/universiy-health-services/out-patient-department): 1 April through 30 September, and 1 October through 31 March. Where those sources do not decide a detail the system still needs, the detail is listed under Still for the hall to decide and stored as a hall setting.

## What the hall already decided

- The hall is Begum Sultan Jahan Hall, Aligarh Muslim University. The hall page lists 206 double rooms and 412 beds. For session 2025–26 the same page lists 506 resident students and 434 non-resident students. That roll is not a room count. This system keeps the provost, wardens, and gate staff.
- A resident has one permanent hall pass. It is not replaced for each outing. The same code records leaving and coming back. The provost can issue a new code from the resident's record. The steps are under Residents. The resident phone shows that code for one outing at a time: from 30 minutes before the ordinary outing's start (immediately when the start is within 5 minutes, because that lead has already begun) until the outing ends. While she is outside, the code stays available until the return scan. The gate scan still decides the movement.
- An ordinary outing is a same-day outing inside ordinary hours. The resident sets the destination and the expected return in the app before going to the gate. The gate scan does not ask for either. If either is missing, the scan does not let her out. An ordinary outing needs no warden approval. The scan records the exit, the time, and which staff member scanned.
- Ordinary hours are a window with a start and an end. Summer is 1 April through 30 September, 6:30 AM to 6:30 PM. Winter is 1 October through 31 March, 6:30 AM to 5:30 PM. On 30 September the summer window is in force. On 1 October the winter window is in force. The clock times and the two start dates are under Hall settings.
- Grace is 30 minutes after the expected return. An expected return of 7:00 PM means grace ends at 7:30 PM.
- A message to the parent or guardian is sent when grace ends and the resident is still outside. A second message is sent when that resident returns. An on-time return sends nothing. Every resident has a guardian phone, so the number is always on file.
- Late-night permission is for staying in Aligarh after ordinary hours. A warden or the provost must approve it before the resident leaves. The hall records the place, the reason, the departure, and the expected return.
- Home going is leave for home. The hall records the home address, the reason, the departure, and the return. A warden or the provost must approve it before the resident leaves.
- A rejection does not block an ordinary outing inside ordinary hours.
- Gate staff scan the hall pass. A second immediate scan must not undo the movement. The gate screen for that case says the resident is already outside and should present the same pass on return.
- The register shows who is inside, outside, or late, and the permissions still waiting. It shows those counts for the whole hall and again for each block. Search is by name or room. A register list row names the outside destination when the resident is outside. A resident record includes the open outside outing when she is outside — place, exit, expected return, grace, outing type — and whether the guardian was told. When she is inside, that outing field is null; cancelled, returned, and planned outings are not shown there.
- The provost sees the whole hall and can export the register.
- A guest stay is applied for by the host resident at least one day before the start date, for at most 7 days counting the first and last day. 18 September 2026 through 21 September 2026 is 4 days. Payment is marked at the hall office, not collected in the app. Guests have no hall pass. Gate staff record arrival and departure from a list. A guest stays on the dining count until departure is recorded, including when the end date has passed.
- Emergency alerts are not in this version. An alert must not approve leave or change whether a resident is outside.
- Parents and guardians do not use the app. A text message is the only channel to them.
- A resident may self-onboard with her full name, enrolment number, chosen password, own phone, guardian name and phone, and a selected block and room. On that form the resident phone and the guardian phone are Indian mobiles: +91 followed by exactly 10 digits. The account starts **active**, can sign in immediately, and receives its hall pass. Staff (gate, warden, provost) are never self-onboarded. She can delete that account from the phone. Deletion asks for her current password, revokes her sessions, cancels planned outings and permissions and guest stays that have not arrived, and frees her room. Her name, phone, guardian, enrolment, and hall pass are removed. The account is suspended under a new username she does not know, so the old enrolment can be used again and sign-in with it fails. Outings, permissions, guest stays, and audit rows the hall already kept stay, without her name. Deletion is refused while she is outside or a guest of hers is still in the hall. The first deletion creates an inactive Utility room, `Utility-former`, that holds these accounts and is not offered at signup.
- Every time a person sees is India time, on a 12-hour clock. Every date a person sees is the day, the month name, and the year.

## Still for the hall to decide

These are stored as settings so the hall can set them later without reshaping the records.

| What the hall sets | Until the hall decides | Why it is open |
|---|---|---|
| How long a second scan is ignored | 45 seconds | A second scan in this gap must not undo the movement. A later scan of a resident who is outside records the return. |
| How early a permission may be used | 30 minutes before the stated departure | How early a resident may scan out on an approved permission. |

Sign-in uses the enrolment number (resident) or a hall-issued username (staff), and a password. Residents may self-onboard; the selected block and room are kept and the account is active for sign-in immediately. Staff accounts are office-created only. There is no parent or guardian login.

## How a value is kept and how it is shown

Each field below names what is kept, whether it is required, and where the value comes from. "Required" means the record is not valid without it. Some fields become required at a later step. They are empty only because that step has not happened yet.

People always see India time and a 12-hour clock. A stored instant of `2026-09-18T13:30:00Z` is shown as 18 September 2026, 7:00 PM. A single-digit hour is not padded. Minutes are always two digits. Midnight is 12:00 AM. Noon is 12:00 PM.

| What is kept | Kept as | Shown to people as |
|---|---|---|
| Identifier | A system-chosen id. People do not invent ids. | The name of the record, not the id. |
| Text | The words the person typed, unchanged. | Those words. |
| Choice | One of a fixed set named in the field. | That choice, in the words this document uses. |
| Whole number | A whole number inside the range named in the field. | That number. |
| Yes or no | Yes or no. | Yes or no. |
| Date | `YYYY-MM-DD`. A hall calendar date, not a clock time. 18 September 2026 is kept as `2026-09-18`. | Day, full month name, year. `2026-09-18` is shown as 18 September 2026. The day is two digits, so the 5th is 05 September 2026. |
| Instant | Universal time, `YYYY-MM-DDTHH:MM:SSZ`. If someone sends a time with an offset, it is converted to this form before it is kept, and this form is what comes back. | India time, 12-hour clock, with the date when the date matters. |
| Time of day | `HH:MM` from 00:00 through 23:59, hall local, with no date. A time such as 24:30 is refused. This form is unambiguous in storage. | 12-hour clock with AM or PM. `06:30` is shown as 6:30 AM. `18:30` is shown as 6:30 PM. The hall enters the 12-hour form. |
| Month and day | `MM-DD`, with no year. 1 April is `04-01`. 1 October is `10-01`. | Day and month name, such as 01 April. |
| Phone | Country code included, `+` then digits, no spaces. India is `+91`, for example `+919876543210`. A number without a country code is refused. | The same value. |
| Protected value | A one-way protection of a secret. The secret itself is never kept and never written to the audit log. | Nothing. The secret is never shown back. |

A password chosen on self-onboard, changed by the account, or set by the provost is at least 10 characters and includes an uppercase letter, a lowercase letter, a number, and a symbol. It is kept as an Argon2id protected value. Argon2id is the password form OWASP recommends for a new system. It is built so that guessing many passwords is slow and needs a large amount of memory, which makes a stolen file of passwords harder to attack than older forms. bcrypt and scrypt remain acceptable. They are not stronger than Argon2id. The password the person typed is never stored.

Other writing rules:

- A record that points at another record may point only at one that exists. A room belongs to a real block. A resident belongs to a real room. A permission belongs to a real resident.
- Outings, permissions, guest stays, guardian messages, and the audit log are never deleted. They change state, or, for the audit log, they are only added. A block, room, or destination that the hall retires is marked inactive, so older records can still show its name.
- The time a record was last changed is set whenever it changes.
- Usernames and enrolment numbers ignore capitals. `24-gllb-118` and `24-GLLB-118` are the same person. The spelling the hall typed is the spelling that is shown.
- The hall pass text is `bsj:v1:` followed by a long random code. That code is not the enrolment number and not a web address. It is long enough that it cannot be guessed.
- Anything a person types is saved as the value of a field. It is never used to change the shape of the records.
- A resident's presence is inside or outside the hall. It is not whether she is signed in to the app. It is remembered on the resident so the register can count who is inside without opening every outing. It changes at the same moment as the outing. She is outside exactly when she has an outing that is currently outside. Otherwise she is inside. A new resident is inside.

## How the records connect

- A person has one role. A resident has a resident profile and no staff profile. A staff account has a staff profile and no resident profile.
- A block contains rooms. A resident is assigned to one room. The room's block is that resident's block.
- A resident requests permissions. A permission can authorise one outing when the resident actually leaves.
- An ordinary outing may name a destination from the hall's list.
- A resident hosts guest stays.
- An outing can produce at most one late notice and one return notice.
- A signed-in phone keeps one session record for that sign-in.
- Actions people take are written to the audit log.

## Hall settings

There is one settings record for the hall.

Ordinary outing hours are the window in which an ordinary outing may start and in which its expected return must fall. The window has a start and an end. Summer and winter each have their own window. There is no separate limit on how many hours an ordinary outing may last. If the resident needs to be out after the end of the window, she asks for late-night permission. If she needs to stay away overnight, she asks for home going.

The clock times below are the hall's published times. SOP 06 and SOP 07 both say summer is 6:30 AM to 6:30 PM and winter is 6:30 AM to 5:30 PM. SOP 05 prints 5:30 AM as the start. This record follows SOP 06 and SOP 07, which agree with each other.

The season is a date. Summer starts on 1 April and winter starts on 1 October. AMU University Health Services uses that split for its own seasonal hours: evening OPD is 5:00 PM to 6:00 PM from 1 April to 30 September, and 4:00 PM to 5:00 PM from 1 October to 31 March. The hall's outing SOP names summer and winter and does not name the dates, so this record uses the university's published split. A hall date from 1 April through 30 September uses the summer window. A hall date from 1 October through 31 March uses the winter window. On 30 September 2026 an ordinary outing uses 6:30 AM to 6:30 PM. On 1 October 2026 it uses 6:30 AM to 5:30 PM. The provost can correct a clock time or a start date if the hall publishes a different one. The correction does not rewrite an outing that is already open.

| Detail | Kept as | Required | Where it comes from | Rule |
|---|---|---|---|---|
| id | Identifier | Yes | System | Always `hall`. There is only one. |
| hall_name | Text | Yes | Set with the record | Begum Sultan Jahan Hall. |
| university_name | Text | Yes | Set with the record | Aligarh Muslim University. |
| timezone | Text | Yes | Set with the record | `Asia/Kolkata`. |
| grace_minutes | Whole number | Yes | The hall confirmed 30. The provost can change it later. | Minutes after the expected return before a guardian can be told. Taken when the outing is created. A later change does not rewrite an outing already open. Whole minutes from 0 to 180. |
| summer_outing_start | Time of day | Yes | SOP 06 and SOP 07 | Shown as 6:30 AM. Kept as `06:30`. |
| summer_outing_end | Time of day | Yes | SOP 06 and SOP 07 | Shown as 6:30 PM. Kept as `18:30`. The end is after the start. |
| winter_outing_start | Time of day | Yes | SOP 06 and SOP 07 | Shown as 6:30 AM. Kept as `06:30`. |
| winter_outing_end | Time of day | Yes | SOP 06 and SOP 07 | Shown as 5:30 PM. Kept as `17:30`. The end is after the start. |
| summer_season_start | Month and day | Yes | AMU University Health Services | 1 April. Kept as `04-01`. Summer runs from this day through the day before winter starts. |
| winter_season_start | Month and day | Yes | AMU University Health Services | 1 October. Kept as `10-01`. Winter runs from this day through the day before summer starts, across the new year. |
| permission_lead_minutes | Whole number | Yes | Still open. Default 30. | Minutes before a permission's start when a resident may leave. Whole minutes from 0 to 180. |
| guest_max_inclusive_days | Whole number | Yes | The hall confirmed 7. | Longest guest stay, counting the first and last day. Whole days from 1 to 30. |
| guest_min_lead_days | Whole number | Yes | The hall confirmed 1. | How many hall days must pass before a guest stay may start. Whole days from 0 to 14. Today cannot be the start date. |
| scan_duplicate_window_seconds | Whole number | Yes | Still open. Default 45. | How long a second scan of the same resident is ignored. Whole seconds from 0 to 600. |
| late_sms_template | Text | Yes | The message below | Late guardian SMS template. Stored on this settings row; read and updated only through GET/PATCH `/api/v1/admin/notifications` (not hall settings). |
| return_sms_template | Text | Yes | The message below | Return guardian SMS template. Stored on this settings row; read and updated only through GET/PATCH `/api/v1/admin/notifications` (not hall settings). |
| updated_at | Instant | Yes | System, whenever these settings change | Shown in the 12-hour form. Updated when either hall settings or notification templates change. |

Late message:

> {resident_name} ({room}) was expected to return to {hall_name} by {expected_return_local} and has not yet returned. Please contact the Hall Office if you need to speak to the duty warden.

Return message:

> {resident_name} ({room}) has returned to {hall_name} at {returned_at_local}. Thank you.

The time blanks are filled in the 12-hour form, for example 7:00 PM. A date in those blanks is the day, the month name, and the year, for example 18 September 2026, 7:00 PM. `{room}` is the room label, such as `B-204`.

## Places

### Blocks

The hall page names five places and how many rooms each has. The records start as this inventory. The page gives Block-A, Block-B, Block-C, and Block-D a letter. It gives Utility no letter, so the code is the published name. A, B, C, and D have four floors. The page does not say how many floors Utility has.

| Code | Name | Floors | Rooms | Beds in each room |
|---|---|---|---|---|
| A | Block-A | 4 | 50 | 2 |
| B | Block-B | 4 | 58 | 2 |
| C | Block-C | 4 | 42 | 2 |
| D | Block-D | 4 | 40 | 2 |
| Utility | Utility | Not on the page | 16 | 2 |

That is 206 rooms and 412 beds. The session 2025–26 roll of 506 resident students is a separate figure on the same page. This inventory does not grow to 506 rooms.

| Detail | Kept as | Required | Where it comes from | Rule |
|---|---|---|---|---|
| id | Identifier | Yes | System | Identifies this block. |
| code | Text | Yes | The hall page, then the provost if the hall renames it | Short code used in room labels. No two blocks share a code. |
| name | Text | Yes | The hall page, then the provost if the hall renames it | Such as `Block-A` or `Utility`. |
| floors | Whole number | Yes for A, B, C, and D. Empty for Utility until the hall publishes it. | The hall page | A, B, C, and D start at 4. |
| room_count | Whole number | Yes | The hall page, then the provost if the published inventory changes | How many rooms this block has. Starts at the counts in the table above. The rooms on file for this block must match this number once the inventory is entered. |
| beds_per_room | Whole number | Yes | The hall page, "Capacity of Room: 02" | Starts at 2. |
| is_active | Yes or no | Yes | Provost | Yes while the hall uses this block. No when it is retired. HTTP `status` is `active` or `inactive`. |

### Rooms

The hall page publishes how many rooms each block has, but not the painted door numbers. For resident blocks A, B, C, and D the service seeds door numbers `1` through that block's published room count (labels such as `A-1` and `B-58`) so self-onboard can offer real room rows. Utility keeps no rooms until the provost enters them. The provost may still add, rename, or retire rooms; a door number is kept as written, so a leading zero is not lost.

| Detail | Kept as | Required | Where it comes from | Rule |
|---|---|---|---|---|
| id | Identifier | Yes | System | Identifies this room. |
| block_id | Identifier | Yes | The block the provost is adding the room to | The block this room belongs to. |
| number | Text | Yes | Seeded as `1` through the published count for A–D; otherwise the provost, from the door | Such as `1`, `58`, `204`, or `087`. |
| label | Text | Yes | System, from the block code, a hyphen, and the number | Such as `B-204` or `Utility-12`. No two rooms share a label. |
| bed_count | Whole number | Yes | Copied from the block's beds per room when the room is created | How many residents this room can hold. Starts at 2. |
| is_active | Yes or no | Yes | Provost | Yes while the room can be assigned. No when it is retired. HTTP `status` is `active` or `inactive`. |

A block cannot contain the same room number twice. Every active resident points at an active room; the room's block is the resident's block. The number of active residents assigned to a room, including a suspended resident who has not been moved, cannot be more than that room's bed count. Changing rooms updates the resident and writes an audit log entry. Past outings keep the place and the resident. They do not keep a copy of the old room. The register shows the room the resident has now.

### Destinations

The list behind the ordinary-outing choices. The screen shows the active named places in alphabetical order, ignoring capitals, and always shows the free-text choice last. Nothing is stored to force a custom order.

| Detail | Kept as | Required | Where it comes from | Rule |
|---|---|---|---|---|
| id | Identifier | Yes | System | Identifies this destination. |
| name | Text | Yes | Provost. The first list is below. | Unique. Named places are compared in alphabetical order for display, ignoring capitals. The free-text choice is shown last. |
| is_other | Yes or no | Yes | Provost | Yes for the single free-text choice. No for a named place. HTTP `source` is `custom` or `preset`. |
| is_active | Yes or no | Yes | Provost | Yes while it can be chosen. No when it is retired. HTTP `status` is `active` or `inactive`. |

The first list is created with the records. The provost can add, rename, or retire entries afterwards. Shown A to Z, with the free-text choice last, the first list reads:

| Name | Free text |
|---|---|
| J.N. Medical College | No |
| Maulana Azad Library | No |
| Shamshad Market | No |
| Women's College | No |
| Other | Yes |

At most one active destination is the free-text choice.

## Accounts

### People

| Detail | Kept as | Required | Where it comes from | Rule |
|---|---|---|---|---|
| id | Identifier | Yes | System | Identifies this person. |
| role | Choice | Yes | Provost for staff and office-created residents. System sets resident on self-onboard. | One of resident, gate, warden, provost. What the person may do comes from this role. The table is under Who can do what. |
| username | Text | Yes | Provost for staff and office-created residents. Self-onboard uses the enrolment number. | Unique, ignoring capitals. |
| full_name | Text | Yes | Provost, or the resident on self-onboard | The name people see. |
| password_hash | Protected value | Yes | System, from the password she chooses on self-onboard, or the temporary password the provost sets, using Argon2id | Never the password itself. |
| status | Choice | Yes | Self-onboard and office-created residents and staff start **active**. The provost may suspend or reinstate. | Active or suspended. |
| created_at | Instant | Yes | System | When the account was created. |
| updated_at | Instant | Yes | System | When the account last changed. |
| last_login_at | Instant | Empty until the first sign-in | System, at each successful sign-in | When this person last signed in. |

A suspended person cannot sign in and cannot be scanned out or in. The account stays.

### Residents

A resident profile exists only for a person whose role is resident. It uses that person's id. The enrolment number is the same as the username. Enrolment uniqueness is hall-wide (ignoring capitals), whether the row came from self-onboard or the office.

The guardian is the parent or other guardian the hall can reach. Both the name and the phone are required. On self-onboard the resident types them. On office create the provost enters them from the hall's record. The provost can correct them later on either path.

The resident's own phone is separate from the guardian phone. Self-onboard and office create require it. The resident supplies it on self-onboard; the provost supplies it on office create. It uses the same country-code form as the guardian phone. Late and return messages still go only to the guardian phone.

| Detail | Kept as | Required | Where it comes from | Rule |
|---|---|---|---|---|
| user_id | Identifier | Yes | The person's id | One profile for that person. |
| enrolment_number | Text | Yes | Self-onboard, or provost. Same value as the username. | Unique, ignoring capitals. Shown on the warden record, for example `24-GLLB-118`. |
| course | Text | Empty if not entered | Self-onboard (optional) or provost | For example `B.A. LL.B. (Hons.)`. |
| room_id | Identifier | Yes for an active resident. | Resident on self-onboard, or provost | The room the resident lives in. It must be active; its block is the resident's block. |
| phone | Phone | Yes on self-onboard and office create. | Self-onboard, or provost | The resident's own number. Country code required. Not used for guardian late or return messages. |
| guardian_name | Text | Yes | Self-onboard, or provost from the hall's record | The person the hall contacts about this resident. |
| guardian_phone | Phone | Yes | Self-onboard, or provost from that same record | Country code required. Late and return messages go to this number. |
| qr_token | Text | Yes when active. | System, when the account is created active (including self-onboard and office create), and again when the provost issues a new hall pass | The hall-pass code. Unique. |
| presence | Choice | Yes | System. Starts as inside. Changes when a gate scan records an exit or a return. | Inside or outside. This is presence in the hall, not sign-in. |
| created_at | Instant | Yes | System | When the profile was created. |
| updated_at | Instant | Yes | System | When it last changed. |

The hall pass code stays the same from outing to outing. It changes only when the provost issues a new one. The resident phone returns that code on her hall pass only while an outing's show window is open. The provost does that on the resident's record, for example after a lost phone or because someone else has seen the code. The provost does not type the new code. The system makes a new random code, puts it in place of the old one at that moment, and writes an audit log entry. The old code stops working immediately. The resident's phone shows the new code the next time it loads the pass.

### Staff

A staff profile exists only for gate, warden, or provost. The role on the person is what limits the account. Gate staff scan. A warden or the provost approves. The provost also keeps the hall's records. The job title is the name of the post, such as Gatekeeper, Resident warden, Non-resident warden, or Provost. It does not grant extra actions.

| Detail | Kept as | Required | Where it comes from | Rule |
|---|---|---|---|---|
| user_id | Identifier | Yes | The person's id | One profile for that person. |
| job_title | Text | Yes | Provost | The name of the post. |

### Signed-in session

This record is what lets a phone stay signed in. The person signs in with a username and password. The password is not kept on the phone. The phone is given a short pass that lasts 15 minutes, and that short pass is not stored. This record keeps a protected form of a longer session secret so the phone can get a new short pass without asking for the password again. The session lasts 30 days. It stops being usable when the person signs out, when a password is changed or reset, or when the account is suspended. Those two durations are part of the agreement in the API document.

| Detail | Kept as | Required | Where it comes from | Rule |
|---|---|---|---|---|
| id | Identifier | Yes | System | Identifies this sign-in. |
| user_id | Identifier | Yes | The person who signed in | The person. |
| token_hash | Protected value | Yes | System, from the session secret | The secret itself is not stored. No two rows share this value. |
| expires_at | Instant | Yes | System, 30 days after sign-in | When this sign-in stops being usable. |
| revoked_at | Instant | Empty while the sign-in is still usable | System, when the person signs out, a password changes, a password is reset, or the account is suspended | Set at that moment. |
| created_at | Instant | Yes | System | When it was created. |

## Permissions

A permission is the warden's or the provost's decision. It is not itself the moment of leaving. The leaving is an outing.

| Detail | Kept as | Required | Where it comes from | Rule |
|---|---|---|---|---|
| id | Identifier | Yes | System | Identifies this permission. |
| resident_id | Identifier | Yes | The signed-in resident | The resident who asked. |
| type | Choice | Yes | The form the resident chose | Late-night, or home going. HTTP name is `permission_type`. |
| status | Choice | Yes | System, as the lifecycle moves | See the lifecycle below. |
| short_place | Text | Yes | The resident types it on the permission form | The short place the warden's card shows, such as Women's College or Lucknow. It is not chosen from the ordinary destination list. |
| destination_detail | Text | Empty for home going. For late-night it may be empty. | The resident types it on the late-night form | A further detail, such as Seminar Hall. |
| address | Text | Yes for home going. Empty for late-night. | The resident types it on the home-going form | The home address. It must not be blank for home going. |
| reason | Text | Yes | The resident types it | Both forms require it. |
| departure_at | Instant | Yes | The resident sets it | When she plans to leave. Must not be in the past when she submits (a few minutes of clock skew are allowed). There is no maximum how far ahead it may be. Late-night is a clock. Home going is a hall date, stored as the start of that day, or the current time when that day is today. |
| expected_return_at | Instant | Yes | The resident sets it | Must be later than the departure. Late-night is a clock. Home going is a hall date, stored as the end of that day. |
| decided_by | Identifier | Empty while waiting, and empty if the resident cancels before a decision | The warden or provost who approves or rejects | Required once that decision is recorded. |
| decided_at | Instant | Empty in the same cases as decided_by | System, at the decision | Required once the decision is recorded. |
| decision_note | Text | Empty if they write nothing | The warden or provost may type it when deciding | Optional. |
| created_at | Instant | Yes | System, when the resident asks | When the request was made. |
| updated_at | Instant | Yes | System | When it last changed. |

The short place lets the warden's card read "Home going · Lucknow" without opening the street address. The home-going form asks for the city, the home address, the reason, the leave date, and the return date. She does not set a clock. The late-night form asks for the short place, the reason, the departure, and the return. A late-night return is the same hall day as the departure. The only later instant is 12:00 AM on the next hall day. While a permission is pending, she may replace those details. It stays pending. Once it is approved, she can no longer change it.

### Permission lifecycle

- Waiting: the warden or provost has not decided.
- Approved: the resident may leave during the use window. No outing has been opened from it yet.
- In use: an outing was opened from this permission and the resident has not returned.
- Completed: that outing was returned.
- Rejected, cancelled, and expired: finished. They do not start again.

From waiting, the warden or provost can reject it, or the resident can cancel it. From approved, the resident can cancel it before leaving. An approved permission whose expected return has passed, and which the resident never used, becomes expired. That check runs on write paths (plan, submit, cancel, decision, gate scan) and on the explicit expire-passed posts (`POST /api/v1/me/expire-passed` for the resident's own plans and permissions; `POST /api/v1/permissions/expire-passed` for staff across the hall). GET routes do not write expiry. Guardian-message sends also consider expiry. Once expired it no longer counts as waiting or approved, and the gate cannot open an outing from it.

The use window runs from the departure minus the early-leave setting, through the expected return. The gate can open an outing from the permission only inside that window.

A resident may hold more than one permission. She may also plan several future ordinary outings, including more than one return on the same hall day. She cannot plan another while one ordinary outing is inside its show window (30 minutes before its start until that outing ends, including while she is outside on it). She may not be outside on two outings, and she may not have two planned or outside outings that end at the same instant. Planning or scanning resolves that, under Outings.

## Resident notifications

A row is written when a warden or the provost approves or rejects a permission. One decision, one row. Nothing else writes this list. The resident reads her own rows, newest first, at most 50. Each row includes the permission's short place, kind, departure, expected return, and the decider's name. The phone sentence is in `docs/design/notifications.md`. Opening that list does not mark them read. She marks every unread row read with one call.

| Detail | Kept as | Required | Where it comes from | Rule |
|---|---|---|---|---|
| id | Identifier | Yes | System | Identifies this notice. |
| resident_id | Identifier | Yes | The permission | The resident the decision is for. |
| permission_id | Identifier | Yes | The permission | One row per permission. A second decision on the same permission is not stored. |
| decision | Choice | Yes | The warden or provost | Approved or rejected. |
| created_at | Instant | Yes | System, at the decision | When the row was written. The same instant as `decided_at`. |
| read_at | Instant | Empty until she marks them read | System, when she marks her inbox read | Set on every unread row for her at that moment. |

## Outings

Ordinary, late-night, and home going are kept as one outing record. The outing type says which it is. The gate, the register, lateness, and the message to the guardian all follow that one record. A resident may have several planned ordinary outings, including a morning return and an afternoon return on the same hall day. She has at most one outing that is outside, and at most one planned or outside outing for a given expected return.

An exit is not a finished fact until it has a time and the staff member who recorded it. A return is not a finished fact until it has a time and the staff member who recorded it. Those fields are empty only before that step. A planned ordinary outing is the only outing that exists before an exit.

| Detail | Kept as | Required | Where it comes from | Rule |
|---|---|---|---|---|
| id | Identifier | Yes | System | Identifies this outing. |
| resident_id | Identifier | Yes | The resident | The resident. |
| permission_id | Identifier | Empty for an ordinary outing. Yes for late-night and home going. | The approved permission the scan uses | The permission's stored `type` must match the outing's stored `type`. HTTP names are `permission_type` and `outing_type`. |
| type | Choice | Yes | Ordinary, from the resident's plan. Late-night or home going, from the permission. | Ordinary, late-night, or home going. HTTP name is `outing_type`. |
| status | Choice | Yes | System | Planned, outside, returned, or cancelled. |
| destination_id | Identifier | Empty when the place is not from the list | The list entry the resident chose | For an ordinary outing chosen from the list. Empty for Other, and empty for a permission outing. |
| place | Text | Yes | The list name, the words the resident typed for Other, or the permission's short place | The place as it should be remembered. Renaming the list later does not change this. |
| starts_at | Instant | Empty for a permission outing and for an ordinary outing saved before this column. Yes for a new ordinary plan. | The resident, before she leaves | When she said she would leave. Same hall day as the expected return, inside that day's ordinary hours. |
| expected_return_at | Instant | Yes | The resident, before she leaves | When she said she would be back. |
| hall_date | Date | Yes | System, from the expected return | The hall day of that return, in Asia/Kolkata. Several planned outings may share this day. The gate uses it so a later day's plan is not taken today. |
| grace_ends_at | Instant | Yes | System, from the expected return plus the grace minutes in force when the outing was created | A later change to grace does not rewrite this. |
| exited_at | Instant | Yes from the moment she has left. Empty only while an ordinary outing is still planned. | The gate scan that records the exit | A permission outing is created already outside, so this is set at creation. |
| exit_recorded_by | Identifier | Yes whenever exited_at is set. Empty only while exited_at is empty. | The signed-in gate, warden, or provost who scanned | The staff member who recorded the exit. |
| returned_at | Instant | Yes from the moment she has returned. Empty before that. | The gate scan that records the return | At or after the exit. |
| return_recorded_by | Identifier | Yes whenever returned_at is set. Empty only while returned_at is empty. | The signed-in gate, warden, or provost who scanned | The staff member who recorded the return. |
| created_at | Instant | Yes | System | When the outing was created. |
| updated_at | Instant | Yes | System | When it last changed. |
| cancelled_at | Instant | Yes when the status is cancelled. Empty otherwise. | System, when the resident cancels a plan, or when a planned ordinary outing passes its expected return unused | A cancelled outing has no exit and no return. |

The status and the times agree:

- Planned: no exit, no return, and not cancelled. Only an ordinary outing can be planned.
- Outside: exit time and exit staff member recorded, no return, and not cancelled.
- Returned: exit and return each have a time and a staff member, the return is at or after the exit, and the outing is not cancelled.
- Cancelled: cancelled time set, and no exit or return.

A resident has at most one outing that is outside, and at most one planned or outside outing for one expected return.

### Ordinary outing

Created when the resident confirms a destination, a start, and an expected return. Other future plans may already exist, including another return on that same hall day, as long as none of them is inside its show window. Planning does not change whether she is inside or outside. This is the step before the gate. The scan cannot invent the destination, the start, or the expected return. No warden approval.

The start and the expected return must both be in the future at the moment she confirms them, the return after the start, and both on the same hall day. Each must fall after that day's ordinary-hours start and at or before that day's ordinary-hours end. The season is the one that contains that hall date. If either time would be outside that window, the plan is refused and she asks for late-night permission or home going instead. If one ordinary outing is already inside its show window, the plan is refused. The show window opens 30 minutes before `starts_at`. When `starts_at` is within 5 minutes, that lead has already opened, so the hall-pass QR is shown immediately. A planned outing's window ends at the expected return. An outside ordinary outing's window stays open until the return scan. If she already has a planned or outside outing ending at that same instant, the plan is refused. After that outing is cancelled or returned, she may plan that instant again.

The outing stays planned until the gate scans the hall pass. She may change or cancel one planned outing by choosing it, until that outing's show window opens. Once the window is open, or she is outside on it, she cannot change or cancel it here. Her other plans stay planned, and she can still change one whose window is shut. Changing a plan stores the new destination, start, and expected return, and recalculates grace from that return. If the expected return passes and she has not been scanned out, the system cancels that plan only, and writes an audit log entry with no staff member.

### Leaving on a permission

Approving a permission does not create an outing. A home-going permission for next week must not block an ordinary outing today.

When the resident is inside and the gate scans the pass:

1. If this resident was just scanned inside the ignore window, refuse. Do not undo the last movement.
2. If one or more ordinary outings are planned for today's hall date, and at least one of those expected returns has not passed, record the exit on the earliest of those returns, including the time and the staff member, provided the current time is inside today's ordinary-hours window. Leave every later plan for today planned. Leave a plan for another hall day planned. Do not use a later day's plan today. Do not attach a permission.
3. Otherwise, if an approved permission is inside its use window, open the outing already outside, link the permission, copy its short place onto the outing, record the exit time and the staff member, mark the permission in use, and mark the resident outside. If several permissions match, use the one with the earliest departure.
4. Otherwise refuse. She has not set a destination and an expected return, or the current time is outside ordinary hours, or the permission is not yet valid, or it is still waiting.

If a planned ordinary outing for today would be used and she meant a later trip today, or a permission, she cancels that plan in the app and shows the hall pass again. The gate does not choose for her. Her other plans stay planned. A scan while she is outside records the return on the outing she is already on. It does not start the next plan.

### Return

When the resident is outside, the ignore window has passed, and the gate scans the pass: mark the open outing returned, record the return time and the staff member who scanned, mark the resident inside, and if a permission is linked mark it completed.

The gate fills in nothing else.

### Late

A resident is late when her outing is outside and the current time is after grace. Late is worked out when someone looks. It is not stored as its own state.

The late list is that set. A row on the register reads inside, outside, or late.

## Guest stays

Guests are not accounts and have no hall pass.

| Detail | Kept as | Required | Where it comes from | Rule |
|---|---|---|---|---|
| id | Identifier | Yes | System | Identifies this stay. |
| host_resident_id | Identifier | Yes | The signed-in resident | The resident who applied. |
| guest_name | Text | Yes | The resident types it | The guest's name. |
| relation | Text | Yes | The resident types it | Such as Cousin. |
| guest_start_date | Date | Yes | The resident sets it | First day, included. Shown as 18 September 2026. |
| guest_end_date | Date | Yes | The resident sets it | Last day, included. On or after the start date. |
| reason | Text | Yes | The resident types it | Why the guest is coming. |
| status | Choice | Yes | System | Waiting, approved, rejected, cancelled, or departed. |
| payment_status | Choice | Yes | System starts it as unpaid. A warden or the provost marks it paid. | Unpaid or paid. |
| payment_marked_by | Identifier | Yes when paid. Empty when unpaid. | The warden or provost who marked it | Required together with the time when the stay is paid. |
| payment_marked_at | Instant | Yes when paid. Empty when unpaid. | System, when payment is marked | |
| payment_note | Text | Yes when paid. Empty when unpaid. | The warden or provost types it when marking paid | Off-system payment proof (transaction reference, who collected cash, screenshot mention, and similar). At most 500 characters. Cleared when marked unpaid. |
| payment_evidence_path | Text | Empty when no file. | System, relative path under the hall payment-evidence directory | Optional receipt file (JPEG, PNG, or PDF). Never required to mark paid. Cleared when payment is marked unpaid, or when staff clear evidence. |
| payment_evidence_original_name | Text | Empty when no file. | The original client filename | For display only. Empty together with the path. |
| payment_evidence_content_type | Text | Empty when no file. | System, from the allowlist | `image/jpeg`, `image/png`, or `application/pdf`. |
| payment_evidence_uploaded_at | Instant | Empty when no file. | System, when the file is stored | |
| payment_evidence_uploaded_by | Identifier | Empty when no file. | The warden or provost who uploaded it | Required together with the path when evidence exists. |
| decided_by | Identifier | Empty while waiting, and empty if the resident cancels. Yes once approved or rejected. | The warden or provost who decided | The audit of the decision. A waiting stay has no decision yet. A resident edit is allowed only while waiting and before arrival, and it leaves this field empty. |
| decided_at | Instant | Empty in the same cases as decided_by. Yes once approved or rejected. | System, at the decision | |
| decision_note | Text | Empty if they write nothing | The warden or provost may type it | Optional. |
| arrived_at | Instant | Yes once arrival is recorded. Empty before that. | The gate scan, or the gate, warden, or provost recording the arrival | |
| arrived_recorded_by | Identifier | Yes whenever arrived_at is set | The staff member who recorded the arrival | |
| departed_at | Instant | Yes once departure is recorded. Empty before that. | The staff member's record of departure | At or after arrival. |
| departed_recorded_by | Identifier | Yes whenever departed_at is set | The staff member who recorded the departure | |
| created_at | Instant | Yes | System | When the resident applied. |
| updated_at | Instant | Yes | System | When it last changed. |

The length of the stay counts the start date and the end date. It must be at least 1 day and at most the hall's maximum. Before arrival, the start date must be at least the lead time after today's hall date. With the confirmed defaults, a new stay starts tomorrow or later, and the stay is at most 7 days. A resident edit uses the same lead time, because an edit is allowed only before arrival.

The state and the times agree:

- Waiting: no decision and no departure. Arrival is usually empty. The resident may edit only when arrival is also empty.
- Rejected and cancelled: no arrival and no departure. Rejected has a decision and a staff member. Cancelled by the resident has neither.
- Approved: a decision and a staff member are recorded, and the guest has not departed. Arrival may still be empty, or already recorded.
- Departed: arrival and departure are both recorded, each with a staff member, and departure is at or after arrival. The decision may be empty when departure was recorded while the stay was still waiting and the guest had already arrived.

### Guest lifecycle

- From waiting, before arrival, the resident may edit name, relation, dates, and reason. The stay stays waiting and the decision stays empty. The warden or provost may approve or reject, or the resident may cancel.
- An approved stay cannot be edited. Before arrival the resident may still cancel it.
- After arrival the resident cannot edit the stay, whether it is waiting or approved, and cannot cancel it.
- Approved is the stay that can be in the hall. Arrival is a time on that stay, not a new state.
- Departure moves an approved stay to departed. Gate may also record departure while a stay is waiting and the guest has already arrived, so the guest is not trapped in the hall. That departure leaves the decision empty.

Payment is a separate act by a warden or the provost. It can be marked before or after approval, and not after departure. Marking it unpaid again is allowed only before arrival. Marking it paid requires a payment note (off-system proof) and does not require a file. Marking it unpaid clears the payment staff member, the payment time, the payment note, and any optional payment evidence file. Optional payment evidence (a JPEG, PNG, or PDF under 5 MiB) may be uploaded before or after marking paid, while the stay is still pending or approved and the guest has not arrived. Uploading evidence never marks the stay paid and is never required to mark paid. Clearing evidence leaves payment_status unchanged.

Arrival is allowed only when the stay is approved, payment is paid, arrival is still empty, and today's hall date falls on the start date, the end date, or a day between them.

Departure is allowed when the guest has arrived, departure is still empty, and the stay is approved or waiting. The stay then becomes departed. A departure while the stay is still waiting leaves the decision empty.

### Guest lists

These are worked out when someone looks. They are not stored.

| List | Who is on it |
|---|---|
| Waiting | The stay is waiting. |
| Upcoming | Approved, not yet arrived, and today's hall date is before the start date. |
| Expected today | Approved, paid, not yet arrived, and today's hall date is within the stay. |
| Not expected | Approved, not yet arrived, and not Upcoming and not Expected today. |
| In the hall | Approved, arrived, not departed, and today's hall date is on or before the end date. |
| Should have left | Approved, arrived, not departed, and today's hall date is after the end date. |
| Departed | The stay is departed. |
| Rejected or cancelled | That stored outcome. |

The dining count, guests in hall, is every stay that has arrived and has not departed. That includes guests who should have left, and a waiting stay that has already arrived. The guest stays on the dining count until the gate records departure. `GET /api/v1/gate/occupancy` returns that dining count and the should-have-left subset (arrived, not departed, and today's hall date is after the end date).

The gate's expected list is every approved stay that has not arrived and whose dates include today's hall date, whether paid or unpaid. A `payment_status` filter on that list keeps only paid or only unpaid. Arrival still requires paid, so an unpaid guest on that list cannot be recorded in until payment is marked. The gate's departure list is In the hall plus Should have left. The derived bucket Expected today, used on the staff guest-stay queue, still requires paid.

## Messages to the parent or guardian

One record per attempt. An outing gets at most one late notice and one return notice. The phone number is the guardian phone. It is copied onto the attempt so the record still shows the number that was used if the guardian phone is corrected later.

| Detail | Kept as | Required | Where it comes from | Rule |
|---|---|---|---|---|
| id | Identifier | Yes | System | Identifies this attempt. |
| outing_id | Identifier | Yes | The outing | The outing. |
| resident_id | Identifier | Yes | The resident on that outing | The resident. |
| notice_type | Choice | Yes | System | Late notice, or return notice. |
| recipient_phone | Phone | Yes | Copied from the resident's guardian phone at the time of the attempt | Country code included. |
| body | Text | Yes | System, from the hall's message and this outing | The message as it was filled in. Times in the 12-hour form. Dates as day, month name, year. |
| driver | Choice | Yes | System, from how the hall is running | `mock` when the message is only recorded, or `dlt` when the live provider is used. |
| status | Choice | Yes | System, from the send result | Sent, or failed. |
| provider_reference | Text | Empty when the provider gives none | The provider, when the send is accepted | |
| error | Text | Empty unless the send failed | The provider or the system | Why it failed. |
| created_at | Instant | Yes | System | When the attempt was recorded. |

The check runs inside the hall's service. There is no separate queue. It runs when the register is read and when a return is scanned.

- Look at outings that are still outside, whose grace has ended, and which have no late notice yet.
- Fill in the late message and send it to the guardian phone. Record sent or failed.
- When the sender is the local stand-in, do not contact a phone network. Write the record, and write the audit log entry.
- Any environment that is not the live hall refuses to start unless the sender is the local stand-in.

When a return is scanned, if a late notice was sent and no return notice exists yet, send the return message. If the late notice failed, do not send a return message that pretends the guardian was told. An on-time return writes no message.

The warden's resident record shows the guardian name and one of: message sent, message failed, or nothing due yet.

## Audit log

This is the audit log: the record of who did what. Each entry is one action that already happened. Entries are added and then left as they are. They are not edited and not deleted. When the system does the action, such as an expiry or cancelling an unused plan, the staff member is empty.

| Detail | Kept as | Required | Where it comes from | Rule |
|---|---|---|---|---|
| id | Identifier | Yes | System | Identifies this entry. |
| occurred_at | Instant | Yes | System | When it happened. |
| actor_user_id | Identifier | Empty when the system did it | The signed-in person, when a person did it | Who did it. |
| action | Choice | Yes | System, one of the names below | A new name is added to this list in the same change that uses it. |
| entity_type | Choice | Yes | System | What the entry is about: a person, a resident, a staff profile, a room, a block, a destination, the settings, an outing, a permission, a guest stay, a guardian message, or a hall pass. |
| entity_id | Identifier | Yes | System | Which record. |
| summary | Text | Yes | System | One sentence a person can read. |
| detail | Text | Empty when nothing further is needed | System | What changed, before and after. Never a password, a sign-in secret, or a hall-pass code. |

| What happened | Recorded as |
|---|---|
| Signed in | auth.login |
| Signed out | auth.logout |
| Resident self-onboarded | auth.onboard |
| Resident created | resident.created |
| Resident updated | resident.updated |
| Resident suspended | resident.suspended |
| Resident reinstated | resident.reinstated |
| Hall pass reissued | hall_pass.reissued |
| Staff account created | staff.created |
| Staff account updated | staff.updated |
| Room created | room.created |
| Room updated | room.updated |
| Block created | block.created |
| Block updated | block.updated |
| Destination created | destination.created |
| Destination updated | destination.updated |
| Settings updated | settings.updated |
| Outing planned | outing.planned |
| Outing changed | outing.updated |
| Outing cancelled | outing.cancelled |
| Exit recorded | outing.exit |
| Return recorded | outing.return |
| Permission submitted | permission.submitted |
| Permission cancelled | permission.cancelled |
| Permission approved | permission.approved |
| Permission rejected | permission.rejected |
| Permission expired | permission.expired |
| Guest stay submitted | guest_stay.submitted |
| Guest stay cancelled | guest_stay.cancelled |
| Guest stay edited | guest_stay.edited |
| Guest stay approved | guest_stay.approved |
| Guest stay rejected | guest_stay.rejected |
| Guest payment marked | guest_stay.payment_marked |
| Guest payment evidence uploaded | guest_stay.payment_evidence_uploaded |
| Guest payment evidence cleared | guest_stay.payment_evidence_cleared |
| Guest arrived | guest_stay.arrived |
| Guest departed | guest_stay.departed |
| Late guardian message | sms.late_notice |
| Return guardian message | sms.return_notice |

## Who can do what

What a person may do comes from her or his role.

Gate staff scan a hall pass and record a guest's arrival and departure. They do not approve a permission, they do not approve a guest stay, and they do not change residents, rooms, or settings. Their screens are the scan result, recent gate activity, and the guest lists.

A warden or the provost approves or rejects a permission and a guest stay, sees the register and the late list, and marks a guest paid. The provost also creates and edits residents, creates staff, rooms, destinations, and settings, issues a new hall pass, resets a password, exports the register, and reads guardian messages and the audit log. A resident can delete her own account. A deleted account is left off the provost's resident list and off the register counts.

| Action | Resident | Gate | Warden | Provost |
|---|---|---|---|---|
| Self-onboard (active account) | Yes | | | |
| Own outing, own permission, own guest application, own hall pass, own permission-decision inbox | Yes (active only) | | | |
| Scan a hall pass, record a guest's arrival and departure | | Yes | Yes | Yes |
| Register, late list, waiting decisions, mark a guest paid, upload or clear optional payment evidence | | | Yes | Yes |
| Export the register | | | | Yes |
| Create and edit residents, create staff, rooms, blocks, destinations, and settings | | | | Yes |
| Issue a new hall pass, reset a password | | | | Yes |
| Read guardian messages and the audit log | | | | Yes |

## What the register counts

The same counts are kept for the whole hall and, separately, for each block. A resident counts in the block of the room she is assigned to now. A guest counts in the block of the host's room. A permission waiting counts in the resident's block.

| Count | Who is included |
|---|---|
| Currently inside | Active residents whose presence is inside. |
| Currently outside | Presence outside, and the open outing is not past grace. |
| Late, not yet returned | Presence outside, and grace has ended. |
| Permissions waiting | Permissions still waiting for a decision. |
| Guests in hall | Guest stays that have arrived and have not departed. |
| Should have left | The guest list of that name. |
| Guest stays waiting | Guest stays still waiting. |

The whole-hall figure is the sum of the blocks. Suspended residents stay in the account list and are left out of the inside and outside counts.

## History that is not its own list

Recent activity at the gate is not a separate record. It is the latest exits and returns, plus guest arrivals and departures, newest first.

The home screen's recent lines are still those exits and returns for that resident, newest first. Each exit and each return is its own line, and the line names the staff member who recorded that movement.

`GET /api/v1/me/history` is a different list. It is one row per ordinary outing, late-night permission, home-going permission, or guest stay that is finished or unused. An ordinary outing is included when there is no gate exit and the planned return has passed (planned leave and planned return, unused), when she cancelled it, or when the gate recorded both the exit and the return (those gate times). An exit with no return is left off, even when the planned return has passed. A future plan she has not cancelled is left off. A permission is included when she cancelled it, when it was rejected, when it was approved and the window ended without use (status `approved` or `expired`), or when it was approved and then completed (status `completed`). A guest stay is included when it was rejected or cancelled, when it was approved and the stay dates ended without an arrival, or when it departed (status `departed`). Pending permissions and guest stays, a permission she is still approved to use or is out on, a plan she has not cancelled, and a guest who is still due or still in the hall, are left off. `exit_recorded_by` and `return_recorded_by` on a history row are the staff display names from the gate exit and return when those exist on a finished ordinary outing or on a completed permission's outing; otherwise they are empty. Guest stays do not copy arrival or departure staff into those fields.

## What this version does not keep

- Emergency alerts, duty phone numbers, or a second emergency contact besides the guardian.
- Push notifications, and a notice on a staff phone. A resident keeps an inbox row when a warden or the provost approves or rejects her permission. Nothing else writes that list. Text messages to the guardian are kept above.
- A payment amount or card collection. The office marks a guest stay paid or unpaid, may type a free-text payment note, and may optionally keep a JPEG, PNG, or PDF receipt file as payment evidence. Amounts and card rails are not kept.
- Parent or guardian accounts.
- More than one outside outing, or two planned or outside outings with the same expected return.
- A second role on one person.
- A separate history of room changes. A room change is an audit log entry.
- The layout of computers. This document says what is kept, not which machine holds it.

## Indexes

Besides the unique indexes that enforce one username, one open outside outing, and one late or return notice per outing, the hall keeps these non-unique indexes so common lists stay cheap:

| Index | On | Why |
|---|---|---|
| permissions_status_created | permissions (status, created_at) | Staff permission queue filtered by status and sorted by created_at. |
| permissions_resident_created | permissions (resident_id, created_at) | A resident's own permission list. |
| guest_stays_status_arrived | guest_stays (status, arrived_at) | Staff and gate guest lists by status and arrival. |
| guest_stays_host_created | guest_stays (host_resident_id, created_at) | A resident's own guest stays. |
| audit_log_occurred_at | audit_log (occurred_at) | Provost audit log newest first. |
| sessions_user_id | sessions (user_id) | Sign-out and password change revoke every live session for that person. |
| guardian_messages_outing_id | guardian_messages (outing_id) | Register resident record looks up the late notice for the open outing. |
| resident_notifications_resident_created | resident_notifications (resident_id, created_at) | A resident's permission-decision inbox, newest first, and whether any row is unread. |
