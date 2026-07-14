import {
  attachMenuItemMedia,
  attachMenuSurfaceCoverMedia,
  completeMenuMediaUpload,
  createMenuMediaUploadSession,
  uploadMenuMediaBase64
} from "../../../api";

export function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("read_failed"));
    reader.readAsDataURL(file);
  });
}

export function readVideoDurationMs(file: File) {
  return new Promise<number>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      const ms = Math.round(video.duration * 1000);
      URL.revokeObjectURL(url);
      resolve(ms);
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("video_metadata_failed"));
    };
    video.src = url;
  });
}

export async function uploadMenuMediaFile(
  token: string,
  opts: {
    restaurantId: string;
    file: File;
    kind: "image" | "video";
    menuItemId?: string;
  }
) {
  const scope = opts.kind === "image" ? "menu" : "video";
  const contentType = opts.file.type || (opts.kind === "image" ? "image/jpeg" : "video/mp4");
  const session = await createMenuMediaUploadSession(token, {
    scope,
    contentType,
    restaurantId: opts.restaurantId,
    menuItemId: opts.menuItemId,
    originalName: opts.file.name
  });
  if (!session.ok || !session.upload) {
    return { ok: false as const, error: session.error ?? "upload_session_failed" };
  }

  const dataBase64 = await readFileAsDataUrl(opts.file);
  const uploaded = await uploadMenuMediaBase64(token, {
    scope,
    objectKey: session.upload.objectKey,
    contentType,
    dataBase64,
    restaurantId: opts.restaurantId,
    originalName: opts.file.name
  });
  if (!uploaded.ok || !uploaded.media?.id) {
    const completed = await completeMenuMediaUpload(token, {
      scope,
      objectKey: session.upload.objectKey,
      contentType,
      restaurantId: opts.restaurantId,
      originalName: opts.file.name
    });
    if (!completed.ok || !completed.media?.id) {
      return { ok: false as const, error: uploaded.error ?? completed.error ?? "upload_failed" };
    }
    return { ok: true as const, mediaId: completed.media.id };
  }
  return { ok: true as const, mediaId: uploaded.media.id };
}

export async function attachUploadedMediaToItem(
  token: string,
  restaurantId: string,
  menuItemId: string,
  opts: { mediaId: string; setAsCover?: boolean; durationMs?: number }
) {
  return attachMenuItemMedia(token, restaurantId, menuItemId, opts);
}

export async function attachUploadedMediaToMenuCover(
  token: string,
  restaurantId: string,
  menuId: string,
  mediaId: string
) {
  return attachMenuSurfaceCoverMedia(token, restaurantId, menuId, mediaId);
}
