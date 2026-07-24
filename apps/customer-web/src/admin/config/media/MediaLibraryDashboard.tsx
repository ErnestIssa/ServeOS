import type { MediaLibraryListQuery, MediaLibraryStats } from "../../../api";
import { formatStorageBytes } from "./mediaHash";

type Props = {
  stats: MediaLibraryStats | null;
  onFilter: (patch: Partial<MediaLibraryListQuery>) => void;
};

function StatChip({
  label,
  value,
  onClick,
  hint
}: {
  label: string;
  value: string;
  onClick?: () => void;
  hint?: string;
}) {
  const cls =
    "rounded-xl border border-slate-200/80 bg-white/80 px-3 py-2 text-left shadow-sm dark:border-slate-700/50 dark:bg-slate-900/40";
  if (onClick) {
    return (
      <button type="button" className={`${cls} transition hover:border-slate-400`} onClick={onClick} title={hint}>
        <p className="text-[10px] font-bold uppercase tracking-[0.12em] admin-config-text-muted">{label}</p>
        <p className="mt-1 font-display text-xl font-bold admin-config-text">{value}</p>
      </button>
    );
  }
  return (
    <div className={cls} title={hint}>
      <p className="text-[10px] font-bold uppercase tracking-[0.12em] admin-config-text-muted">{label}</p>
      <p className="mt-1 font-display text-xl font-bold admin-config-text">{value}</p>
    </div>
  );
}

export function MediaLibraryDashboard({ stats, onFilter }: Props) {
  if (!stats) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 p-4 text-sm admin-config-text-muted dark:border-slate-700">
        Loading library stats…
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
      <StatChip label="Total assets" value={String(stats.totalAssets)} />
      <StatChip label="Storage used" value={formatStorageBytes(stats.storageBytes)} />
      <StatChip
        label="Unused"
        value={String(stats.unusedCount)}
        onClick={() =>
          onFilter({
            unused: true,
            used: false,
            duplicates: false,
            processing: false,
            page: 1
          })
        }
      />
      <StatChip
        label="Duplicates"
        value={String(stats.duplicateGroupCount)}
        onClick={() =>
          onFilter({
            duplicates: true,
            unused: false,
            used: false,
            processing: false,
            page: 1
          })
        }
      />
      <StatChip
        label="Processing"
        value={String(stats.videosProcessing)}
        onClick={() =>
          onFilter({
            processing: true,
            unused: false,
            used: false,
            duplicates: false,
            page: 1
          })
        }
      />
      <StatChip
        label="Library health"
        value={`${stats.libraryHealthScore}%`}
        hint="Based on alt text, size, usage, processing, and dimensions — not WebP/AVIF yet."
      />
    </div>
  );
}
