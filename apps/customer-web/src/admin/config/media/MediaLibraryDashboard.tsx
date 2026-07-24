import type { MediaLibraryStats } from "../../../api";
import { formatStorageBytes } from "./mediaHash";
import { AdminSkeletonStatGrid } from "../../AdminSkeleton";

type Props = {
  stats: MediaLibraryStats | null;
};

function StatTile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="admin-stat-card rounded-xl border p-4 shadow-sm">
      <p className="admin-stat-label text-[10px] font-bold uppercase tracking-[0.14em]">{label}</p>
      <p className="admin-stat-value mt-2 font-display text-2xl font-bold">{value}</p>
      {hint ? <p className="admin-stat-hint mt-1 text-xs">{hint}</p> : null}
    </div>
  );
}

export function MediaLibraryDashboard({ stats }: Props) {
  if (!stats) {
    return (
      <div className="mt-1">
        <AdminSkeletonStatGrid count={4} />
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" role="group" aria-label="Media library statistics">
      <StatTile
        label="Assets"
        value={String(stats.totalAssets)}
        hint={`${stats.imageCount} images · ${stats.videoCount} videos`}
      />
      <StatTile
        label="Storage"
        value={formatStorageBytes(stats.storageBytes)}
        hint={`${stats.unusedCount} unused · ${stats.duplicateGroupCount} duplicate groups`}
      />
      <StatTile
        label="Health"
        value={`${stats.libraryHealthScore}%`}
        hint={`${stats.missingAltCount} missing alt · ${stats.videosProcessing} processing`}
      />
      <StatTile
        label="In use"
        value={String(Math.max(0, stats.totalAssets - stats.unusedCount))}
        hint="Attached to menus, venue, or other surfaces"
      />
    </div>
  );
}
