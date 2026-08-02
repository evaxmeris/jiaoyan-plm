warn The configuration property `package.json#prisma` is deprecated and will be removed in Prisma 7. Please migrate to a Prisma config file (e.g., `prisma.config.ts`).
For more information, see: https://pris.ly/prisma-config

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "ScheduleStatus" AS ENUM ('PLANNED', 'IN_PROGRESS', 'COMPLETED', 'DELAYED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ApprovalRequestStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ServiceContractType" AS ENUM ('TRANSLATION', 'LEGAL', 'CONSULTING', 'TESTING', 'OTHER');

-- CreateEnum
CREATE TYPE "ServiceContractStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'ACTIVE', 'COMPLETED', 'TERMINATED');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('CEO', 'RND_MANAGER', 'DEVELOPER', 'COMPLIANCE', 'PURCHASER', 'FINANCE', 'PRODUCTION', 'OBSERVER');

-- CreateEnum
CREATE TYPE "TrademarkType" AS ENUM ('WORD', 'FIGURE', 'COMBINED');

-- CreateEnum
CREATE TYPE "TrademarkStatus" AS ENUM ('DRAFT', 'FILING', 'ACCEPTED', 'PUBLISHED', 'OPPOSITION', 'REGISTERED', 'RENEWING', 'EXPIRED', 'REJECTED');

-- CreateEnum
CREATE TYPE "PatentType" AS ENUM ('INVENTION', 'UTILITY', 'DESIGN');

-- CreateEnum
CREATE TYPE "PatentStatus" AS ENUM ('DRAFT', 'FILING', 'ACCEPTED', 'SUBSTANTIVE', 'AUTHORIZED', 'MAINTENANCE', 'EXPIRED', 'REJECTED');

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
CREATE TYPE "CertStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'APPROVED', 'REJECTED', 'EXPIRED');

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

-- CreateEnum
CREATE TYPE "SampleStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "PatentFeeStatus" AS ENUM ('PENDING', 'PAID', 'OVERDUE');

-- CreateEnum
CREATE TYPE "TradeSecretLevel" AS ENUM ('TOP_SECRET', 'CONFIDENTIAL', 'INTERNAL');

-- CreateEnum
CREATE TYPE "SupplierDocType" AS ENUM ('BUSINESS_LICENSE', 'PRODUCTION_LICENSE', 'CERTIFICATION', 'NDA', 'QUALITY_AGREEMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "DocStatus" AS ENUM ('VALID', 'EXPIRING', 'EXPIRED');

-- CreateEnum
CREATE TYPE "AuditResult" AS ENUM ('PASS', 'CONDITIONAL', 'FAIL');

-- CreateEnum
CREATE TYPE "IQCResult" AS ENUM ('PENDING', 'PASS', 'CONDITIONAL', 'FAIL');

-- CreateEnum
CREATE TYPE "Disposition" AS ENUM ('USE_AS_IS', 'RETURN', 'SCRAP');

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
CREATE TABLE "permission_configs" (
    "operation" TEXT NOT NULL,
    "allowedRoles" TEXT[],
    "description" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "permission_configs_pkey" PRIMARY KEY ("operation")
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
    "filingDate" TIMESTAMP(3),
    "publicationDate" TIMESTAMP(3),
    "registrationDate" TIMESTAMP(3),
    "renewalDate" TIMESTAMP(3),
    "agency" TEXT,
    "agentContact" TEXT,
    "fee" DOUBLE PRECISION,
    "filingReceipt" TEXT,
    "registrationCert" TEXT,
    "status" "TrademarkStatus" NOT NULL DEFAULT 'DRAFT',
    "owner" TEXT NOT NULL,
    "remark" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,

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
    "status" "PatentStatus" NOT NULL DEFAULT 'DRAFT',
    "techField" TEXT,
    "remark" TEXT,
    "filingDate" TIMESTAMP(3),
    "publicationDate" TIMESTAMP(3),
    "agency" TEXT,
    "agentContact" TEXT,
    "fee" DOUBLE PRECISION,
    "filingReceipt" TEXT,
    "patentCert" TEXT,
    "officeActions" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,

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
    "filingNo" TEXT,
    "filingStatus" "RecordStatus" NOT NULL DEFAULT 'UNRECORDED',
    "filingExpireDate" TIMESTAMP(3),
    "inciName" TEXT,
    "safetyInfoUrl" TEXT,
    "msdsUrl" TEXT,
    "tdsUrl" TEXT,
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
    "deletedAt" TIMESTAMP(3),
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,

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
    "expireDate" TIMESTAMP(3),
    "supplier" TEXT NOT NULL,
    "coaUrl" TEXT,
    "status" "BatchStatus" NOT NULL DEFAULT 'IN_STOCK',
    "remark" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "raw_material_batches_pkey" PRIMARY KEY ("id")
);

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
    "deletedAt" TIMESTAMP(3),
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,

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
    "deletedAt" TIMESTAMP(3),
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,

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
    "deletedAt" TIMESTAMP(3),
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,

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
    "deletedAt" TIMESTAMP(3),
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,

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
    "deletedAt" TIMESTAMP(3),
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,

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
    "deletedAt" TIMESTAMP(3),
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "oem_contracts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "oem_price_history" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "unitPrice" DOUBLE PRECISION NOT NULL,
    "moq" INTEGER,
    "effectiveDate" TIMESTAMP(3) NOT NULL,
    "remark" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "oem_price_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "oem_schedules" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "orderQty" INTEGER NOT NULL,
    "plannedDate" TIMESTAMP(3) NOT NULL,
    "completedDate" TIMESTAMP(3),
    "status" "ScheduleStatus" NOT NULL DEFAULT 'PLANNED',
    "remark" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "oem_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_documents" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "type" "SupplierDocType" NOT NULL,
    "name" TEXT NOT NULL,
    "fileUrl" TEXT,
    "issueDate" TIMESTAMP(3),
    "expireDate" TIMESTAMP(3),
    "notifyDays" INTEGER NOT NULL DEFAULT 30,
    "status" "DocStatus" NOT NULL DEFAULT 'VALID',
    "remark" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "supplier_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_audits" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "auditDate" TIMESTAMP(3) NOT NULL,
    "auditor" TEXT NOT NULL,
    "result" "AuditResult" NOT NULL,
    "score" DOUBLE PRECISION,
    "reportUrl" TEXT,
    "findings" JSONB,
    "remark" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supplier_audits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_evaluations" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "evalDate" TIMESTAMP(3) NOT NULL,
    "scoreQuality" DOUBLE PRECISION NOT NULL,
    "scoreDelivery" DOUBLE PRECISION NOT NULL,
    "scoreService" DOUBLE PRECISION NOT NULL,
    "scoreTotal" DOUBLE PRECISION NOT NULL,
    "evaluator" TEXT NOT NULL,
    "remark" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supplier_evaluations_pkey" PRIMARY KEY ("id")
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
    "deletedAt" TIMESTAMP(3),
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,

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
CREATE TABLE "approval_flows" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "module" TEXT NOT NULL DEFAULT 'purchase',
    "stages" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "approval_flows_pkey" PRIMARY KEY ("id")
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
CREATE TABLE "approval_requests" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "amount" DOUBLE PRECISION,
    "requesterId" TEXT NOT NULL,
    "status" "ApprovalRequestStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "approval_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_items" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "role" TEXT,
    "approverId" TEXT,
    "action" "ApprovalAction" NOT NULL DEFAULT 'PENDING',
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "approval_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "budgets" (
    "id" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "fiscalYear" INTEGER NOT NULL,
    "totalAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "usedAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "budgets_pkey" PRIMARY KEY ("id")
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

-- CreateTable
CREATE TABLE "sample_tasks" (
    "id" TEXT NOT NULL,
    "productDesignId" TEXT NOT NULL,
    "batchNo" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "result" TEXT,
    "evaluation" TEXT,
    "nextAction" TEXT,
    "status" "SampleStatus" NOT NULL DEFAULT 'PENDING',
    "assignedTo" TEXT,
    "dueDate" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "remark" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "sample_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
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

-- CreateTable
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

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "userName" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "detail" JSONB,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
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

-- CreateTable
CREATE TABLE "service_contracts" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contractor" TEXT NOT NULL,
    "type" "ServiceContractType" NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "signingDate" TIMESTAMP(3) NOT NULL,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "status" "ServiceContractStatus" NOT NULL DEFAULT 'DRAFT',
    "fileUrl" TEXT,
    "remark" TEXT,
    "applicantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_contracts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trade_secrets" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "summary" TEXT,
    "level" "TradeSecretLevel" NOT NULL DEFAULT 'CONFIDENTIAL',
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "trade_secrets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "files" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "fileType" TEXT,
    "expireDate" TIMESTAMP(3),
    "uploadedBy" TEXT,
    "remark" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "files_pkey" PRIMARY KEY ("id")
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
CREATE INDEX "approval_requests_entityType_entityId_idx" ON "approval_requests"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "approval_requests_requesterId_idx" ON "approval_requests"("requesterId");

-- CreateIndex
CREATE INDEX "approval_requests_status_idx" ON "approval_requests"("status");

-- CreateIndex
CREATE INDEX "approval_items_requestId_idx" ON "approval_items"("requestId");

-- CreateIndex
CREATE INDEX "approval_items_approverId_idx" ON "approval_items"("approverId");

-- CreateIndex
CREATE UNIQUE INDEX "budgets_department_fiscalYear_key" ON "budgets"("department", "fiscalYear");

-- CreateIndex
CREATE UNIQUE INDEX "reimbursements_code_key" ON "reimbursements"("code");

-- CreateIndex
CREATE UNIQUE INDEX "product_milestones_productDesignId_stage_key" ON "product_milestones"("productDesignId", "stage");

-- CreateIndex
CREATE INDEX "files_entityType_entityId_idx" ON "files"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "files_fileType_idx" ON "files"("fileType");

-- AddForeignKey
ALTER TABLE "trademark_attachments" ADD CONSTRAINT "trademark_attachments_trademarkId_fkey" FOREIGN KEY ("trademarkId") REFERENCES "trademarks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patent_attachments" ADD CONSTRAINT "patent_attachments_patentId_fkey" FOREIGN KEY ("patentId") REFERENCES "patents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "raw_material_batches" ADD CONSTRAINT "raw_material_batches_rawMaterialId_fkey" FOREIGN KEY ("rawMaterialId") REFERENCES "raw_materials"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incoming_inspections" ADD CONSTRAINT "incoming_inspections_rawMaterialId_fkey" FOREIGN KEY ("rawMaterialId") REFERENCES "raw_materials"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incoming_inspections" ADD CONSTRAINT "incoming_inspections_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "raw_material_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

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
ALTER TABLE "inspections" ADD CONSTRAINT "inspections_productDesignId_fkey" FOREIGN KEY ("productDesignId") REFERENCES "product_designs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inspections" ADD CONSTRAINT "inspections_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "registrations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "oem_contracts" ADD CONSTRAINT "oem_contracts_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "oem_price_history" ADD CONSTRAINT "oem_price_history_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "oem_contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "oem_schedules" ADD CONSTRAINT "oem_schedules_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "oem_contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_documents" ADD CONSTRAINT "supplier_documents_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_audits" ADD CONSTRAINT "supplier_audits_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_evaluations" ADD CONSTRAINT "supplier_evaluations_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

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
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "purchase_applications"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_reimbursementId_fkey" FOREIGN KEY ("reimbursementId") REFERENCES "reimbursements"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_items" ADD CONSTRAINT "approval_items_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "approval_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_items" ADD CONSTRAINT "approval_items_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reimbursements" ADD CONSTRAINT "reimbursements_applicantId_fkey" FOREIGN KEY ("applicantId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sample_tasks" ADD CONSTRAINT "sample_tasks_productDesignId_fkey" FOREIGN KEY ("productDesignId") REFERENCES "product_designs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_certifications" ADD CONSTRAINT "product_certifications_productDesignId_fkey" FOREIGN KEY ("productDesignId") REFERENCES "product_designs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_milestones" ADD CONSTRAINT "product_milestones_productDesignId_fkey" FOREIGN KEY ("productDesignId") REFERENCES "product_designs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patent_fees" ADD CONSTRAINT "patent_fees_patentId_fkey" FOREIGN KEY ("patentId") REFERENCES "patents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_contracts" ADD CONSTRAINT "service_contracts_applicantId_fkey" FOREIGN KEY ("applicantId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trade_secrets" ADD CONSTRAINT "trade_secrets_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

