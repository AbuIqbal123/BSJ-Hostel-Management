# Gate scan

Gate staff scan a hall-pass payload. When the resident has a usable outing window, exit and return scans flip presence. Outside that window the scan is refused.

## Sub-features

- `pass-payload` reads the resident hall-pass (or QR from office reissue) when visible.
- `scan-exit` records exit when the window is open.
- `scan-refuse` returns an error when no usable outing exists.

## How to get to it (user POV)

- Gate Scan tab → enter/scan code.
- API: `POST /api/v1/gate/scans` as gate/warden/provost with the pass payload.

## Driving it with verify-bsj-hall HTTP

Preconditions:

- Launch + doctor.
- Resident token and gate token (`gate.fatima`).
- Prefer proving **refusal** when no outing window is open (always available on a fresh seed): that is a complete journey without clock gymnastics.
- Full exit/return proof needs a planned outing whose QR window is open (`qr_visible` true on `GET /api/v1/me/hall-pass` or the outing). Only attempt that when you can set times accordingly; otherwise report the unmet precondition in Gotchas style and stop.

- **Refuse without window.** As gate, `POST /api/v1/gate/scans` with the resident’s stored QR token when no outing is usable → non-2xx with a documented error code. Capture status + body.
- **Optional exit.** When `qr_visible` is true, scan once → presence `outside`; scan again → `inside`. Confirm with a staff or resident read that shows presence.
- **Proof.** Artifacts under `artifacts/<run>/gate-scan/`.

## Gotchas

- Fresh seed residents are `inside` with no open ordinary window — refusal is the reliable first proof.
- Do not invent QR strings; read them from hall-pass or office create/reissue responses.
- Never scan against the laptop hall on 8000.
