# System architecture

Picture date: **2026-10-03**

This is the system that exists in the repository today. A solid arrow is in use. A dashed arrow is written down and is not on the running path. When a part is added, removed, or connected, this picture is updated in the same change.

```mermaid
flowchart LR
  phone["Phone"] -->|"sign-in"| api["Hall API"]
  browser["Browser"] -->|"health, sign-in, resident phone, register, permissions, guest stays, gate, hall office, and Swagger"| api
  api -->|"serves"| contract["API contract"]
  model["Data model"] --> db[("SQLite")]
  api -->|"creates the hall and keeps records"| db
  api -->|"optional guest payment evidence files"| evidence["Local payment-evidence directory"]
  api -->|"mock late and return notices"| sms["Parent SMS"]
```

| Arrow | Meaning |
|---|---|
| Phone → Hall API | In use for sign-in. The Expo app in `mobile/` opens on a loading screen, then asks for the hall username and password. A successful sign-in shows the person's name. Sign-out clears the session on the phone and revokes the refresh token. |
| Browser → Hall API | In use. The process is FastAPI on this computer, at `http://localhost:8000`. `GET /health` answers. `GET /ready` opens an existing hall database and reports `user_version`. A missing or unreadable file answers 503 and is not created. Sign-in answers. Public resident self-onboard answers and creates an active resident who can sign in immediately; that call returns no tokens. The resident phone answers for home, history, hall pass, destinations, ordinary outings, late-night and home-going permissions, and guest stays (including edit only while pending and before arrival; the stay stays pending). A warden or the provost can read the register presence board, the permission queue, and guest stays, and can decide pending permissions and guest stays, mark payment, and upload optional payment evidence. Gate staff can scan a hall pass, list recent gate activity, read guest dining occupancy, and record guest arrival and departure. The provost can manage settings, blocks, rooms, destinations, residents, staff, password reset, the audit log, the SMS log, and register CSV export. Swagger is at `/docs`. |
| Hall API → API contract | In use. `/docs` reads `backend/openapi.yaml`. [`api.md`](../api/api.md) is the same contract for reading. The Auth (including resident self-onboard), Resident, Register, Permissions, Guest Stays, Gate, and Hall office paths in that file are implemented and registered. `GET /api/v1/auth/onboard/options` is served for the onboard room picker: active blocks and active rooms with no resident assigned. |
| Data model → SQLite | In use. [`database.md`](../database/database.md) is applied when the service starts. After startup the hall records exist. |
| Hall API → SQLite | In use. The process opens the database and creates the hall when the file is new. Sign-in reads and writes people, sessions, and the audit log. Resident home, history, hall pass, destinations, ordinary outings, permissions, and guest stays (apply, edit, cancel, staff decide/payment) read and write their tables. The register presence board reads active residents by block, open outings for lateness, waiting permissions, and guest stays for the dining and should-have-left counts. Gate scans and gate guest routes read dining occupancy and write outings and guest stays. The hall office reads and writes settings, places, accounts, and audit entries, and reads guardian message rows for the SMS log. The process refuses to start when the signing key is missing or shorter than 32 bytes. |
| Hall API → Parent SMS | In use with the mock driver. Outside production the process stops unless the SMS driver is mock. Reading the register (and a return scan) records late notices for outside outings past grace; a return scan records the return notice when a late notice was sent. No phone network is contacted. |
| Hall API → Local payment-evidence directory | In use. Optional guest-stay payment evidence (JPEG, PNG, or PDF, at most 5 MiB) is stored under `PAYMENT_EVIDENCE_DIR` (default under the backend data directory). Paths are hall-controlled; clients never receive absolute filesystem paths. Uploading evidence is never required to mark a stay paid. |

Docker, Nginx, and the VPS are absent from this picture. They are drawn here when that part exists in the project. The phone client signs in and stops there.
