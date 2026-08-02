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

-- CreateIndex
CREATE UNIQUE INDEX "budgets_department_fiscalYear_key" ON "budgets"("department", "fiscalYear");
