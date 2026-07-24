import {
  createMediaUploadJob,
  createMenuMediaUploadSession,
  getMediaUploadJob,
  uploadMenuMediaBase64,
  completeMenuMediaUpload,
  type MediaImportSource
} from "../../../api";
import { readFileAsDataUrl, readVideoDurationMs } from "../menu/menuMediaUpload";

export { readFileAsDataUrl, readVideoDurationMs };

export type LibraryUploadImportMeta = {
  importSource?: MediaImportSource;
  importSourceId?: string;
  importOriginalPath?: string;
};

export async function uploadLibraryMediaFile(
  token: string,
  opts: {
    restaurantId: string;
    file: File;
    kind: "image" | "video";
    displayName?: string;
    altText?: string;
    purpose?: string;
    forceNewAsset?: boolean;
    importMeta?: LibraryUploadImportMeta;
    onJobId?: (jobId: string) => void;
    onStage?: (label: string) => void;
  }
) {
  const scope = opts.kind === "image" ? "menu" : "video";
  const contentType = opts.file.type || (opts.kind === "image" ? "image/jpeg" : "video/mp4");

  opts.onStage?.("Queuing upload…");
  const jobRes = await createMediaUploadJob(token, opts.restaurantId, {
    originalName: opts.file.name,
    contentType,
    purpose: opts.purpose ?? (opts.kind === "image" ? "item_image" : "item_video")
  });
  const jobId = jobRes.ok && jobRes.job ? jobRes.job.id : undefined;
  if (jobId) opts.onJobId?.(jobId);

  opts.onStage?.("Preparing storage…");
  const session = await createMenuMediaUploadSession(token, {
    scope,
    contentType,
    restaurantId: opts.restaurantId,
    originalName: opts.file.name
  });
  if (!session.ok || !session.upload) {
    return { ok: false as const, error: session.error ?? "upload_session_failed", jobId };
  }

  let width: number | undefined;
  let height: number | undefined;
  let durationMs: number | undefined;
  if (opts.kind === "image") {
    try {
      const dims = await readImageDimensions(opts.file);
      width = dims.width;
      height = dims.height;
    } catch {
      /* optional */
    }
  } else {
    try {
      durationMs = await readVideoDurationMs(opts.file);
    } catch {
      /* optional */
    }
  }

  opts.onStage?.("Uploading original…");
  const dataBase64 = await readFileAsDataUrl(opts.file);
  const uploaded = await uploadMenuMediaBase64(token, {
    scope,
    objectKey: session.upload.objectKey,
    contentType,
    dataBase64,
    restaurantId: opts.restaurantId,
    originalName: opts.file.name,
    uploadJobId: jobId,
    displayName: opts.displayName || opts.file.name,
    altText: opts.altText,
    width,
    height,
    durationMs,
    forceNewAsset: opts.forceNewAsset,
    importSource: opts.importMeta?.importSource,
    importSourceId: opts.importMeta?.importSourceId,
    importOriginalPath: opts.importMeta?.importOriginalPath
  });

  if (!uploaded.ok || !uploaded.media?.id) {
    const completed = await completeMenuMediaUpload(token, {
      scope,
      objectKey: session.upload.objectKey,
      contentType,
      restaurantId: opts.restaurantId,
      originalName: opts.file.name,
      uploadJobId: jobId,
      forceNewAsset: opts.forceNewAsset
    });
    if (!completed.ok || !completed.media?.id) {
      return {
        ok: false as const,
        error: uploaded.error ?? completed.error ?? "upload_failed",
        jobId
      };
    }
    if (jobId) {
      opts.onStage?.("Processing · validate · thumb · WebP…");
      await pollJobUntilSettled(token, opts.restaurantId, jobId);
    }
    return {
      ok: true as const,
      mediaId: completed.media.id,
      assetId: completed.assetId ?? null,
      reused: completed.reused ?? false,
      jobId
    };
  }

  if (jobId) {
    opts.onStage?.("Processing · validate · thumb · WebP…");
    await pollJobUntilSettled(token, opts.restaurantId, jobId);
  }

  return {
    ok: true as const,
    mediaId: uploaded.media.id,
    assetId: uploaded.assetId ?? null,
    reused: uploaded.reused ?? false,
    jobId
  };
}

function readImageDimensions(file: File) {
  return new Promise<{ width: number; height: number }>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const width = img.naturalWidth;
      const height = img.naturalHeight;
      URL.revokeObjectURL(url);
      resolve({ width, height });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("image_meta_failed"));
    };
    img.src = url;
  });
}

async function pollJobUntilSettled(token: string, restaurantId: string, jobId: string) {
  for (let i = 0; i < 20; i++) {
    const res = await getMediaUploadJob(token, restaurantId, jobId);
    const status = res.job?.status;
    if (status === "READY" || status === "FAILED") return res.job;
    await new Promise((r) => window.setTimeout(r, 200));
  }
  return null;
}
