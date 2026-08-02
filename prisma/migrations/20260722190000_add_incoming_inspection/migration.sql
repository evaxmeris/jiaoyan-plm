-- CreateEnum
CREATE TYPE "IQCResult" AS ENUM ('PENDING', 'PASS', 'CONDITIONAL', 'FAIL');

-- CreateEnum
CREATE TYPE "Disposition" AS ENUM ('USE_AS_IS', 'RETURN', 'SCRAP');

-- CreateTable
CREATE TABLE "incoming_inspections" (
    "id" TEXT NOT NULL,
    "rawMaterialId" TEXT NOT NULL,
    "batchId" TEXT,
    "supplierBatchNo" TEXT NOT NULL,
    "quantityReceived" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "receiptDate" TIMESTAMP(3) NOT NULL,
    "coaVerified" BOOLEAN NOT NULL DEFAULT false,
    "coaResult" TEXT,
    "sampleQty" DOUBLE PRECISION,
    "sampleLocation" TEXT,
    "samplePerson" TEXT,
    "inspectionDate" TIMESTAMP(3),
    "inspector" TEXT,
    "result" "IQCResult" NOT NULL DEFAULT 'PENDING',
    "nonConformity" JSONB,
    "disposition" "Disposition",
    "remark" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "incoming_inspections_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "incoming_inspections_rawMaterialId_idx" ON "incoming_inspections"("rawMaterialId");

-- CreateIndex
CREATE INDEX "incoming_inspections_batchId_idx" ON "incoming_inspections"("batchId");

-- AddForeignKey
ALTER TABLE "incoming_inspections" ADD CONSTRAINT "incoming_inspections_rawMaterialId_fkey" FOREIGN KEY ("rawMaterialId") REFERENCES "raw_materials"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incoming_inspections" ADD CONSTRAINT "incoming_inspections_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "raw_material_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
