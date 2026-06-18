# EC consensus: members-only 2/3 over a frozen roll, chair as deadlock-breaker

**Status:** accepted (2026-06-12)

A nomination becomes a candidate by **EC Consensus**: at least `ceil(2/3 × N)` votes from EC
members, where `N` is the size of a **frozen EC Roll** (the active `EC_MEMBER`s snapshotted when the
review phase opens). `ADMIN` and `SUPER_ADMIN` are excluded from the quorum. The Chairperson
(`SUPER_ADMIN`) holds a **Chair Override** that may be used **only when consensus is Deadlocked**
(review deadline passed, or 2/3 mathematically unreachable) and **cannot overturn a reached
consensus**. Every override is logged with actor, timestamp, and reason. Consensus is binding;
the chair is the escape valve for member apathy, not a rubber stamp.

## Why

- The shipped code counted `ADMIN` (technical admin, no vote-data access per §4.5.2) inside the 2/3
  base and *excluded* the Chairperson, while still counting the chair's review in the numerator —
  an incoherent denominator that could declare consensus on a single member's agreement.
- The denominator was recomputed live on every call, so deactivating/adding an EC member
  retroactively changed a nomination's outcome — not reproducible, not auditable. Freezing the roll
  fixes this.
- EC members are students and exhibit the same apathy as voters; a pure 2/3-of-full-body rule with
  no fallback **deadlocks** (nomination stuck in VERIFIED, no candidate, election can't proceed).
  The chair override is the deadlock escape.

## Considered and rejected

- **Chair as an equal voter** — keeps the chair inside the quorum math and reintroduces the
  numerator/denominator coupling; rejected for a clean separation of "commission judges, chair
  adjudicates."
- **Full chair override anytime (incl. overturning consensus)** — rejected: makes the 2/3 vote
  advisory theater. The chair may only break deadlocks.

## Consequences / required changes

- The review → vote-count → consensus-check → finalize → create-candidate sequence
  (`nomination-review.service.ts`) must run in **one transaction** and finalize must be idempotent
  (guard on `status NOT IN (APPROVED, REJECTED)`) to prevent concurrent double-finalize and
  duplicate `candidateNumber` races.
- Delete the denormalized `approvalCount`/`rejectionCount` on `Nomination` (drift; `EcReview` is the
  source of truth) and the duplicate `checkConsensus` implementation in `nomination-review.service.ts`.
- `checkConsensus` must expose `deadlocked` / `chairCanOverride`, computed from the frozen `N`,
  `approvals`, `rejections`, `pending`, and the `ElectionTimeline` review deadline.
