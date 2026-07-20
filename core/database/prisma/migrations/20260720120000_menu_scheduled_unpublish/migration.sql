-- AlterTable
ALTER TABLE "Menu" ADD COLUMN IF NOT EXISTS "scheduledUnpublishAt" TIMESTAMP(3);
