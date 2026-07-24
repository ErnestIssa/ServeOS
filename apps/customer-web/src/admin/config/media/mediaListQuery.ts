import type { MediaCollectionRow, MediaLibraryListQuery } from "../../../api";
import type { MenuListFilterGroup, MenuListQueryPreset, MenuListToolOption } from "../menu/menuListQuery";

export const MEDIA_DEFAULT_SORT = "newest";

export const MEDIA_SORT_OPTIONS: MenuListToolOption[] = [
  { id: "newest", label: "Newest first", description: "Most recently uploaded" },
  { id: "oldest", label: "Oldest first", description: "Earliest uploads first" },
  { id: "name_asc", label: "Name A–Z", description: "Alphabetical by display name" },
  { id: "name_desc", label: "Name Z–A", description: "Reverse alphabetical" },
  { id: "size_desc", label: "Largest first", description: "By file size" },
  { id: "size_asc", label: "Smallest first", description: "By file size" }
];

const BASE_FILTER_GROUPS: MenuListFilterGroup[] = [
  {
    id: "type",
    label: "Type",
    hint: "Match any selected media type.",
    options: [
      { id: "type:image", label: "Images", description: "JPEG, PNG, WebP, GIF…" },
      { id: "type:video", label: "Videos", description: "MP4, WebM, MOV…" }
    ]
  },
  {
    id: "usage",
    label: "Usage",
    hint: "Match any selected usage state.",
    options: [
      { id: "usage:used", label: "In use", description: "Attached to at least one surface" },
      { id: "usage:unused", label: "Unused", description: "Not attached anywhere" }
    ]
  },
  {
    id: "status",
    label: "Status",
    options: [
      { id: "status:favorite", label: "Favorites", description: "Starred assets" },
      { id: "status:recent", label: "Recently uploaded", description: "Last 7 days" },
      { id: "status:processing", label: "Processing", description: "Still in the pipeline" },
      { id: "status:archived", label: "Archived", description: "Hidden from the default library" }
    ]
  },
  {
    id: "health",
    label: "Health",
    options: [
      { id: "health:needs_alt", label: "Missing alt text", description: "Accessibility gaps" },
      { id: "health:large", label: "Large files", description: "Over the size threshold" },
      { id: "health:duplicates", label: "Duplicates", description: "Same hash as another asset" }
    ]
  }
];

export function buildMediaListQueryPreset(collections: MediaCollectionRow[]): MenuListQueryPreset {
  const filterGroups = [...BASE_FILTER_GROUPS];
  if (collections.length > 0) {
    filterGroups.push({
      id: "collection",
      label: "Collection",
      hint: "Match any selected collection.",
      options: collections.map((c) => ({
        id: `collection:${c.id}`,
        label: c.name,
        description: c.description?.trim() || undefined
      }))
    });
  }
  return {
    defaultSort: MEDIA_DEFAULT_SORT,
    filterGroups,
    sortOptions: MEDIA_SORT_OPTIONS
  };
}

export function mediaFiltersFromQuery(query: MediaLibraryListQuery): string[] {
  const ids: string[] = [];
  if (query.type === "image") ids.push("type:image");
  if (query.type === "video") ids.push("type:video");
  if (query.used) ids.push("usage:used");
  if (query.unused) ids.push("usage:unused");
  if (query.favorite) ids.push("status:favorite");
  if (query.recentlyUploaded) ids.push("status:recent");
  if (query.processing) ids.push("status:processing");
  if (query.archived) ids.push("status:archived");
  if (query.needsAlt) ids.push("health:needs_alt");
  if (query.largeFiles) ids.push("health:large");
  if (query.duplicates) ids.push("health:duplicates");
  if (query.collectionId) ids.push(`collection:${query.collectionId}`);
  return ids;
}

export function applyMediaFiltersToQuery(
  query: MediaLibraryListQuery,
  filterIds: string[]
): MediaLibraryListQuery {
  const has = (id: string) => filterIds.includes(id);
  const typeImage = has("type:image");
  const typeVideo = has("type:video");
  let type: MediaLibraryListQuery["type"] = "all";
  if (typeImage && !typeVideo) type = "image";
  else if (typeVideo && !typeImage) type = "video";

  const collectionId = filterIds.find((id) => id.startsWith("collection:"))?.slice("collection:".length);

  return {
    ...query,
    page: 1,
    type,
    used: has("usage:used"),
    unused: has("usage:unused"),
    favorite: has("status:favorite"),
    recentlyUploaded: has("status:recent"),
    processing: has("status:processing"),
    archived: has("status:archived"),
    needsAlt: has("health:needs_alt"),
    largeFiles: has("health:large"),
    duplicates: has("health:duplicates"),
    collectionId: collectionId || undefined
  };
}
