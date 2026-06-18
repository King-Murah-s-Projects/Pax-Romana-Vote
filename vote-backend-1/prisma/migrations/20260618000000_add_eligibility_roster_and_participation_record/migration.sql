-- CreateTable: eligibility_roster
-- Frozen snapshot of eligible voters keyed by student ID.
-- Once frozen=true, entries represent the locked voting-day roster.
CREATE TABLE "eligibility_roster" (
    "id"        TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "name"      TEXT NOT NULL,
    "frozen"    BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "eligibility_roster_pkey" PRIMARY KEY ("id")
);

-- CreateTable: participation_records
-- One-person-one-vote gate. No FK to votes/ballots — unlinkability is intentional (ADR-0001).
CREATE TABLE "participation_records" (
    "id"          TEXT NOT NULL,
    "studentId"   TEXT NOT NULL,
    "checkedInAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "participation_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: unique student ID in roster
CREATE UNIQUE INDEX "eligibility_roster_studentId_key" ON "eligibility_roster"("studentId");

-- CreateIndex: unique student ID in participation (DB-enforced one-vote gate)
CREATE UNIQUE INDEX "participation_records_studentId_key" ON "participation_records"("studentId");
