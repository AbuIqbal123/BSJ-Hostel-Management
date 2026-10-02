# Open questions

Product and engineering decisions that are deferred. Not hall settings (those stay in [`database/database.md`](../database/database.md)).

| Topic | Status | Note |
|---|---|---|
| Guest stay QR at the gate | Open, deferred | Risk of misuse/sharing (a guest could hand their QR to anyone). Possible mitigation: tie the code to the host resident's presence at the gate. Undecided. |
| Resident self-onboard: limited waiting shell vs login refuse until active | Open | Workflow and contract refuse login while pending (`Your account is waiting for the Hall Office.`). Confirm Abubaker does not want a signed-in waiting shell. |
| Resident `phone` required on office create too | Open | Self-onboard requires `phone`. Office `POST /api/v1/admin/residents` still allows omit. Align later if the hall wants one rule. |
| Public onboard enrolment enumeration | Open | Contract returns 409 `duplicate_enrolment` for a taken enrolment. Rate-limit applies. Confirm whether a less revealing response is preferred. |
| Security checklist rows 4 and 17 | Open | Pre-ship checklist still says no public signup. Update when implementation ships so rate-limit covers `POST /api/v1/auth/onboard`. |
