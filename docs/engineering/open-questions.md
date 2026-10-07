# Open questions

Product and engineering decisions that are deferred. Not hall settings (those stay in [`database/database.md`](../database/database.md)).

| Topic | Status | Note |
|---|---|---|
| Guest stay QR at the gate | Open, deferred | Risk of misuse/sharing (a guest could hand their QR to anyone). Possible mitigation: tie the code to the host resident's presence at the gate. Undecided. |
| Hall Office activation of self-onboarded residents | Open, deferred | Self-onboard creates an active resident who can sign in at once. A Hall Office step to activate or finish her account is not built, and `users.status` allows only active and suspended. |
