-- 迁移：供应商资质管理 + RawMaterial 字段扩展

-- 1. RawMaterial 字段：重命名中文列名并添加新字段
ALTER TABLE "raw_materials" RENAME COLUMN "备案号" TO "filing_no";
ALTER TABLE "raw_materials" RENAME COLUMN "备案状态" TO "filing_status";
ALTER TABLE "raw_materials" RENAME COLUMN "备案有效期" TO "filing_expire_date";
ALTER TABLE "raw_materials" ADD COLUMN "inci_name" TEXT;
ALTER TABLE "raw_materials" ADD COLUMN "safety_info_url" TEXT;
ALTER TABLE "raw_materials" ADD COLUMN "msds_url" TEXT;
ALTER TABLE "raw_materials" ADD COLUMN "tds_url" TEXT;

-- 2. RawMaterialBatch 添加 expire_date
ALTER TABLE "raw_material_batches" ADD COLUMN "expire_date" TIMESTAMPTZ;

-- 3. 创建供应商资质文件表
CREATE TABLE "supplier_documents" (
    "id" TEXT NOT NULL,
    "supplier_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "file_url" TEXT,
    "issue_date" TIMESTAMPTZ,
    "expire_date" TIMESTAMPTZ,
    "notify_days" INTEGER NOT NULL DEFAULT 30,
    "status" TEXT NOT NULL DEFAULT 'VALID',
    "remark" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "supplier_documents_pkey" PRIMARY KEY ("id")
);

-- 4. 创建供应商审计记录表
CREATE TABLE "supplier_audits" (
    "id" TEXT NOT NULL,
    "supplier_id" TEXT NOT NULL,
    "audit_date" TIMESTAMPTZ NOT NULL,
    "auditor" TEXT NOT NULL,
    "result" TEXT NOT NULL,
    "score" DOUBLE PRECISION,
    "report_url" TEXT,
    "findings" JSONB,
    "remark" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "supplier_audits_pkey" PRIMARY KEY ("id")
);

-- 5. 创建供应商评价表
CREATE TABLE "supplier_evaluations" (
    "id" TEXT NOT NULL,
    "supplier_id" TEXT NOT NULL,
    "eval_date" TIMESTAMPTZ NOT NULL,
    "score_quality" DOUBLE PRECISION NOT NULL,
    "score_delivery" DOUBLE PRECISION NOT NULL,
    "score_service" DOUBLE PRECISION NOT NULL,
    "score_total" DOUBLE PRECISION NOT NULL,
    "evaluator" TEXT NOT NULL,
    "remark" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "supplier_evaluations_pkey" PRIMARY KEY ("id")
);

-- 6. 外键约束
ALTER TABLE "supplier_documents" ADD CONSTRAINT "supplier_documents_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE CASCADE;
ALTER TABLE "supplier_audits" ADD CONSTRAINT "supplier_audits_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT;
ALTER TABLE "supplier_evaluations" ADD CONSTRAINT "supplier_evaluations_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT;
