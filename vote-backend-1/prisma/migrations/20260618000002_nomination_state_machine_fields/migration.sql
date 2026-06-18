-- Add replacementCount and repudiationEscalated to Nomination
ALTER TABLE "nominations" ADD COLUMN IF NOT EXISTS "replacementCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "nominations" ADD COLUMN IF NOT EXISTS "repudiationEscalated" BOOLEAN NOT NULL DEFAULT false;
