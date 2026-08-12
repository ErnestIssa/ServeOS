import type { MediaLibraryAsset } from "../../../api";
import { ConfigSectionSpinner } from "../configLoadingUi";
import type { MediaCardActionCaps, MediaCardActionId } from "./mediaCardActions";
import { MediaLibraryGrid } from "./MediaLibraryGrid";

type Props = {
  assets: MediaLibraryAsset[];
  loading: boolean;
  venueName: string;
  caps: MediaCardActionCaps;
  onOpen: (id: string) => void;
  onAction: (asset: MediaLibraryAsset, actionId: MediaCardActionId) => void;
};

export function MediaArchivedPanel({ assets, loading, venueName, caps, onOpen, onAction }: Props) {
  return (
    <div className="admin-media-archived-panel">
      <div className="admin-media-archived-panel__intro">
        <p className="admin-media-archived-panel__lede">
          Soft-removed files live here. Restore them anytime, or open Manage / Details to replace or delete
          permanently.
        </p>
      </div>
      {loading && assets.length === 0 ? (
        <ConfigSectionSpinner label="Loading archived media" />
      ) : assets.length === 0 ? (
        <p className="admin-media-archived-panel__empty">No archived assets yet.</p>
      ) : (
        <MediaLibraryGrid
          assets={assets}
          loading={loading}
          venueName={venueName}
          caps={caps}
          onOpen={onOpen}
          onAction={onAction}
        />
      )}
    </div>
  );
}
