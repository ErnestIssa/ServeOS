import type { MediaLibraryAsset } from "../../../api";

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

type Props = {
  asset: MediaLibraryAsset;
  onOpen: () => void;
};

export function MediaAssetCard({ asset, onOpen }: Props) {
  const isVideo = asset.contentType.startsWith("video/");
  const name = asset.displayName || asset.originalName || "Untitled";
  return (
    <button type="button" className="admin-menu-media-card text-left" onClick={onOpen}>
      {asset.url && !isVideo ? (
        <img src={asset.url} alt={asset.altText || name} className="admin-menu-media-card__preview" />
      ) : isVideo ? (
        <div className="admin-menu-media-card__preview admin-menu-media-card__preview--empty">Video</div>
      ) : (
        <div className="admin-menu-media-card__preview admin-menu-media-card__preview--empty">Image</div>
      )}
      <div className="admin-menu-media-card__meta">
        <span className="truncate text-xs font-semibold admin-config-text">{name}</span>
        <span className="admin-config-text-subtle text-[0.65rem]">
          {isVideo ? "Video" : "Image"} · {formatBytes(asset.byteSize)} · {asset.usageCount} use
          {asset.usageCount === 1 ? "" : "s"}
        </span>
        {asset.health?.missingAlt || asset.health?.unused || asset.health?.largeFile ? (
          <span className="admin-config-text-subtle text-[0.65rem]">
            {[
              asset.health.missingAlt ? "No alt" : null,
              asset.health.unused ? "Unused" : null,
              asset.health.largeFile ? "Large" : null
            ]
              .filter(Boolean)
              .join(" · ")}
          </span>
        ) : null}
      </div>
    </button>
  );
}
