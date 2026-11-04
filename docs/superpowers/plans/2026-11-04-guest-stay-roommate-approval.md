# Guest stay roommate approval Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A guest stay reaches `approved` only after every current roommate and the provost have said yes; either no rejects immediately; decisions are audited; the phone adds Waiting for you + inbox/history lines without changing existing layout feel.

**Architecture:** A shy `decisions` module owns required-approver resolution and recording. Routes call it; SQL stores append-only `guest_stay_decisions` rows. Parent `guest_stays.status` stays the gate-facing flag. Phone reuses Permissions `PlainRow` / `SectionHead` / `StatusPill` tokens.

**Tech Stack:** FastAPI, SQLite/Turso migrations, Expo Router resident app, OpenAPI + `docs/tests/tests.md` TDD.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-11-04-guest-stay-roommate-approval-design.md`
- Coding: `docs/engineering/coding-principles.md` (DRY, shy modules, layers, small blast radius, vendor behind our seams)
- Design: additive only — same spacing/layout/feel as Permissions and guest detail; StatusPill via existing `statusTone`
- Contract: `.grok/skills/contract-maintenance/SKILL.md`; do not bump API/DB/test/schema versions on dev
- TDD: failing test first; update `docs/tests/tests.md` in the same change as each test
- Response names: domain fields (`guest_name`, `host_name`, …), never generic `title`/`subtitle`
- Provost-only hall decision; wardens still pay/list; roommate decides on resident routes

## File map

| File | Responsibility |
|---|---|
| `backend/app/shared/migrations/0021_guest_stay_decisions.sql` | Table `guest_stay_decisions` |
| `backend/app/residents/guests/decisions.py` | Required roommates, record decision, maybe promote status |
| `backend/app/residents/guests/records.py` | Expose decision summary on stay bodies |
| `backend/app/residents/guests/staff_routes.py` | Provost decide writes decision row; approve only when complete |
| `backend/app/residents/guests/routes.py` | Roommate list + decide; notify roommates on apply |
| `backend/app/residents/notifications/*` | New notice kinds / sentences |
| `backend/app/residents/home/routes.py` | History lines for roommate/host decision copy if History is the lasting surface |
| `backend/openapi.yaml` + regenerate `docs/api/api.md` | Contract |
| `docs/database/database.md`, `docs/design/workflows.md`, `docs/design/notifications.md`, `docs/tests/tests.md` | Specs |
| `postman/collections/.../Guest Stays/` | Matching requests |
| `mobile/src/app/(resident)/(tabs)/permissions.tsx` | Waiting for you + StatusPill aside |
| `mobile/src/app/(resident)/guest.tsx` | Roommate Approve/Decline; host decision summary |
| `mobile/src/notices.ts`, `mobile/src/requests.ts`, `mobile/src/session.tsx` | Copy + API clients |
| `mobile/src/app/(resident)/history.tsx` | Decision history lines if surfaced there |

---

### Task 1: Decision table + pure required-roommate helpers

**Files:**
- Create: `backend/app/shared/migrations/0021_guest_stay_decisions.sql`
- Create: `backend/app/residents/guests/decisions.py`
- Create: `backend/app/residents/guests/tests/test_decisions_logic.py`
- Modify: `docs/database/database.md` (guest stay decisions section)
- Modify: `docs/tests/tests.md` (entry for isolated decision logic)

**Interfaces:**
- Produces: `active_roommates(connection, host_resident_id) -> list[str]`; `required_roles(has_roommate: bool) -> ...`; table columns `id`, `guest_stay_id`, `actor_user_id`, `role` (`roommate`|`provost`), `decision` (`approved`|`rejected`), `note`, `decided_at`

- [ ] **Step 1: Document the test in `docs/tests/tests.md`**

Add an isolated entry: purpose = required roommates are other active residents on the host’s room; empty when alone. Actor = none (pure). Artifact = none.

- [ ] **Step 2: Write the failing test**

```python
"""Required roommates for a guest stay (no HTTP)."""

from __future__ import annotations

import sqlite3
from pathlib import Path

from app.residents.guests.decisions import active_roommate_user_ids


def test_active_roommates_other_active_same_room(tmp_path: Path, monkeypatch) -> None:
    # Use the hall test DB helper already used by guest tests, or a minimal schema
    # seeded with host + one roommate on B-204 and a stranger on B-205.
    ...
    assert active_roommate_user_ids(connection, host_id) == [roommate_id]
    assert active_roommate_user_ids(connection, solo_host_id) == []
```

Prefer wiring through the project’s existing pytest DB fixture (`database_path`) like `test_lifecycle.py` rather than inventing a second schema. If importing `decisions` fails, that is the red.

- [ ] **Step 3: Run test to verify it fails**

Run: `cd backend && .venv/bin/pytest app/residents/guests/tests/test_decisions_logic.py -v`  
Expected: FAIL (module or function missing)

- [ ] **Step 4: Migration + minimal implementation**

`0021_guest_stay_decisions.sql`:

```sql
CREATE TABLE guest_stay_decisions (
  id TEXT PRIMARY KEY,
  guest_stay_id TEXT NOT NULL REFERENCES guest_stays(id),
  actor_user_id TEXT NOT NULL REFERENCES users(id),
  role TEXT NOT NULL CHECK (role IN ('roommate', 'provost')),
  decision TEXT NOT NULL CHECK (decision IN ('approved', 'rejected')),
  note TEXT,
  decided_at TEXT NOT NULL,
  UNIQUE (guest_stay_id, actor_user_id, role)
) STRICT;

CREATE INDEX guest_stay_decisions_stay ON guest_stay_decisions (guest_stay_id, decided_at);
```

`decisions.py`: query other active residents with same `room_id` as host; exclude host; exclude suspended if product treats them as non-roommates (match “active” used elsewhere — same as bed occupancy rules in `database.md`).

Document the table in `docs/database/database.md` beside guest stays. No version bump.

- [ ] **Step 5: Run test to verify it passes**

Run: `cd backend && .venv/bin/pytest app/residents/guests/tests/test_decisions_logic.py -v`  
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add backend/app/shared/migrations/0021_guest_stay_decisions.sql \
  backend/app/residents/guests/decisions.py \
  backend/app/residents/guests/tests/test_decisions_logic.py \
  docs/database/database.md docs/tests/tests.md
git commit -m "Add guest stay decision records and roommate resolution."
```

---

### Task 2: Record a decision and promote status (domain)

**Files:**
- Modify: `backend/app/residents/guests/decisions.py`
- Modify: `backend/app/residents/guests/tests/test_decisions_logic.py`
- Modify: `docs/tests/tests.md`

**Interfaces:**
- Consumes: `active_roommate_user_ids`, `guest_stay_decisions` table
- Produces: `apply_decision(connection, *, guest_stay_id, actor_user_id, role, decision, note, now_text) -> Literal["pending","approved","rejected"]`  
  Rules: reject → parent `rejected`; approve → insert row; if every required roommate (current set) has approved and a provost has approved → parent `approved` and set `decided_by`/`decided_at` when provost is the one completing (or when last required yes lands, set `decided_by` to the provost actor if present). Roommate-only reject leaves `decided_by` null. Host edit does not call clear. Duplicate decision → 409-style error from caller.

- [ ] **Step 1: Extend failing tests for promote / reject**

Cases: (1) roommate approve alone → stay pending; (2) then provost approve → approved; (3) provost first then roommate → approved; (4) either reject → rejected; (5) no roommate, provost approve → approved; (6) after roommate A approved, A moves out and B moves in → still pending until B and provost yes (A’s row remains).

- [ ] **Step 2: Run — expect FAIL on missing `apply_decision`**

- [ ] **Step 3: Implement `apply_decision` only in `decisions.py`** (routes stay dumb)

- [ ] **Step 4: Run — PASS**

- [ ] **Step 5: Commit**

```bash
git commit -m "Promote guest stay status from decision records."
```

---

### Task 3: Provost decide path uses decisions module

**Files:**
- Modify: `backend/app/residents/guests/staff_routes.py` (`decide_guest_stay`)
- Modify: `backend/app/residents/guests/tests/test_staff_queue.py` (and artifacts as needed)
- Modify: `docs/tests/tests.md`, `docs/api` via OpenAPI later or same change if behaviour already documented in Task 5

**Interfaces:**
- Consumes: `apply_decision(..., role="provost")`
- Produces: HTTP behaviour — approve while roommate pending returns 200 with `status=pending` and decision summary; only fully approved when complete; reject still 200 `rejected`

- [ ] **Step 1: Write/adjust failing E2E in staff guest tests** — seed host+roommate; provost approve; assert still `pending`; roommate not yet; then roommate approve in Task 4.

For this task alone: provost approve with no roommate → `approved` (regression). Provost approve with roommate present → still `pending`.

- [ ] **Step 2: Run red**

- [ ] **Step 3: Replace direct `UPDATE ... status = ?` approve path with `apply_decision`; keep audit + `record_decision` push for host when status becomes approved or rejected by provost. When status stays pending after provost yes, notify host that provost approved but waiting on roommate (optional sentence — if not in notifications.md yet, add in Task 6).

- [ ] **Step 4: Green + commit**

```bash
git commit -m "Provost guest stay decision waits on roommate when required."
```

---

### Task 4: Roommate list + decide routes

**Files:**
- Modify: `backend/app/residents/guests/routes.py`
- Create: `backend/app/residents/guests/tests/test_roommate_decide.py`
- Modify: `backend/openapi.yaml` → regenerate `docs/api/api.md`
- Modify: `docs/tests/tests.md`, `docs/design/workflows.md`
- Postman: Guest Stays folder under Resident

**Interfaces:**
- `GET /api/v1/me/guest-stays/awaiting-my-approval` → page of `GuestStaySummaryBody` (+ host fields already on summary)
- `POST /api/v1/me/guest-stays/{id}/roommate-decision` body `{ "decision": "approved"|"rejected", "note": null }` → `GuestStayBody`
- Only if caller is in `active_roommate_user_ids` for the host **now** and stay `pending` and no prior decision by this actor for this stay

- [ ] **Step 1: OpenAPI paths first (contract), then failing E2E test**

- [ ] **Step 2: Red**

- [ ] **Step 3: Implement routes calling `apply_decision`; on apply of new stay notify each current roommate (Task 6 can finish copy)**

- [ ] **Step 4: `render_api_md.py`, Postman, green, commit**

```bash
git commit -m "Let roommates list and decide guest stays."
```

---

### Task 5: Expose decisions on GuestStayBody

**Files:**
- Modify: `backend/app/residents/guests/records.py`
- Modify: OpenAPI schemas; regenerate api.md
- Tests: assert `decisions` array on GET stay

**Shape (explicit names):**

```json
"decisions": [
  {
    "role": "roommate",
    "actor_user_id": "...",
    "actor_name": "Zara Ahmed",
    "decision": "approved",
    "decided_at": "...",
    "note": null
  }
]
```

Also derived booleans or lists are fine if named clearly, e.g. `roommate_approval_required`, `waiting_on_roommate`, `waiting_on_provost` — prefer deriving in one place in `decisions.py`.

- [ ] TDD: extend resident get-stay assertions → implement loader join → commit  
  Message: `Expose guest stay decision summary on stay detail.`

---

### Task 6: Notifications + History copy

**Files:**
- `docs/design/notifications.md` — new rows  
  - Roommate: “Your roommate has requested a guest stay” / quieter: guest, dates  
  - Host: “Your roommate {name} approved the guest stay” / declined variant  
  - Roommate: “You approved {host}’s guest stay” / declined — if these live in History not inbox, put them on `/me/history` instead; prefer **both** lasting inbox where the app already stores decision notices, and History lines per spec
- `backend/app/residents/notifications/records.py` + routes kinds
- `backend/app/residents/home/routes.py` history if needed
- `mobile/src/notices.ts`

- [ ] Failing test that apply creates roommate notice; roommate approve creates host notice  
- [ ] Implement  
- [ ] Commit: `Notify host and roommate on guest stay decisions.`

---

### Task 7: Mobile — Waiting for you + StatusPill + decide

**Files:**
- `mobile/src/app/(resident)/(tabs)/permissions.tsx` — section **Waiting for you** above **Your requests** when Guest stays tab; same `GuestStayRow` / StatusPill (reuse permission `StatusPill` or lift shared pill; DRY)
- `mobile/src/app/(resident)/guest.tsx` — if opened for roommate pending: Approve/Decline; host sees decision summary
- `mobile/src/session.tsx` — API helpers
- `mobile/src/requests.ts` — guest line still “Pending”; pill colour via `statusTone`
- Follow design-system spacing; do not change tab padding or row styles except aside → StatusPill for guest rows (host + waiting lists)

- [ ] Manual check on Expo: spacing matches Late-night rows  
- [ ] Commit: `Show Waiting for you and StatusPill on guest stays.`

---

### Task 8: Regression sweep + docs glue

- [ ] Run: `cd backend && .venv/bin/pytest app/residents/guests/ -v` and history/notification tests touched  
- [ ] Run: `cd backend && .venv/bin/python scripts/check_docs.py`  
- [ ] Run: `cd mobile && npx tsc --noEmit`  
- [ ] Update `docs/design/workflows.md` § Guest stays for dual approval  
- [ ] Commit: `Align guest stay docs and finish roommate approval slice.`

---

## Spec coverage check

| Spec item | Task |
|---|---|
| Dual approve either order | 2, 3, 4 |
| No roommate → provost alone | 2, 3 |
| Either reject ends | 2 |
| Current roommates | 1, 2 |
| Edit does not clear | 2 (no clear call); keep patch tests green |
| Decision records audit | 1, 2 |
| Push not only path | 4, 7 |
| Waiting for you + StatusPill | 7 |
| Inbox + history copy | 6 |
| Staff detail shows roommate state | 5, 3 |
| Gate unchanged (approved+paid) | 2/3 status semantics |
| Design additive | Global + Task 7 |
| Coding principles | `decisions.py` shy module |

## Placeholder scan

No TBD sections. Implementers must fill the `...` in Task 1 test by copying the seed pattern from `test_lifecycle.py` (`issue_people`, same room ids) — that file is the template, not a vague “similar”.
