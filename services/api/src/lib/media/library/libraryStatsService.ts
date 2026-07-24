import type { PrismaClient } from "@prisma/client";
import { LARGE_FILE_BYTES } from "./limits.js";

function assetHealthScore(a: {
  altText: string | null;
  byteSize: number;
  usageCount: number;
  processingStatus: string;
  contentType: string;
  width: number | null;
  height: number | null;
  hasThumb: boolean;
  hasWebp: boolean;
  hasBlurHash: boolean;
}): number {
  let score = 100;
  if (!a.altText?.trim()) score -= 15;
  if (a.byteSize >= LARGE_FILE_BYTES) score -= 12;
  if (a.usageCount === 0) score -= 8;
  if (a.processingStatus === "FAILED") score -= 40;
  if (a.contentType.startsWith("image/")) {
    if (a.width == null || a.height == null) score -= 8;
    if (!a.hasThumb) score -= 10;
    if (!a.hasWebp) score -= 10;
    if (!a.hasBlurHash) score -= 5;
  }
  return Math.max(0, score);
}

export async function getLibraryStats(prisma: PrismaClient, restaurantId: string) {
  const assets = await prisma.mediaAsset.findMany({
    where: {
      archivedAt: null,
      OR: [{ restaurantId }, { usages: { some: { restaurantId } } }]
    },
    select: {
      id: true,
      byteSize: true,
      contentType: true,
      altText: true,
      sha256Hex: true,
      processingStatus: true,
      width: true,
      height: true,
      blurHash: true,
      renditions: { select: { kind: true } },
      _count: { select: { usages: { where: { restaurantId } } } }
    }
  });

  const hashCounts = new Map<string, number>();
  for (const a of assets) {
    const sha = a.sha256Hex?.trim();
    if (!sha) continue;
    hashCounts.set(sha, (hashCounts.get(sha) ?? 0) + 1);
  }
  let duplicateGroupCount = 0;
  for (const count of hashCounts.values()) {
    if (count >= 2) duplicateGroupCount += 1;
  }

  let storageBytes = 0;
  let unusedCount = 0;
  let missingAltCount = 0;
  let imageCount = 0;
  let videoCount = 0;
  let videosProcessing = 0;
  let healthSum = 0;

  for (const a of assets) {
    storageBytes += a.byteSize;
    const usageCount = a._count.usages;
    if (usageCount === 0) unusedCount += 1;
    if (!a.altText?.trim()) missingAltCount += 1;
    const hasThumb = a.renditions.some((r) => r.kind === "THUMB");
    const hasWebp = a.renditions.some((r) => r.kind === "WEBP");
    if (a.contentType.startsWith("image/")) imageCount += 1;
    if (a.contentType.startsWith("video/")) {
      videoCount += 1;
      if (a.processingStatus === "PROCESSING") videosProcessing += 1;
    }
    healthSum += assetHealthScore({
      altText: a.altText,
      byteSize: a.byteSize,
      usageCount,
      processingStatus: a.processingStatus,
      contentType: a.contentType,
      width: a.width,
      height: a.height,
      hasThumb,
      hasWebp,
      hasBlurHash: Boolean(a.blurHash)
    });
  }

  const totalAssets = assets.length;
  const libraryHealthScore = totalAssets === 0 ? 100 : Math.round(healthSum / totalAssets);

  return {
    totalAssets,
    storageBytes,
    unusedCount,
    duplicateGroupCount,
    videosProcessing,
    imageCount,
    videoCount,
    missingAltCount,
    libraryHealthScore
  };
}

export async function findAssetByHash(
  prisma: PrismaClient,
  restaurantId: string,
  sha256Hex: string
) {
  const sha = sha256Hex.trim();
  if (!sha) return null;
  return prisma.mediaAsset.findFirst({
    where: {
      sha256Hex: sha,
      archivedAt: null,
      OR: [{ restaurantId }, { usages: { some: { restaurantId } } }]
    },
    orderBy: { createdAt: "asc" }
  });
}
