import type { MediaUploadJobRow } from "../../../api";
import { AdminBtnSecondary } from "../../AdminUi";

type Props = {
  jobs: MediaUploadJobRow[];
  onRefresh: () => void;
};

export function MediaUploadQueuePanel({ jobs, onRefresh }: Props) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm admin-config-text-muted">
          Upload jobs show real stages: queued → uploading → hashing → metadata → CDN → ready.
        </p>
        <AdminBtnSecondary onClick={onRefresh}>Refresh</AdminBtnSecondary>
      </div>
      {jobs.length === 0 ? (
        <p className="text-sm admin-config-text-muted">No upload jobs yet.</p>
      ) : (
        <ul className="space-y-2">
          {jobs.map((j) => (
            <li key={j.id} className="rounded-xl border border-slate-200 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold admin-config-text">{j.originalName || "Upload"}</p>
                <span className="text-xs font-bold uppercase admin-config-text-muted">{j.status}</span>
              </div>
              <p className="mt-1 text-xs admin-config-text-muted">
                Stage: {j.stage} · {j.progress}%
              </p>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-slate-700"
                  style={{ width: `${Math.min(100, Math.max(0, j.progress))}%` }}
                />
              </div>
              {j.error ? <p className="mt-2 text-xs text-red-600">{j.error}</p> : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
