-- CreateEnum
CREATE TYPE "CustomerReservationStatus" AS ENUM ('CONFIRMED', 'CANCELLED', 'COMPLETED');

-- CreateTable
CREATE TABLE "CustomerReservation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "confirmationCode" TEXT NOT NULL,
    "status" "CustomerReservationStatus" NOT NULL DEFAULT 'CONFIRMED',
    "startsAt" TIMESTAMP(3) NOT NULL,
    "draft" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerReservation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CustomerReservation_confirmationCode_key" ON "CustomerReservation"("confirmationCode");

-- CreateIndex
CREATE INDEX "CustomerReservation_userId_status_startsAt_idx" ON "CustomerReservation"("userId", "status", "startsAt");

-- CreateIndex
CREATE INDEX "CustomerReservation_restaurantId_idx" ON "CustomerReservation"("restaurantId");

-- AddForeignKey
ALTER TABLE "CustomerReservation" ADD CONSTRAINT "CustomerReservation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerReservation" ADD CONSTRAINT "CustomerReservation_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
