-- CreateEnum
CREATE TYPE "DataTransferMigrationRequestStatus" AS ENUM ('PENDING', 'REVIEWING', 'CLOSED');

-- CreateTable
CREATE TABLE "DataTransferMigrationRequest" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "providerKey" TEXT NOT NULL,
    "providerLabel" TEXT,
    "note" TEXT,
    "status" "DataTransferMigrationRequestStatus" NOT NULL DEFAULT 'PENDING',
    "requestedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DataTransferMigrationRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DataTransferMigrationRequest_restaurantId_createdAt_idx" ON "DataTransferMigrationRequest"("restaurantId", "createdAt");

-- CreateIndex
CREATE INDEX "DataTransferMigrationRequest_restaurantId_status_idx" ON "DataTransferMigrationRequest"("restaurantId", "status");

-- AddForeignKey
ALTER TABLE "DataTransferMigrationRequest" ADD CONSTRAINT "DataTransferMigrationRequest_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
