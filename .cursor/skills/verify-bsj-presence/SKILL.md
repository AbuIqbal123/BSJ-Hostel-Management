---
name: verify-bsj-presence
description: >-
  Formally check Begum Sultan Jahan Hall presence vs outing status (one resident,
  gate movements, ignore window) with TLA+/TLC. Use when changing gate scan,
  outing status, or presence fields, or when a bug could leave presence and
  outing disagree. Not a substitute for HTTP verify-bsj-hall or pytest.
---

# Formal verify: presence ↔ outing

**Property (plain):** A resident is marked outside if and only if she has an outing whose status is outside. A successful exit/return flips both together; a scan inside the ignore window moves nothing.

**Harm if broken:** Register counts lie; a second immediate scan can undo a leave; return scans attach to the wrong story.

**Tool:** TLA+ model checker TLC (`tla2tools.jar` v1.8.0). Chosen because the bug is bad interleaving of states (presence, outing, ignore window), not a single function’s numeric domain.

## When to run

If the change touches any of:

- `backend/app/staff/gate/` (scan handling)
- Outing status transitions (`planned` / `outside` / `returned` / `cancelled`) that gate or register reads
- Resident `presence` updates

Then run this check before claiming the change is safe. Read results with pstack `/statechart` (do not copy `/statechart` CLI flags into this skill — they change).

## Sync record

| Field | Value |
|---|---|
| Model | `.cursor/skills/verify-bsj-presence/formal/Presence.tla` |
| Config | `Presence.cfg` |
| Last confirmed commit | `4f54c993b9eb84a107cc229e0a4a40da0429d235` |
| Covered product rules | `docs/database/database.md` — presence matches outside outing; ignore window must not undo movement; at most one outside outing (single-outing abstraction) |

Move the sync commit forward only after you confirm the model still describes the code at the new commit.

## How to run

```bash
.cursor/skills/verify-bsj-presence/formal/run-tlc.sh
```

Expect: `Model checking completed. No error has been found.` (8 distinct states in the current model).

If TLC reports an invariant violation, treat it as a finding: narrate the counterexample as gate/plan/scan steps in hall words. Do not weaken the invariant to make TLC green unless the product rule changed and docs say so.

## Bounds and honesty

- One resident; one outing slot (encodes “at most one outside”).
- `planned_open` collapses “planned and in show window” — calendar/ordinary-hours are not modeled.
- Ignore window is a boolean, not 45 seconds.
- Multi-resident concurrency, SMS, permissions calendar, and phone UI are out of scope.
- A pass covers this model, not the whole gate module.

## Able to fail (regression check)

To confirm the skill still catches a break: temporarily change `ExitScan` so `presence'` becomes `"outside"` while `outing'` stays `"planned_open"`, run TLC, expect `Inv_PresenceMatchesOuting` to fail with a three-state trace (Init → PlanOpen → ExitScan). Restore the file. Do not commit the broken variant.

## Related

- HTTP journeys: `/verify-bsj-hall` (scratch API).
- Keep model aligned after intentional presence changes: `/maintain-formal-verification-skill`.
