-- CreateEnum
CREATE TYPE "DataTransferDirection" AS ENUM ('IMPORT', 'EXPORT');

-- CreateEnum
CREATE TYPE "DataTransferJobStatus" AS ENUM ('QUEUED', 'RUNNING', 'VALIDATING', 'COMPLETED', 'FAILED', 'CANCELLED', 'ROLLED_BACK');

-- CreateTable
CREATE TABLE "DataTransferJob" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "direction" "DataTransferDirection" NOT NULL,
    "status" "DataTransferJobStatus" NOT NULL DEFAULT 'QUEUED',
    "targetKey" TEXT NOT NULL,
    "sourceFormat" TEXT,
    "fileName" TEXT,
    "fileHash" TEXT,
    "fileSizeBytes" INTEGER,
    "rowCount" INTEGER NOT NULL DEFAULT 0,
    "importedCount" INTEGER NOT NULL DEFAULT 0,
    "updatedCount" INTEGER NOT NULL DEFAULT 0,
    "skippedCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "warningCount" INTEGER NOT NULL DEFAULT 0,
    "dryRun" BOOLEAN NOT NULL DEFAULT false,
    "summary" JSONB,
    "error" TEXT,
    "startedByUserId" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "undoExpiresAt" TIMESTAMP(3),
    "undoAvailable" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DataTransferJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DataTransferJob_restaurantId_createdAt_idx" ON "DataTransferJob"("restaurantId", "createdAt");

-- CreateIndex
CREATE INDEX "DataTransferJob_restaurantId_status_idx" ON "DataTransferJob"("restaurantId", "status");

-- CreateIndex
CREATE INDEX "DataTransferJob_restaurantId_direction_idx" ON "DataTransferJob"("restaurantId", "direction");

-- AddForeignKey
ALTER TABLE "DataTransferJob" ADD CONSTRAINT "DataTransferJob_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
