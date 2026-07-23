import type { MediaLibraryAsset } from "../../../api";
import { MediaAssetCard } from "./MediaAssetCard";

type Props = {
  assets: MediaLibraryAsset[];
  loading: boolean;
  venueName: string;
  onOpen: (id: string) => void;
};

export function MediaLibraryGrid({ assets, loading, venueName, onOpen }: Props) {
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
        <MediaAssetCard key={asset.id} asset={asset} onOpen={() => onOpen(asset.id)} />
      ))}
    </div>
  );
}
