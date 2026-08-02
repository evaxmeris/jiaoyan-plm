-- CreateEnum
CREATE TYPE "PatentFeeStatus" AS ENUM ('PENDING', 'PAID', 'OVERDUE');

-- CreateTable
CREATE TABLE "budgets" (
    "id" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "fiscalYear" INTEGER NOT NULL,
    "totalAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "usedAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "budgets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patent_fees" (
    "id" TEXT NOT NULL,
    "patentId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "paidDate" TIMESTAMP(3),
    "status" "PatentFeeStatus" NOT NULL DEFAULT 'PENDING',
    "remark" TEXT,

    CONSTRAINT "patent_fees_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "budgets_department_fiscalYear_key" ON "budgets"("department", "fiscalYear");

-- AddForeignKey
ALTER TABLE "patent_fees" ADD CONSTRAINT "patent_fees_patentId_fkey" FOREIGN KEY ("patentId") REFERENCES "patents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
