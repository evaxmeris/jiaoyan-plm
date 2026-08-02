-- CreateTable: PermissionConfig
CREATE TABLE "permission_configs" (
    "operation" TEXT NOT NULL,
    "allowedRoles" TEXT[],
    "description" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "permission_configs_pkey" PRIMARY KEY ("operation")
);
