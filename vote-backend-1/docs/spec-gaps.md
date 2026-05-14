# Spec vs Code — Gap Analysis

Cross-reference of `PAX_ROMANA_KNUST_Election_System.md` against the actual codebase.
Three categories: **bugs** (code is broken), **mismatches** (spec says X, code does Y), **not implemented** (spec describes feature that doesn't exist).

---

## 1. Bugs — Code is Currently Broken

These will cause runtime failures or silent wrong behaviour.

---

### 1.1 `VerificationStatus` mismatch — `nominations.controller.ts` writes wrong value

**Problem:** The Prisma `VerificationStatus` enum uses `VERIFIED` and `DECLINED`. `nomination-workflow.service.ts` and `nominator-verification.service.ts` write the correct values. But `nominations.controller.ts` writes the raw string `'APPROVED'` to the same fields, and then checks `status === 'APPROVED'` to decide if a nomination is fully verified. Those two code paths will never agree — the controller's completion check will never fire when verifications came through the service layer.

**Search:**
```bash
grep -n "status.*'APPROVED'\|'APPROVED'.*status" src/modules/nominations/nominations.controller.ts
# lines ~75, 115, 116, 233, 237
```

**Fix:** Replace `'APPROVED'` with `VerificationStatus.VERIFIED` (from `@prisma/client`). Same check in `candidates.service.ts:41` — `status: 'APPROVED'` should be `NominationStatus.APPROVED`.

```bash
grep -rn "'APPROVED'" src/ --include="*.ts" | grep -v spec | grep -v notification
```

---

### 1.2 Non-existent schema fields — `nomination.service.ts`

**Problem:** `nomination.service.ts` lines 289–290 reference `approvedAt` and `rejectedAt` in a Prisma update:
```typescript
...(status === NominationStatus.APPROVED && { approvedAt: new Date() }),
...(status === NominationStatus.REJECTED && { rejectedAt: new Date() }),
```
Neither field exists in the `Nomination` model. Prisma will throw a runtime error when `updateStatus` is called with APPROVED or REJECTED.

**Search:**
```bash
grep -n "approvedAt\|rejectedAt" src/modules/nominations/services/nomination.service.ts
```

**Fix:** Add `approvedAt DateTime?` and `rejectedAt DateTime?` to the `Nomination` model in `prisma/schema.prisma`, then generate a migration. Or remove the lines if you don't need those timestamps.

---

### 1.3 `nomination-submission.controller.ts` — auth guard disabled, console.logs remain

**Problem:** The `NominationsController` at `src/modules/nominations/controllers/nomination-submission.controller.ts` has `// @UseGuards(JwtAuthGuard)` commented out, making nomination creation publicly accessible without authentication. It also still has `console.log` calls that the earlier cleanup missed.

**Search:**
```bash
grep -n "// @UseGuards\|console\." src/modules/nominations/controllers/nomination-submission.controller.ts
```

**Fix:** Uncomment the guard. Replace `console.log` with `this.logger`.

---

### 1.4 MNotify hardcoded API key fallback

**Problem:** `mnotify-sms.service.ts` has a hardcoded API key as a fallback default, the same pattern we already fixed in `VoteSubmissionService` for the encryption key. If `MNOTIFY_API_KEY` is unset, it silently uses the hardcoded production key.

**Search:**
```bash
grep -n "||" src/modules/notifications/service/mnotify-sms.service.ts | head -5
```

**Fix:** Replace the `|| 'OSVTWts...'` fallback with a throw, same as `vote-submission.service.ts:35–38`.

---

### 1.5 Local enums shadow Prisma enums

**Problem:** `src/modules/common/enums/nomination-status.enum.ts` defines its own `NominationStatus` (with different values: DRAFT, SUBMITTED, PENDING_VERIFICATION…) and its own `VerificationStatus` (with APPROVED/REJECTED instead of VERIFIED/DECLINED). Nobody currently imports `NominationStatus` from this file (they use `@prisma/client`), but the local `VerificationStatus` with `APPROVED` is a source of confusion and has already caused the bug in §1.1.

**Search:**
```bash
grep -rn "from.*common/enums/nomination-status" src/ --include="*.ts"
# Should only return imports of AdminActions
```

**Fix:** Delete the `NominationStatus` and `VerificationStatus` blocks from that file, leaving only `AdminActions`. Update any file importing `VerificationStatus` from the local enum to import from `@prisma/client` instead.

---

## 2. Spec vs Code Mismatches

The spec describes the intended design. The code implements something different. These aren't bugs — they're design choices — but they mean the spec doc is wrong as written.

---

### 2.1 Voter authentication

**Spec (§3.3.1):** "Standard Pax Web App credentials as primary authentication" + email/SMS 2FA code.

**Code:** Voters don't have a password. They authenticate by submitting phone number + name + email to `/voting/generate-otp`, receive a 6-digit SMS OTP via Arkesel, and verify it at `/voting/verify-otp`. This creates a `VotingSession` (30-minute TTL) that they use for the rest of the flow.

**Search:**
```bash
grep -n "generateOtp\|verifyOtp" src/modules/voting/services/otp.service.ts
```

**Update needed in spec:** Section 3.3.1 and 3.3.3 voting sequence steps 1–2.

---

### 2.2 Nominator count

**Spec (§3.2, §4.2.1):** "Each aspirant must have the required number of nominators (typically 2–3)."

**Code:** Exactly **1 nominator** per nomination. The schema has `nominatorVerification NominatorVerification?` as a unique one-to-one relation.

**Search:**
```bash
grep -n "nominatorVerification" prisma/schema.prisma
```

**Update needed in spec:** Everywhere "2-3 nominators" appears — replace with "1 nominator".

---

### 2.3 Guarantor count

**Spec (§4.2.1):** "Each aspirant must have the required number of guarantors (typically 1–2)."

**Code:** Exactly **2 guarantors** enforced by `ExactlyTwoGuarantorsConstraint`.

**Search:**
```bash
cat src/modules/common/validators/exactly-two-guarantors.validator.ts
```

**Update needed in spec:** Everywhere "1-2 guarantors" appears — replace with "exactly 2 guarantors."

---

### 2.4 Role naming

**Spec:** "Electoral Commissioner" is the senior role, "electoral officials" are the members.

**Code:** `SUPER_ADMIN` = EC Chairperson (full access), `EC_MEMBER` = commission member (review access), `ADMIN` = general admin.

**Search:**
```bash
grep -n "SUPER_ADMIN\|EC_MEMBER" prisma/schema.prisma
```

**Update needed in spec:** Section 4.4 — clarify that "Electoral Commissioner" maps to `SUPER_ADMIN` and commission members map to `EC_MEMBER`.

---

### 2.5 Section 5.4 missing from spec

**Spec:** Table of contents and document body jump from **5.3 Verification Phase** to **5.5 Voting Day Procedures**. Section 5.4 (Campaign Phase) is missing entirely.

**Fix in spec:** Add section 5.4 for the Campaign/Candidate Publication phase, or renumber 5.5 → 5.4 and 5.6 → 5.5.

---

### 2.6 Two SMS providers (not one)

**Spec:** Implies a single SMS notification system.

**Code:** Two completely separate providers:
- **MNotify** (`mnotify-sms.service.ts`) — nomination status updates, deadline reminders, general admin notifications
- **Arkesel** (`otp.service.ts`) — voting OTPs only

**Search:**
```bash
grep -rn "mnotify\|arkesel\|MnotifySms\|HttpService" src/ --include="*.ts" -l | grep -v spec
```

**Update needed in spec:** §3.3.1 multi-factor options — clarify that Arkesel handles voting OTPs and MNotify handles all other SMS.

---

### 2.7 CWA eligibility not enforced

**Spec (§4.1.1):** "Minimum CWA requirements (position-specific)."

**Code:** The nomination DTO collects `nomineeCwa` (a string field) but no validation threshold is applied anywhere. Any value is accepted.

**Search:**
```bash
grep -rn "nomineeCwa\|cwa" src/ --include="*.ts" | grep -v spec
```

---

## 3. Not Implemented

Features the spec describes that have no code.

| Feature | Spec Section | Status |
|---|---|---|
| Campaign module (material uploads, guidelines) | §3.1, §4.1 | No backend module exists |
| "Request additional information" verification state | §3.2.2 | Only `VERIFIED`/`DECLINED` states exist |
| Plagiarism detection on endorsements | §3.2.3 | Not implemented |
| CAPTCHA for suspicious logins | §3.3.1 | Not implemented |
| Blockchain-inspired vote immutability | §3.3.4 | Votes are AES-encrypted in a standard DB table |
| Offline voting with sync | §3.3.3 | Not implemented |
| Social media results integration | §3.4.3 | Not implemented |
| PWA / WCAG 2.1 compliance | §2.1 | Frontend concern; no backend impact |

**Search to confirm campaign is absent:**
```bash
find src/ -name "*campaign*" 2>/dev/null || echo "no campaign files"
```

---

## 4. In Code, Not in Spec

Features that exist in the backend but aren't mentioned in the spec document. Update the spec or README to cover these.

| Feature | Where |
|---|---|
| **Supabase Storage** — candidate photo uploads via Supabase bucket | `src/modules/supabase/` |
| **Cloudinary** — also used for candidate photos (two upload paths) | `src/modules/file-upload/` |
| **Real-time SSE** — live admin dashboard with vote stats, anomaly alerts | `src/modules/real-time/` |
| **BullMQ notification queue** — async email/SMS via Redis queue | `src/modules/notifications/service/notification-queue.service.ts` |
| **Anomaly detection** — rate spike detection during voting | `src/modules/real-time/services/anomaly-detection.service.ts` |
| **Election timeline DB model** — `ElectionTimeline` table drives phase logic | `prisma/schema.prisma` |
| **Voting pause/resume** — emergency system controls via `SystemConfig` table | `VotingAdminService.pauseVoting()` |

---

## Quick Search Reference

```bash
# All places that still write raw string status values
grep -rn "'APPROVED'\|'PENDING'\|'VERIFIED'\|'DECLINED'" src/ --include="*.ts" | grep -v spec

# Auth guards that are commented out
grep -rn "// @UseGuards" src/ --include="*.ts"

# Remaining console.log (should be zero after cleanup)
grep -rn "console\." src/ --include="*.ts" | grep -v spec | grep -v node_modules

# All Prisma fields referenced in code that may not exist in schema
grep -rn "approvedAt\|rejectedAt\|inkVerified" src/ --include="*.ts" | grep -v spec

# Files importing from local enums (should only be AdminActions)
grep -rn "common/enums/nomination-status" src/ --include="*.ts"

# Hardcoded fallback secrets
grep -rn "|| '" src/ --include="*.ts" | grep -v spec | grep -v "// " | grep -v ".spec"
```
