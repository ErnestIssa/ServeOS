import type { MediaUsageRole, MediaUsageTargetType, Prisma, PrismaClient, StoredMediaVisibility } from "@prisma/client";
import { deleteObject } from "../../integrations/objectStorage.js";

type Db = PrismaClient | Prisma.TransactionClient;

export type EnsureAssetInput = {
  objectKey: string;
  contentType: string;
  byteSize: number;
  sha256Hex?: string | null;
  originalName?: string | null;
  displayName?: string | null;
  visibility?: StoredMediaVisibility;
  createdByUserId?: string | null;
  restaurantId?: string | null;
  width?: number | null;
  height?: number | null;
  durationMs?: number | null;
  altText?: string | null;
  description?: string | null;
  tags?: string[];
};

/**
 * Resolve or create a MediaAsset for an uploaded object.
 * Prefer sha256 match (same bytes = same asset) so duplicate uploads do not double S3.
 */
export async function ensureAssetFromUpload(prisma: Db, input: EnsureAssetInput) {
  const sha = input.sha256Hex?.trim() || null;

  if (sha) {
    const byHash = await prisma.mediaAsset.findFirst({
      where: { sha256Hex: sha, archivedAt: null }
    });
    if (byHash) return byHash;
  }

  const byKey = await prisma.mediaAsset.findUnique({ where: { objectKey: input.objectKey } });
  if (byKey) return byKey;

  const displayName =
    input.displayName?.trim() ||
    input.originalName?.trim() ||
    input.objectKey.split("/").pop() ||
    "Untitled";

  try {
    const asset = await prisma.mediaAsset.create({
      data: {
        objectKey: input.objectKey,
        originalObjectKey: input.objectKey,
        sha256Hex: sha,
        contentType: input.contentType,
        byteSize: input.byteSize,
        originalName: input.originalName ?? null,
        displayName,
        altText: input.altText ?? null,
        description: input.description ?? null,
        tags: input.tags ?? [],
        width: input.width ?? null,
        height: input.height ?? null,
        durationMs: input.durationMs ?? null,
        visibility: input.visibility ?? "PRIVATE",
        createdByUserId: input.createdByUserId ?? null,
        restaurantId: input.restaurantId ?? null,
        processingStatus: "READY",
        currentVersionNumber: 1
      }
    });

    await prisma.mediaAssetVersion.create({
      data: {
        assetId: asset.id,
        versionNumber: 1,
        objectKey: asset.objectKey,
        byteSize: asset.byteSize,
        contentType: asset.contentType,
        sha256Hex: asset.sha256Hex,
        createdByUserId: asset.createdByUserId,
        note: "Initial upload"
      }
    });

    return asset;
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
    if (asset.originalObjectKey !== asset.objectKey) {
      await deleteObject(asset.originalObjectKey);
    }
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
  if (asset.archivedAt) return { ok: false as const, error: "asset_archived" };

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
        sortOrder,
        durationMs: asset.durationMs
      }
    });
    storedMediaId = row.id;

    const item = await prisma.menuItem.findFirst({
      where: { id: params.targetId },
      select: { imageKey: true }
    });
    if (item && !item.imageKey && !isVideo) {
      await prisma.menuItem.update({
        where: { id: params.targetId },
        data: { imageKey: asset.objectKey }
      });
    }
  }

  if (params.targetType === "MENU_COVER") {
    await prisma.menu.updateMany({
      where: { id: params.targetId, restaurantId: params.restaurantId },
      data: { coverMediaKey: asset.objectKey }
    });
  }

  if (params.targetType === "VENUE_LOGO") {
    await prisma.restaurant.updateMany({
      where: { id: params.restaurantId },
      data: { logoImageKey: asset.objectKey }
    });
  }

  if (params.targetType === "VENUE_COVER") {
    await prisma.restaurant.updateMany({
      where: { id: params.restaurantId },
      data: { coverImageKey: asset.objectKey }
    });
  }

  return { ok: true as const, usage, asset, storedMediaId };
}

export async function listVenueAssets(prisma: PrismaClient, restaurantId: string) {
  const assets = await prisma.mediaAsset.findMany({
    where: {
      archivedAt: null,
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
    displayName: a.displayName ?? a.originalName,
    sha256Hex: a.sha256Hex,
    visibility: a.visibility,
    favorite: a.favorite,
    altText: a.altText,
    processingStatus: a.processingStatus,
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
    durationMs?: number | null;
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
    restaurantId: media.restaurantId,
    durationMs: media.durationMs
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
      restaurantId,
      durationMs: row.durationMs
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

export async function updateAssetMetadata(
  prisma: PrismaClient,
  assetId: string,
  restaurantId: string,
  patch: {
    displayName?: string | null;
    altText?: string | null;
    description?: string | null;
    tags?: string[];
    favorite?: boolean;
    archived?: boolean;
    width?: number | null;
    height?: number | null;
    durationMs?: number | null;
  }
) {
  const asset = await prisma.mediaAsset.findFirst({
    where: {
      id: assetId,
      OR: [{ restaurantId }, { usages: { some: { restaurantId } } }]
    }
  });
  if (!asset) return { ok: false as const, error: "asset_not_found" };

  const updated = await prisma.mediaAsset.update({
    where: { id: assetId },
    data: {
      ...(patch.displayName !== undefined ? { displayName: patch.displayName?.trim() || null } : {}),
      ...(patch.altText !== undefined ? { altText: patch.altText?.trim() || null } : {}),
      ...(patch.description !== undefined ? { description: patch.description?.trim() || null } : {}),
      ...(patch.tags !== undefined ? { tags: patch.tags } : {}),
      ...(patch.favorite !== undefined ? { favorite: patch.favorite } : {}),
      ...(patch.archived === true ? { archivedAt: new Date() } : {}),
      ...(patch.archived === false ? { archivedAt: null } : {}),
      ...(patch.width !== undefined ? { width: patch.width } : {}),
      ...(patch.height !== undefined ? { height: patch.height } : {}),
      ...(patch.durationMs !== undefined ? { durationMs: patch.durationMs } : {})
    }
  });

  return { ok: true as const, asset: updated };
}
