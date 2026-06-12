# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

NestJS backend for the Pax Romana KNUST election system — handles nominations, verifications, OTP-based voting, real-time SSE updates, and results. PostgreSQL via Prisma, Redis via BullMQ/cache, file storage via Supabase and Cloudinary.

Branch strategy: `dev` → staging, `main` → production.

---

## Commands

Package manager: **pnpm**. Do not use `npm install` — use `pnpm install`. `package-lock.json` is gitignored.

```bash
# Install
pnpm install

# Dev (watch mode)
pnpm run start:dev

# Build (also copies email templates to dist/)
pnpm run build

# Lint (auto-fix)
pnpm run lint

# All unit tests
pnpm test

# Single test file
./node_modules/.bin/jest path/to/file.spec.ts --no-coverage --forceExit

# Watch a single file
./node_modules/.bin/jest path/to/file.spec.ts --watch

# TypeScript check (no emit)
./node_modules/.bin/tsc --noEmit

# Prisma schema validation (needs DIRECT_URL env var)
DIRECT_URL="postgresql://localhost:5432/vote" ./node_modules/.bin/prisma validate

# Push schema to dev DB
pnpm run db:push:dev

# Generate migration
# NOTE: `prisma migrate dev` requires a TTY and fails in Claude Code's shell.
# Instead: write SQL to prisma/migrations/<timestamp>_<name>/migration.sql, then:
./node_modules/.bin/prisma migrate deploy
```

**Environment files:**
- `prisma/.env` — database URLs and all secrets (gitignored; never commit)
- `.env` — app-level env vars

**Deployment:** Coolify (`dev` branch → staging, `main` → production).

---

## Architecture

### Module Map

```
src/modules/
  auth/              — JWT auth, login, guards, strategies
  users/             — User CRUD, roles, profile management
  nominations/       — Nomination submission and verification flow
    services/        — nomination.service, nominator-verification.service,
                       guarantor-verification.service, nomination-workflow.service
    controllers/     — nominations.controller (main), nomination-submission.controller
    dto/, guards/, decorators/
  voting/            — OTP voting flow, split into 4 services:
    services/        — otp.service (Arkesel SMS), vote-submission.service,
                       voting-admin.service, (thin facade: voting.service)
  real-time/         — SSE streaming to browser clients
    services/        — real-time.service, voting-stats.service, anomaly-detection.service
  admin/             — EC review, dashboard, super-admin controls
  candidates/        — Approved candidate management
  results/           — Vote counting, certification, export
  notifications/     — Orchestrator + 5 sub-services:
    service/         — email.service (SMTP/Handlebars), mnotify-sms.service,
                       notification-queue.service (BullMQ), admin-notifications.service,
                       deadline-reminders.service
  caches/            — Redis wrapper (CacheService)
  file-upload/       — Cloudinary (candidate photos, nomination documents)
  common/            — Shared: enums, guards, decorators, validators, utils

db/                  — PrismaService (DbModule)
config/              — Per-provider config files
```

### Key Design Decisions

**Voting flow:** Voters authenticate via phone OTP (Arkesel API), not username/password. The OTP creates a `VotingSession` (30-minute TTL). Votes are AES-encrypted before storage.

**Two SMS providers:** MNotify (`mnotify-sms.service`) handles nomination/admin SMS notifications. Arkesel (`otp.service`) handles voting OTPs only.

**Verification tokens:** `VerificationToken` uses a polymorphic FK — `verificationId` (the ID of either a `NominatorVerification` or `GuarantorVerification`) + `verificationType` enum (`NOMINATOR | GUARANTOR`). No direct Prisma relation; always two-step: fetch token → fetch verification by `verificationId`.

**EC consensus:** `EcConsensusService` (canonical at `common/utils/`) enforces 2/3 majority rule across active `EC_MEMBER` users. `canMemberVote()` checks for duplicate reviews.

**Real-time:** Admin dashboard uses SSE via `RealTimeService`. Voting events (OTP generation, vote submissions, anomalies) broadcast to admin streams automatically from `OtpService` and `VoteSubmissionService`.

**Email templates:** Handlebars `.hbs` files in `src/modules/notifications/templates/email/`. The `npm run build` script copies these to `dist/`. In development, `EmailService` resolves templates from `src/`; in production from `dist/`.

### User Roles

| Role | Description |
|---|---|
| `VOTER` | Eligible student; authenticates via phone OTP |
| `ASPIRANT` | Candidate submitting a nomination |
| `EC_MEMBER` | Electoral Commission member; reviews nominations |
| `SUPER_ADMIN` | EC Chairperson; full admin access |
| `ADMIN` | General admin tasks |

### Nomination Status Flow (Prisma enum)

`PENDING` → `AWAITING_VERIFICATION` → `PARTIALLY_VERIFIED` → `VERIFIED` → `UNDER_REVIEW` → `APPROVED` / `REJECTED`

### Known Pre-existing Issues (do not fix without a task)

- 16 failing test stubs: wrong imports or missing mocks. See `docs/failing-tests.md`.
- `nominations.controller.ts` (the submission variant at `controllers/nomination-submission.controller.ts`) has `@UseGuards` commented out.
- `common/enums/nomination-status.enum.ts` contains a local `NominationStatus` and `VerificationStatus` that differ from the Prisma-generated ones — only `AdminActions` from that file is actually used.
- `nomination.service.ts` references `approvedAt`/`rejectedAt` fields that don't exist in the schema.
