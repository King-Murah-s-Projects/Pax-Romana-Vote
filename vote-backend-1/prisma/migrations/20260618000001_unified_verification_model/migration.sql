-- Migration: Unified Verification model (ADR-0007)
-- Adds: VerificationRole enum, REPUDIATED to VerificationStatus, NEEDS_ATTENTION to NominationStatus,
--       Verification model (unified endorsement), EndorsementToken (real FK), PasswordResetToken.
-- Legacy NominatorVerification and GuarantorVerification tables are retained for the transitional period.

-- 1. Add REPUDIATED to VerificationStatus enum
ALTER TYPE "verification_statuses" ADD VALUE IF NOT EXISTS 'REPUDIATED';

-- 2. Add NEEDS_ATTENTION to NominationStatus enum
ALTER TYPE "nomination_statuses" ADD VALUE IF NOT EXISTS 'NEEDS_ATTENTION';

-- 3. Create VerificationRole enum
DO $$ BEGIN
  CREATE TYPE "verification_roles" AS ENUM ('NOMINATOR', 'GUARANTOR');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 4. Create unified Verification table
CREATE TABLE IF NOT EXISTS "verifications" (
    "id"                  TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "nominationId"        TEXT NOT NULL,
    "role"                "verification_roles" NOT NULL,
    "endorserName"        TEXT NOT NULL,
    "endorserEmail"       TEXT NOT NULL,
    "endorserId"          TEXT,
    "status"              "verification_statuses" NOT NULL DEFAULT 'PENDING',
    "comments"            TEXT,
    "verifiedAt"          TIMESTAMP(3),
    "declinedAt"          TIMESTAMP(3),
    "repudiatedAt"        TIMESTAMP(3),
    "repudiationReason"   TEXT,
    "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "verifications_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "verifications_nominationId_fkey"
        FOREIGN KEY ("nominationId") REFERENCES "Nomination"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "verifications_endorserId_fkey"
        FOREIGN KEY ("endorserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- 5. Create EndorsementToken table (real FK to Verification)
CREATE TABLE IF NOT EXISTS "endorsement_tokens" (
    "id"             TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "verificationId" TEXT NOT NULL,
    "token"          TEXT NOT NULL,
    "expiresAt"      TIMESTAMP(3) NOT NULL,
    "usedAt"         TIMESTAMP(3),
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "endorsement_tokens_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "endorsement_tokens_verificationId_key" UNIQUE ("verificationId"),
    CONSTRAINT "endorsement_tokens_token_key" UNIQUE ("token"),
    CONSTRAINT "endorsement_tokens_verificationId_fkey"
        FOREIGN KEY ("verificationId") REFERENCES "verifications"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- 6. Create PasswordResetToken table (separate from verification tokens)
CREATE TABLE IF NOT EXISTS "password_reset_tokens" (
    "id"        TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "userId"    TEXT NOT NULL,
    "token"     TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt"    TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "password_reset_tokens_token_key" UNIQUE ("token"),
    CONSTRAINT "password_reset_tokens_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
