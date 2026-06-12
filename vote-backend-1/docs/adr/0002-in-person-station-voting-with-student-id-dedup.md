# In-person station voting, student-ID dedup, no OTP, no ink

**Status:** accepted (2026-06-12)

Voting is **in-person only**, on organization-provided laptops/tablets at supervised **Polling
Stations**, inside a fixed time window, reachable only from an **IP allowlist** (all other sources
get 403). One-person-one-vote is enforced by a **Digital Uniqueness Gate**: a voter's **KNUST
student ID number** may appear in the **Participation Record** at most once. Eligibility is checked
against **Pax Romana's own membership roster**; voters not on it are enrolled via **Same-Day
Attestation** by a poll worker who visually verifies the physical student ID card. The phone-OTP
flow (Arkesel) is removed entirely, and indelible ink is not used.

## Context / forces

- The university **will not** provide any API or tooling to verify student identity. The only
  authoritative membership data is Pax's own. Student status is therefore *not* verified against
  the school — only the physical ID card (visually) and Pax's roster.
- The dominant product goal is **raising turnout** among disinterested students; every step of
  friction costs marginal voters.
- **Resource-constrained:** biometrics (fingerprint) were desired but are unaffordable.
- Voters objected to indelible ink.

## Decisions and why

- **In-person, supervised, IP-locked, time-windowed.** The physical station + poll worker is the
  authentication and the perimeter; this makes remote ballot-stuffing (e.g. mass SIM/email
  self-registration) physically impossible, which no software control could otherwise prevent given
  the absence of a trustworthy remote identity source.
- **Remove the phone OTP / Arkesel-for-voting.** With in-person auth, OTP authenticated nothing the
  poll worker didn't, while an undelivered SMS = a lost vote. Removing it *raises* turnout, deletes a
  vendor dependency, and closes the self-registration hole where `verifyOtp` minted voters on the fly.
- **Student ID number as the dedup key ("digital ink").** Every student already carries a unique,
  hard-to-forge credential; no separate voting-ID is issued. Marking the ID "voted" digitally
  replaces ink. Accepted consequence: **no physical backstop** — the digital dedup and the poll
  worker's card check are the sole uniqueness guarantees, so the **Participation Record** must be
  clean and auditable.
- **Eligibility = own roster + same-day attestation.** Includes "ordinary" members not on subgroup
  lists without pretending the school can verify them. Attestation is the entire fraud surface, so
  every attested enrollment records (student ID, attesting official, timestamp, station, reason); the
  attestation *rate* is monitored as an abuse signal.
- **Card evidence is tiered, not mandatory.** The student ID *number* (the dedup key) can be obtained
  by any means, so no voter is turned away for lacking a card. A physical card takes the fast path; a
  phone photo or no card routes to the logged attestation path (a photo binds nothing to the person
  present). Accepted residual risk: no non-biometric scheme prevents impersonation of an abstaining
  eligible member; dedup caps it at one vote per real ID and attestation makes weak-evidence votes
  traceable.

## Considered and rejected

- **Remote voting from personal devices.** Unsolvable for one-person-one-vote without a trustworthy
  identity source (no school API, no verified-phone roster); the only countermeasures were "accept
  fraud" or "integrate with school records," both unavailable.
- **Keep ink as a backstop.** Rejected on voter-experience grounds; the trade-off (loss of the
  physical safety net) is explicitly accepted and recorded here.
- **Issue a separate voting-ID number / pre-register everyone.** Rejected: redundant with the
  existing student ID card, and mandatory pre-registration adds pre-election-day friction that
  directly suppresses the turnout this system exists to raise. Pre-registration is optional and used
  only to speed lines for already-listed subgroup members.
