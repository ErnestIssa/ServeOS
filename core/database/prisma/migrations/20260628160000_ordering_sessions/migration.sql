-- CreateEnum
CREATE TYPE "OrderingSessionType" AS ENUM ('QR_SESSION', 'WALK_IN_SESSION', 'LINK_SESSION', 'STAFF_ASSISTED_SESSION');

-- CreateEnum
CREATE TYPE "OrderingSessionStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'CLOSED');

-- CreateEnum
CREATE TYPE "OrderingPaymentMode" AS ENUM ('PAY_AT_VENUE', 'PREPAY', 'HYBRID');

-- CreateTable
CREATE TABLE "OrderingSession" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "sessionType" "OrderingSessionType" NOT NULL DEFAULT 'QR_SESSION',
    "status" "OrderingSessionStatus" NOT NULL DEFAULT 'ACTIVE',
    "entryMode" TEXT,
    "tableId" TEXT,
    "tableLabel" TEXT,
    "locationId" TEXT,
    "paymentMode" "OrderingPaymentMode" NOT NULL DEFAULT 'PREPAY',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastActiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderingSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrderingSession_restaurantId_status_idx" ON "OrderingSession"("restaurantId", "status");

-- CreateIndex
CREATE INDEX "OrderingSession_expiresAt_idx" ON "OrderingSession"("expiresAt");

-- AddForeignKey
ALTER TABLE "OrderingSession" ADD CONSTRAINT "OrderingSession_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
