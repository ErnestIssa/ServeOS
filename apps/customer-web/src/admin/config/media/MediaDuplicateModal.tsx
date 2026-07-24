import type { MediaDuplicateCheckAsset } from "../../../api";
import { MenuPageModalShell, ProfileModalFooter } from "../menu/menuPageModalShell";
import { AdminBtnPrimary, AdminBtnSecondary } from "../../AdminUi";
import { formatStorageBytes } from "./mediaHash";

type Props = {
  open: boolean;
  onClose: () => void;
  existing: MediaDuplicateCheckAsset;
  localPreviewUrl: string | null;
  localName: string;
  showCompare: boolean;
  onToggleCompare: () => void;
  onReuse: () => void;
  onUploadAnyway: () => void;
};

export function MediaDuplicateModal({
  open,
  onClose,
  existing,
  localPreviewUrl,
  localName,
  showCompare,
  onToggleCompare,
  onReuse,
  onUploadAnyway
}: Props) {
  return (
    <MenuPageModalShell
      open={open}
      onClose={onClose}
      title="This file already exists"
      description="An identical file is already in this venue’s Media Library."
      titleId="media-duplicate-modal"
      maxWidthClass="max-w-lg"
    >
      <div className="space-y-4">
        {showCompare ? (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="mb-1 text-[10px] font-bold uppercase tracking-wider admin-config-text-muted">
                Existing
              </p>
              {existing.url && existing.contentType.startsWith("image/") ? (
                <img src={existing.url} alt="" className="max-h-40 w-full rounded-xl object-contain" />
              ) : (
                <p className="text-sm admin-config-text-muted">{existing.displayName}</p>
              )}
            </div>
            <div>
              <p className="mb-1 text-[10px] font-bold uppercase tracking-wider admin-config-text-muted">
                New upload
              </p>
              {localPreviewUrl ? (
                <img src={localPreviewUrl} alt="" className="max-h-40 w-full rounded-xl object-contain" />
              ) : (
                <p className="text-sm admin-config-text-muted">{localName}</p>
              )}
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-slate-200/80 p-3 text-sm dark:border-slate-700/50">
            <p className="font-semibold admin-config-text">{existing.displayName}</p>
            <p className="admin-config-text-muted text-xs">
              {existing.contentType} · {formatStorageBytes(existing.byteSize)}
            </p>
          </div>
        )}

        <div className="flex flex-col gap-2">
          <AdminBtnPrimary onClick={onReuse}>Reuse existing</AdminBtnPrimary>
          <AdminBtnSecondary onClick={onUploadAnyway}>Upload anyway</AdminBtnSecondary>
          <AdminBtnSecondary onClick={onToggleCompare}>
            {showCompare ? "Hide compare" : "Compare"}
          </AdminBtnSecondary>
        </div>
      </div>
      <ProfileModalFooter cancelLabel="Cancel" onCancel={onClose} confirmLabel="Close" onConfirm={onClose} />
    </MenuPageModalShell>
  );
}
