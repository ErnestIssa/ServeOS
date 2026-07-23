/** Per-purpose upload limits (bytes). Plan-configurable later. */
export type MediaPurpose = "menu_cover" | "item_image" | "logo" | "item_video" | "marketing_video" | "general";

const PURPOSE_MAX_BYTES: Record<MediaPurpose, number> = {
  menu_cover: 10 * 1024 * 1024,
  item_image: 8 * 1024 * 1024,
  logo: 2 * 1024 * 1024,
  item_video: 250 * 1024 * 1024,
  marketing_video: 1024 * 1024 * 1024,
  general: 25 * 1024 * 1024
};

export function maxBytesForPurpose(purpose: MediaPurpose | string | null | undefined): number {
  if (purpose && purpose in PURPOSE_MAX_BYTES) {
    return PURPOSE_MAX_BYTES[purpose as MediaPurpose];
  }
  return PURPOSE_MAX_BYTES.general;
}

export function purposeFromContentType(contentType: string, hint?: MediaPurpose | null): MediaPurpose {
  if (hint) return hint;
  if (contentType.startsWith("video/")) return "item_video";
  return "item_image";
}

/** Soft “large file” threshold for library filters (10 MB). */
export const LARGE_FILE_BYTES = 10 * 1024 * 1024;
