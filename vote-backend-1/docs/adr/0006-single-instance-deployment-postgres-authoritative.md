# Single-instance deployment; Postgres authoritative for vote-critical state

**Status:** accepted (2026-06-12)

The application runs as a **single instance**. Coolify replicas are pinned to 1, and deploys happen
**outside voting windows** (a rolling deploy that briefly overlaps two instances would drop in-flight
voting sessions). Separately and non-negotiably: **vote-critical state — `hasVoted`, voting sessions,
ballots, participation — is authoritative in Postgres and is never trusted from cache.**

## Why

- Three subsystems independently keep state in process memory and break **silently** under >1
  instance: auth verification codes (`auth.service.ts` in-memory `Map`), the cache
  (`@nestjs/cache-manager` in-memory default), and the SSE client registry (`real-time.service.ts`).
  A second replica would mean a code issued on instance A fails to verify on B, and SSE broadcasts
  reach only the admins connected to the emitting instance.
- The deployment is a single venue with ~3–4 stations for a few hours. High availability / failover
  is not worth re-introducing the Redis dependency that was deliberately removed.
- The cached `hasVoted` (`cache.service.ts:135`) must **never** be the source of truth for vote
  eligibility — a stale cache read would permit double voting. The double-vote guard lives in a
  Postgres transaction on `User.hasVoted`; cache is an accelerator only.

## Considered and rejected

- **Redis-backed shared state** (verification codes, sessions, SSE pub/sub) — enables multi-instance
  HA but re-adds the infra just removed; over-engineering for a single-venue, few-hour election.
- **Single-instance now, Redis-ready interfaces later** — viable, but deferred; the interfaces can be
  introduced if scale ever demands it. Not worth the upfront abstraction now.

## Consequences / guardrails

- Pin replicas = 1 in the Coolify config and note *why* beside it.
- No deploys during an open voting window.
- If the app is ever scaled, this ADR must be superseded and the three in-memory subsystems moved to
  shared (Redis) storage **before** scaling — not after.
- Treat any future code that reads vote eligibility from cache as a correctness bug.
