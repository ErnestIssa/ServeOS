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
  }
) {
  const uploaded = await uploadBase64Object({
    scope: params.scope,
    objectKey: params.objectKey,
    dataBase64: params.dataBase64,
    contentType: params.contentType
  });
  if ("error" in uploaded) return { ok: false as const, error: uploaded.error };

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
      chatMessageId: params.chatMessageId ?? null
    }
  });

  try {
    await syncAssetFromStoredMedia(prisma, media);
  } catch {
    /* dual-write best-effort */
  }

  return { ok: true as const, media };
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
  }
) {
  const head = await headObject(params.objectKey);
  if (!head) return { ok: false as const, error: "object_not_found" };

  const maxBytes = maxBytesForScope(params.scope);
  if (head.byteSize > maxBytes) {
    await deleteObject(params.objectKey);
    return { ok: false as const, error: "file_too_large" };
  }

  const visibility = visibilityForScope(params.scope);
  const media = await prisma.storedMedia.create({
    data: {
      objectKey: params.objectKey,
      scope: SCOPE_TO_DB[params.scope],
      contentType: head.contentType ?? params.contentType,
      byteSize: head.byteSize,
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

  try {
    await syncAssetFromStoredMedia(prisma, media);
  } catch {
    /* dual-write best-effort */
  }

  const purge = await purgeCdnObjectKeys([params.objectKey]);
  if (!purge.ok) {
    console.warn("[cloudflare-cdn] presigned upload purge failed", purge.error);
  }

  return { ok: true as const, media };
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
