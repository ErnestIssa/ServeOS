import type { PrismaClient } from "@prisma/client";
import { createHash } from "node:crypto";
import {
  buildObjectKey,
  putObjectBuffer,
  type StorageScope
} from "../../integrations/objectStorage.js";
import { runPostUploadHooks } from "./processingHooks.js";
import { maxBytesForPurpose, purposeFromContentType, type MediaPurpose } from "./limits.js";

function parseDataUrl(dataUrl: string): { contentType: string; buffer: Buffer } | null {
  const m = /^data:([^;]+);base64,(.+)$/s.exec(dataUrl.trim());
  if (!m) return null;
  try {
    return { contentType: m[1], buffer: Buffer.from(m[2], "base64") };
  } catch {
    return null;
  }
}

/**
 * Replace asset file: keep asset id + usages; append version; never delete old S3 object.
 */
export async function replaceAssetFile(
  prisma: PrismaClient,
  params: {
    assetId: string;
    restaurantId: string;
    dataBase64: string;
    contentType?: string;
    actorUserId?: string;
    note?: string;
    purpose?: MediaPurpose;
  }
) {
  const asset = await prisma.mediaAsset.findFirst({
    where: {
      id: params.assetId,
      OR: [{ restaurantId: params.restaurantId }, { usages: { some: { restaurantId: params.restaurantId } } }]
    }
  });
  if (!asset) return { ok: false as const, error: "asset_not_found" };

  const parsed = parseDataUrl(params.dataBase64);
  if (!parsed) return { ok: false as const, error: "invalid_data" };

  const contentType = params.contentType?.trim() || parsed.contentType;
  const purpose = purposeFromContentType(contentType, params.purpose);
  const maxBytes = maxBytesForPurpose(purpose);
  if (parsed.buffer.byteLength > maxBytes) {
    return { ok: false as const, error: "file_too_large" };
  }

  const scope: StorageScope = contentType.startsWith("video/") ? "video" : "menu";
  const objectKey = buildObjectKey(scope, [params.restaurantId, "library", asset.id, String(Date.now())]);
  const sha256Hex = createHash("sha256").update(parsed.buffer).digest("hex");

  const put = await putObjectBuffer({
    objectKey,
    body: parsed.buffer,
    contentType,
    visibility: asset.visibility === "PUBLIC" ? "public" : "private"
  }).catch((err: Error) => ({ error: err.message || "upload_failed" }));
  if ("error" in put) return { ok: false as const, error: put.error };

  const nextVersion = asset.currentVersionNumber + 1;

  const updated = await prisma.$transaction(async (tx) => {
    await tx.mediaAssetVersion.create({
      data: {
        assetId: asset.id,
        versionNumber: nextVersion,
        objectKey,
        byteSize: parsed.buffer.byteLength,
        contentType,
        sha256Hex,
        note: params.note?.trim() || "Replaced",
        createdByUserId: params.actorUserId ?? null
      }
    });

    return tx.mediaAsset.update({
      where: { id: asset.id },
      data: {
        objectKey,
        byteSize: parsed.buffer.byteLength,
        contentType,
        sha256Hex,
        currentVersionNumber: nextVersion,
        processingStatus: "READY"
      }
    });
  });

  // Re-point menu covers / item image keys that matched previous objectKey
  await prisma.menu.updateMany({
    where: { restaurantId: params.restaurantId, coverMediaKey: asset.objectKey },
    data: { coverMediaKey: objectKey }
  });
  await prisma.menuItem.updateMany({
    where: { imageKey: asset.objectKey },
    data: { imageKey: objectKey }
  });
  await prisma.storedMedia.updateMany({
    where: { restaurantId: params.restaurantId, objectKey: asset.objectKey },
    data: { objectKey, contentType, byteSize: parsed.buffer.byteLength, sha256Hex }
  });

  await runPostUploadHooks({
    assetId: updated.id,
    objectKey,
    contentType,
    restaurantId: params.restaurantId
  });

  return { ok: true as const, asset: updated, versionNumber: nextVersion };
}

/**
 * Rollback deliverable to a prior version (creates a new version pointing at old objectKey).
 */
export async function rollbackAssetVersion(
  prisma: PrismaClient,
  params: {
    assetId: string;
    restaurantId: string;
    versionNumber: number;
    actorUserId?: string;
  }
) {
  const asset = await prisma.mediaAsset.findFirst({
    where: {
      id: params.assetId,
      OR: [{ restaurantId: params.restaurantId }, { usages: { some: { restaurantId: params.restaurantId } } }]
    }
  });
  if (!asset) return { ok: false as const, error: "asset_not_found" };

  const target = await prisma.mediaAssetVersion.findUnique({
    where: {
      assetId_versionNumber: { assetId: asset.id, versionNumber: params.versionNumber }
    }
  });
  if (!target) return { ok: false as const, error: "version_not_found" };

  const prevKey = asset.objectKey;
  const nextVersion = asset.currentVersionNumber + 1;

  const updated = await prisma.$transaction(async (tx) => {
    await tx.mediaAssetVersion.create({
      data: {
        assetId: asset.id,
        versionNumber: nextVersion,
        objectKey: target.objectKey,
        byteSize: target.byteSize,
        contentType: target.contentType,
        sha256Hex: target.sha256Hex,
        note: `Rollback to v${params.versionNumber}`,
        createdByUserId: params.actorUserId ?? null
      }
    });

    return tx.mediaAsset.update({
      where: { id: asset.id },
      data: {
        objectKey: target.objectKey,
        byteSize: target.byteSize,
        contentType: target.contentType,
        sha256Hex: target.sha256Hex,
        currentVersionNumber: nextVersion
      }
    });
  });

  await prisma.menu.updateMany({
    where: { restaurantId: params.restaurantId, coverMediaKey: prevKey },
    data: { coverMediaKey: target.objectKey }
  });
  await prisma.menuItem.updateMany({
    where: { imageKey: prevKey },
    data: { imageKey: target.objectKey }
  });
  await prisma.storedMedia.updateMany({
    where: { restaurantId: params.restaurantId, objectKey: prevKey },
    data: {
      objectKey: target.objectKey,
      contentType: target.contentType,
      byteSize: target.byteSize,
      sha256Hex: target.sha256Hex
    }
  });

  return { ok: true as const, asset: updated, versionNumber: nextVersion };
}
