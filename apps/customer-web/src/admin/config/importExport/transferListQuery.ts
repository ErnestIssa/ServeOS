import type { DataTransferJobRow, ImportExportCatalog } from "../../../api";
import type { MenuListQueryPreset } from "../menu/menuListQuery";
import { isJobActive, jobStatusLabel, jobTitle } from "./transferUiHelpers";

export const TRANSFER_LIST_QUERY: MenuListQueryPreset = {
  defaultSort: "started_desc",
  filterGroups: [
    {
      id: "direction",
      label: "Type",
      options: [
        { id: "direction:import", label: "Import", description: "Data brought into ServeOS" },
        { id: "direction:export", label: "Export", description: "Data taken out of ServeOS" }
      ]
    },
    {
      id: "status",
      label: "Status",
      options: [
        { id: "status:running", label: "Running", description: "Still processing" },
        { id: "status:completed", label: "Completed", description: "Finished successfully" },
        { id: "status:warnings", label: "Warnings", description: "Completed but needs review" },
        { id: "status:failed", label: "Failed", description: "Operation failed or cancelled" },
        { id: "status:ready", label: "Ready to download", description: "Export ready" },
        { id: "status:dry_run", label: "Dry run", description: "Validated without writing" }
      ]
    },
    {
      id: "data",
      label: "Data type",
      options: [
        { id: "data:menu", label: "Menu" },
        { id: "data:orders", label: "Orders" },
        { id: "data:customers", label: "Customers" },
        { id: "data:staff", label: "Staff" },
        { id: "data:inventory", label: "Inventory" },
        { id: "data:other", label: "Other", description: "Tables, media, QR, loyalty, etc." }
      ]
    }
  ],
  sortOptions: [
    { id: "started_desc", label: "Newest first", description: "Most recent operations first" },
    { id: "started_asc", label: "Oldest first" },
    { id: "name_asc", label: "Name A–Z" },
    { id: "name_desc", label: "Name Z–A" },
    { id: "records_desc", label: "Most records" },
    { id: "records_asc", label: "Fewest records" },
    { id: "status_asc", label: "Status" }
  ]
};

/** History tab filters — mirrors the former chip row (All = no filters). */
export const TRANSFER_HISTORY_LIST_QUERY: MenuListQueryPreset = {
  defaultSort: "started_desc",
  filterGroups: [
    {
      id: "direction",
      label: "Type",
      options: [
        { id: "direction:import", label: "Import", description: "Imports into this venue" },
        { id: "direction:export", label: "Export", description: "Exports from this venue" }
      ]
    },
    {
      id: "status",
      label: "Status",
      options: [
        { id: "status:running", label: "Running", description: "Queued or still processing" },
        { id: "status:completed", label: "Completed", description: "Finished successfully" },
        { id: "status:warnings", label: "Warnings", description: "Finished with warnings or row errors" },
        { id: "status:failed", label: "Failed", description: "Failed or cancelled" }
      ]
    }
  ],
  sortOptions: [
    { id: "started_desc", label: "Newest first", description: "Most recent first — who did it when" },
    { id: "started_asc", label: "Oldest first" },
    { id: "status_asc", label: "Status", description: "Group by outcome" },
    { id: "name_asc", label: "Name A–Z" },
    { id: "name_desc", label: "Name Z–A" },
    { id: "records_desc", label: "Most records" },
    { id: "records_asc", label: "Fewest records" }
  ]
};

function groupSelected(active: string[], groupId: string) {
  const group = TRANSFER_LIST_QUERY.filterGroups.find((g) => g.id === groupId);
  if (!group) return [];
  return group.options.map((o) => o.id).filter((id) => active.includes(id));
}

function dataBucket(targetKey: string) {
  if (["menu", "categories", "items", "modifier-groups", "modifier-options", "availability"].includes(targetKey)) {
    return "data:menu";
  }
  if (targetKey === "orders") return "data:orders";
  if (targetKey === "customers") return "data:customers";
  if (targetKey === "staff") return "data:staff";
  if (targetKey === "inventory") return "data:inventory";
  return "data:other";
}

function filterMatch(job: DataTransferJobRow, id: string) {
  const status = (job.status || "").toUpperCase();
  switch (id) {
    case "direction:import":
      return job.direction === "IMPORT";
    case "direction:export":
      return job.direction === "EXPORT";
    case "status:completed":
      return (
        (status === "COMPLETED" || status === "SUCCEEDED" || status === "SUCCESS") &&
        job.warningCount === 0 &&
        !job.dryRun
      );
    case "status:warnings":
      return job.warningCount > 0 || job.failedCount > 0;
    case "status:running":
      return isJobActive(job);
    case "status:ready":
      return status === "READY";
    case "status:failed":
      return status === "FAILED" || status === "CANCELLED";
    case "status:dry_run":
      return job.dryRun;
    case "data:menu":
    case "data:orders":
    case "data:customers":
    case "data:staff":
    case "data:inventory":
    case "data:other":
      return dataBucket(job.targetKey) === id;
    default:
      return false;
  }
}

export function applyTransferListFilters(rows: DataTransferJobRow[], filters: string[]) {
  if (filters.length === 0) return rows;
  return rows.filter((job) => {
    for (const group of TRANSFER_LIST_QUERY.filterGroups) {
      const selected = groupSelected(filters, group.id);
      if (selected.length === 0) continue;
      if (!selected.some((id) => filterMatch(job, id))) return false;
    }
    return true;
  });
}

export function applyTransferListSort(
  rows: DataTransferJobRow[],
  sortId: string,
  catalog: ImportExportCatalog | null
) {
  const next = [...rows];
  switch (sortId) {
    case "started_asc":
      return next.sort(
        (a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime()
      );
    case "name_asc":
      return next.sort((a, b) => jobTitle(a, catalog).localeCompare(jobTitle(b, catalog)));
    case "name_desc":
      return next.sort((a, b) => jobTitle(b, catalog).localeCompare(jobTitle(a, catalog)));
    case "records_desc":
      return next.sort((a, b) => b.rowCount - a.rowCount);
    case "records_asc":
      return next.sort((a, b) => a.rowCount - b.rowCount);
    case "status_asc":
      return next.sort((a, b) => jobStatusLabel(a).localeCompare(jobStatusLabel(b)));
    case "started_desc":
    default:
      return next.sort(
        (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
      );
  }
}
