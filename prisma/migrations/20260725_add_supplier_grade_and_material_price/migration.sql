-- AlterTable: 添加 grade 到 supplier_evaluations
ALTER TABLE "supplier_evaluations" ADD COLUMN "grade" TEXT DEFAULT 'C';

-- AlterTable: 添加 latestPrice 到 raw_materials
ALTER TABLE "raw_materials" ADD COLUMN "latest_price" DOUBLE PRECISION;
