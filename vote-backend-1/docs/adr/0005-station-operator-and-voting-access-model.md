# Station operator & voting access model

**Status:** accepted (2026-06-12)

Voter-facing voting endpoints (currently unguarded) are replaced by an **operator-mediated check-in**.
A new minimal **`POLL_WORKER`** role performs fast-path check-in (verify physical card → open an
anonymous ballot session); **`EC_MEMBER`s** perform every **Same-Day Attestation** and supervise.
Check-in requires operator JWT **+** allowlisted network **+** open voting window. Check-in writes
the identity-linked **Participation Record** and issues a **single-use, short-TTL ballot token** that
is stored against nothing identifying; the **Ballot** is cast with that token and references neither
the voter, the operator, nor the check-in (preserving ADR-0001 unlinkability).

## Why this shape

- **Scale forces it.** Realistically ≈3 EC members and ≈3–4 (borrowed) devices. EC-only operators
  cannot staff the devices without idling one or forming queues — and queues bleed the turnout the
  system exists to raise. `POLL_WORKER` lets a few EC members cover more lanes.
- **Separation of duties.** EC members already decide who is on the ballot (ADR-0003). Delegating the
  routine glance to poll workers while keeping the privileged *attestation* judgment in EC hands stops
  the polls being run entirely by the same people who picked the candidates.
- **The operator is the deanonymization risk.** The operator knows who sat down and when; if their
  check-in record joined to the ballot, ADR-0001 is undone. Hence the severed hand-off via an
  anonymous, single-use ballot token.

## Network / device reality

- Borrowed laptops share one venue NAT IP, so the **IP allowlist only fences out the open internet**,
  not other devices on the venue WiFi. The real per-device gate is the operator JWT + bound ballot
  token. A dedicated voting router/SSID is the cheap way to make the allowlist mean "official devices."
- Devices are borrowed personal machines: operator JWTs are short-lived and **cleared at end of
  shift**; use a kiosk/fullscreen session so no live token is returned with the laptop.
- During the voting phase, EC nomination-review endpoints are **phase-gated off**, so a station token
  cannot reach the nomination subsystem.

## Immediate prerequisite

The unguarded voter endpoints (`voting.controller.ts` `generate-otp`, `verify-otp`, `submit`,
`session/:id/validate`) must not ship as-is — they are currently open to the public internet. They
are removed (OTP) or replaced by the guarded check-in/cast endpoints described here.
