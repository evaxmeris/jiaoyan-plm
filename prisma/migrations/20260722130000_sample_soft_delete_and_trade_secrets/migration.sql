-- CreateEnum
CREATE TYPE "TradeSecretLevel" AS ENUM ('TOP_SECRET', 'CONFIDENTIAL', 'INTERNAL');

-- AlterTable: Add soft delete fields to sample_tasks
ALTER TABLE "sample_tasks" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "sample_tasks" ADD COLUMN "isDeleted" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable: trade_secrets
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

-- CreateIndex
CREATE INDEX "trade_secrets_is_deleted_idx" ON "trade_secrets"("isDeleted");
CREATE INDEX "sample_tasks_is_deleted_idx" ON "sample_tasks"("isDeleted");

-- AddForeignKey
ALTER TABLE "trade_secrets" ADD CONSTRAINT "trade_secrets_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
