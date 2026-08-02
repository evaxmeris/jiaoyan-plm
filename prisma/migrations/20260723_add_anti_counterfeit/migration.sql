-- CreateEnum
CREATE TYPE "AntiCounterfeitStatus" AS ENUM ('ACTIVE', 'VERIFIED', 'EXPIRED', 'REVOKED');

-- CreateTable
CREATE TABLE "anti_counterfeit_codes" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "productBatchId" TEXT,
    "productId" TEXT,
    "status" "AntiCounterfeitStatus" NOT NULL DEFAULT 'ACTIVE',
    "firstVerifiedAt" TIMESTAMP(3),
    "firstVerifiedIp" TEXT,
    "verifyCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiredAt" TIMESTAMP(3),

    CONSTRAINT "anti_counterfeit_codes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "anti_counterfeit_codes_code_key" ON "anti_counterfeit_codes"("code");

-- CreateIndex
CREATE INDEX "anti_counterfeit_codes_code_idx" ON "anti_counterfeit_codes"("code");

-- AddForeignKey
ALTER TABLE "anti_counterfeit_codes" ADD CONSTRAINT "anti_counterfeit_codes_productBatchId_fkey" FOREIGN KEY ("productBatchId") REFERENCES "product_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
