# Recoverable nomination verification, with capped replacements and repudiation escalation

**Status:** accepted (2026-06-12)

A declined or repudiated endorsement does **not** kill a nomination. It moves to `NEEDS_ATTENTION`;
the aspirant may replace the endorser (re-issuing a verification token) while the nomination window is
open. Replacements are **capped** (≈3 per nomination). Every `REPUDIATED` is logged and attached to the
nomination for EC visibility; **two or more repudiations on one nomination escalates** and blocks
auto-advance to `VERIFIED` until an EC member clears the flag. The whole lifecycle is driven by a
single **guarded transition function** — the only writer of nomination status.

## Why

- **Candidate supply is a turnout/legitimacy concern.** Losing a nominee because one of three endorsers
  is unresponsive or made a mistake shrinks the ballot and punishes aspirants for others' behavior.
  Recovery keeps honest candidacies alive.
- **But "recoverable" and "abusable" are the same mechanism from two sides.** Unbounded replacement is
  endorser-fishing (retry until someone says yes); a consequence-free `REPUDIATED` means a fabricated
  endorser is just a free do-over — building a fraud signal and then ignoring it. Caps + escalation
  bound both.
- **The shipped flow only handled the happy path:** a decline left the nomination in `PENDING` forever
  (silent limbo), and `VERIFIED` was decided by `guarantorVerifications.every(...)`, which is vacuously
  `true` for zero guarantors — so, combined with the never-applied two-guarantor validator, a nomination
  with no guarantors could reach `VERIFIED`. The new rule requires the count (1 + 2), enforced in a
  guarded transition.

## Considered and rejected

- **One decline → terminal REJECTED** — simplest, but a single flaky endorser destroys a candidacy.
- **Every repudiation → EC clears it** — strongest fraud control, but loads the 3-person EC with routine
  churn during the nomination rush. We escalate only on the *second* repudiation instead.
- **Unlimited recovery, log only** — maximal candidate supply, but no brake on fishing or fabrication.

## Consequences / required changes

- Resurrect the previously-dead states (`AWAITING_VERIFICATION`, `PARTIALLY_VERIFIED`, `UNDER_REVIEW`)
  with real writes, plus a new `NEEDS_ATTENTION`; fix the dashboard tiles that currently count states
  nothing ever sets.
- Implement one guarded transition function; tokens processable only in `{AWAITING_VERIFICATION,
  PARTIALLY_VERIFIED, NEEDS_ATTENTION}`; `VERIFIED` requires the 1 + 2 count, in a transaction.
- Track `repudiationCount` and a replacement counter per nomination; escalate at ≥2 repudiations.
- Delete the divergent raw-string verification handler in `nominations.controller.ts` (the
  `'APPROVED'`/`'REJECTED'` path) so the workflow service is the single handler.
