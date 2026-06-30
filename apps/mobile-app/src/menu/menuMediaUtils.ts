import type { ImageSourcePropType } from "react-native";

export type MenuMediaLite = {
  id: string;
  kind: "image" | "video";
  url: string | null;
  sortOrder: number;
  durationMs?: number | null;
};

export type MenuItemWithMedia = {
  id: string;
  coverUrl?: string | null;
  imageKey?: string | null;
  media?: MenuMediaLite[];
};

/** Resolve menu card / detail image — real CDN URL only (no stock photos). */
export function menuImageSourceForItem(item: MenuItemWithMedia): ImageSourcePropType | null {
  const url = item.coverUrl?.trim() || item.media?.find((m) => m.kind === "image" && m.url)?.url?.trim();
  if (url) return { uri: url };
  return null;
}

export function menuVideosForItem(item: MenuItemWithMedia): MenuMediaLite[] {
  return (item.media ?? []).filter((m) => m.kind === "video" && m.url);
}

export function menuImagesForItem(item: MenuItemWithMedia): MenuMediaLite[] {
  return (item.media ?? []).filter((m) => m.kind === "image" && m.url);
}
