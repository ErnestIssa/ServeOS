-- CreateEnum
CREATE TYPE "MediaImportSource" AS ENUM ('DEVICE', 'CAMERA', 'GOOGLE_DRIVE', 'DROPBOX', 'ONEDRIVE', 'URL', 'CLIPBOARD');

-- AlterTable
ALTER TABLE "MediaAsset" ADD COLUMN IF NOT EXISTS "importSource" "MediaImportSource",
ADD COLUMN IF NOT EXISTS "importSourceId" TEXT,
ADD COLUMN IF NOT EXISTS "importOriginalPath" TEXT,
ADD COLUMN IF NOT EXISTS "importedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "importedByUserId" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "MediaAsset_restaurantId_importSource_idx" ON "MediaAsset"("restaurantId", "importSource");
