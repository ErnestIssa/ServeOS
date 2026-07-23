import type { Prisma, PrismaClient } from "@prisma/client";
import { LARGE_FILE_BYTES } from "./limits.js";

export type LibraryListQuery = {
  page?: number;
  pageSize?: number;
  q?: string;
  type?: "image" | "video" | "all";
  used?: boolean;
  unused?: boolean;
  favorite?: boolean;
  archived?: boolean;
  needsAlt?: boolean;
  largeFiles?: boolean;
  recentlyUploaded?: boolean;
  collectionId?: string;
};

export async function queryLibraryAssets(prisma: PrismaClient, restaurantId: string, query: LibraryListQuery) {
  const page = Math.max(1, query.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 48));
  const skip = (page - 1) * pageSize;

  const where: Prisma.MediaAssetWhereInput = {
    OR: [{ restaurantId }, { usages: { some: { restaurantId } } }]
  };

  if (query.archived) {
    where.archivedAt = { not: null };
  } else {
    where.archivedAt = null;
  }

  if (query.favorite) where.favorite = true;

  if (query.type === "image") {
    where.contentType = { startsWith: "image/" };
  } else if (query.type === "video") {
    where.contentType = { startsWith: "video/" };
  }

  if (query.needsAlt) {
    where.OR = [
      { restaurantId, altText: null },
      { restaurantId, altText: "" },
      { usages: { some: { restaurantId } }, altText: null },
      { usages: { some: { restaurantId } }, altText: "" }
    ];
  }

  if (query.largeFiles) {
    where.byteSize = { gte: LARGE_FILE_BYTES };
  }

  if (query.recentlyUploaded) {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    where.createdAt = { gte: since };
  }

  if (query.used) {
    where.usages = { some: { restaurantId } };
  }
  if (query.unused) {
    where.usages = { none: { restaurantId } };
  }

  if (query.collectionId) {
    where.collections = { some: { collectionId: query.collectionId } };
  }

  const q = query.q?.trim();
  if (q) {
    where.AND = [
      ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
      {
        OR: [
          { displayName: { contains: q, mode: "insensitive" } },
          { originalName: { contains: q, mode: "insensitive" } },
          { altText: { contains: q, mode: "insensitive" } },
          { tags: { has: q } }
        ]
      }
    ];
  }

  const [total, rows] = await Promise.all([
    prisma.mediaAsset.count({ where }),
    prisma.mediaAsset.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
      include: {
        _count: { select: { usages: true } },
        collections: { select: { collectionId: true } }
      }
    })
  ]);

  return {
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    assets: rows.map((a) => ({
      id: a.id,
      objectKey: a.objectKey,
      contentType: a.contentType,
      byteSize: a.byteSize,
      originalName: a.originalName,
      displayName: a.displayName ?? a.originalName ?? "Untitled",
      altText: a.altText,
      description: a.description,
      tags: a.tags,
      width: a.width,
      height: a.height,
      durationMs: a.durationMs,
      favorite: a.favorite,
      archivedAt: a.archivedAt?.toISOString() ?? null,
      processingStatus: a.processingStatus,
      currentVersionNumber: a.currentVersionNumber,
      sha256Hex: a.sha256Hex,
      visibility: a.visibility,
      createdAt: a.createdAt.toISOString(),
      updatedAt: a.updatedAt.toISOString(),
      usageCount: a._count.usages,
      collectionIds: a.collections.map((c) => c.collectionId),
      health: {
        missingAlt: !a.altText?.trim(),
        unused: a._count.usages === 0,
        largeFile: a.byteSize >= LARGE_FILE_BYTES,
        processingFailed: a.processingStatus === "FAILED"
      }
    }))
  };
}

export async function getLibraryAssetDetail(prisma: PrismaClient, restaurantId: string, assetId: string) {
  const asset = await prisma.mediaAsset.findFirst({
    where: {
      id: assetId,
      OR: [{ restaurantId }, { usages: { some: { restaurantId } } }]
    },
    include: {
      _count: { select: { usages: true } },
      versions: { orderBy: { versionNumber: "desc" } },
      collections: {
        include: { collection: { select: { id: true, name: true } } }
      },
      usages: {
        where: { restaurantId },
        orderBy: { createdAt: "desc" }
      }
    }
  });
  if (!asset) return null;

  return {
    id: asset.id,
    objectKey: asset.objectKey,
    originalObjectKey: asset.originalObjectKey,
    contentType: asset.contentType,
    byteSize: asset.byteSize,
    originalName: asset.originalName,
    displayName: asset.displayName ?? asset.originalName ?? "Untitled",
    altText: asset.altText,
    description: asset.description,
    tags: asset.tags,
    width: asset.width,
    height: asset.height,
    durationMs: asset.durationMs,
    favorite: asset.favorite,
    archivedAt: asset.archivedAt?.toISOString() ?? null,
    processingStatus: asset.processingStatus,
    currentVersionNumber: asset.currentVersionNumber,
    aiQualityScore: asset.aiQualityScore,
    aiTags: asset.aiTags,
    sha256Hex: asset.sha256Hex,
    visibility: asset.visibility,
    createdByUserId: asset.createdByUserId,
    createdAt: asset.createdAt.toISOString(),
    updatedAt: asset.updatedAt.toISOString(),
    usageCount: asset._count.usages,
    versions: asset.versions.map((v) => ({
      id: v.id,
      versionNumber: v.versionNumber,
      objectKey: v.objectKey,
      byteSize: v.byteSize,
      contentType: v.contentType,
      note: v.note,
      createdAt: v.createdAt.toISOString()
    })),
    collections: asset.collections.map((c) => ({
      id: c.collection.id,
      name: c.collection.name
    })),
    usages: asset.usages.map((u) => ({
      id: u.id,
      targetType: u.targetType,
      targetId: u.targetId,
      role: u.role,
      sortOrder: u.sortOrder,
      createdAt: u.createdAt.toISOString()
    })),
    health: {
      missingAlt: !asset.altText?.trim(),
      unused: asset._count.usages === 0,
      largeFile: asset.byteSize >= LARGE_FILE_BYTES,
      processingFailed: asset.processingStatus === "FAILED"
    }
  };
}
