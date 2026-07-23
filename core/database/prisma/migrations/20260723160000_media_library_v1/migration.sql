-- Media Library V1: extend MediaAsset + collections, versions, upload jobs

CREATE TYPE "MediaProcessingStatus" AS ENUM ('READY', 'PROCESSING', 'FAILED', 'SKIPPED');
CREATE TYPE "MediaUploadJobStatus" AS ENUM ('QUEUED', 'UPLOADING', 'PROCESSING', 'READY', 'FAILED');

-- Extend MediaAsset
ALTER TABLE "MediaAsset" ADD COLUMN IF NOT EXISTS "originalObjectKey" TEXT;
UPDATE "MediaAsset" SET "originalObjectKey" = "objectKey" WHERE "originalObjectKey" IS NULL;
ALTER TABLE "MediaAsset" ALTER COLUMN "originalObjectKey" SET NOT NULL;

ALTER TABLE "MediaAsset" ADD COLUMN IF NOT EXISTS "displayName" TEXT;
ALTER TABLE "MediaAsset" ADD COLUMN IF NOT EXISTS "altText" TEXT;
ALTER TABLE "MediaAsset" ADD COLUMN IF NOT EXISTS "description" TEXT;
ALTER TABLE "MediaAsset" ADD COLUMN IF NOT EXISTS "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "MediaAsset" ADD COLUMN IF NOT EXISTS "width" INTEGER;
ALTER TABLE "MediaAsset" ADD COLUMN IF NOT EXISTS "height" INTEGER;
ALTER TABLE "MediaAsset" ADD COLUMN IF NOT EXISTS "durationMs" INTEGER;
ALTER TABLE "MediaAsset" ADD COLUMN IF NOT EXISTS "favorite" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "MediaAsset" ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3);
ALTER TABLE "MediaAsset" ADD COLUMN IF NOT EXISTS "processingStatus" "MediaProcessingStatus" NOT NULL DEFAULT 'READY';
ALTER TABLE "MediaAsset" ADD COLUMN IF NOT EXISTS "currentVersionNumber" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "MediaAsset" ADD COLUMN IF NOT EXISTS "aiQualityScore" DOUBLE PRECISION;
ALTER TABLE "MediaAsset" ADD COLUMN IF NOT EXISTS "aiTags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "MediaAsset" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX IF NOT EXISTS "MediaAsset_restaurantId_archivedAt_idx" ON "MediaAsset"("restaurantId", "archivedAt");
CREATE INDEX IF NOT EXISTS "MediaAsset_restaurantId_favorite_idx" ON "MediaAsset"("restaurantId", "favorite");
CREATE INDEX IF NOT EXISTS "MediaAsset_restaurantId_processingStatus_idx" ON "MediaAsset"("restaurantId", "processingStatus");

CREATE TABLE IF NOT EXISTS "MediaAssetVersion" (
  "id" TEXT NOT NULL,
  "assetId" TEXT NOT NULL,
  "versionNumber" INTEGER NOT NULL,
  "objectKey" TEXT NOT NULL,
  "byteSize" INTEGER NOT NULL,
  "contentType" TEXT NOT NULL,
  "sha256Hex" TEXT,
  "note" TEXT,
  "createdByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MediaAssetVersion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "MediaAssetVersion_assetId_versionNumber_key" ON "MediaAssetVersion"("assetId", "versionNumber");
CREATE INDEX IF NOT EXISTS "MediaAssetVersion_assetId_idx" ON "MediaAssetVersion"("assetId");

CREATE TABLE IF NOT EXISTS "MediaCollection" (
  "id" TEXT NOT NULL,
  "restaurantId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MediaCollection_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "MediaCollection_restaurantId_name_key" ON "MediaCollection"("restaurantId", "name");
CREATE INDEX IF NOT EXISTS "MediaCollection_restaurantId_idx" ON "MediaCollection"("restaurantId");

CREATE TABLE IF NOT EXISTS "MediaCollectionItem" (
  "id" TEXT NOT NULL,
  "collectionId" TEXT NOT NULL,
  "assetId" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MediaCollectionItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "MediaCollectionItem_collectionId_assetId_key" ON "MediaCollectionItem"("collectionId", "assetId");
CREATE INDEX IF NOT EXISTS "MediaCollectionItem_assetId_idx" ON "MediaCollectionItem"("assetId");

CREATE TABLE IF NOT EXISTS "MediaUploadJob" (
  "id" TEXT NOT NULL,
  "restaurantId" TEXT NOT NULL,
  "status" "MediaUploadJobStatus" NOT NULL DEFAULT 'QUEUED',
  "stage" TEXT NOT NULL DEFAULT 'queued',
  "progress" INTEGER NOT NULL DEFAULT 0,
  "assetId" TEXT,
  "error" TEXT,
  "originalName" TEXT,
  "contentType" TEXT,
  "purpose" TEXT,
  "objectKey" TEXT,
  "createdByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MediaUploadJob_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "MediaUploadJob_restaurantId_status_idx" ON "MediaUploadJob"("restaurantId", "status");
CREATE INDEX IF NOT EXISTS "MediaUploadJob_restaurantId_createdAt_idx" ON "MediaUploadJob"("restaurantId", "createdAt");

-- Seed version 1 for existing assets
INSERT INTO "MediaAssetVersion" ("id", "assetId", "versionNumber", "objectKey", "byteSize", "contentType", "sha256Hex", "createdByUserId", "createdAt")
SELECT
  'mav_' || a."id",
  a."id",
  1,
  a."objectKey",
  a."byteSize",
  a."contentType",
  a."sha256Hex",
  a."createdByUserId",
  a."createdAt"
FROM "MediaAsset" a
WHERE NOT EXISTS (
  SELECT 1 FROM "MediaAssetVersion" v WHERE v."assetId" = a."id" AND v."versionNumber" = 1
);

DO $$ BEGIN
  ALTER TABLE "MediaAssetVersion" ADD CONSTRAINT "MediaAssetVersion_assetId_fkey"
    FOREIGN KEY ("assetId") REFERENCES "MediaAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "MediaCollection" ADD CONSTRAINT "MediaCollection_restaurantId_fkey"
    FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "MediaCollectionItem" ADD CONSTRAINT "MediaCollectionItem_collectionId_fkey"
    FOREIGN KEY ("collectionId") REFERENCES "MediaCollection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "MediaCollectionItem" ADD CONSTRAINT "MediaCollectionItem_assetId_fkey"
    FOREIGN KEY ("assetId") REFERENCES "MediaAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "MediaUploadJob" ADD CONSTRAINT "MediaUploadJob_restaurantId_fkey"
    FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "MediaUploadJob" ADD CONSTRAINT "MediaUploadJob_assetId_fkey"
    FOREIGN KEY ("assetId") REFERENCES "MediaAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
