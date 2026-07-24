import { useEffect, useRef, useState } from "react";
import {
  deleteMediaLibraryAsset,
  detachMediaLibraryUsages,
  getMediaDeleteImpact,
  patchMediaLibraryAsset,
  type MediaDeleteImpact
} from "../../../api";
import { MenuPageModalShell } from "../menu/menuPageModalShell";
import { AdminBtnSecondary } from "../../AdminUi";
import { useAdminToast } from "../../AdminToast";
import { MediaUsageGraph } from "./MediaUsageGraph";

type Props = {
  open: boolean;
  onClose: () => void;
  token: string;
  restaurantId: string;
  assetId: string;
  assetName?: string;
  canDelete: boolean;
  canEdit: boolean;
  canUpload: boolean;
  onReplaceEverywhere: () => void;
  onDone: () => void;
};

type Mode = "overview" | "detach";
type PendingAction = "archive" | "delete" | null;

export function MediaDeleteSafetyModal({
  open,
  onClose,
  token,
  restaurantId,
  assetId,
  assetName,
  canDelete,
  canEdit,
  canUpload,
  onReplaceEverywhere,
  onDone
}: Props) {
  const { pushToast } = useAdminToast();
  const [impact, setImpact] = useState<MediaDeleteImpact | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<Mode>("overview");
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [runningAction, setRunningAction] = useState<PendingAction>(null);
  const requestIdRef = useRef(0);
  const pendingRef = useRef<PendingAction>(null);

  useEffect(() => {
    pendingRef.current = pendingAction;
  }, [pendingAction]);

  useEffect(() => {
    if (!open) return;
    const requestId = ++requestIdRef.current;
    setMode("overview");
    setSelected(new Set());
    setImpact(null);
    setLoadError(null);
    setPendingAction(null);
    pendingRef.current = null;
    setRunningAction(null);
    setLoading(true);

    void (async () => {
      const res = await getMediaDeleteImpact(token, restaurantId, assetId);
      if (requestId !== requestIdRef.current) return;
      setLoading(false);
      if (!res.ok || !res.impact) {
        setLoadError(res.message ?? res.error ?? "Could not check usage.");
        return;
      }
      setImpact(res.impact);

      const queued = pendingRef.current;
      if (queued === "archive") {
        setPendingAction(null);
        pendingRef.current = null;
        await runArchive(requestId);
      } else if (queued === "delete") {
        setPendingAction(null);
        pendingRef.current = null;
        await runHardDelete(requestId, res.impact);
      }
    })();

    return () => {
      requestIdRef.current += 1;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, token, restaurantId, assetId]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const runArchive = async (requestId = requestIdRef.current) => {
    if (!canEdit) return;
    setRunningAction("archive");
    setBusy(true);
    const res = await patchMediaLibraryAsset(token, restaurantId, assetId, { archived: true });
    if (requestId !== requestIdRef.current) return;
    setBusy(false);
    setRunningAction(null);
    if (!res.ok) {
      pushToast(res.message ?? res.error ?? "Archive failed.", "error");
      return;
    }
    pushToast("Asset archived.", "success");
    onDone();
    onClose();
  };

  const runHardDelete = async (requestId = requestIdRef.current, nextImpact = impact) => {
    if (!canDelete) return;
    if (!nextImpact) return;
    if (!nextImpact.canHardDelete || nextImpact.total > 0) {
      pushToast("Delete blocked — remove or replace usages first, or archive instead.", "error");
      return;
    }
    setRunningAction("delete");
    setBusy(true);
    const res = await deleteMediaLibraryAsset(token, restaurantId, assetId);
    if (requestId !== requestIdRef.current) return;
    setBusy(false);
    setRunningAction(null);
    if (!res.ok) {
      pushToast(res.message ?? res.error ?? "Delete blocked.", "error");
      return;
    }
    pushToast("Asset deleted permanently.", "success");
    onDone();
    onClose();
  };

  const requestArchive = () => {
    if (!canEdit || busy) return;
    if (loading || !impact) {
      setPendingAction("archive");
      pendingRef.current = "archive";
      return;
    }
    void runArchive();
  };

  const requestDelete = () => {
    if (!canDelete || busy) return;
    if (loading || !impact) {
      setPendingAction("delete");
      pendingRef.current = "delete";
      return;
    }
    void runHardDelete();
  };

  const detachSelected = async () => {
    if (!canEdit || selected.size === 0 || busy) return;
    const requestId = requestIdRef.current;
    setBusy(true);
    const res = await detachMediaLibraryUsages(token, restaurantId, assetId, [...selected]);
    if (requestId !== requestIdRef.current) return;
    setBusy(false);
    if (!res.ok) {
      pushToast(res.message ?? res.error ?? "Detach failed.", "error");
      return;
    }
    pushToast(`Removed from ${res.detached ?? selected.size} place(s).`, "success");
    // Refresh impact in background without closing.
    setLoading(true);
    const next = await getMediaDeleteImpact(token, restaurantId, assetId);
    if (requestId !== requestIdRef.current) return;
    setLoading(false);
    if (next.ok && next.impact) {
      setImpact(next.impact);
      setSelected(new Set());
      setMode("overview");
    }
    onDone();
  };

  const titleName = assetName || impact?.displayName || "this asset";
  const used = (impact?.total ?? 0) > 0;
  const canHardDelete = Boolean(impact?.canHardDelete) && !used;

  return (
    <MenuPageModalShell
      open={open}
      onClose={busy ? () => undefined : onClose}
      title="Remove media?"
      titleId="media-delete-safety"
      description={
        loading && !impact
          ? `Checking where “${titleName}” is used…`
          : used
            ? `“${titleName}” is used in ${impact!.total} place(s). Direct delete is blocked until usages are cleared.`
            : `“${titleName}” is unused. Archive to soft-remove, or delete permanently.`
      }
      maxWidthClass="max-w-lg"
      bodyScroll={false}
    >
      <div className="media-delete-modal">
        {loadError ? <p className="media-delete-modal__error">{loadError}</p> : null}

        {impact && used ? (
          <div className="media-delete-modal__body">
            <MediaUsageGraph
              usages={impact.usages}
              selectable={mode === "detach"}
              selectedIds={selected}
              onToggleSelect={toggle}
            />
            {mode === "overview" ? (
              <div className="media-delete-modal__alt-actions">
                {canUpload ? (
                  <AdminBtnSecondary
                    disabled={busy}
                    onClick={() => {
                      onClose();
                      onReplaceEverywhere();
                    }}
                  >
                    Replace everywhere
                  </AdminBtnSecondary>
                ) : null}
                {canEdit ? (
                  <AdminBtnSecondary disabled={busy} onClick={() => setMode("detach")}>
                    Remove from selected places
                  </AdminBtnSecondary>
                ) : null}
              </div>
            ) : (
              <div className="media-delete-modal__alt-actions media-delete-modal__alt-actions--row">
                <AdminBtnSecondary disabled={busy} onClick={() => setMode("overview")}>
                  Back
                </AdminBtnSecondary>
                <button
                  type="button"
                  className="admin-profile-modal-btn admin-profile-modal-btn--primary media-delete-modal__btn"
                  disabled={busy || selected.size === 0}
                  onClick={() => void detachSelected()}
                >
                  {busy ? "Working…" : `Remove selected (${selected.size})`}
                </button>
              </div>
            )}
          </div>
        ) : null}

        {loading && !impact ? (
          <div className="media-delete-modal__checking" aria-live="polite">
            <span className="media-step-loader media-delete-modal__loader" aria-hidden />
            <p className="text-sm admin-config-text-muted">Checking usage in the background…</p>
            {pendingAction ? (
              <p className="text-xs admin-config-text-muted">
                {pendingAction === "archive" ? "Archive" : "Delete"} will run when the check finishes.
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="media-delete-modal__footer">
          {canEdit ? (
            <button
              type="button"
              className="admin-profile-modal-btn admin-profile-modal-btn--ghost media-delete-modal__btn"
              disabled={busy}
              onClick={requestArchive}
            >
              {busy && runningAction === "archive"
                ? "Archiving…"
                : pendingAction === "archive"
                  ? "Waiting…"
                  : "Archive"}
            </button>
          ) : null}
          {canDelete ? (
            <button
              type="button"
              className="admin-profile-modal-btn admin-profile-modal-btn--danger media-delete-modal__btn"
              disabled={busy || (Boolean(impact) && !canHardDelete)}
              title={
                impact && !canHardDelete
                  ? "Remove or replace usages first, or archive instead"
                  : undefined
              }
              onClick={requestDelete}
            >
              {busy && runningAction === "delete"
                ? "Deleting…"
                : pendingAction === "delete"
                  ? "Waiting…"
                  : "Delete Permanently"}
            </button>
          ) : null}
        </div>
      </div>
    </MenuPageModalShell>
  );
}
