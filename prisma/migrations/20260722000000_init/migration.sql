-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('CEO', 'RND_MANAGER', 'DEVELOPER', 'COMPLIANCE', 'PURCHASER', 'FINANCE', 'PRODUCTION', 'OBSERVER');

-- CreateEnum
CREATE TYPE "TrademarkType" AS ENUM ('WORD', 'FIGURE', 'COMBINED');

-- CreateEnum
CREATE TYPE "TrademarkStatus" AS ENUM ('APPLYING', 'PRELIMINARY', 'REGISTERED', 'OBJECTION', 'REVIEW', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "PatentType" AS ENUM ('INVENTION', 'UTILITY', 'DESIGN');

-- CreateEnum
CREATE TYPE "PatentStatus" AS ENUM ('APPLYING', 'SUBSTANTIVE', 'AUTHORIZED', 'REJECTED', 'INVALID');

-- CreateEnum
CREATE TYPE "RecordStatus" AS ENUM ('UNRECORDED', 'RECORDING', 'RECORDED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "BatchStatus" AS ENUM ('IN_STOCK', 'USED', 'RETURNED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "FormulaStatus" AS ENUM ('DEVELOPING', 'SAMPLING', 'TESTING', 'STABILIZED', 'DISCONTINUED');

-- CreateEnum
CREATE TYPE "ProductStatus" AS ENUM ('CONCEPT', 'DESIGNING', 'SAMPLING', 'TESTING', 'REGISTERING', 'READY', 'LAUNCHED', 'DISCONTINUED');

-- CreateEnum
CREATE TYPE "RegistrationStatus" AS ENUM ('APPLYING', 'SUPPLEMENT', 'REGISTERED', 'CHANGE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "InspectionType" AS ENUM ('MICROBIAL', 'PHYSICAL', 'STABILITY', 'SAFETY', 'EFFICACY', 'CHALLENGE', 'PACKAGING');

-- CreateEnum
CREATE TYPE "InspectionResult" AS ENUM ('PENDING', 'PASS', 'FAIL');

-- CreateEnum
CREATE TYPE "InspectionStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED');

-- CreateEnum
CREATE TYPE "SupplierType" AS ENUM ('RAW_MATERIAL', 'PACKAGING', 'OEM', 'TESTING', 'OTHER');

-- CreateEnum
CREATE TYPE "ContractStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'TERMINATED');

-- CreateEnum
CREATE TYPE "PurchaseStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'ORDERED', 'RECEIVED', 'REIMBURSED');

-- CreateEnum
CREATE TYPE "Urgency" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "ApprovalAction" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'RETURNED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "avatar" TEXT,
    "role" "Role" NOT NULL DEFAULT 'DEVELOPER',
    "department" TEXT,
    "position" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trademarks" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "TrademarkType" NOT NULL,
    "category" TEXT NOT NULL,
    "applicationNo" TEXT,
    "registrationNo" TEXT,
    "applyDate" TIMESTAMP(3),
    "registerDate" TIMESTAMP(3),
    "expireDate" TIMESTAMP(3),
    "status" "TrademarkStatus" NOT NULL DEFAULT 'APPLYING',
    "owner" TEXT NOT NULL,
    "remark" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trademarks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trademark_attachments" (
    "id" TEXT NOT NULL,
    "trademarkId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trademark_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patents" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "PatentType" NOT NULL,
    "applicationNo" TEXT,
    "patentNo" TEXT,
    "inventor" TEXT NOT NULL,
    "applicant" TEXT NOT NULL,
    "applyDate" TIMESTAMP(3),
    "grantDate" TIMESTAMP(3),
    "expireDate" TIMESTAMP(3),
    "status" "PatentStatus" NOT NULL DEFAULT 'APPLYING',
    "techField" TEXT,
    "remark" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "patents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patent_attachments" (
    "id" TEXT NOT NULL,
    "patentId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "patent_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "raw_materials" (
    "id" TEXT NOT NULL,
    "nameCn" TEXT NOT NULL,
    "nameEn" TEXT,
    "casNo" TEXT,
    "备案号" TEXT,
    "备案状态" "RecordStatus" NOT NULL DEFAULT 'UNRECORDED',
    "备案有效期" TIMESTAMP(3),
    "supplier" TEXT,
    "supplierId" TEXT,
    "function" TEXT,
    "specification" TEXT,
    "limitChina" TEXT,
    "limitEu" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "safetyInfo" TEXT,
    "unit" TEXT NOT NULL DEFAULT 'kg',
    "currentStock" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "minStock" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "remark" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "raw_materials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "raw_material_batches" (
    "id" TEXT NOT NULL,
    "rawMaterialId" TEXT NOT NULL,
    "batchNo" TEXT NOT NULL,
    "internalBatch" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "receiptDate" TIMESTAMP(3) NOT NULL,
    "supplier" TEXT NOT NULL,
    "coaUrl" TEXT,
    "status" "BatchStatus" NOT NULL DEFAULT 'IN_STOCK',
    "remark" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "raw_material_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "formulas" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "version" TEXT NOT NULL DEFAULT 'V1.0',
    "targetProduct" TEXT,
    "batchSize" DOUBLE PRECISION,
    "totalCost" DOUBLE PRECISION,
    "status" "FormulaStatus" NOT NULL DEFAULT 'DEVELOPING',
    "isCore" BOOLEAN NOT NULL DEFAULT false,
    "processParams" TEXT,
    "remark" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "formulas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "formula_items" (
    "id" TEXT NOT NULL,
    "formulaId" TEXT NOT NULL,
    "rawMaterialId" TEXT NOT NULL,
    "percentage" DOUBLE PRECISION NOT NULL,
    "weight" DOUBLE PRECISION,
    "cost" DOUBLE PRECISION,
    "orderIndex" INTEGER NOT NULL,
    "remark" TEXT,
    "formulaId2" TEXT,

    CONSTRAINT "formula_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "formula_versions" (
    "id" TEXT NOT NULL,
    "formulaId" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "changedBy" TEXT NOT NULL,
    "changeLog" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "formula_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_designs" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "brand" TEXT,
    "category" TEXT,
    "capacity" TEXT,
    "status" "ProductStatus" NOT NULL DEFAULT 'CONCEPT',
    "formulaId" TEXT,
    "packagingBom" JSONB,
    "designDoc" TEXT,
    "sampleBatch" TEXT,
    "launchDate" TIMESTAMP(3),
    "remark" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_designs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_trademarks" (
    "productId" TEXT NOT NULL,
    "trademarkId" TEXT NOT NULL,

    CONSTRAINT "product_trademarks_pkey" PRIMARY KEY ("productId","trademarkId")
);

-- CreateTable
CREATE TABLE "registrations" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "registerNo" TEXT,
    "registerType" TEXT NOT NULL,
    "applyDate" TIMESTAMP(3),
    "approveDate" TIMESTAMP(3),
    "expiryDate" TIMESTAMP(3),
    "status" "RegistrationStatus" NOT NULL DEFAULT 'APPLYING',
    "remark" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "registrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "registration_attachments" (
    "id" TEXT NOT NULL,
    "registrationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "registration_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inspections" (
    "id" TEXT NOT NULL,
    "registrationId" TEXT NOT NULL,
    "productDesignId" TEXT,
    "type" "InspectionType" NOT NULL,
    "items" JSONB,
    "institution" TEXT NOT NULL,
    "reportNo" TEXT,
    "reportUrl" TEXT,
    "sampleBatch" TEXT,
    "applyDate" TIMESTAMP(3),
    "completeDate" TIMESTAMP(3),
    "result" "InspectionResult" NOT NULL DEFAULT 'PENDING',
    "cost" DOUBLE PRECISION,
    "status" "InspectionStatus" NOT NULL DEFAULT 'PENDING',
    "remark" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inspections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suppliers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "SupplierType" NOT NULL,
    "contact" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "license" TEXT,
    "qualification" TEXT,
    "rating" DOUBLE PRECISION,
    "contractUrl" TEXT,
    "contractEnd" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "remark" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "oem_contracts" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "contractNo" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "techStandard" TEXT,
    "unitPrice" DOUBLE PRECISION NOT NULL,
    "moq" INTEGER NOT NULL,
    "leadTime" INTEGER NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "contractUrl" TEXT,
    "status" "ContractStatus" NOT NULL DEFAULT 'ACTIVE',
    "remark" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "oem_contracts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_batches" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "batchNo" TEXT NOT NULL,
    "productionDate" TIMESTAMP(3) NOT NULL,
    "quantity" INTEGER NOT NULL,
    "status" "BatchStatus" NOT NULL DEFAULT 'IN_STOCK',
    "registrationNo" TEXT,
    "remark" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_trace_items" (
    "id" TEXT NOT NULL,
    "productBatchId" TEXT NOT NULL,
    "rawMaterialBatchId" TEXT NOT NULL,
    "usagePercentage" DOUBLE PRECISION,
    "remark" TEXT,

    CONSTRAINT "product_trace_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_applications" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "applicantId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "supplier" TEXT,
    "supplierId" TEXT,
    "totalAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "status" "PurchaseStatus" NOT NULL DEFAULT 'PENDING',
    "urgency" "Urgency" NOT NULL DEFAULT 'NORMAL',
    "purpose" TEXT NOT NULL,
    "relatedProject" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "purchase_applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_application_items" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "productDesignId" TEXT,
    "rawMaterialId" TEXT,
    "name" TEXT NOT NULL,
    "specification" TEXT,
    "quantity" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "estimatedPrice" DECIMAL(65,30) NOT NULL,
    "totalPrice" DECIMAL(65,30) NOT NULL,
    "remark" TEXT,

    CONSTRAINT "purchase_application_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approvals" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT,
    "reimbursementId" TEXT,
    "approverId" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "action" "ApprovalAction" NOT NULL DEFAULT 'PENDING',
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "approvals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reimbursements" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "applicantId" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "receipts" JSONB,
    "description" TEXT NOT NULL,
    "status" "PurchaseStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reimbursements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "formulas_code_key" ON "formulas"("code");

-- CreateIndex
CREATE UNIQUE INDEX "oem_contracts_contractNo_key" ON "oem_contracts"("contractNo");

-- CreateIndex
CREATE UNIQUE INDEX "product_batches_batchNo_key" ON "product_batches"("batchNo");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_applications_code_key" ON "purchase_applications"("code");

-- CreateIndex
CREATE UNIQUE INDEX "reimbursements_code_key" ON "reimbursements"("code");

-- AddForeignKey
ALTER TABLE "trademark_attachments" ADD CONSTRAINT "trademark_attachments_trademarkId_fkey" FOREIGN KEY ("trademarkId") REFERENCES "trademarks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patent_attachments" ADD CONSTRAINT "patent_attachments_patentId_fkey" FOREIGN KEY ("patentId") REFERENCES "patents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "raw_material_batches" ADD CONSTRAINT "raw_material_batches_rawMaterialId_fkey" FOREIGN KEY ("rawMaterialId") REFERENCES "raw_materials"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "formula_items" ADD CONSTRAINT "formula_items_formulaId_fkey" FOREIGN KEY ("formulaId") REFERENCES "formulas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "formula_items" ADD CONSTRAINT "formula_items_rawMaterialId_fkey" FOREIGN KEY ("rawMaterialId") REFERENCES "raw_materials"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "formula_versions" ADD CONSTRAINT "formula_versions_formulaId_fkey" FOREIGN KEY ("formulaId") REFERENCES "formulas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_designs" ADD CONSTRAINT "product_designs_formulaId_fkey" FOREIGN KEY ("formulaId") REFERENCES "formulas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_trademarks" ADD CONSTRAINT "product_trademarks_productId_fkey" FOREIGN KEY ("productId") REFERENCES "product_designs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_trademarks" ADD CONSTRAINT "product_trademarks_trademarkId_fkey" FOREIGN KEY ("trademarkId") REFERENCES "trademarks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registrations" ADD CONSTRAINT "registrations_productId_fkey" FOREIGN KEY ("productId") REFERENCES "product_designs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registration_attachments" ADD CONSTRAINT "registration_attachments_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "registrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inspections" ADD CONSTRAINT "inspections_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "registrations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inspections" ADD CONSTRAINT "inspections_productDesignId_fkey" FOREIGN KEY ("productDesignId") REFERENCES "product_designs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "oem_contracts" ADD CONSTRAINT "oem_contracts_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_trace_items" ADD CONSTRAINT "product_trace_items_productBatchId_fkey" FOREIGN KEY ("productBatchId") REFERENCES "product_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_trace_items" ADD CONSTRAINT "product_trace_items_rawMaterialBatchId_fkey" FOREIGN KEY ("rawMaterialBatchId") REFERENCES "raw_material_batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_applications" ADD CONSTRAINT "purchase_applications_applicantId_fkey" FOREIGN KEY ("applicantId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_applications" ADD CONSTRAINT "purchase_applications_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_application_items" ADD CONSTRAINT "purchase_application_items_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "purchase_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_application_items" ADD CONSTRAINT "purchase_application_items_productDesignId_fkey" FOREIGN KEY ("productDesignId") REFERENCES "product_designs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_application_items" ADD CONSTRAINT "purchase_application_items_rawMaterialId_fkey" FOREIGN KEY ("rawMaterialId") REFERENCES "raw_materials"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "purchase_applications"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_reimbursementId_fkey" FOREIGN KEY ("reimbursementId") REFERENCES "reimbursements"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reimbursements" ADD CONSTRAINT "reimbursements_applicantId_fkey" FOREIGN KEY ("applicantId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

