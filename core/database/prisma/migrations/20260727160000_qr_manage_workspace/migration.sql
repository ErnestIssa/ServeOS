-- QR manage workspace: notes, pause ordering, archive status.

ALTER TYPE "QrCodeStatus" ADD VALUE 'ARCHIVED';

ALTER TABLE "QrCode" ADD COLUMN "description" TEXT;
ALTER TABLE "QrCode" ADD COLUMN "orderingPaused" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "QrCode" ADD COLUMN "sessionTtlHours" INTEGER;
ALTER TABLE "QrCode" ADD COLUMN "archivedAt" TIMESTAMP(3);
