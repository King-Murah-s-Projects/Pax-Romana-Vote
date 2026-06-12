-- AlterTable: drop the redundant type column
ALTER TABLE "VerificationToken" DROP COLUMN IF EXISTS "type";

-- DropEnum
DROP TYPE IF EXISTS "TokenType";
