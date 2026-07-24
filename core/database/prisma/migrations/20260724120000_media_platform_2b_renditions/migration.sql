-- Media Platform Phase 2B: renditions + blurHash + expanded usage targets

ALTER TYPE "MediaUsageTargetType" ADD VALUE IF NOT EXISTS 'STAFF_AVATAR';
ALTER TYPE "MediaUsageTargetType" ADD VALUE IF NOT EXISTS 'CUSTOMER_AVATAR';
ALTER TYPE "MediaUsageTargetType" ADD VALUE IF NOT EXISTS 'MODIFIER_OPTION';
ALTER TYPE "MediaUsageTargetType" ADD VALUE IF NOT EXISTS 'QR_HERO';
ALTER TYPE "MediaUsageTargetType" ADD VALUE IF NOT EXISTS 'MARKETING_CAMPAIGN';
ALTER TYPE "MediaUsageTargetType" ADD VALUE IF NOT EXISTS 'LOYALTY_REWARD';
ALTER TYPE "MediaUsageTargetType" ADD VALUE IF NOT EXISTS 'RECEIPT_BRANDING';
ALTER TYPE "MediaUsageTargetType" ADD VALUE IF NOT EXISTS 'RESERVATION';
ALTER TYPE "MediaUsageTargetType" ADD VALUE IF NOT EXISTS 'GIFT_CARD';

ALTER TABLE "MediaAsset" ADD COLUMN IF NOT EXISTS "blurHash" TEXT;

CREATE TYPE "MediaRenditionKind" AS ENUM ('ORIGINAL', 'THUMB', 'CARD', 'WEBP', 'BLUR');

CREATE TABLE IF NOT EXISTS "MediaAssetRendition" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "kind" "MediaRenditionKind" NOT NULL,
    "objectKey" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "blurHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MediaAssetRendition_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "MediaAssetRendition_assetId_kind_key" ON "MediaAssetRendition"("assetId", "kind");
CREATE INDEX IF NOT EXISTS "MediaAssetRendition_assetId_idx" ON "MediaAssetRendition"("assetId");
CREATE INDEX IF NOT EXISTS "MediaAssetRendition_objectKey_idx" ON "MediaAssetRendition"("objectKey");

ALTER TABLE "MediaAssetRendition"
  DROP CONSTRAINT IF EXISTS "MediaAssetRendition_assetId_fkey";
ALTER TABLE "MediaAssetRendition"
  ADD CONSTRAINT "MediaAssetRendition_assetId_fkey"
  FOREIGN KEY ("assetId") REFERENCES "MediaAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
