# Guest stay roommate approval

**Date:** 2026-11-04  
**Status:** draft for review (implement after sign-off)  
**Area:** guest stays (API, database, resident phone, staff queue)

## Goal

A guest stay becomes `approved` only when every required party has said yes: the **provost**, and every **other active resident who currently shares the host’s room**. Either party’s no rejects the stay immediately. Decisions are kept as lasting records so a month later the hall can see who approved or declined.

## Non-goals

- Changing ordinary outing or late-night / home-going permission flows
- Payment, gate arrival/departure, or lead-day rules (unchanged)
- A new Home banner or a new bottom tab
- New visual language, spacing, or type scales

## Design fidelity (hard)

The resident and staff apps are already designed. This work **must not** invent a parallel look.

| Follow | Do not |
|---|---|
| `docs/design/design-system.md` tokens, type, chips, spacing | New colours, gradients, or typography |
| Permissions tab layout, `PlainRow`, `SectionHead`, hairlines | New list chrome or card nesting |
| Existing `statusTone` / `StatusPill` (permission detail, staff review) | Ad-hoc coloured text or new pill shapes |
| Notification inbox patterns (`docs/design/notifications.md`) | A second inbox |
| Sentence case, hall product terms | ALL CAPS, “Needs you”, invented status words |
| Symmetrical list rows: same padding, aside alignment, date line as today’s guest rows | One-off layouts for roommate rows |

Roommate rows use the same structure as “Your requests” guest rows. Status aside is the existing StatusPill with word **Pending** (and Approved / Rejected when those apply), coloured via current tokens (`pending` / `forest` / `danger` and their soft backgrounds).

## Rules agreed

1. **Both required, either order.** Roommate(s) and provost may decide in any order. Status stays `pending` until every required yes is recorded, then becomes `approved`.
2. **No roommate.** If the host’s room has no other active resident, only the provost is required.
3. **Either no ends it.** Roommate or provost decline → `rejected` immediately; the other party need not act.
4. **Who is a roommate.** Other **active** residents with the same `room_id` as the host **now**. Recompute from current room assignment when checking who must still decide. Past decision rows stay for audit.
5. **Host edit.** Editing a pending stay before arrival does **not** clear existing decisions.
6. **Audit.** Store industry-style **decision records** (actor, role `roommate` | `provost`, yes/no, when, optional note). Keep them so disputes later can show who said what.
7. **Push is not the only door.** Push may fail or be denied. Durable paths: bell → Notifications inbox, and Permissions → Guest stays → **Waiting for you**.

## Status model

- Parent guest stay status remains the hall-facing status: `pending` | `approved` | `rejected` | `cancelled` | … (existing lifecycle after arrival unchanged).
- `approved` means every required decision is yes (and then payment / gate rules apply as today).
- Derived “waiting on” for UI/API responses is fine; prefer deriving from decision records + current roommates over a stored field that can drift.

## Phone (resident)

### Paths to decide (roommate)

1. **Home → bell → Notifications.** New inbox sentence, friendlier tone, e.g. “Your roommate has requested a guest stay”. Quieter line: guest name, then dates (same pattern as `docs/design/notifications.md`).
2. **Permissions tab → Guest stays → section “Waiting for you”.** Above “Your requests”. Rows match existing guest `PlainRow` layout; aside is StatusPill **Pending**. Tap opens decide screen.

### Decide screen

Reuse guest stay detail patterns (back, serif title, body spacing). Host name and room as context. **Decline** / **Approve** using existing button styles (ghost / forest primary). No new sheet chrome unless the existing guest/permission detail already uses it.

### Host

Stay detail shows who has decided and who is still required (roommate and/or provost), using existing status language and pills. Apply / edit / cancel unchanged in shape.

### History

Add lasting lines when decisions land, for example:

- Roommate: “You approved {host}’s guest stay” (and decline equivalent)
- Host: “Your roommate {name} approved the guest stay” (and decline equivalent)
- Existing provost approval/rejection lines remain

Quieter line: guest name, then dates.

## Staff

- Queue shape unchanged. Detail shows roommate decision state (pending / approved / declined, name, time).
- Only the **provost** records the hall decision (as today). Wardens still read queues and mark payment.
- Provost may decide while roommate is still pending (either order). Stay is `approved` only when all required yeses exist.

## Gate

Unchanged: admit only when stay is `approved` and paid.

## Data / API (shape)

- New decision records linked to the guest stay (not only two columns that overwrite history).
- Resident routes for the roommate to list stays awaiting her and to submit approve/decline.
- Responses expose decision summary with explicit domain names (no generic `title` / `subtitle`).
- Specs to update in the same change as code: `docs/database/database.md`, `backend/openapi.yaml` → `docs/api/api.md`, `docs/design/workflows.md`, `docs/design/notifications.md`, `docs/tests/tests.md`, Postman folder Guest Stays. Follow `.grok/skills/contract-maintenance/SKILL.md` and `docs/engineering/coding-principles.md`.

## Testing intent (tonight)

- Roommate can approve via Waiting for you and via inbox; stay stays pending until provost also approves.
- Provost first, then roommate → approved.
- Either decline → rejected; gate cannot admit.
- Solo room (no roommate) → provost alone suffices.
- Roommate moves out / new roommate moves in → required set follows current room; old decisions remain readable.
- Host edit does not wipe decisions.
- Status pills and list spacing match existing Permissions guest rows.
- History shows roommate and host decision lines.

## Out of scope for this slice

- Changing `guest_min_lead_days` or max inclusive days
- Roommate override by provost after decline
- Clearing decisions on host edit (explicitly not wanted)
