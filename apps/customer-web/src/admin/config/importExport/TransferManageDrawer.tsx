import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  cancelDataTransferJob,
  deleteDataTransferJob,
  getDataTransferJob,
  type DataTransferJobRow,
  type ImportExportCatalog
} from "../../../api";
import { AdminLabel, inputBase } from "../../AdminUi";
import { useAdminToast } from "../../AdminToast";
import { useModalScrollLock } from "../../../lib/modalScrollLock";
import {
  MENU_PAGE_DRAWER_BACKDROP_CLASS,
  MENU_PAGE_DRAWER_SHELL_CLASS,
  MenuPageModalShell,
  ProfileModalAlert,
  ProfileModalFooter
} from "../menu/menuPageModalShell";
import { MenuSurfacePagination } from "../menu/MenuSurfacePagination";
import { useMenuListPagination } from "../menu/useMenuListPagination";
import { isUiOnlyTransferId } from "./transferListUiMocks";
import {
  isExportReady,
  isJobActive,
  jobStatusLabel,
  jobStatusTone,
  jobTitle
} from "./transferUiHelpers";

const SCOPE_PAGE_SIZE = 8;

type Props = {
  open: boolean;
  jobs: DataTransferJobRow[];
  selectedIds: Set<string>;
  catalog: ImportExportCatalog | null;
  token: string;
  restaurantId: string;
  venueName: string;
  canEdit: boolean;
  onClose: () => void;
  onRefresh: () => void;
  onClearSelection: () => void;
  onViewJob: (job: DataTransferJobRow) => void;
  onDownloadJob: (job: DataTransferJobRow) => void;
};

type DangerKind = "remove" | null;
type PickKind = "view" | "download" | null;

function scopeChipTone(job: DataTransferJobRow) {
  const tone = jobStatusTone(job);
  if (tone === "success" || tone === "info") return "live";
  if (tone === "warning" || tone === "running") return "scheduled";
  if (tone === "danger") return "retired";
  return "draft";
}

function ScopeChip({ job, catalog }: { job: DataTransferJobRow; catalog: ImportExportCatalog | null }) {
  const title = jobTitle(job, catalog);
  return (
    <li>
      <span
        className={`admin-menu-manage-scope-chip admin-menu-manage-scope-chip--${scopeChipTone(job)}`}
        title={`${title} — ${jobStatusLabel(job)}`}
      >
        {title}
      </span>
    </li>
  );
}

export function TransferManageDrawer({
  open,
  jobs,
  selectedIds,
  catalog,
  token,
  restaurantId,
  venueName,
  canEdit,
  onClose,
  onRefresh,
  onClearSelection,
  onViewJob,
  onDownloadJob
}: Props) {
  const { pushToast } = useAdminToast();
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const closeTimerRef = useRef<number | null>(null);

  const [pickKind, setPickKind] = useState<PickKind>(null);
  const [pickedJobId, setPickedJobId] = useState("");
  const [dangerKind, setDangerKind] = useState<DangerKind>(null);
  const [dangerBusy, setDangerBusy] = useState(false);
  const [dangerError, setDangerError] = useState<string | null>(null);
  const [confirmName, setConfirmName] = useState("");
  const [actionBusy, setActionBusy] = useState(false);

  const targets = useMemo(() => {
    if (selectedIds.size === 0) {
      const real = jobs.filter((j) => !isUiOnlyTransferId(j.id));
      return real.length > 0 ? real : jobs;
    }
    return jobs.filter((j) => selectedIds.has(j.id));
  }, [jobs, selectedIds]);

  const apiTargets = useMemo(() => targets.filter((j) => !isUiOnlyTransferId(j.id)), [targets]);

  const scopePager = useMenuListPagination(targets, {
    pageSize: SCOPE_PAGE_SIZE,
    resetKey: `${open ? "open" : "closed"}:${targets.map((j) => j.id).join(",")}`
  });

  const selectionLabel =
    selectedIds.size > 0 ? `${selectedIds.size} selected` : `${targets.length} in list`;

  const anyCancellable = apiTargets.some(isJobActive);
  const anyRemovable = apiTargets.some((j) => !isJobActive(j));
  const anyDownloadable = targets.some(
    (j) =>
      j.direction === "EXPORT" &&
      (isExportReady(j) || ["COMPLETED", "SUCCEEDED", "SUCCESS", "READY"].includes(j.status.toUpperCase()))
  );

  const pickOpen = pickKind != null;
  const dangerOpen = dangerKind != null;
  const showManageShell = mounted && !dangerOpen && !pickOpen;

  useEffect(() => {
    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    if (open) {
      setMounted(true);
      const frame = window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => setVisible(true));
      });
      return () => window.cancelAnimationFrame(frame);
    }
    setVisible(false);
    closeTimerRef.current = window.setTimeout(() => {
      setMounted(false);
      closeTimerRef.current = null;
    }, 520);
    return () => {
      if (closeTimerRef.current) {
        window.clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
      }
    };
  }, [open]);

  useModalScrollLock(mounted || dangerOpen || pickOpen);

  useEffect(() => {
    if (!visible || dangerOpen || pickOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [visible, dangerOpen, pickOpen, onClose]);

  useEffect(() => {
    if (!dangerOpen) {
      setConfirmName("");
      setDangerError(null);
    }
  }, [dangerOpen]);

  useEffect(() => {
    if (open) return;
    setPickKind(null);
    setPickedJobId("");
    setDangerKind(null);
    setActionBusy(false);
  }, [open]);

  useEffect(() => {
    if (!pickOpen) {
      setPickedJobId("");
      return;
    }
    const pool = pickKind === "download" ? targets.filter((j) => j.direction === "EXPORT") : targets;
    if (!pickedJobId || !pool.some((j) => j.id === pickedJobId)) {
      setPickedJobId(pool[0]?.id ?? "");
    }
  }, [pickOpen, pickKind, targets, pickedJobId]);

  const expectedConfirm =
    apiTargets.length === 1
      ? jobTitle(apiTargets[0]!, catalog)
      : apiTargets.map((j) => jobTitle(j, catalog)).join(", ");

  const openPick = (kind: Exclude<PickKind, null>) => {
    if (targets.length < 1) return;
    if (targets.length === 1) {
      const job = targets[0]!;
      if (kind === "view") {
        onViewJob(job);
        onClose();
        return;
      }
      if (kind === "download") {
        onDownloadJob(job);
        return;
      }
    }
    setPickKind(kind);
  };

  const confirmPicked = () => {
    const job = targets.find((j) => j.id === pickedJobId);
    if (!job || !pickKind) {
      pushToast("Choose an operation to continue.", "error");
      return;
    }
    const kind = pickKind;
    setPickKind(null);
    if (kind === "view") {
      onViewJob(job);
      onClose();
      return;
    }
    onDownloadJob(job);
  };

  const runRefresh = async () => {
    if (apiTargets.length === 0) {
      pushToast("Preview rows only — refresh applies to saved transfer jobs.", "error");
      return;
    }
    setActionBusy(true);
    let ok = 0;
    let failed = 0;
    for (const job of apiTargets) {
      const res = await getDataTransferJob(token, restaurantId, job.id);
      if (res.ok && res.job) ok += 1;
      else failed += 1;
    }
    setActionBusy(false);
    onRefresh();
    if (ok > 0) {
      pushToast(ok === 1 ? "Operation refreshed." : `${ok} operations refreshed.`, "success");
    }
    if (failed > 0) {
      pushToast(failed === 1 ? "One job could not be refreshed." : `${failed} could not be refreshed.`, "error");
    }
  };

  const runCancel = async () => {
    if (!canEdit) {
      pushToast("Your role cannot cancel transfers.", "error");
      return;
    }
    const cancellable = apiTargets.filter(isJobActive);
    if (cancellable.length === 0) {
      pushToast(
        apiTargets.length === 0
          ? "Preview rows only — cancel applies to active server jobs."
          : "No active jobs in scope to cancel.",
        "error"
      );
      return;
    }
    setActionBusy(true);
    let ok = 0;
    let failed = 0;
    for (const job of cancellable) {
      const res = await cancelDataTransferJob(token, restaurantId, job.id);
      if (res.ok) ok += 1;
      else failed += 1;
    }
    setActionBusy(false);
    if (ok > 0) {
      pushToast(ok === 1 ? "Transfer cancelled." : `${ok} transfers cancelled.`, "success");
      onRefresh();
      onClearSelection();
    }
    if (failed > 0) {
      pushToast(failed === 1 ? "One job could not be cancelled." : `${failed} could not be cancelled.`, "error");
    }
  };

  const runRemove = async () => {
    if (!canEdit) return;
    if (confirmName.trim() !== expectedConfirm) return;
    const removable = apiTargets.filter((j) => !isJobActive(j));
    if (removable.length === 0) {
      setDangerError("Cancel active jobs before removing them from history.");
      return;
    }
    setDangerBusy(true);
    setDangerError(null);
    let ok = 0;
    let failed = 0;
    for (const job of removable) {
      const res = await deleteDataTransferJob(token, restaurantId, job.id);
      if (res.ok) ok += 1;
      else failed += 1;
    }
    setDangerBusy(false);
    if (ok > 0) {
      pushToast(ok === 1 ? "Removed from history." : `${ok} operations removed from history.`, "success");
      onRefresh();
      onClearSelection();
      setDangerKind(null);
      onClose();
    }
    if (failed > 0 && ok === 0) {
      setDangerError("Could not remove the selected operations from history.");
    } else if (failed > 0) {
      pushToast(`${failed} could not be removed.`, "error");
      setDangerKind(null);
      onClose();
    }
  };

  if (!mounted && !dangerOpen && !pickOpen) return null;

  const pickTitle = pickKind === "download" ? "Download which export?" : "View which operation?";
  const pickDesc =
    pickKind === "download"
      ? "Choose one export from the list to download."
      : "Choose one operation to open its full record.";
  const pickPool =
    pickKind === "download"
      ? targets.filter(
          (j) =>
            j.direction === "EXPORT" &&
            (isExportReady(j) ||
              ["COMPLETED", "SUCCEEDED", "SUCCESS", "READY"].includes(j.status.toUpperCase()))
        )
      : targets;

  return createPortal(
    <>
      {showManageShell ? (
        <div
          className={`admin-staff-profile-shell ${MENU_PAGE_DRAWER_SHELL_CLASS} ${visible ? "admin-staff-profile-shell--open" : ""}`}
          role="presentation"
          aria-hidden={!visible}
        >
          <button
            type="button"
            className={`${MENU_PAGE_DRAWER_BACKDROP_CLASS}${visible ? " is-active" : ""}`}
            aria-label="Close manage operations"
            tabIndex={visible ? 0 : -1}
            onClick={onClose}
          />
          <div
            role="dialog"
            aria-modal="true"
            tabIndex={visible ? 0 : -1}
            aria-label="Manage operations"
            className={`admin-staff-profile-panel admin-menu-item-profile-panel ${visible ? "admin-staff-profile-panel--open" : ""}`}
          >
            <header className="admin-staff-profile-header">
              <div className="min-w-0 flex-1">
                <h3 className="admin-staff-profile-title">Manage operations</h3>
                <p className="admin-staff-profile-sub">
                  {selectionLabel}
                  {venueName ? ` at ${venueName}` : ""}
                </p>
              </div>
              <button type="button" className="admin-staff-profile-close" onClick={onClose} aria-label="Close">
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                  <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </header>

            <div className="admin-staff-profile-body admin-menu-item-profile-body admin-menu-manage-body">
              {targets.length === 0 ? (
                <p className="admin-staff-drawer-hint">Select operations from the list to manage them.</p>
              ) : (
                <>
                  <section className="admin-staff-drawer-section">
                    <h4 className="admin-staff-drawer-section-title">In scope</h4>
                    <ul className={`admin-menu-manage-scope-list ${scopePager.pageClassName}`} key={scopePager.pageKey}>
                      {scopePager.pagedItems.map((job) => (
                        <ScopeChip key={job.id} job={job} catalog={catalog} />
                      ))}
                    </ul>
                    {scopePager.showPagination ? (
                      <MenuSurfacePagination
                        page={scopePager.page}
                        totalPages={scopePager.totalPages}
                        totalItems={scopePager.totalItems}
                        pageSize={scopePager.pageSize}
                        onPageChange={scopePager.goToPage}
                        label="In-scope operations pagination"
                        size="compact"
                      />
                    ) : null}
                    {apiTargets.length === 0 ? (
                      <p className="admin-staff-drawer-hint mt-3">
                        Preview rows are for layout only. Saved server jobs can be cancelled, refreshed, or removed.
                      </p>
                    ) : null}
                  </section>

                  <section className="admin-staff-drawer-section">
                    <h4 className="admin-staff-drawer-section-title">Actions</h4>
                    <div className="admin-menu-manage-actions">
                      <button
                        type="button"
                        className="admin-menu-manage-action"
                        disabled={actionBusy}
                        onClick={() => openPick("view")}
                      >
                        <span className="admin-menu-manage-action-label">View details</span>
                        <span className="admin-menu-manage-action-desc">
                          Open the full transfer record, counts, and source file info.
                        </span>
                      </button>
                      {anyDownloadable ? (
                        <button
                          type="button"
                          className="admin-menu-manage-action"
                          disabled={actionBusy}
                          onClick={() => openPick("download")}
                        >
                          <span className="admin-menu-manage-action-label">
                            {targets.filter((j) => j.direction === "EXPORT").length === 1
                              ? "Download export"
                              : "Download export…"}
                          </span>
                          <span className="admin-menu-manage-action-desc">
                            Prepare a fresh download for a completed export in scope.
                          </span>
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className="admin-menu-manage-action"
                        disabled={actionBusy || apiTargets.length === 0}
                        onClick={() => void runRefresh()}
                      >
                        <span className="admin-menu-manage-action-label">Refresh status</span>
                        <span className="admin-menu-manage-action-desc">
                          Re-fetch the latest job status from ServeOS for jobs in scope.
                        </span>
                      </button>
                      {anyCancellable ? (
                        <button
                          type="button"
                          className="admin-menu-manage-action"
                          disabled={actionBusy || !canEdit}
                          onClick={() => void runCancel()}
                        >
                          <span className="admin-menu-manage-action-label">
                            {apiTargets.filter(isJobActive).length > 1 ? "Cancel active jobs" : "Cancel job"}
                          </span>
                          <span className="admin-menu-manage-action-desc">
                            Stop queued, running, or validating transfers. Finished jobs stay in history.
                          </span>
                        </button>
                      ) : null}
                    </div>
                  </section>

                  <section className="admin-staff-drawer-section">
                    <h4 className="admin-staff-drawer-section-title">Selection</h4>
                    <div className="admin-menu-manage-actions">
                      <button
                        type="button"
                        className="admin-menu-manage-action"
                        disabled={selectedIds.size === 0}
                        onClick={() => {
                          onClearSelection();
                          pushToast("Selection cleared.", "success");
                        }}
                      >
                        <span className="admin-menu-manage-action-label">Clear selection</span>
                        <span className="admin-menu-manage-action-desc">
                          Deselect all operations on the Recent operations list.
                        </span>
                      </button>
                    </div>
                  </section>

                  <section className="admin-staff-drawer-section admin-menu-manage-danger-zone">
                    <h4 className="admin-staff-drawer-section-title admin-menu-manage-danger-title">Danger Zone</h4>
                    <div className="admin-menu-manage-danger-row" role="group" aria-label="Dangerous transfer actions">
                      <button
                        type="button"
                        className="admin-menu-manage-danger-btn"
                        disabled={!canEdit || !anyRemovable}
                        onClick={() => setDangerKind("remove")}
                      >
                        <span className="admin-menu-manage-danger-btn-label">
                          {apiTargets.filter((j) => !isJobActive(j)).length > 1
                            ? "Remove from history"
                            : "Remove from history"}
                        </span>
                        <span className="admin-menu-manage-danger-btn-desc">
                          Delete finished job records. Does not undo imported venue data.
                        </span>
                      </button>
                    </div>
                  </section>
                </>
              )}
            </div>
          </div>
        </div>
      ) : null}

      <MenuPageModalShell
        open={pickOpen}
        onClose={() => setPickKind(null)}
        title={pickTitle}
        description={pickDesc}
        titleId="transfer-pick-title"
        stackLevel="overlay"
      >
        <AdminLabel>
          <span className="text-xs admin-config-text-muted">Operation</span>
          <select
            className={`${inputBase} mt-1 w-full`}
            value={pickedJobId}
            onChange={(e) => setPickedJobId(e.target.value)}
            aria-label="Choose operation"
          >
            {pickPool.map((job) => (
              <option key={job.id} value={job.id}>
                {jobTitle(job, catalog)} — {jobStatusLabel(job)}
              </option>
            ))}
          </select>
        </AdminLabel>
        <ProfileModalFooter
          onCancel={() => setPickKind(null)}
          onConfirm={confirmPicked}
          confirmLabel={pickKind === "download" ? "Download" : "View details"}
          confirmDisabled={!pickedJobId || pickPool.length === 0}
        />
      </MenuPageModalShell>

      <MenuPageModalShell
        open={dangerOpen}
        onClose={dangerBusy ? () => undefined : () => setDangerKind(null)}
        title="Remove from history?"
        description="This deletes the transfer job record. Imported or exported venue data is not changed."
        titleId="transfer-remove-title"
        stackLevel="overlay"
        busy={dangerBusy}
      >
        {dangerError ? <ProfileModalAlert tone="error">{dangerError}</ProfileModalAlert> : null}
        <AdminLabel>
          <span className="text-xs admin-config-text-muted">
            Type {apiTargets.length === 1 ? "the operation name" : "all operation names"} to confirm
          </span>
          <input
            className={`${inputBase} mt-1 w-full`}
            value={confirmName}
            onChange={(e) => setConfirmName(e.target.value)}
            placeholder={expectedConfirm}
            disabled={dangerBusy}
            autoComplete="off"
          />
        </AdminLabel>
        <p className="mt-2 text-xs admin-config-text-muted">Expected: {expectedConfirm}</p>
        <ProfileModalFooter
          danger
          busy={dangerBusy}
          cancelLabel="Cancel"
          onCancel={() => setDangerKind(null)}
          confirmLabel={apiTargets.length > 1 ? "Remove operations" : "Remove operation"}
          confirmDisabled={confirmName.trim() !== expectedConfirm || apiTargets.length === 0}
          onConfirm={() => void runRemove()}
        />
      </MenuPageModalShell>
    </>,
    document.body
  );
}
