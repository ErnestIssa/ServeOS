-- Content Replication Engine V1: assets, usages, jobs, maps, templates

CREATE TYPE "MediaUsageTargetType" AS ENUM ('MENU_COVER', 'MENU_ITEM', 'CATEGORY', 'VENUE_LOGO', 'VENUE_COVER');
CREATE TYPE "MediaUsageRole" AS ENUM ('PRIMARY', 'GALLERY', 'COVER');
CREATE TYPE "ReplicationJobKind" AS ENUM ('DUPLICATE_MENU', 'DUPLICATE_CATEGORY', 'DUPLICATE_ITEM', 'DUPLICATE_TO_LOCATION', 'APPLY_TEMPLATE', 'DUPLICATE_MEDIA_USAGE');
CREATE TYPE "ReplicationJobStatus" AS ENUM ('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED', 'PAUSED', 'RETRYING');
CREATE TYPE "ContentTemplateKind" AS ENUM ('MENU');

CREATE TABLE "MediaAsset" (
    "id" TEXT NOT NULL,
    "objectKey" TEXT NOT NULL,
    "sha256Hex" TEXT,
    "contentType" TEXT NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "originalName" TEXT,
    "visibility" "StoredMediaVisibility" NOT NULL DEFAULT 'PRIVATE',
    "createdByUserId" TEXT,
    "restaurantId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MediaAsset_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MediaUsage" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "targetType" "MediaUsageTargetType" NOT NULL,
    "targetId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "role" "MediaUsageRole" NOT NULL DEFAULT 'GALLERY',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MediaUsage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ReplicationJob" (
    "id" TEXT NOT NULL,
    "kind" "ReplicationJobKind" NOT NULL,
    "status" "ReplicationJobStatus" NOT NULL DEFAULT 'QUEUED',
    "sourceRestaurantId" TEXT NOT NULL,
    "targetRestaurantId" TEXT,
    "actorUserId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "progressPct" INTEGER NOT NULL DEFAULT 0,
    "phase" TEXT,
    "counts" JSONB,
    "result" JSONB,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    CONSTRAINT "ReplicationJob_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ReplicationMap" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReplicationMap_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ContentTemplate" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "companyId" TEXT,
    "kind" "ContentTemplateKind" NOT NULL DEFAULT 'MENU',
    "name" TEXT NOT NULL,
    "description" TEXT,
    "snapshot" JSONB NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ContentTemplate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MediaAsset_objectKey_key" ON "MediaAsset"("objectKey");
CREATE INDEX "MediaAsset_restaurantId_idx" ON "MediaAsset"("restaurantId");
CREATE INDEX "MediaAsset_sha256Hex_idx" ON "MediaAsset"("sha256Hex");

CREATE UNIQUE INDEX "MediaUsage_assetId_targetType_targetId_role_sortOrder_key" ON "MediaUsage"("assetId", "targetType", "targetId", "role", "sortOrder");
CREATE INDEX "MediaUsage_restaurantId_targetType_targetId_idx" ON "MediaUsage"("restaurantId", "targetType", "targetId");
CREATE INDEX "MediaUsage_assetId_idx" ON "MediaUsage"("assetId");

CREATE INDEX "ReplicationJob_status_createdAt_idx" ON "ReplicationJob"("status", "createdAt");
CREATE INDEX "ReplicationJob_sourceRestaurantId_createdAt_idx" ON "ReplicationJob"("sourceRestaurantId", "createdAt");
CREATE INDEX "ReplicationJob_actorUserId_createdAt_idx" ON "ReplicationJob"("actorUserId", "createdAt");

CREATE UNIQUE INDEX "ReplicationMap_jobId_entityType_sourceId_key" ON "ReplicationMap"("jobId", "entityType", "sourceId");
CREATE INDEX "ReplicationMap_jobId_idx" ON "ReplicationMap"("jobId");

CREATE INDEX "ContentTemplate_restaurantId_kind_idx" ON "ContentTemplate"("restaurantId", "kind");
CREATE INDEX "ContentTemplate_companyId_kind_idx" ON "ContentTemplate"("companyId", "kind");

ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MediaUsage" ADD CONSTRAINT "MediaUsage_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "MediaAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MediaUsage" ADD CONSTRAINT "MediaUsage_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReplicationJob" ADD CONSTRAINT "ReplicationJob_sourceRestaurantId_fkey" FOREIGN KEY ("sourceRestaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReplicationJob" ADD CONSTRAINT "ReplicationJob_targetRestaurantId_fkey" FOREIGN KEY ("targetRestaurantId") REFERENCES "Restaurant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ReplicationMap" ADD CONSTRAINT "ReplicationMap_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "ReplicationJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContentTemplate" ADD CONSTRAINT "ContentTemplate_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
