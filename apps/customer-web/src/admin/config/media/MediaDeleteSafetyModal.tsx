import { useEffect, useState } from "react";
import {
  deleteMediaLibraryAsset,
  detachMediaLibraryUsages,
  getMediaDeleteImpact,
  patchMediaLibraryAsset,
  type MediaDeleteImpact
} from "../../../api";
import { MenuPageModalShell, ProfileModalFooter } from "../menu/menuPageModalShell";
import { AdminBtnPrimary, AdminBtnSecondary } from "../../AdminUi";
import { useAdminToast } from "../../AdminToast";
import { MediaUsageGraph } from "./MediaUsageGraph";

type Props = {
  open: boolean;
  onClose: () => void;
  token: string;
  restaurantId: string;
  assetId: string;
  canDelete: boolean;
  canEdit: boolean;
  canUpload: boolean;
  onReplaceEverywhere: () => void;
  onDone: () => void;
};

type Mode = "overview" | "detach";

export function MediaDeleteSafetyModal({
  open,
  onClose,
  token,
  restaurantId,
  assetId,
  canDelete,
  canEdit,
  canUpload,
  onReplaceEverywhere,
  onDone
}: Props) {
  const { pushToast } = useAdminToast();
  const [impact, setImpact] = useState<MediaDeleteImpact | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<Mode>("overview");
  const [selected, setSelected] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    if (!open) return;
    setMode("overview");
    setSelected(new Set());
    setLoading(true);
    void (async () => {
      const res = await getMediaDeleteImpact(token, restaurantId, assetId);
      setLoading(false);
      if (!res.ok || !res.impact) {
        pushToast(res.message ?? res.error ?? "Could not load usage impact.", "error");
        onClose();
        return;
      }
      setImpact(res.impact);
    })();
  }, [open, token, restaurantId, assetId, pushToast, onClose]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const archive = async () => {
    if (!canEdit) return;
    setBusy(true);
    const res = await patchMediaLibraryAsset(token, restaurantId, assetId, { archived: true });
    setBusy(false);
    if (!res.ok) {
      pushToast(res.message ?? res.error ?? "Archive failed.", "error");
      return;
    }
    pushToast("Asset archived.", "success");
    onDone();
    onClose();
  };

  const hardDelete = async () => {
    if (!canDelete || !impact?.canHardDelete) return;
    setBusy(true);
    const res = await deleteMediaLibraryAsset(token, restaurantId, assetId);
    setBusy(false);
    if (!res.ok) {
      pushToast(res.message ?? res.error ?? "Delete blocked.", "error");
      return;
    }
    pushToast("Asset deleted permanently.", "success");
    onDone();
    onClose();
  };

  const detachSelected = async () => {
    if (!canEdit || selected.size === 0) return;
    setBusy(true);
    const res = await detachMediaLibraryUsages(token, restaurantId, assetId, [...selected]);
    setBusy(false);
    if (!res.ok) {
      pushToast(res.message ?? res.error ?? "Detach failed.", "error");
      return;
    }
    pushToast(`Removed from ${res.detached ?? selected.size} place(s).`, "success");
    onDone();
    onClose();
  };

  return (
    <MenuPageModalShell
      open={open}
      onClose={busy ? () => undefined : onClose}
      title="Remove media?"
      titleId="media-delete-safety"
      description={
        impact && impact.total > 0
          ? `This asset is currently used in ${impact.total} place(s). Direct delete is blocked.`
          : "This asset is unused. You can archive or delete it permanently."
      }
      maxWidthClass="max-w-lg"
    >
      {loading || !impact ? (
        <p className="text-sm admin-config-text-muted">Checking where this asset is used…</p>
      ) : (
        <div className="space-y-4">
          {impact.total > 0 ? (
            <>
              <MediaUsageGraph
                usages={impact.usages}
                selectable={mode === "detach"}
                selectedIds={selected}
                onToggleSelect={toggle}
              />
              {mode === "overview" ? (
                <div className="flex flex-col gap-2">
                  {canUpload ? (
                    <AdminBtnPrimary
                      disabled={busy}
                      onClick={() => {
                        onClose();
                        onReplaceEverywhere();
                      }}
                    >
                      Replace everywhere
                    </AdminBtnPrimary>
                  ) : null}
                  {canEdit ? (
                    <AdminBtnSecondary disabled={busy} onClick={() => setMode("detach")}>
                      Remove from selected places
                    </AdminBtnSecondary>
                  ) : null}
                  {canEdit ? (
                    <AdminBtnSecondary disabled={busy} onClick={() => void archive()}>
                      Archive instead
                    </AdminBtnSecondary>
                  ) : null}
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  <AdminBtnPrimary disabled={busy || selected.size === 0} onClick={() => void detachSelected()}>
                    Remove selected ({selected.size})
                  </AdminBtnPrimary>
                  <AdminBtnSecondary disabled={busy} onClick={() => setMode("overview")}>
                    Back
                  </AdminBtnSecondary>
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col gap-2">
              {canEdit ? (
                <AdminBtnSecondary disabled={busy} onClick={() => void archive()}>
                  Archive
                </AdminBtnSecondary>
              ) : null}
              {canDelete ? (
                <AdminBtnPrimary disabled={busy} onClick={() => void hardDelete()}>
                  Delete permanently
                </AdminBtnPrimary>
              ) : null}
            </div>
          )}
        </div>
      )}
      <ProfileModalFooter cancelLabel="Cancel" onCancel={onClose} confirmLabel="Done" onConfirm={onClose} />
    </MenuPageModalShell>
  );
}
