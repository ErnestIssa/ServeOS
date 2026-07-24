/**
 * ServeOS Media Platform — post-upload processing.
 * Real: magic bytes, EXIF strip/orient, thumb, WebP, BlurHash.
 * Honest stubs (via processingHooks): virus product, AI.
 */
import { createHash, randomUUID } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { encode } from "blurhash";
import sharp from "sharp";
import {
  getObjectBuffer,
  putObjectBuffer
} from "../../integrations/objectStorage.js";
import { purgeCdnObjectKeys } from "../../integrations/cloudflareCdn.js";
import { runPostUploadHooks } from "./processingHooks.js";

export type PipelineStage =
  | "validate_magic"
  | "strip_exif_orient"
  | "thumb"
  | "webp"
  | "blurhash"
  | "store_meta"
  | "cdn"
  | "ready"
  | "failed";

const IMAGE_MAGICS: Array<{ mime: string; test: (b: Buffer) => boolean }> = [
  { mime: "image/jpeg", test: (b) => b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  {
    mime: "image/png",
    test: (b) =>
      b.length >= 8 &&
      b[0] === 0x89 &&
      b[1] === 0x50 &&
      b[2] === 0x4e &&
      b[3] === 0x47 &&
      b[4] === 0x0d &&
      b[5] === 0x0a &&
      b[6] === 0x1a &&
      b[7] === 0x0a
  },
  {
    mime: "image/gif",
    test: (b) =>
      b.length >= 6 &&
      b[0] === 0x47 &&
      b[1] === 0x49 &&
      b[2] === 0x46 &&
      b[3] === 0x38 &&
      (b[4] === 0x37 || b[4] === 0x39) &&
      b[5] === 0x61
  },
  {
    mime: "image/webp",
    test: (b) =>
      b.length >= 12 &&
      b[0] === 0x52 &&
      b[1] === 0x49 &&
      b[2] === 0x46 &&
      b[3] === 0x46 &&
      b[8] === 0x57 &&
      b[9] === 0x45 &&
      b[10] === 0x42 &&
      b[11] === 0x50
  }
];

export function detectImageMimeFromMagic(buffer: Buffer): string | null {
  for (const row of IMAGE_MAGICS) {
    if (row.test(buffer)) return row.mime;
  }
  return null;
}

function renditionKey(originalKey: string, kind: string, ext: string) {
  const base = originalKey.replace(/\.[^.]+$/, "");
  return `${base}.r/${kind}-${randomUUID().slice(0, 8)}.${ext}`;
}

async function upsertRendition(
  prisma: PrismaClient,
  params: {
    assetId: string;
    kind: "ORIGINAL" | "THUMB" | "CARD" | "WEBP" | "BLUR";
    objectKey: string;
    contentType: string;
    byteSize: number;
    width?: number | null;
    height?: number | null;
    blurHash?: string | null;
  }
) {
  return prisma.mediaAssetRendition.upsert({
    where: {
      assetId_kind: { assetId: params.assetId, kind: params.kind }
    },
    create: {
      assetId: params.assetId,
      kind: params.kind,
      objectKey: params.objectKey,
      contentType: params.contentType,
      byteSize: params.byteSize,
      width: params.width ?? null,
      height: params.height ?? null,
      blurHash: params.blurHash ?? null
    },
    update: {
      objectKey: params.objectKey,
      contentType: params.contentType,
      byteSize: params.byteSize,
      width: params.width ?? null,
      height: params.height ?? null,
      blurHash: params.blurHash ?? null
    }
  });
}

export type PipelineResult =
  | {
      ok: true;
      stage: PipelineStage;
      width?: number;
      height?: number;
      blurHash?: string | null;
      renditionKeys: string[];
    }
  | { ok: false; stage: PipelineStage; error: string };

/**
 * Process an uploaded image asset into platform renditions.
 * Videos: mark READY without heavy transcode (honest skip).
 */
export async function runMediaProcessingPipeline(
  prisma: PrismaClient,
  params: {
    assetId: string;
    restaurantId: string;
    objectKey: string;
    contentType: string;
    onStage?: (stage: PipelineStage, progress: number) => Promise<void> | void;
  }
): Promise<PipelineResult> {
  const report = async (stage: PipelineStage, progress: number) => {
    await params.onStage?.(stage, progress);
  };

  await prisma.mediaAsset.update({
    where: { id: params.assetId },
    data: { processingStatus: "PROCESSING" }
  });

  if (params.contentType.startsWith("video/")) {
    await report("store_meta", 85);
    await runPostUploadHooks({
      assetId: params.assetId,
      objectKey: params.objectKey,
      contentType: params.contentType,
      restaurantId: params.restaurantId
    });
    await report("cdn", 95);
    await purgeCdnObjectKeys([params.objectKey]);
    await prisma.mediaAsset.update({
      where: { id: params.assetId },
      data: { processingStatus: "READY" }
    });
    await report("ready", 100);
    return { ok: true, stage: "ready", renditionKeys: [] };
  }

  if (!params.contentType.startsWith("image/")) {
    await prisma.mediaAsset.update({
      where: { id: params.assetId },
      data: { processingStatus: "SKIPPED" }
    });
    await report("ready", 100);
    return { ok: true, stage: "ready", renditionKeys: [] };
  }

  try {
    await report("validate_magic", 58);
    const buffer = await getObjectBuffer(params.objectKey);
    if (!buffer || buffer.byteLength === 0) {
      throw Object.assign(new Error("object_not_found"), { stage: "validate_magic" as const });
    }

    const magicMime = detectImageMimeFromMagic(buffer);
    if (!magicMime) {
      throw Object.assign(new Error("invalid_image_magic"), { stage: "validate_magic" as const });
    }

    await report("strip_exif_orient", 65);
    const oriented = sharp(buffer).rotate();
    const meta = await oriented.metadata();
    const width = meta.width ?? null;
    const height = meta.height ?? null;

    // Normalized JPEG without EXIF for intermediate work (original S3 object stays immutable).
    const cleanJpeg = await oriented.jpeg({ quality: 92, mozjpeg: true }).toBuffer();

    await upsertRendition(prisma, {
      assetId: params.assetId,
      kind: "ORIGINAL",
      objectKey: params.objectKey,
      contentType: params.contentType,
      byteSize: buffer.byteLength,
      width,
      height
    });

    await report("thumb", 72);
    const thumbBuf = await sharp(cleanJpeg)
      .resize({ width: 320, height: 320, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 82, mozjpeg: true })
      .toBuffer();
    const thumbMeta = await sharp(thumbBuf).metadata();
    const thumbKey = renditionKey(params.objectKey, "thumb", "jpg");
    await putObjectBuffer({
      objectKey: thumbKey,
      body: thumbBuf,
      contentType: "image/jpeg",
      visibility: "private"
    });
    await upsertRendition(prisma, {
      assetId: params.assetId,
      kind: "THUMB",
      objectKey: thumbKey,
      contentType: "image/jpeg",
      byteSize: thumbBuf.byteLength,
      width: thumbMeta.width ?? null,
      height: thumbMeta.height ?? null
    });

    await report("webp", 80);
    const webpBuf = await sharp(cleanJpeg)
      .resize({ width: 1280, height: 1280, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer();
    const webpMeta = await sharp(webpBuf).metadata();
    const webpKey = renditionKey(params.objectKey, "webp", "webp");
    await putObjectBuffer({
      objectKey: webpKey,
      body: webpBuf,
      contentType: "image/webp",
      visibility: "private"
    });
    await upsertRendition(prisma, {
      assetId: params.assetId,
      kind: "WEBP",
      objectKey: webpKey,
      contentType: "image/webp",
      byteSize: webpBuf.byteLength,
      width: webpMeta.width ?? null,
      height: webpMeta.height ?? null
    });

    await report("blurhash", 88);
    const blurRaw = await sharp(cleanJpeg)
      .resize(32, 32, { fit: "inside" })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const blurHash = encode(
      new Uint8ClampedArray(blurRaw.data),
      blurRaw.info.width,
      blurRaw.info.height,
      4,
      3
    );
    await upsertRendition(prisma, {
      assetId: params.assetId,
      kind: "BLUR",
      objectKey: params.objectKey,
      contentType: params.contentType,
      byteSize: 0,
      width: blurRaw.info.width,
      height: blurRaw.info.height,
      blurHash
    });

    await report("store_meta", 92);
    await prisma.mediaAsset.update({
      where: { id: params.assetId },
      data: {
        width,
        height,
        blurHash,
        contentType: magicMime,
        processingStatus: "READY",
        sha256Hex: createHash("sha256").update(buffer).digest("hex")
      }
    });

    await runPostUploadHooks({
      assetId: params.assetId,
      objectKey: params.objectKey,
      contentType: magicMime,
      restaurantId: params.restaurantId
    });

    await report("cdn", 96);
    const purgeKeys = [params.objectKey, thumbKey, webpKey];
    await purgeCdnObjectKeys(purgeKeys);

    await report("ready", 100);
    return {
      ok: true,
      stage: "ready",
      width: width ?? undefined,
      height: height ?? undefined,
      blurHash,
      renditionKeys: purgeKeys
    };
  } catch (err) {
    const stage =
      err && typeof err === "object" && "stage" in err
        ? ((err as { stage: PipelineStage }).stage ?? "failed")
        : "failed";
    const message = err instanceof Error ? err.message : "processing_failed";
    await prisma.mediaAsset.update({
      where: { id: params.assetId },
      data: { processingStatus: "FAILED" }
    });
    await report("failed", 100);
    return { ok: false, stage, error: message };
  }
}
