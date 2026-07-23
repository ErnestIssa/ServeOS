import type { MediaCollectionRow, MediaLibraryListQuery } from "../../../api";

type Props = {
  query: MediaLibraryListQuery;
  collections: MediaCollectionRow[];
  total: number;
  onChange: (q: MediaLibraryListQuery) => void;
};

const FILTERS: Array<{ id: string; label: string; patch: Partial<MediaLibraryListQuery> }> = [
  { id: "all", label: "All", patch: { type: "all", used: false, unused: false, favorite: false, archived: false, needsAlt: false, largeFiles: false, recentlyUploaded: false } },
  { id: "images", label: "Images", patch: { type: "image" } },
  { id: "videos", label: "Videos", patch: { type: "video" } },
  { id: "unused", label: "Unused", patch: { unused: true, used: false } },
  { id: "used", label: "Used", patch: { used: true, unused: false } },
  { id: "favorite", label: "Favorites", patch: { favorite: true } },
  { id: "recent", label: "Recently uploaded", patch: { recentlyUploaded: true } },
  { id: "needsAlt", label: "Missing alt text", patch: { needsAlt: true } },
  { id: "large", label: "Large files", patch: { largeFiles: true } },
  { id: "archived", label: "Archived", patch: { archived: true } }
];

export function MediaLibraryFilters({ query, collections, total, onChange }: Props) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          className="admin-config-input min-w-[12rem] flex-1"
          placeholder="Search name, alt text, tags…"
          value={query.q ?? ""}
          onChange={(e) => onChange({ ...query, q: e.target.value, page: 1 })}
        />
        <span className="admin-config-text-muted text-xs">{total} assets</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => {
          const active =
            f.id === "all"
              ? !query.unused &&
                !query.used &&
                !query.favorite &&
                !query.archived &&
                !query.needsAlt &&
                !query.largeFiles &&
                !query.recentlyUploaded &&
                (!query.type || query.type === "all")
              : f.id === "images"
                ? query.type === "image"
                : f.id === "videos"
                  ? query.type === "video"
                  : f.id === "unused"
                    ? Boolean(query.unused)
                    : f.id === "used"
                      ? Boolean(query.used)
                      : f.id === "favorite"
                        ? Boolean(query.favorite)
                        : f.id === "recent"
                          ? Boolean(query.recentlyUploaded)
                          : f.id === "needsAlt"
                            ? Boolean(query.needsAlt)
                            : f.id === "large"
                              ? Boolean(query.largeFiles)
                              : Boolean(query.archived);
          return (
            <button
              key={f.id}
              type="button"
              className={`admin-menu-tab-chip${active ? " is-active" : ""}`}
              onClick={() =>
                onChange({
                  ...query,
                  page: 1,
                  type: "all",
                  used: false,
                  unused: false,
                  favorite: false,
                  archived: false,
                  needsAlt: false,
                  largeFiles: false,
                  recentlyUploaded: false,
                  ...f.patch
                })
              }
            >
              {f.label}
            </button>
          );
        })}
      </div>
      {collections.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={`admin-menu-tab-chip${!query.collectionId ? " is-active" : ""}`}
            onClick={() => onChange({ ...query, collectionId: undefined, page: 1 })}
          >
            Any collection
          </button>
          {collections.map((c) => (
            <button
              key={c.id}
              type="button"
              className={`admin-menu-tab-chip${query.collectionId === c.id ? " is-active" : ""}`}
              onClick={() => onChange({ ...query, collectionId: c.id, page: 1 })}
            >
              {c.name}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
