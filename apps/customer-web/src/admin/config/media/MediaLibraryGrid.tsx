import { useState } from "react";
import type { MediaLibraryAsset } from "../../../api";
import { MediaAssetCard } from "./MediaAssetCard";
import type { MediaCardActionCaps, MediaCardActionId } from "./mediaCardActions";

type Props = {
  assets: MediaLibraryAsset[];
  loading: boolean;
  venueName: string;
  caps: MediaCardActionCaps;
  onOpen: (id: string) => void;
  onAction: (asset: MediaLibraryAsset, actionId: MediaCardActionId) => void;
};

export function MediaLibraryGrid({ assets, loading, venueName, caps, onOpen, onAction }: Props) {
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  if (loading && assets.length === 0) {
    return <p className="admin-config-text-muted text-sm">Loading library…</p>;
  }
  if (assets.length === 0) {
    return (
      <div className="admin-menu-image-placeholder mt-2">
        <p className="admin-config-text-subtle text-sm">
          No assets yet{venueName ? ` for ${venueName}` : ""}. Use Add media to upload the first file.
        </p>
      </div>
    );
  }
  return (
    <div className="admin-menu-media-grid admin-media-library-grid">
      {assets.map((asset) => (
        <MediaAssetCard
          key={asset.id}
          asset={asset}
          caps={caps}
          menuOpen={openMenuId === asset.id}
          onOpen={() => onOpen(asset.id)}
          onToggleMenu={() => setOpenMenuId((id) => (id === asset.id ? null : asset.id))}
          onAction={(actionId) => {
            setOpenMenuId(null);
            onAction(asset, actionId);
          }}
        />
      ))}
    </div>
  );
}
