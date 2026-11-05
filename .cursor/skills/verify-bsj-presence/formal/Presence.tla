------------------------------ MODULE Presence ------------------------------
\* Abstract model of one resident's presence vs outing status at the gate.
\* Source of truth in the product: docs/database/database.md (presence, outings, gate scan).
\* Covered code (sync at commit recorded in the skill):
\*   backend/app/staff/gate/ (scan routes / records that flip presence and outing status)
\*
\* Scope: one resident, at most one "usable" outing slot, ignore-window as a boolean.
\* Out of scope: ordinary-hours calendar, destinations, SMS, multi-resident races.

EXTENDS Naturals, TLC

VARIABLES
  presence,       \* "inside" | "outside"
  outing,         \* "none" | "planned_open" | "outside" | "returned"
  ignoreActive    \* TRUE right after a successful movement scan

TypeOK ==
  /\ presence \in {"inside", "outside"}
  /\ outing \in {"none", "planned_open", "outside", "returned"}
  /\ ignoreActive \in BOOLEAN

\* Product rule: outside presence iff an outing is currently outside.
PresenceMatchesOuting ==
  (presence = "outside") <=> (outing = "outside")

\* At most one outside outing is encoded by a single outing variable.

Init ==
  /\ presence = "inside"
  /\ outing = "none"
  /\ ignoreActive = FALSE

PlanOpen ==
  /\ presence = "inside"
  /\ outing \in {"none", "returned"}
  /\ outing' = "planned_open"
  /\ UNCHANGED <<presence, ignoreActive>>

\* Exit scan while inside and a usable plan is open.
ExitScan ==
  /\ presence = "inside"
  /\ outing = "planned_open"
  /\ ~ignoreActive
  /\ presence' = "outside"
  /\ outing' = "outside"
  /\ ignoreActive' = TRUE

\* Return scan while outside.
ReturnScan ==
  /\ presence = "outside"
  /\ outing = "outside"
  /\ ~ignoreActive
  /\ presence' = "inside"
  /\ outing' = "returned"
  /\ ignoreActive' = TRUE

\* Second scan inside the ignore window: no movement.
IgnoredScan ==
  /\ ignoreActive
  /\ UNCHANGED <<presence, outing>>
  /\ ignoreActive' = TRUE

\* Time passes; ignore window ends.
ClearIgnore ==
  /\ ignoreActive
  /\ ignoreActive' = FALSE
  /\ UNCHANGED <<presence, outing>>

\* Cancel a planned outing that never exited.
CancelPlan ==
  /\ presence = "inside"
  /\ outing = "planned_open"
  /\ outing' = "none"
  /\ UNCHANGED <<presence, ignoreActive>>

Next ==
  \/ PlanOpen
  \/ ExitScan
  \/ ReturnScan
  \/ IgnoredScan
  \/ ClearIgnore
  \/ CancelPlan

Spec == Init /\ [][Next]_<<presence, outing, ignoreActive>>

\* Invariants
Inv_PresenceMatchesOuting == PresenceMatchesOuting
Inv_TypeOK == TypeOK
Inv_NoOutsideWithoutOuting ==
  presence = "outside" => outing = "outside"
Inv_NoInsideWhileOutingOutside ==
  outing = "outside" => presence = "outside"

=============================================================================
