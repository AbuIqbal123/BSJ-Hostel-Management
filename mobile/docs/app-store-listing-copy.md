# App Store listing copy

Paste-ready fields for Begum Sultan Jahan Hall. Bundle `com.abuiqbal.bsjhall`, version `1.0.0`. The production build calls `https://bsj-hostel-api.onrender.com`.

Do not push this with `eas metadata:push` until the privacy policy and support pages are live HTTPS URLs. Those fields are left empty on purpose.

## Identity

| Field | Limit | Value |
|---|---|---|
| Name | 30 | Begum Sultan Jahan Hall |
| Subtitle | 30 | Plan outings and leave |
| Primary category | | Education |
| Secondary category | | Utilities |
| Age rating | | 4+ |
| Copyright | | 2026 Begum Sultan Jahan Hall |

Name is 23 characters. Subtitle is 22.

## Promotional text

170 characters maximum. 88 characters.

The resident phone for the hall. Plan an outing, show your hall pass, and request leave.

## Description

Begum Sultan Jahan Hall is the phone for residents of the hall. Sign in with the account the hall office gave you, or sign up for a room that is free.

Plan an ordinary outing, with where you are going and when you will be back. Show your hall pass to the gate. Ask for late-night leave or home going, and request a guest stay. When the warden or the provost decides, the notice is on your phone.

The app needs a connection to the hall. Your sign-in stays on this phone until you sign out. The hall does not sell this information, and the app does not show ads.

## Keywords

100 characters maximum, comma-separated, no spaces. Words already in the name or subtitle are left out.

hostel,permission,guest,warden,gate,aligarh,enrolment,curfew,homegoing,qr,pass,late,night,provost

## What's new

First release for residents. Sign in, plan an outing, show the hall pass, and request late-night leave, home going, or a guest stay.

## Review notes

The app needs a username and password from the hall office. There is nothing to browse before sign-in. A release build talks to https://bsj-hostel-api.onrender.com. Give App Review a resident account before you submit. The app does not work as a public demo.

Encryption is only HTTPS. `ITSAppUsesNonExemptEncryption` is false.

## Privacy answers

The binary has no analytics SDK and no ads. It does send hall records to the hall's own API, so App Privacy is not "Data Not Collected".

Collected, linked to the resident, used for app functionality, not used for tracking:

- Name, phone, and the guardian's name and phone
- Enrolment number and the password the resident sets
- Room, course, outings, permissions, guest stays, and the hall pass code

The in-app policy is on the Privacy policy screen, dated 3 October 2026. App Store Connect still needs a public HTTPS copy of that page, and a support URL. Neither is live yet.

## What the app actually does

- Sign in, sign up, change password, sign out
- Plan, change, and cancel an ordinary outing
- Hall pass for the gate
- Late-night and home-going requests
- Guest stays
- History, and notices when a request is approved or rejected
- Light and dark appearance
- Gate scan, and for a warden or the provost the register (who is out, and pending requests)

The hall office is not in this app. There is no payment in the app, and no parent login.
