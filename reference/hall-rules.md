# BSJ Hall — printed rules (source notices)

Captured from physical notices posted at the hall. Product decisions that follow from these notices live in `docs/database.md` (confirmed behavior). This file keeps the original wording and how we read it.

Sources:

- General Rules notice (numbered list)
- Homegoing / contact timings notice (bullet list; one line highlighted on the original)

---

## General rules

1. The hostel outing timings are from **06:00 AM to 06:30 PM**.

2. On leaving the Hall, a resident must make an **entry** in the outing register kept at the gate. She should clearly mention in **legible handwriting**:
   - Name
   - Place of Visit
   - Time of Leaving the Hostel
   - Room No
   - Course

3. On return, the resident should enter the **time** of return in the same Register and **sign** in front of her name.

4. A resident has to **apply** for late-night outing permission if she desires to stay out of the hostel premises after the outing hours.

5. The **Provost**, BSJ Hall shall sanction the **late-night outing permission**, and the application for the same should be deposited in the Office of the Provost.

6. For permission for a **night stay**, the resident has to fill out the homegoing slip a day in advance.

7. The homegoing slip book shall be available between **8:00 PM – 9:00 PM** every day outside the Warden Room 2 (Adj. ICT Hub).

8. In case of any **medical emergency**, the resident should contact the Proctor **Gate Staff** deployed at the main gate of the Hall or the Warden. They shall facilitate the University **Ambulance** facility.

   > On the printed notice, “Office Security Guard” was crossed out and replaced by hand with “Gate Staff”.

---

## Homegoing slip and contact timings

- **Homegoing slip** can be filled between **8:00 PM to 9:00 PM** only.
- Residents can **collect** the signed homegoing slips after **midnight** (after 12:00 AM).
- For any **queries and issues** related to the hostel, the residents are requested to contact between 8:00 PM – 9:00 PM.
- Kindly **DO NOT KNOCK** the door before and after the abovementioned timings, except in the case of an emergency.
- Please **DO NOT CONTACT** for permission for **late-night outings**. *(highlighted on the original notice)*

---

## Product reading (contract decisions)

| Printed rule | Product decision |
|---|---|
| Outing hours 06:00–18:30 | Confirmed. `ordinary_hours_start` = `06:00`, `ordinary_hours_end` = `18:30`. One pair for now (summer/winter clocks later if needed). |
| Gate register fields + return sign | Digital: plan outing + QR exit/return. Name, room, course on the resident profile. |
| Late-night apply; Provost sanctions | Confirmed. Provost alone approves/rejects late-night (and home going). Digital submit replaces office deposit. |
| “Night stay” a day in advance | Read as **guest stay** lead (`guest_min_lead_days` = 1), not a home-going lead rule. |
| Homegoing slip book 8–9 PM / collect after midnight | Not productised. Digital request + approval replace the paper book and midnight collection. |
| Query hours / do not knock | Hall operations only. Not an API feature. |
| Do not contact for late-night | Met by in-app late-night queue (provost decides). |
| Medical emergency / ambulance | Out of scope for this version (no emergency alerts). |
