-- CreateEnum
CREATE TYPE "DataTransferTemplateStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');

-- CreateTable
CREATE TABLE "DataTransferTemplate" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "targetKey" TEXT NOT NULL,
    "format" TEXT NOT NULL DEFAULT 'csv',
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" "DataTransferTemplateStatus" NOT NULL DEFAULT 'ACTIVE',
    "content" TEXT NOT NULL,
    "systemKey" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdByUserId" TEXT,
    "updatedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DataTransferTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DataTransferTemplate_restaurantId_updatedAt_idx" ON "DataTransferTemplate"("restaurantId", "updatedAt");

-- CreateIndex
CREATE INDEX "DataTransferTemplate_restaurantId_targetKey_idx" ON "DataTransferTemplate"("restaurantId", "targetKey");

-- CreateIndex
CREATE INDEX "DataTransferTemplate_restaurantId_status_idx" ON "DataTransferTemplate"("restaurantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "DataTransferTemplate_restaurantId_systemKey_key" ON "DataTransferTemplate"("restaurantId", "systemKey");

-- AddForeignKey
ALTER TABLE "DataTransferTemplate" ADD CONSTRAINT "DataTransferTemplate_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
