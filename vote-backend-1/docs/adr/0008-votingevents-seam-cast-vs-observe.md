# Separate Ballot Casting from observation via a VotingEvents seam

**Status:** accepted (2026-06-12)

The vote path is split into a deep **Ballot Casting** operation and a set of **observers** behind a
**VotingEvents** seam. `castBallot(...)` does only the irreducible, must-be-correct work — validate
selections, enforce the **Digital Uniqueness Gate**, write the anonymous **Ballot** + **Participation
Record**, return a receipt — and emits a single **BallotCast** event. SSE broadcasts, turnout stats,
and anomaly detection become observers of that event. Emission is **after-commit, fire-and-forget**:
observers run outside the cast transaction, each isolated, so a failing or slow observer can never
roll back or delay a recorded vote. Single-instance (ADR-0006) means an in-process emitter suffices —
no message bus.

**BallotCast is operational-only**: it carries that a ballot occurred, a timestamp, and selection-free
operational context (station / IP) for anomaly detection. It carries **no voter identity** (ADR-0001)
and **no candidate selections** (ADR-0004).

## Why

- The shipped `submitVote()` inlined ~11 concerns and made 10+ SSE/stats calls in the request path; a
  stats or broadcast bug could break or delay a recorded vote, and the cast was nearly untestable
  (mock three services). Observation had invaded casting.
- Broadcasting was *also* scattered into `otp.service`, and both domain services imported
  `SseEventType` directly — real-time vocabulary leaking into the voting domain.
- Making casting deep and narrow puts the system's most safety-critical operation behind a one-call,
  side-effect-free interface that is trivially testable; observation is tested independently by
  feeding it synthetic `BallotCast` events.

## Considered and rejected

- **Synchronous in-transaction emission** — a subscriber failure could roll back a vote; awaiting
  subscribers re-introduces the station latency we removed. Rejected.
- **Durable outbox** — stronger delivery guarantee, but an outbox table + drain worker is more than a
  single-venue, single-instance election needs; a missed event self-heals on the next vote.
- **Event carrying selections** — would resurrect live standings (violates ADR-0004) and create a
  timing/positional deanonymization path. Rejected.

## Scope — events are for observation, NOT for core state transitions

The fire-and-forget seam is **only** for observation and after-effects (SSE, turnout stats, anomaly
detection, notifications, candidate-creation) — work that is best-effort and self-healing. A **core
state transition is never fire-and-forget**, because state is *not* self-healing: if recording an
endorsement emitted a droppable event to advance the nomination, a lost event would strand the
nomination in `PARTIALLY_VERIFIED` forever (the silent-limbo bug). Therefore:

- **Core transitions are synchronous and transactional.** Recording an endorsement and applying the
  resulting Nomination Lifecycle transition happen in **one transaction** via a direct
  `Lifecycle.apply(event)` call — not an event.
- **After a transition commits**, the wrapping service emits domain events (`NominationVerified`,
  `NominationApproved`, …) for the *observers* (notifications, candidate-creation) over this seam.

Same rule, both subsystems: the irreducible state change is a direct atomic call; everything
downstream of it is an isolated event.

## Consequences

- `castBallot` has no dependency on SSE/stats/anomaly services; those are `@OnEvent('ballot.cast')`
  observers, each wrapped so its failure is logged and swallowed.
- The Nomination Lifecycle reuses this pattern: pure core + synchronous `apply` in a tx, then
  post-commit domain events for notifications and candidate-creation (resolves the #6 boundary leak —
  notifications resolve recipients behind a `recipientsFor(role)` seam, not `prisma.user`).
- Domain services stop importing `SseEventType`; only the observers know real-time vocabulary.
- This is the architectural groundwork for issues #17 (anonymous ballot) and #18 (post-close tally).
