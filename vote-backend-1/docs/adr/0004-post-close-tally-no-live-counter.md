# Tally votes after close, not via a live counter

**Status:** accepted (2026-06-12)

Votes are tallied **after the voting window closes**, by counting the anonymous `Ballot` rows in a
single pass. We do **not** keep a live `candidate.voteCount`. During voting, only turnout (ballot
count) is observable; per-candidate standings do not exist until the close-of-poll count.

## Why

- **Integrity:** no live standings means no mid-election leak — no bandwagon effect, nothing for an
  insider to peek at, no partial results influencing late voters.
- **Correctness:** a denormalized per-candidate counter is a second source of truth that drifts from
  the ballots; counting from ballots at close has exactly one source of truth.
- **Contention:** removes a hot-row write (`UPDATE candidate SET voteCount = voteCount + 1`) from
  every vote transaction — popular candidates were a contention point.
- **Fit:** the results phase (spec §3.4) already reviews and certifies *after* voting ends, so
  real-time exact standings were never a requirement.

## Considered and rejected

- **Live counter updated off the request path** — gives real-time standings but reintroduces the
  drift-prone counter and the mid-election leak; rejected because real-time standings aren't needed.
- **Live counter inside the vote transaction (status quo)** — per-vote contention plus drift;
  survivable at station scale but strictly worse than counting at close.

## Consequence

The live admin dashboard shows **turnout only** during voting. The synchronous SSE/stats fan-out
currently inside `submitVote` (`vote-submission.service.ts`) should be reduced accordingly and moved
off the vote request path (emit an event; recompute asynchronously).
