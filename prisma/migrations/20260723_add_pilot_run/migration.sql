-- CreateEnum
CREATE TYPE "PilotRunStatus" AS ENUM ('PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PilotRunResult" AS ENUM ('PASS', 'CONDITIONAL', 'FAIL');

-- CreateTable
CREATE TABLE "pilot_runs" (
    "id" TEXT NOT NULL,
    "productDesignId" TEXT NOT NULL,
    "batchNo" TEXT NOT NULL,
    "scale" TEXT NOT NULL,
    "producer" TEXT NOT NULL,
    "plannedDate" TIMESTAMP(3),
    "completedDate" TIMESTAMP(3),
    "status" "PilotRunStatus" NOT NULL DEFAULT 'PLANNED',
    "result" "PilotRunResult",
    "yield" DOUBLE PRECISION,
    "defects" JSONB,
    "remark" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pilot_runs_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "pilot_runs" ADD CONSTRAINT "pilot_runs_productDesignId_fkey" FOREIGN KEY ("productDesignId") REFERENCES "product_designs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
