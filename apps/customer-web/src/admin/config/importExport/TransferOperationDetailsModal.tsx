import type { DataTransferJobRow, ImportExportCatalog } from "../../../api";
import { AdminBtnPrimary, AdminBtnSecondary } from "../../AdminUi";
import { MenuChip } from "../menu/MenuPageUi";
import {
  DetailsDrawerShell,
  DetailsFlags,
  DetailsGrid,
  DetailsRow,
  DetailsSection,
  shortEntityId,
  useCachedDetailsEntity
} from "../menu/detailsDrawerUi";
import {
  formatBytes,
  formatWhen,
  jobActorLabel,
  jobListDescription,
  jobRecordLabel,
  jobStatusLabel,
  jobSurfaceStatusClass,
  jobTitle
} from "./transferUiHelpers";

type Props = {
  open: boolean;
  onClose: () => void;
  job: DataTransferJobRow | null;
  catalog: ImportExportCatalog | null;
  venueName?: string;
  onDownloadExport?: (job: DataTransferJobRow) => void;
};

export function TransferOperationDetailsModal({
  open,
  onClose,
  job,
  catalog,
  venueName = "",
  onDownloadExport
}: Props) {
  const active = useCachedDetailsEntity(open, job);
  const title = active ? jobTitle(active, catalog) : "Operation details";

  return (
    <DetailsDrawerShell
      open={open}
      entityKey={active?.id ?? null}
      title={title}
      subtitle={active ? `${active.direction}${venueName ? ` · ${venueName}` : ""}` : undefined}
      badge={
        active ? (
          <>
            <span className={`admin-menu-surface-status ${jobSurfaceStatusClass(active)}`}>
              {jobStatusLabel(active)}
            </span>
            <MenuChip tone="muted">{jobRecordLabel(active)}</MenuChip>
          </>
        ) : null
      }
      closeLabel="Close operation details"
      onClose={onClose}
    >
      {active ? (
        <>
          <DetailsSection>
            <DetailsGrid>
              <DetailsRow label="Operation" value={title} />
              <DetailsRow label="Internal ID" value={shortEntityId(active.id)} />
              <DetailsRow label="Type" value={active.direction === "IMPORT" ? "Import" : "Export"} />
              <DetailsRow label="Status" value={jobStatusLabel(active)} />
              <DetailsRow label="Data target" value={active.targetKey} />
              <DetailsRow label="Started by" value={jobActorLabel(active)} />
            </DetailsGrid>
          </DetailsSection>

          <DetailsSection title="Timing">
            <DetailsGrid>
              <DetailsRow label="Started" value={formatWhen(active.startedAt)} />
              <DetailsRow label="Finished" value={formatWhen(active.finishedAt)} />
              {active.dryRun ? <DetailsRow label="Mode" value="Dry run · no writes" /> : null}
            </DetailsGrid>
          </DetailsSection>

          <DetailsSection title="Source">
            <DetailsGrid>
              <DetailsRow label="File" value={jobListDescription(active)} />
              <DetailsRow label="Size" value={formatBytes(active.fileSizeBytes)} />
              <DetailsRow label="Format" value={active.sourceFormat ?? "—"} />
              <DetailsRow
                label="SHA-256"
                value={active.fileHash ? shortEntityId(active.fileHash) : "—"}
              />
            </DetailsGrid>
          </DetailsSection>

          <DetailsSection title="Results">
            <DetailsGrid>
              <DetailsRow label="Records" value={jobRecordLabel(active)} />
              <DetailsRow label="Created" value={String(active.importedCount)} />
              <DetailsRow label="Updated" value={String(active.updatedCount)} />
              <DetailsRow label="Skipped" value={String(active.skippedCount)} />
              <DetailsRow label="Failed" value={String(active.failedCount)} />
              <DetailsRow label="Warnings" value={String(active.warningCount)} />
            </DetailsGrid>
          </DetailsSection>

          {active.error ? (
            <DetailsSection title="Error">
              <p className="text-sm text-rose-600">{active.error}</p>
            </DetailsSection>
          ) : null}

          <DetailsSection title="Rollback" hint="Whether this transfer can be safely reversed.">
            <DetailsFlags
              flags={[
                {
                  label: "Undo available",
                  ok: active.undoAvailable,
                  note: active.undoAvailable
                    ? "Safe to undo — restore previous configuration where possible."
                    : "Cannot undo automatically — review affected records manually if needed."
                },
                {
                  label: "Undo window",
                  ok: Boolean(active.undoExpiresAt),
                  note: active.undoExpiresAt ? formatWhen(active.undoExpiresAt) : "No timed undo window"
                }
              ]}
            />
          </DetailsSection>

          <div className="mt-4 flex flex-wrap gap-2">
            {active.direction === "EXPORT" && onDownloadExport ? (
              <AdminBtnPrimary type="button" onClick={() => onDownloadExport(active)}>
                Download
              </AdminBtnPrimary>
            ) : null}
            {active.direction === "IMPORT" && active.fileName ? (
              <AdminBtnSecondary type="button" disabled>
                Download original · soon
              </AdminBtnSecondary>
            ) : null}
            <AdminBtnSecondary type="button" onClick={onClose}>
              Close
            </AdminBtnSecondary>
          </div>
        </>
      ) : null}
    </DetailsDrawerShell>
  );
}
