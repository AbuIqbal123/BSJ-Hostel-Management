# Open questions

Product and engineering decisions that are deferred. Not hall settings (those stay in [`database/database.md`](../database/database.md)).

| Topic | Status | Note |
|---|---|---|
| Guest stay QR at the gate | Open, deferred | Risk of misuse/sharing (a guest could hand their QR to anyone). Possible mitigation: tie the code to the host resident's presence at the gate. Undecided. |
| Resident self-onboard: limited waiting shell vs login refuse until active | Resolved | Abubaker chose full onboarding with block and room. Self-onboard creates an active account; login is allowed immediately. Hall Office activation is deferred. |
| Resident `phone` required on office create too | Resolved | Abubaker decided resident `phone` is required on both self-onboard and office `POST /api/v1/admin/residents`, using the same E.164 rule. |
| Public onboard enrolment enumeration | Resolved | A taken enrolment receives the same generic `unauthenticated` authentication error as other auth failures, plus the existing rate limit; the API does not reveal whether it exists. |
| Security checklist rows 4 and 17 | Resolved | Public resident signup is allowed on dev, is rate-limited, and uses generic authentication errors; the checklist now documents the dev-only exposure and production review requirement. |
