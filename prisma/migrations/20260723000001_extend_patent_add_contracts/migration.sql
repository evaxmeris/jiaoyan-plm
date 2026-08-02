-- Extend PatentStatus enum: add new values (PostgreSQL doesn't support removing values, so we only ADD)
-- Note: APPLYING→DRAFT and INVALID→EXPIRED are handled in application code
ALTER TYPE "PatentStatus" ADD VALUE IF NOT EXISTS 'DRAFT';
ALTER TYPE "PatentStatus" ADD VALUE IF NOT EXISTS 'FILING';
ALTER TYPE "PatentStatus" ADD VALUE IF NOT EXISTS 'ACCEPTED';
ALTER TYPE "PatentStatus" ADD VALUE IF NOT EXISTS 'MAINTENANCE';
ALTER TYPE "PatentStatus" ADD VALUE IF NOT EXISTS 'EXPIRED';

-- Add new columns to patents table
ALTER TABLE "patents" ADD COLUMN IF NOT EXISTS "filingDate" TIMESTAMP(3);
ALTER TABLE "patents" ADD COLUMN IF NOT EXISTS "publicationDate" TIMESTAMP(3);
ALTER TABLE "patents" ADD COLUMN IF NOT EXISTS "agency" TEXT;
ALTER TABLE "patents" ADD COLUMN IF NOT EXISTS "agentContact" TEXT;
ALTER TABLE "patents" ADD COLUMN IF NOT EXISTS "fee" DOUBLE PRECISION;
ALTER TABLE "patents" ADD COLUMN IF NOT EXISTS "filingReceipt" TEXT;
ALTER TABLE "patents" ADD COLUMN IF NOT EXISTS "patentCert" TEXT;
ALTER TABLE "patents" ADD COLUMN IF NOT EXISTS "officeActions" JSONB;

-- Create new enums for service contracts
DO $$ BEGIN
  CREATE TYPE "ServiceContractType" AS ENUM ('TRANSLATION', 'LEGAL', 'CONSULTING', 'TESTING', 'OTHER');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "ServiceContractStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'ACTIVE', 'COMPLETED', 'TERMINATED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create service_contracts table
CREATE TABLE IF NOT EXISTS "service_contracts" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contractor" TEXT NOT NULL,
    "type" "ServiceContractType" NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "signingDate" TIMESTAMP(3) NOT NULL,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "status" "ServiceContractStatus" NOT NULL DEFAULT 'DRAFT',
    "fileUrl" TEXT,
    "remark" TEXT,
    "applicantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_contracts_pkey" PRIMARY KEY ("id")
);

-- Add foreign key (IF NOT EXISTS check)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'service_contracts_applicantId_fkey'
  ) THEN
    ALTER TABLE "service_contracts" ADD CONSTRAINT "service_contracts_applicantId_fkey"
      FOREIGN KEY ("applicantId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
