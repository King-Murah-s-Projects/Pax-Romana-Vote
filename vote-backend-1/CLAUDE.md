# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

NestJS backend for the Pax Romana KNUST student election system — nominations, nominator/guarantor
verification, **in-person** voting at supervised stations, real-time SSE admin dashboards, and
results. PostgreSQL via Prisma. File storage via Cloudinary. Cache is in-process
(`@nestjs/cache-manager`, in-memory). There is **no** Redis, **no** BullMQ, and **no** Supabase —
those were removed; ignore any older doc that mentions them.

Branch strategy: `dev` → staging, `main` → production. Deployment: Coolify.

> ### ⚠️ Read the design docs before changing behavior
> This codebase is **mid-redesign**. The authoritative design lives in:
> - **`CONTEXT.md`** — the domain glossary (Ballot Secrecy, Eligibility Roster, Participation Record,
>   Polling Station, Station Operator, EC Consensus, Verification, Nomination Lifecycle, Tally, …).
> - **`docs/adr/0001`–`0007`** — the architectural decisions and *why*.
>
> The **legacy code does not yet match the ADRs.** Phone-OTP voting, AES vote encryption, the
> polymorphic verification token, the live `candidate.voteCount`, and the duplicated EC-consensus
> logic all still exist and are being migrated via tracked GitHub issues. When working here, **follow
> the ADRs and `CONTEXT.md`, not the legacy code** — and if you find code that contradicts them, flag
> it rather than extending it. The original product spec under `docs/init/` is aspirational and is
> **superseded** by the ADRs wherever they overlap.

---

## Commands

Package manager: **pnpm**. Do not use `npm install` — use `pnpm install`. `package-lock.json` is gitignored.

```bash
pnpm install                 # Install
pnpm run start:dev           # Dev (watch mode)
pnpm run build               # Build (also copies email templates to dist/)
pnpm run lint                # Lint (auto-fix)
pnpm test                    # All unit tests

# Single test file
./node_modules/.bin/jest path/to/file.spec.ts --no-coverage --forceExit
# Watch a single file
./node_modules/.bin/jest path/to/file.spec.ts --watch

./node_modules/.bin/tsc --noEmit                                   # Typecheck (no emit)
DIRECT_URL="postgresql://localhost:5432/vote" ./node_modules/.bin/prisma validate  # Schema validate
pnpm run db:push:dev                                               # Push schema to dev DB
./node_modules/.bin/prisma migrate dev --name <name>              # Generate migration
```

**Environment files:**
- `prisma/.env` — database URLs and all secrets (gitignored; never commit)
- `.env` — app-level env vars

---

## Architecture

### Module Map

```
src/modules/
  auth/              — JWT auth, password/email-code login, guards, strategies
                       (voter OTP login is being removed — voters auth in person, see ADR-0005)
  users/             — User CRUD, roles, profile management
  nominations/       — Nomination submission + verification flow
    services/        — nomination.service, nominator-verification.service,
                       guarantor-verification.service, nomination-workflow.service
  voting/            — Voting flow. LEGACY: phone-OTP (otp.service, Arkesel) + AES-encrypted votes.
                       TARGET: in-person operator check-in + unlinkable ballots (ADR-0001/0002/0005).
  real-time/         — SSE streaming to admin dashboards (in-memory client registry; single-instance)
  admin/             — EC review, dashboard, super-admin controls
  candidates/        — Approved candidate management
  results/           — Vote counting, certification, export
                       (LEGACY: decrypts votes; TARGET: post-close tally from anonymous ballots, ADR-0004)
  notifications/     — Orchestrator + email.service (SMTP/Handlebars), mnotify-sms.service,
                       admin-notifications.service, deadline-reminders.service
                       (the BullMQ notification queue was removed)
  caches/            — In-memory cache wrapper (CacheService). NOT authoritative for vote state.
  file-upload/       — Cloudinary (candidate photos, nomination documents)
  common/            — Shared: enums, guards, decorators, validators, utils

db/                  — PrismaService (DbModule)
config/              — Per-provider config files
```

### Key Design Decisions (see ADRs for full rationale)

**Voting is in-person (ADR-0002, ADR-0005).** Voting happens on supervised station devices, inside a
fixed window, behind an IP allowlist. There is no remote/phone voting. A `POLL_WORKER` (or `EC_MEMBER`
for attestation) checks each voter in against the **Eligibility Roster** (Pax's own membership records,
keyed by student ID) or via **Same-Day Attestation**; the student-ID dedup is the one-person-one-vote
gate (no ink). Voter phone-OTP auth is being removed.

**Ballot secrecy via unlinkability, not encryption (ADR-0001).** Ballots are stored anonymous and
**unlinkable** to the voter — the `Vote → VotingSession → User` chain, `voterHash`, and the
re-linking audit-log row are being removed. AES vote encryption is being deleted (it protected nothing
once co-located with its key). The threat model is scoped to outsiders + a DB-dump, not trusted insiders.

**Tally post-close (ADR-0004).** No live `candidate.voteCount`; tallies are counted from anonymous
ballot rows after voting closes. During voting only turnout is visible.

**EC consensus (ADR-0003).** A nomination is approved/rejected by 2/3 of a **frozen** roll of active
`EC_MEMBER`s only (`ADMIN` and `SUPER_ADMIN` excluded from the quorum). The `SUPER_ADMIN` Chair holds a
**deadlock-only** override that cannot overturn a reached consensus. Canonical service:
`common/utils/ec-consensus.service.ts` (a duplicate in `nomination-review.service.ts` must be deleted).

**Verification model.** Target: one `Verification { role: NOMINATOR|GUARANTOR, status: VerificationStatus }`
with a *real* FK from `VerificationToken` (the legacy polymorphic `verificationId`+type is being
replaced). `status` is always the Prisma enum (`VERIFIED`/`DECLINED`), never a raw string. A new
`REPUDIATED` outcome flags fabricated endorsers. See ADR-0007 for the recoverable nomination lifecycle.

**Single instance (ADR-0006).** Auth verification codes, the cache, and the SSE registry are in
process memory. Run **one** instance (pin Coolify replicas=1); deploy outside voting windows.
Vote-critical state (`hasVoted`, sessions, ballots) is authoritative in **Postgres**, never the cache.

**Email templates:** Handlebars `.hbs` in `src/modules/notifications/templates/email/`; `pnpm run build`
copies them to `dist/`. `EmailService` resolves from `src/` in dev, `dist/` in prod.

### User Roles

| Role | Description |
|---|---|
| `VOTER` | Eligible student; authenticated **in person** by a station operator (no self-login) |
| `POLL_WORKER` | Station operator; fast-path check-in only (no nomination/admin/results access) |
| `ASPIRANT` | Candidate submitting a nomination |
| `EC_MEMBER` | Electoral Commission member; reviews nominations, performs Same-Day Attestation |
| `SUPER_ADMIN` | EC Chairperson; full admin + deadlock-only consensus override |
| `ADMIN` | General/technical admin; **not** an EC voting member, no vote-data access |

### Nomination Lifecycle (ADR-0007; see `CONTEXT.md`)

`PENDING → AWAITING_VERIFICATION → PARTIALLY_VERIFIED → VERIFIED → UNDER_REVIEW → APPROVED/REJECTED`,
plus `NEEDS_ATTENTION` (an endorser declined/repudiated — recoverable while the window is open) and
`WITHDRAWN`. All transitions go through a single **guarded** function (the only writer of status);
`VERIFIED` requires exactly 1 nominator + 2 guarantors, all `VERIFIED` (a count check).

### Status / known work

Security: the `SUPER_ADMIN` auto-mint, weak-PRNG codes, and timing-unsafe comparisons in `auth` have
been patched (codes now use `crypto.randomInt` + `timingSafeEqual`; admins are no longer auto-created —
**provision the first `SUPER_ADMIN` via seed/DB**). The remaining redesign + audit findings are tracked
as GitHub issues; each cites its ADR. Pre-existing failing test stubs: see `docs/failing-tests.md`.

---

## Agent skills

### Issue tracker

Issues live in GitHub Issues (github.com/JesseMurah/Pax-Romana-Vote). See `docs/agents/issue-tracker.md`.

### Triage labels

Default label vocabulary — needs-triage, needs-info, ready-for-agent, ready-for-human, wontfix. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context layout — one CONTEXT.md + docs/adr/ at the repo root. See `docs/agents/domain.md`.
