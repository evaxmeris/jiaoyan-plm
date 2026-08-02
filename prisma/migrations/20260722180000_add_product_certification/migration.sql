-- AddCertStatus
CREATE TYPE "CertStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'APPROVED', 'REJECTED', 'EXPIRED');

-- CreateTable: product_certifications
CREATE TABLE "product_certifications" (
    "id" TEXT NOT NULL,
    "productDesignId" TEXT NOT NULL,
    "market" TEXT NOT NULL,
    "certType" TEXT NOT NULL,
    "certName" TEXT NOT NULL,
    "certNo" TEXT,
    "status" "CertStatus" NOT NULL DEFAULT 'PENDING',
    "applyDate" TIMESTAMP(3),
    "approveDate" TIMESTAMP(3),
    "expiryDate" TIMESTAMP(3),
    "remark" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "product_certifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable: product_milestones
CREATE TABLE "product_milestones" (
    "id" TEXT NOT NULL,
    "productDesignId" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),
    "completedBy" TEXT,
    "remark" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "product_milestones_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey: product_certifications -> product_designs
ALTER TABLE "product_certifications" ADD CONSTRAINT "product_certifications_productDesignId_fkey" FOREIGN KEY ("productDesignId") REFERENCES "product_designs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: product_milestones -> product_designs
ALTER TABLE "product_milestones" ADD CONSTRAINT "product_milestones_productDesignId_fkey" FOREIGN KEY ("productDesignId") REFERENCES "product_designs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex: unique constraint for productDesignId + stage
CREATE UNIQUE INDEX "product_milestones_productDesignId_stage_key" ON "product_milestones"("productDesignId", "stage");
