import type { PrismaClient, StoredMediaScope, StoredMediaVisibility } from "@prisma/client";
import {
  createPresignedGetUrl,
  createUploadSession,
  deleteObject,
  headObject,
  isObjectStorageConfigured,
  maxBytesForScope,
  type MediaVisibility,
  type StorageScope,
  uploadBase64Object,
  visibilityForScope
} from "../integrations/objectStorage.js";
import { purgeCdnObjectKeys } from "../integrations/cloudflareCdn.js";
import { syncAssetFromStoredMedia } from "../replication/mediaAssetService.js";
import {
  advanceUploadJob,
  finalizeUploadJobProcessing
} from "./library/uploadJobService.js";

const SCOPE_TO_DB: Record<StorageScope, StoredMediaScope> = {
  profile: "PROFILE_IMAGE",
  restaurant: "RESTAURANT_IMAGE",
  menu: "MENU_IMAGE",
  chat: "CHAT_IMAGE",
  video: "VIDEO",
  pdf: "PDF",
  invoice: "INVOICE",
  document: "DOCUMENT",
  attachment: "ATTACHMENT"
};

function toDbVisibility(v: MediaVisibility): StoredMediaVisibility {
  return v === "public" ? "PUBLIC" : "PRIVATE";
}

export async function createMediaUploadSession(params: {
  scope: StorageScope;
  contentType: string;
  keyParts: string[];
}) {
  if (!isObjectStorageConfigured()) {
    return { ok: false as const, error: "object_storage_not_configured" };
  }
  const session = await createUploadSession(params);
  if ("error" in session) return { ok: false as const, error: session.error };
  return { ok: true as const, upload: session };
}

export async function uploadMediaBase64(
  prisma: PrismaClient,
  params: {
    scope: StorageScope;
    objectKey: string;
    dataBase64: string;
    contentType: string;
    uploadedById?: string;
    restaurantId?: string;
    userId?: string;
    menuItemId?: string;
    chatRoomId?: string;
    chatMessageId?: string;
    originalName?: string;
    uploadJobId?: string;
    displayName?: string;
    altText?: string;
    width?: number;
    height?: number;
    durationMs?: number;
    forceNewAsset?: boolean;
  }
) {
  if (params.uploadJobId) {
    await advanceUploadJob(prisma, params.uploadJobId, {
      status: "UPLOADING",
      stage: "uploading",
      progress: 25,
      objectKey: params.objectKey
    }).catch(() => undefined);
  }

  const uploaded = await uploadBase64Object({
    scope: params.scope,
    objectKey: params.objectKey,
    dataBase64: params.dataBase64,
    contentType: params.contentType
  });
  if ("error" in uploaded) {
    if (params.uploadJobId) {
      await advanceUploadJob(prisma, params.uploadJobId, {
        status: "FAILED",
        stage: "uploading",
        progress: 25,
        error: uploaded.error
      }).catch(() => undefined);
    }
    return { ok: false as const, error: uploaded.error };
  }

  const visibility = visibilityForScope(params.scope);
  const media = await prisma.storedMedia.create({
    data: {
      objectKey: uploaded.objectKey,
      scope: SCOPE_TO_DB[params.scope],
      contentType: params.contentType,
      byteSize: uploaded.byteSize,
      sha256Hex: uploaded.sha256Hex,
      visibility: toDbVisibility(visibility),
      originalName: params.originalName?.trim() || null,
      uploadedById: params.uploadedById ?? null,
      restaurantId: params.restaurantId ?? null,
      userId: params.userId ?? null,
      menuItemId: params.menuItemId ?? null,
      chatRoomId: params.chatRoomId ?? null,
      chatMessageId: params.chatMessageId ?? null,
      durationMs: params.durationMs ?? null
    }
  });

  let assetId: string | null = null;
  let reused = false;
  try {
    const synced = await syncAssetFromStoredMedia(prisma, {
      ...media,
      durationMs: params.durationMs ?? media.durationMs,
      forceNewAsset: params.forceNewAsset
    });
    assetId = synced.asset.id;
    reused = synced.reused;
    if (!reused && (params.displayName || params.altText || params.width || params.height)) {
      await prisma.mediaAsset.update({
        where: { id: synced.asset.id },
        data: {
          ...(params.displayName ? { displayName: params.displayName.trim() } : {}),
          ...(params.altText ? { altText: params.altText.trim() } : {}),
          ...(params.width != null ? { width: params.width } : {}),
          ...(params.height != null ? { height: params.height } : {})
        }
      });
    }
  } catch {
    /* dual-write best-effort */
  }

  if (params.uploadJobId && params.restaurantId && assetId) {
    await finalizeUploadJobProcessing(prisma, {
      jobId: params.uploadJobId,
      restaurantId: params.restaurantId,
      assetId,
      objectKey: uploaded.objectKey,
      contentType: params.contentType
    }).catch(() => undefined);
  }

  return { ok: true as const, media, assetId, reused };
}

export async function recordUploadedObject(
  prisma: PrismaClient,
  params: {
    scope: StorageScope;
    objectKey: string;
    contentType: string;
    uploadedById?: string;
    restaurantId?: string;
    userId?: string;
    menuItemId?: string;
    chatRoomId?: string;
    chatMessageId?: string;
    originalName?: string;
    uploadJobId?: string;
    sha256Hex?: string;
    forceNewAsset?: boolean;
  }
) {
  if (params.uploadJobId) {
    await advanceUploadJob(prisma, params.uploadJobId, {
      status: "UPLOADING",
      stage: "uploading",
      progress: 30,
      objectKey: params.objectKey
    }).catch(() => undefined);
  }

  const head = await headObject(params.objectKey);
  if (!head) {
    if (params.uploadJobId) {
      await advanceUploadJob(prisma, params.uploadJobId, {
        status: "FAILED",
        error: "object_not_found"
      }).catch(() => undefined);
    }
    return { ok: false as const, error: "object_not_found" };
  }

  const maxBytes = maxBytesForScope(params.scope);
  if (head.byteSize > maxBytes) {
    await deleteObject(params.objectKey);
    return { ok: false as const, error: "file_too_large" };
  }

  const sha256Hex = params.sha256Hex?.trim() || head.sha256Hex || null;
  const visibility = visibilityForScope(params.scope);
  const media = await prisma.storedMedia.create({
    data: {
      objectKey: params.objectKey,
      scope: SCOPE_TO_DB[params.scope],
      contentType: head.contentType ?? params.contentType,
      byteSize: head.byteSize,
      sha256Hex,
      visibility: toDbVisibility(visibility),
      originalName: params.originalName?.trim() || null,
      uploadedById: params.uploadedById ?? null,
      restaurantId: params.restaurantId ?? null,
      userId: params.userId ?? null,
      menuItemId: params.menuItemId ?? null,
      chatRoomId: params.chatRoomId ?? null,
      chatMessageId: params.chatMessageId ?? null
    }
  });

  let assetId: string | null = null;
  let reused = false;
  try {
    const synced = await syncAssetFromStoredMedia(prisma, {
      ...media,
      forceNewAsset: params.forceNewAsset
    });
    assetId = synced.asset.id;
    reused = synced.reused;
  } catch {
    /* dual-write best-effort */
  }

  const purge = await purgeCdnObjectKeys([params.objectKey]);
  if (!purge.ok) {
    console.warn("[cloudflare-cdn] presigned upload purge failed", purge.error);
  }

  if (params.uploadJobId && params.restaurantId && assetId) {
    await finalizeUploadJobProcessing(prisma, {
      jobId: params.uploadJobId,
      restaurantId: params.restaurantId,
      assetId,
      objectKey: params.objectKey,
      contentType: head.contentType ?? params.contentType
    }).catch(() => undefined);
  }

  return { ok: true as const, media, assetId, reused };
}

export async function refreshMediaCdnCache(prisma: PrismaClient, mediaId: string) {
  const media = await prisma.storedMedia.findUnique({ where: { id: mediaId } });
  if (!media) return { ok: false as const, error: "media_not_found" };
  const purge = await purgeCdnObjectKeys([media.objectKey]);
  if (!purge.ok) return { ok: false as const, error: purge.error };
  return { ok: true as const, purged: purge.purged, objectKey: media.objectKey };
}

export async function getMediaSignedUrl(
  prisma: PrismaClient,
  mediaId: string,
  opts?: { expiresInSeconds?: number }
) {
  const media = await prisma.storedMedia.findUnique({ where: { id: mediaId } });
  if (!media) return { ok: false as const, error: "media_not_found" };
  if (!isObjectStorageConfigured()) {
    return { ok: false as const, error: "object_storage_not_configured" };
  }
  const url = await createPresignedGetUrl(media.objectKey, {
    expiresInSeconds: opts?.expiresInSeconds ?? 900,
    downloadName: media.originalName ?? undefined
  });
  return { ok: true as const, url, media };
}

export async function deleteStoredMedia(prisma: PrismaClient, mediaId: string) {
  const media = await prisma.storedMedia.findUnique({ where: { id: mediaId } });
  if (!media) return { ok: false as const, error: "media_not_found" };
  await deleteObject(media.objectKey);
  await prisma.storedMedia.delete({ where: { id: mediaId } });
  return { ok: true as const };
}

export async function attachRestaurantImage(
  prisma: PrismaClient,
  params: { restaurantId: string; mediaId: string; kind: "logo" | "cover" }
) {
  const media = await prisma.storedMedia.findFirst({
    where: { id: params.mediaId, restaurantId: params.restaurantId }
  });
  if (!media) return { ok: false as const, error: "media_not_found" };

  const data =
    params.kind === "logo"
      ? { logoImageKey: media.objectKey }
      : { coverImageKey: media.objectKey };

  await prisma.restaurant.update({ where: { id: params.restaurantId }, data });
  return { ok: true as const, objectKey: media.objectKey };
}

export async function attachMenuItemImage(
  prisma: PrismaClient,
  params: { restaurantId: string; menuItemId: string; mediaId: string }
) {
  const item = await prisma.menuItem.findFirst({
    where: { id: params.menuItemId, category: { restaurantId: params.restaurantId } }
  });
  if (!item) return { ok: false as const, error: "menu_item_not_found" };

  const media = await prisma.storedMedia.findFirst({
    where: { id: params.mediaId, menuItemId: params.menuItemId }
  });
  if (!media) return { ok: false as const, error: "media_not_found" };

  await prisma.menuItem.update({
    where: { id: params.menuItemId },
    data: { imageKey: media.objectKey }
  });
  return { ok: true as const, objectKey: media.objectKey };
}
