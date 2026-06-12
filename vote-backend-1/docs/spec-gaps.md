# Spec ↔ Code ↔ Decisions — Reconciliation

The original product spec (`docs/init/`) was written before the system was designed in detail. Where
the spec and the code disagreed, the disagreements were resolved by a grilling/design pass that
produced the **ADRs** (`docs/adr/0001`–`0007`) and the domain glossary (`CONTEXT.md`). Those are now
the source of truth.

This document is no longer a flat "spec vs code" diff. It records, per area: what the spec assumed,
what was **decided**, and the current **status** (fixed / tracked as a GitHub issue / superseded).

---

## 1. Decisions that supersede the spec

| Area | Spec assumed | Decided (ADR) | Status |
|---|---|---|---|
| Voting channel | Remote, "any internet device", phone/credential auth, offline sync | **In-person** at supervised stations, IP-allowlisted, fixed window; operator check-in; no phone OTP | ADR-0002, ADR-0005 — tracked |
| Vote secrecy | AES-encrypt-before-storage; "blockchain-inspired immutability" | **Unlinkability**, not encryption; ballots anonymous, no `Vote→User` chain, no `voterHash`; AES layer deleted | ADR-0001 — tracked |
| Tally | Live counts / real-time standings | **Post-close** tally from anonymous ballots; no live `candidate.voteCount`; turnout-only during voting | ADR-0004 — tracked |
| Voter eligibility | Pre-registration; verify student status | Pax's **own roster** (student-ID keyed) + **Same-Day Attestation**; school will not verify; ink dropped, student-ID dedup is the gate | ADR-0002 — tracked |
| EC consensus | "Electoral Commissioner reviews/approves" | 2/3 of a **frozen `EC_MEMBER` roll** only; `ADMIN`/`SUPER_ADMIN` excluded; Chair = deadlock-only override | ADR-0003 — tracked |
| Verification states | Confirm / Decline / Request-info / Report-error | Unified `Verification` + enum status + `REPUDIATED`; recoverable decline within window, capped, repudiation escalates | ADR-0007 — tracked |
| Deployment | "Scalable multi-tier" | **Single instance**; in-memory cache/SSE/codes; Postgres authoritative for vote state | ADR-0006 — tracked |
| Nominator/guarantor counts | "2–3 nominators, 1–2 guarantors" | **Exactly 1 nominator + 2 guarantors** | tracked (validator + completion fix) |
| SMS providers | Single SMS system | **MNotify only** (nomination/admin); Arkesel removed with the OTP flow | done by design |

The spec's blockchain immutability, offline voting, plagiarism detection, CAPTCHA, and social-media
results integration are **not** part of the designed system.

---

## 2. Security findings

| Finding | Status |
|---|---|
| `auth.service.ts` auto-created a `SUPER_ADMIN` for any email+name on the unauthenticated send-code endpoint | **FIXED** — role assignment removed; admins must be provisioned out-of-band (seed) |
| Verification/reset codes used `Math.random()`; codes compared with `!==` (timing-unsafe) | **FIXED** — `crypto.randomInt` + `timingSafeEqual`; sensitive auth endpoints throttled |
| Commented-out `@UseGuards` on EC-nominations, admin-dashboard, nomination-submission, system-monitor controllers | tracked (Tier 0) |
| `common/guards/ec-consensus.guard.ts` fails **open** | tracked (Tier 0) |
| `mnotify-sms.service.ts` hardcoded API-key fallback | tracked (Tier 0) |
| `file-upload`: unauthenticated `/urls/:publicId`, unsigned Cloudinary uploads, stubbed dimension validation | tracked (Tier 0) |
| `results`: `/winners` & `/public-results` public; results SSE stream missing `RolesGuard`; decryption returns/caches `voterHash`+`sessionId` (deanonymization) | tracked (Tier 0 / Tier 1) |

---

## 3. Concrete code bugs (tracked unless noted)

- **Enum mismatch:** `nominations.controller.ts` writes raw `'APPROVED'`/`'REJECTED'`; Prisma uses
  `VERIFIED`/`DECLINED`. The completion check never fires. → unified Verification model + enum status.
- **Non-existent fields:** `nomination.service.ts` updates `approvedAt`/`rejectedAt` (not in schema). → state-machine work.
- **Vacuous completion:** `nomination-workflow.service.ts` marks `VERIFIED` via `guarantorVerifications.every(...)`,
  which is `true` for zero guarantors. The two-guarantor validator is defined but never applied. → require the 1+2 count.
- **Local shadow enums:** `common/enums/nomination-status.enum.ts` defines `NominationStatus`/`VerificationStatus`
  that differ from Prisma's; only `AdminActions` is used. → delete the shadows.
- **Duplicate consensus logic** in `nomination-review.service.ts` vs `common/utils/ec-consensus.service.ts`;
  drifting `approvalCount`/`rejectionCount` counters. → ADR-0003 work.
- **`@ts-ignore` cluster** across admin/nominations/results/real-time — each hides a real schema mismatch. → tracked.
- **Missing `result_certifications` table:** `certification.service.ts` writes to a table that doesn't exist (silent failure). → tracked.
- Pre-existing failing test stubs (wrong imports / missing mocks): see `docs/failing-tests.md`.

---

*Each tracked item is (or will be) a GitHub issue citing its ADR. Work the ADRs, not the legacy code.*
