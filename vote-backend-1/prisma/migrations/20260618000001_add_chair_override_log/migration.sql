-- CreateTable: ChairOverrideLog
-- Records SUPER_ADMIN chair overrides used to break deadlocked EC votes.
-- A chair override is only valid when deadlocked and cannot overturn a reached consensus.

CREATE TABLE "chair_override_logs" (
    "id"           TEXT NOT NULL,
    "nominationId" TEXT NOT NULL,
    "actorId"      TEXT NOT NULL,
    "decision"     TEXT NOT NULL,
    "reason"       TEXT NOT NULL,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chair_override_logs_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "chair_override_logs" ADD CONSTRAINT "chair_override_logs_nominationId_fkey"
    FOREIGN KEY ("nominationId") REFERENCES "Nomination"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chair_override_logs" ADD CONSTRAINT "chair_override_logs_actorId_fkey"
    FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
