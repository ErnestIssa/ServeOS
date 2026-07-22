import type { MediaUsageRole, MediaUsageTargetType, Prisma, PrismaClient, StoredMediaVisibility } from "@prisma/client";
import { deleteObject } from "../integrations/objectStorage.js";

type Db = PrismaClient | Prisma.TransactionClient;

export type EnsureAssetInput = {
  objectKey: string;
  contentType: string;
  byteSize: number;
  sha256Hex?: string | null;
  originalName?: string | null;
  visibility?: StoredMediaVisibility;
  createdByUserId?: string | null;
  restaurantId?: string | null;
};

/**
 * Resolve or create a MediaAsset for an uploaded object.
 * Prefer sha256 match (same bytes = same asset) so duplicate uploads do not double S3.
 */
export async function ensureAssetFromUpload(prisma: Db, input: EnsureAssetInput) {
  const sha = input.sha256Hex?.trim() || null;

  if (sha) {
    const byHash = await prisma.mediaAsset.findFirst({ where: { sha256Hex: sha } });
    if (byHash) return byHash;
  }

  const byKey = await prisma.mediaAsset.findUnique({ where: { objectKey: input.objectKey } });
  if (byKey) return byKey;

  try {
    return await prisma.mediaAsset.create({
      data: {
        objectKey: input.objectKey,
        sha256Hex: sha,
        contentType: input.contentType,
        byteSize: input.byteSize,
        originalName: input.originalName ?? null,
        visibility: input.visibility ?? "PRIVATE",
        createdByUserId: input.createdByUserId ?? null,
        restaurantId: input.restaurantId ?? null
      }
    });
  } catch {
    const again =
      (sha && (await prisma.mediaAsset.findFirst({ where: { sha256Hex: sha } }))) ||
      (await prisma.mediaAsset.findUnique({ where: { objectKey: input.objectKey } }));
    if (again) return again;
    throw new Error("media_asset_create_failed");
  }
}

export async function attachUsage(
  prisma: Db,
  params: {
    assetId: string;
    restaurantId: string;
    targetType: MediaUsageTargetType;
    targetId: string;
    role?: MediaUsageRole;
    sortOrder?: number;
  }
) {
  const role = params.role ?? "GALLERY";
  const sortOrder = params.sortOrder ?? 0;
  return prisma.mediaUsage.upsert({
    where: {
      assetId_targetType_targetId_role_sortOrder: {
        assetId: params.assetId,
        targetType: params.targetType,
        targetId: params.targetId,
        role,
        sortOrder
      }
    },
    create: {
      assetId: params.assetId,
      restaurantId: params.restaurantId,
      targetType: params.targetType,
      targetId: params.targetId,
      role,
      sortOrder
    },
    update: {}
  });
}

export async function detachUsage(prisma: PrismaClient, usageId: string) {
  const usage = await prisma.mediaUsage.findUnique({ where: { id: usageId } });
  if (!usage) return { ok: false as const, error: "usage_not_found" };
  await prisma.mediaUsage.delete({ where: { id: usageId } });
  await deleteAssetIfUnused(prisma, usage.assetId);
  return { ok: true as const };
}

export async function assetUsageCount(prisma: Db, assetId: string) {
  return prisma.mediaUsage.count({ where: { assetId } });
}

/** Hard-delete asset + S3 object only when no usages remain. */
export async function deleteAssetIfUnused(prisma: PrismaClient, assetId: string) {
  const count = await assetUsageCount(prisma, assetId);
  if (count > 0) return { ok: true as const, deleted: false };
  const asset = await prisma.mediaAsset.findUnique({ where: { id: assetId } });
  if (!asset) return { ok: true as const, deleted: false };
  await prisma.mediaAsset.delete({ where: { id: assetId } });
  try {
    await deleteObject(asset.objectKey);
  } catch {
    /* best-effort S3 cleanup */
  }
  return { ok: true as const, deleted: true };
}

/**
 * Duplicate reference: new MediaUsage (+ StoredMedia row for menu items) pointing at same asset.
 * Never copies the S3 object.
 */
export async function duplicateUsage(
  prisma: PrismaClient,
  params: {
    assetId: string;
    restaurantId: string;
    targetType: MediaUsageTargetType;
    targetId: string;
    role?: MediaUsageRole;
    sortOrder?: number;
    actorUserId?: string;
  }
) {
  const asset = await prisma.mediaAsset.findUnique({ where: { id: params.assetId } });
  if (!asset) return { ok: false as const, error: "asset_not_found" };

  const role = params.role ?? (params.targetType === "MENU_COVER" ? "COVER" : "GALLERY");
  const sortOrder =
    params.sortOrder ??
    (await prisma.mediaUsage.count({
      where: {
        restaurantId: params.restaurantId,
        targetType: params.targetType,
        targetId: params.targetId
      }
    }));

  const usage = await attachUsage(prisma, {
    assetId: asset.id,
    restaurantId: params.restaurantId,
    targetType: params.targetType,
    targetId: params.targetId,
    role,
    sortOrder
  });

  let storedMediaId: string | null = null;
  if (params.targetType === "MENU_ITEM") {
    const isVideo = asset.contentType.startsWith("video/");
    const row = await prisma.storedMedia.create({
      data: {
        objectKey: asset.objectKey,
        scope: isVideo ? "VIDEO" : "MENU_IMAGE",
        contentType: asset.contentType,
        byteSize: asset.byteSize,
        sha256Hex: asset.sha256Hex,
        visibility: asset.visibility,
        originalName: asset.originalName,
        uploadedById: params.actorUserId ?? asset.createdByUserId,
        restaurantId: params.restaurantId,
        menuItemId: params.targetId,
        sortOrder
      }
    });
    storedMediaId = row.id;
  }

  if (params.targetType === "MENU_COVER") {
    await prisma.menu.updateMany({
      where: { id: params.targetId, restaurantId: params.restaurantId },
      data: { coverMediaKey: asset.objectKey }
    });
  }

  return { ok: true as const, usage, asset, storedMediaId };
}

export async function listVenueAssets(prisma: PrismaClient, restaurantId: string) {
  const assets = await prisma.mediaAsset.findMany({
    where: {
      OR: [{ restaurantId }, { usages: { some: { restaurantId } } }]
    },
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { _count: { select: { usages: true } } }
  });
  return assets.map((a) => ({
    id: a.id,
    objectKey: a.objectKey,
    contentType: a.contentType,
    byteSize: a.byteSize,
    originalName: a.originalName,
    sha256Hex: a.sha256Hex,
    visibility: a.visibility,
    createdAt: a.createdAt.toISOString(),
    usageCount: a._count.usages
  }));
}

/** After StoredMedia create — dual-write asset + optional item usage. */
export async function syncAssetFromStoredMedia(
  prisma: PrismaClient,
  media: {
    objectKey: string;
    contentType: string;
    byteSize: number;
    sha256Hex?: string | null;
    originalName?: string | null;
    visibility?: StoredMediaVisibility;
    uploadedById?: string | null;
    restaurantId?: string | null;
    menuItemId?: string | null;
    sortOrder?: number;
  }
) {
  const asset = await ensureAssetFromUpload(prisma, {
    objectKey: media.objectKey,
    contentType: media.contentType,
    byteSize: media.byteSize,
    sha256Hex: media.sha256Hex,
    originalName: media.originalName,
    visibility: media.visibility,
    createdByUserId: media.uploadedById,
    restaurantId: media.restaurantId
  });

  if (media.restaurantId && media.menuItemId) {
    await attachUsage(prisma, {
      assetId: asset.id,
      restaurantId: media.restaurantId,
      targetType: "MENU_ITEM",
      targetId: media.menuItemId,
      role: "GALLERY",
      sortOrder: media.sortOrder ?? 0
    });
  }

  return asset;
}

export async function cloneItemMediaViaAssets(
  tx: Db,
  sourceItemId: string,
  targetItemId: string,
  restaurantId: string,
  actorUserId?: string
) {
  const rows = await tx.storedMedia.findMany({
    where: { menuItemId: sourceItemId, scope: { in: ["MENU_IMAGE", "VIDEO"] } },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
  });

  for (const row of rows) {
    const asset = await ensureAssetFromUpload(tx, {
      objectKey: row.objectKey,
      contentType: row.contentType,
      byteSize: row.byteSize,
      sha256Hex: row.sha256Hex,
      originalName: row.originalName,
      visibility: row.visibility,
      createdByUserId: row.uploadedById,
      restaurantId
    });

    await attachUsage(tx, {
      assetId: asset.id,
      restaurantId,
      targetType: "MENU_ITEM",
      targetId: targetItemId,
      role: "GALLERY",
      sortOrder: row.sortOrder
    });

    await tx.storedMedia.create({
      data: {
        objectKey: row.objectKey,
        scope: row.scope,
        contentType: row.contentType,
        byteSize: row.byteSize,
        sha256Hex: row.sha256Hex,
        visibility: row.visibility,
        originalName: row.originalName,
        uploadedById: actorUserId ?? row.uploadedById,
        restaurantId,
        menuItemId: targetItemId,
        sortOrder: row.sortOrder,
        durationMs: row.durationMs
      }
    });
  }

  return rows.length;
}
