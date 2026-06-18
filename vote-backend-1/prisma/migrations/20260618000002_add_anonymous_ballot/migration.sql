-- Migration: add anonymous Ballot model (ADR-0001)
-- Ballot has NO FK to User, VotingSession, or ParticipationRecord —
-- unlinkability is the ballot-secrecy guarantee.

CREATE TABLE "ballots" (
    "id"          TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "position"    TEXT NOT NULL,
    "castedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ballots_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ballots"
    ADD CONSTRAINT "ballots_candidateId_fkey"
    FOREIGN KEY ("candidateId") REFERENCES "candidates"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- ChairOverrideLog (referenced by Nomination but missing from previous migrations)
CREATE TABLE IF NOT EXISTS "chair_override_logs" (
    "id"           TEXT NOT NULL,
    "nominationId" TEXT NOT NULL,
    "actorId"      TEXT NOT NULL,
    "decision"     TEXT NOT NULL,
    "reason"       TEXT NOT NULL,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chair_override_logs_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "chair_override_logs"
    ADD CONSTRAINT "chair_override_logs_nominationId_fkey"
    FOREIGN KEY ("nominationId") REFERENCES "Nomination"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
