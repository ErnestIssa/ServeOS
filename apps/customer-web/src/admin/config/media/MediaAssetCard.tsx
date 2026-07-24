import type { MediaLibraryAsset } from "../../../api";
import { MenuEntityActionsMenu } from "../menu/MenuEntityActionsMenu";
import { buildMediaCardActions, type MediaCardActionCaps, type MediaCardActionId } from "./mediaCardActions";

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

type Props = {
  asset: MediaLibraryAsset;
  menuOpen: boolean;
  caps: MediaCardActionCaps;
  onOpen: () => void;
  onToggleMenu: () => void;
  onAction: (actionId: MediaCardActionId) => void;
};

export function MediaAssetCard({ asset, menuOpen, caps, onOpen, onToggleMenu, onAction }: Props) {
  const isVideo = asset.contentType.startsWith("video/");
  const name = asset.displayName || asset.originalName || "Untitled";
  const healthBits = [
    asset.health?.missingAlt ? "No alt" : null,
    asset.health?.unused ? "Unused" : null,
    asset.health?.largeFile ? "Large" : null,
    asset.archivedAt ? "Archived" : null
  ].filter(Boolean);
  const actions = buildMediaCardActions(asset, caps);

  return (
    <article
      className={`admin-media-library-card${isVideo ? " admin-media-library-card--video" : ""}${
        menuOpen ? " is-menu-open" : ""
      }`}
    >
      <button type="button" className="admin-media-library-card__hit" onClick={onOpen} aria-label={`Open ${name}`}>
        {asset.url && !isVideo ? (
          <img src={asset.url} alt={asset.altText || name} className="admin-media-library-card__media" />
        ) : (
          <div className="admin-media-library-card__media admin-media-library-card__media--empty">
            {isVideo ? "Video" : "Image"}
          </div>
        )}
      </button>

      <div className="admin-media-library-card__actions">
        <MenuEntityActionsMenu
          entityName={name}
          hideHeader
          open={menuOpen}
          actions={actions}
          onToggle={onToggleMenu}
          onAction={(id) => onAction(id as MediaCardActionId)}
        />
      </div>

      <button type="button" className="admin-media-library-card__glass" onClick={onOpen}>
        <span className="admin-media-library-card__name">{name}</span>
        <span className="admin-media-library-card__meta">
          {isVideo ? "Video" : "Image"} · {formatBytes(asset.byteSize)} · {asset.usageCount} use
          {asset.usageCount === 1 ? "" : "s"}
        </span>
        {healthBits.length > 0 ? (
          <span className="admin-media-library-card__health">{healthBits.join(" · ")}</span>
        ) : null}
      </button>
    </article>
  );
}
