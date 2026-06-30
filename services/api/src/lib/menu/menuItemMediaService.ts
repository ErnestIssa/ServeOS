import type { PrismaClient, StoredMedia, StoredMediaScope } from "@prisma/client";
import { getMediaSignedUrl } from "../media/mediaService.js";
import { MENU_ITEM_MEDIA_LIMITS } from "./menuPermissions.js";

export type MenuItemMediaRow = {
  id: string;
  kind: "image" | "video";
  sortOrder: number;
  contentType: string;
  byteSize: number;
  durationMs: number | null;
  originalName: string | null;
  objectKey: string;
  isCover: boolean;
  url: string | null;
};

function mediaKind(scope: StoredMediaScope): "image" | "video" | null {
  if (scope === "MENU_IMAGE") return "image";
  if (scope === "VIDEO") return "video";
  return null;
}

async function assertMenuItemRestaurant(prisma: PrismaClient, menuItemId: string, restaurantId: string) {
  const item = await prisma.menuItem.findFirst({
    where: { id: menuItemId },
    include: { category: { select: { restaurantId: true } } }
  });
  if (!item || item.category.restaurantId !== restaurantId) {
    throw Object.assign(new Error("menu_item_not_found"), { statusCode: 404 });
  }
  return item;
}

async function countItemMedia(prisma: PrismaClient, menuItemId: string) {
  const rows = await prisma.storedMedia.groupBy({
    by: ["scope"],
    where: { menuItemId, scope: { in: ["MENU_IMAGE", "VIDEO"] } },
    _count: { _all: true }
  });
  let images = 0;
  let videos = 0;
  for (const row of rows) {
    if (row.scope === "MENU_IMAGE") images = row._count._all;
    if (row.scope === "VIDEO") videos = row._count._all;
  }
  return { images, videos };
}

async function serializeMediaRow(
  prisma: PrismaClient,
  media: StoredMedia,
  coverKey: string | null
): Promise<MenuItemMediaRow | null> {
  const kind = mediaKind(media.scope);
  if (!kind) return null;
  const signed = await getMediaSignedUrl(prisma, media.id);
  return {
    id: media.id,
    kind,
    sortOrder: media.sortOrder,
    contentType: media.contentType,
    byteSize: media.byteSize,
    durationMs: media.durationMs,
    originalName: media.originalName,
    objectKey: media.objectKey,
    isCover: Boolean(coverKey && coverKey === media.objectKey),
    url: signed.ok ? signed.url : null
  };
}

export async function listMenuItemMedia(
  prisma: PrismaClient,
  params: { restaurantId: string; menuItemId: string }
) {
  const item = await assertMenuItemRestaurant(prisma, params.menuItemId, params.restaurantId);
  const media = await prisma.storedMedia.findMany({
    where: {
      menuItemId: params.menuItemId,
      scope: { in: ["MENU_IMAGE", "VIDEO"] }
    },
    orderBy: [{ scope: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }]
  });

  const rows: MenuItemMediaRow[] = [];
  for (const row of media) {
    const serialized = await serializeMediaRow(prisma, row, item.imageKey);
    if (serialized) rows.push(serialized);
  }

  const counts = await countItemMedia(prisma, params.menuItemId);
  return {
    ok: true as const,
    media: rows,
    counts,
    limits: MENU_ITEM_MEDIA_LIMITS
  };
}

export async function attachMenuItemMedia(
  prisma: PrismaClient,
  params: {
    restaurantId: string;
    menuItemId: string;
    mediaId: string;
    setAsCover?: boolean;
    durationMs?: number;
  }
) {
  const item = await assertMenuItemRestaurant(prisma, params.menuItemId, params.restaurantId);

  const media = await prisma.storedMedia.findFirst({
    where: { id: params.mediaId, restaurantId: params.restaurantId }
  });
  if (!media) return { ok: false as const, error: "media_not_found" };

  const kind = mediaKind(media.scope);
  if (!kind) return { ok: false as const, error: "invalid_media_scope" };

  if (kind === "video") {
    if (media.byteSize > MENU_ITEM_MEDIA_LIMITS.maxVideoBytes) {
      return { ok: false as const, error: "video_too_large" };
    }
    const duration = params.durationMs ?? media.durationMs ?? null;
    if (duration != null && duration > MENU_ITEM_MEDIA_LIMITS.maxVideoDurationMs) {
      return { ok: false as const, error: "video_too_long" };
    }
  }

  const counts = await countItemMedia(prisma, params.menuItemId);
  const alreadyAttached = media.menuItemId === params.menuItemId;
  if (!alreadyAttached) {
    if (kind === "image" && counts.images >= MENU_ITEM_MEDIA_LIMITS.maxImagesPerItem) {
      return { ok: false as const, error: "item_image_limit" };
    }
    if (kind === "video" && counts.videos >= MENU_ITEM_MEDIA_LIMITS.maxVideosPerItem) {
      return { ok: false as const, error: "item_video_limit" };
    }
  }

  const maxSort = await prisma.storedMedia.aggregate({
    where: { menuItemId: params.menuItemId, scope: media.scope },
    _max: { sortOrder: true }
  });
  const sortOrder = alreadyAttached ? media.sortOrder : (maxSort._max.sortOrder ?? -1) + 1;

  const updated = await prisma.storedMedia.update({
    where: { id: media.id },
    data: {
      menuItemId: params.menuItemId,
      sortOrder,
      durationMs: kind === "video" ? (params.durationMs ?? media.durationMs ?? null) : null
    }
  });

  if (params.setAsCover && kind === "image") {
    await prisma.menuItem.update({
      where: { id: params.menuItemId },
      data: { imageKey: updated.objectKey }
    });
  } else if (!item.imageKey && kind === "image") {
    await prisma.menuItem.update({
      where: { id: params.menuItemId },
      data: { imageKey: updated.objectKey }
    });
  }

  const serialized = await serializeMediaRow(
    prisma,
    updated,
    params.setAsCover || !item.imageKey ? updated.objectKey : item.imageKey
  );
  return { ok: true as const, media: serialized };
}

export async function removeMenuItemMedia(
  prisma: PrismaClient,
  params: { restaurantId: string; menuItemId: string; mediaId: string }
) {
  const item = await assertMenuItemRestaurant(prisma, params.menuItemId, params.restaurantId);
  const media = await prisma.storedMedia.findFirst({
    where: {
      id: params.mediaId,
      menuItemId: params.menuItemId,
      restaurantId: params.restaurantId,
      scope: { in: ["MENU_IMAGE", "VIDEO"] }
    }
  });
  if (!media) return { ok: false as const, error: "media_not_found" };

  await prisma.storedMedia.update({
    where: { id: media.id },
    data: { menuItemId: null, sortOrder: 0, durationMs: null }
  });

  if (item.imageKey === media.objectKey) {
    const nextCover = await prisma.storedMedia.findFirst({
      where: { menuItemId: params.menuItemId, scope: "MENU_IMAGE" },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
    });
    await prisma.menuItem.update({
      where: { id: params.menuItemId },
      data: { imageKey: nextCover?.objectKey ?? null }
    });
  }

  return { ok: true as const };
}

export async function reorderMenuItemMedia(
  prisma: PrismaClient,
  params: { restaurantId: string; menuItemId: string; orderedMediaIds: string[] }
) {
  await assertMenuItemRestaurant(prisma, params.menuItemId, params.restaurantId);

  const existing = await prisma.storedMedia.findMany({
    where: {
      menuItemId: params.menuItemId,
      scope: { in: ["MENU_IMAGE", "VIDEO"] }
    },
    select: { id: true }
  });
  const existingIds = new Set(existing.map((r) => r.id));
  if (params.orderedMediaIds.length !== existing.length) {
    return { ok: false as const, error: "invalid_media_order" };
  }
  for (const id of params.orderedMediaIds) {
    if (!existingIds.has(id)) return { ok: false as const, error: "invalid_media_order" };
  }

  await prisma.$transaction(
    params.orderedMediaIds.map((id, index) =>
      prisma.storedMedia.update({
        where: { id },
        data: { sortOrder: index }
      })
    )
  );

  return listMenuItemMedia(prisma, {
    restaurantId: params.restaurantId,
    menuItemId: params.menuItemId
  });
}

export function mapMenuItemMediaError(code: string): string {
  switch (code) {
    case "item_image_limit":
      return `Each item can have up to ${MENU_ITEM_MEDIA_LIMITS.maxImagesPerItem} images.`;
    case "item_video_limit":
      return `Each item can have up to ${MENU_ITEM_MEDIA_LIMITS.maxVideosPerItem} short videos.`;
    case "video_too_long":
      return "Videos must be 60 seconds or shorter.";
    case "video_too_large":
      return "Video file is too large for menu items.";
    case "invalid_media_scope":
      return "Only images and short videos can be attached to menu items.";
    case "media_not_found":
      return "Media not found.";
    case "menu_item_not_found":
      return "Menu item not found.";
    case "invalid_media_order":
      return "Could not reorder media — list is out of date.";
    default:
      return "Menu media request failed.";
  }
}

/** @deprecated Use attachMenuItemMedia — kept for legacy single-cover route. */
export async function attachMenuItemCoverImage(
  prisma: PrismaClient,
  params: { restaurantId: string; menuItemId: string; mediaId: string }
) {
  return attachMenuItemMedia(prisma, { ...params, setAsCover: true });
}
