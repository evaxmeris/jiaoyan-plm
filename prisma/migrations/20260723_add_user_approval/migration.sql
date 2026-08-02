-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('PENDING_APPROVAL', 'ACTIVE', 'DISABLED');

-- AlterTable: Add user approval fields
ALTER TABLE "users" ADD COLUMN "status" "UserStatus" NOT NULL DEFAULT 'PENDING_APPROVAL';
ALTER TABLE "users" ADD COLUMN "approvedBy" TEXT;
ALTER TABLE "users" ADD COLUMN "approvedAt" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN "rejectReason" TEXT;

-- Set existing users to ACTIVE
UPDATE "users" SET "status" = 'ACTIVE' WHERE "status" = 'PENDING_APPROVAL';
