-- AlterTable: Budget totalAmount and usedAmount from DOUBLE PRECISION to DECIMAL
ALTER TABLE "budgets" ALTER COLUMN "totalAmount" SET DATA TYPE DECIMAL(65,30) USING "totalAmount"::DECIMAL(65,30);
ALTER TABLE "budgets" ALTER COLUMN "totalAmount" SET DEFAULT 0;
ALTER TABLE "budgets" ALTER COLUMN "usedAmount" SET DATA TYPE DECIMAL(65,30) USING "usedAmount"::DECIMAL(65,30);
ALTER TABLE "budgets" ALTER COLUMN "usedAmount" SET DEFAULT 0;
