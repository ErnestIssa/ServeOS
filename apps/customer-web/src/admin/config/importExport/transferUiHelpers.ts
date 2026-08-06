import type {
  DataTransferJobRow,
  DataTransferTemplateRow,
  ImportExportCatalog,
  MenuCsvPreview
} from "../../../api";

export const MENU_CSV_TEMPLATE = `category,item,description,price_cents,sort_order,active,modifier_group,modifier_option,option_price_delta_cents
Starters,Soup of the day,Seasonal soup,8900,1,yes,,,
Mains,House burger,Served with fries,14900,1,yes,Extras,Extra cheese,2000
`;

export const MENU_FIELD_MAP: Array<{ source: string; field: string; required?: boolean }> = [
  { source: "category", field: "Category", required: true },
  { source: "item", field: "Item name", required: true },
  { source: "description", field: "Description" },
  { source: "price_cents", field: "Base price (cents)", required: true },
  { source: "sort_order", field: "Sort order" },
  { source: "active", field: "Active" },
  { source: "modifier_group", field: "Modifier group" },
  { source: "modifier_option", field: "Modifier option" },
  { source: "option_price_delta_cents", field: "Option price delta" }
];

export type JobStatusTone = "success" | "warning" | "danger" | "info" | "muted" | "running";

export function downloadTextFile(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function formatBytes(bytes: number | null | undefined) {
  if (bytes == null || Number.isNaN(bytes)) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatWhen(iso: string | null | undefined) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    const now = new Date();
    const sameDay =
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate();
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const isYesterday =
      d.getFullYear() === yesterday.getFullYear() &&
      d.getMonth() === yesterday.getMonth() &&
      d.getDate() === yesterday.getDate();
    const time = d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
    if (sameDay) return `Today ${time}`;
    if (isYesterday) return `Yesterday ${time}`;
    return d.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  } catch {
    return iso;
  }
}

export function formatRelativeDay(iso: string | null | undefined) {
  if (!iso) return "0";
  return formatWhen(iso);
}

export function jobStatusLabel(job: DataTransferJobRow): string {
  const status = (job.status || "").toUpperCase();
  if (status === "RUNNING" || status === "QUEUED" || status === "PROCESSING") return "Processing";
  if (status === "READY") return "Ready to download";
  if (status === "FAILED") return "Failed";
  if (status === "CANCELLED") return "Cancelled";
  if (job.warningCount > 0 || job.failedCount > 0) return "Completed with warnings";
  if (job.dryRun) return "Validated (dry run)";
  if (status === "COMPLETED" || status === "SUCCEEDED" || status === "SUCCESS") return "Completed";
  return job.status || "Unknown";
}

export function jobStatusTone(job: DataTransferJobRow): JobStatusTone {
  const status = (job.status || "").toUpperCase();
  if (status === "RUNNING" || status === "QUEUED" || status === "PROCESSING") return "running";
  if (status === "READY") return "info";
  if (status === "FAILED" || status === "CANCELLED") return "danger";
  if (job.warningCount > 0 || job.failedCount > 0) return "warning";
  if (job.dryRun) return "muted";
  return "success";
}

/** Maps transfer status onto the same status chip classes as Menu items. */
export function jobSurfaceStatusClass(job: DataTransferJobRow) {
  const tone = jobStatusTone(job);
  if (tone === "success" || tone === "info") return "admin-menu-surface-status--live";
  if (tone === "warning" || tone === "running") return "admin-menu-surface-status--scheduled";
  if (tone === "danger") return "admin-menu-surface-status--retired";
  return "admin-menu-surface-status--draft";
}

export function jobActorLabel(job: DataTransferJobRow) {
  const id = job.startedByUserId;
  if (!id) return "System";
  if (id === "ui-mock-alex") return "Alex";
  if (id === "ui-mock-sam") return "Sam";
  if (id === "ui-mock-jordan") return "Jordan";
  return `${id.slice(0, 6)}…`;
}

export function jobListDescription(job: DataTransferJobRow) {
  if (job.fileName) return job.fileName;
  if (job.direction === "EXPORT") return "Generated export file";
  if (job.dryRun) return "Validation only — no writes";
  return `${job.direction === "IMPORT" ? "Import" : "Export"} · ${job.targetKey}`;
}

export function jobTitle(job: DataTransferJobRow, catalog: ImportExportCatalog | null): string {
  const target = catalog?.targets.find((t) => t.key === job.targetKey);
  const label = target?.label ?? job.targetKey;
  if (job.direction === "IMPORT") {
    return job.dryRun ? `${label} validation` : `${label} import`;
  }
  return `${label} export`;
}

export function jobRecordLabel(job: DataTransferJobRow): string {
  const n = job.rowCount || job.importedCount || 0;
  if (job.failedCount > 0 && job.status.toUpperCase() !== "FAILED") {
    return `${job.failedCount.toLocaleString()} records need attention`;
  }
  if (n <= 0) return "No rows";
  return `${n.toLocaleString()} records`;
}

export function isJobActive(job: DataTransferJobRow) {
  const s = (job.status || "").toUpperCase();
  return s === "RUNNING" || s === "QUEUED" || s === "PROCESSING";
}

export function isExportReady(job: DataTransferJobRow) {
  return job.direction === "EXPORT" && (job.status || "").toUpperCase() === "READY";
}

/** Plain-language outcome for history: Did it succeed? */
export function jobOutcomeSummary(job: DataTransferJobRow): string {
  const status = (job.status || "").toUpperCase();
  if (status === "RUNNING" || status === "QUEUED" || status === "PROCESSING" || status === "VALIDATING") {
    return "Still running — not finished yet";
  }
  if (status === "FAILED") {
    return job.error ? `Failed — ${job.error}` : "Failed — nothing was applied";
  }
  if (status === "CANCELLED") return "Cancelled — stopped before completion";
  if (status === "READY") return "Succeeded — export is ready to download";
  if (job.warningCount > 0 || job.failedCount > 0) {
    return "Finished with issues — review warnings before relying on it";
  }
  if (job.dryRun) return "Succeeded as a dry run — nothing was written";
  if (status === "COMPLETED" || status === "SUCCEEDED" || status === "SUCCESS") {
    return job.direction === "EXPORT" ? "Succeeded — export completed" : "Succeeded — import completed";
  }
  return jobStatusLabel(job);
}

export function canDownloadJob(job: DataTransferJobRow) {
  return (
    isExportReady(job) ||
    (job.direction === "EXPORT" &&
      ["COMPLETED", "SUCCEEDED", "SUCCESS", "READY"].includes((job.status || "").toUpperCase()))
  );
}

export function canRetryJob(job: DataTransferJobRow) {
  const status = (job.status || "").toUpperCase();
  return status === "FAILED" || status === "CANCELLED";
}

export function jobWhenLabel(job: DataTransferJobRow) {
  const finished = job.finishedAt ? formatWhen(job.finishedAt) : null;
  const started = formatWhen(job.startedAt);
  if (finished && finished !== started) return `Finished ${finished}`;
  return `Started ${started}`;
}

export function templateStatusLabel(row: DataTransferTemplateRow) {
  if (row.status === "ACTIVE") return "Active";
  if (row.status === "DRAFT") return "Draft";
  if (row.status === "ARCHIVED") return "Archived";
  return row.status;
}

export function templateSurfaceStatusClass(row: DataTransferTemplateRow) {
  if (row.status === "ACTIVE") return "admin-menu-surface-status--live";
  if (row.status === "DRAFT") return "admin-menu-surface-status--scheduled";
  return "admin-menu-surface-status--retired";
}

export function templateListDescription(row: DataTransferTemplateRow) {
  return row.description?.trim() || `${row.targetLabel} · ${row.format.toUpperCase()}`;
}

export function templateMetaLabel(row: DataTransferTemplateRow) {
  const rows =
    row.rowEstimate === 1 ? "1 sample row" : `${row.rowEstimate.toLocaleString()} sample rows`;
  return [
    `v${row.version}`,
    row.format.toUpperCase(),
    rows,
    row.isSystem ? "ServeOS default" : "Custom",
    formatWhen(row.updatedAt)
  ].join(" · ");
}

export function isJobThisWeek(job: DataTransferJobRow) {
  const t = new Date(job.startedAt || job.createdAt).getTime();
  if (Number.isNaN(t)) return false;
  return Date.now() - t < 7 * 24 * 60 * 60 * 1000;
}

export function summarizeOps(jobs: DataTransferJobRow[]) {
  const activeImports = jobs.filter((j) => j.direction === "IMPORT" && isJobActive(j)).length;
  const readyExports = jobs.filter((j) => isExportReady(j) || (j.direction === "EXPORT" && j.status.toUpperCase() === "COMPLETED")).length;
  const weekCount = jobs.filter(isJobThisWeek).length;
  const lastBackup = jobs
    .filter((j) => j.direction === "EXPORT" && (j.targetKey === "menu" || j.targetKey.includes("backup")))
    .filter((j) => {
      const s = (j.status || "").toUpperCase();
      return s === "COMPLETED" || s === "SUCCEEDED" || s === "SUCCESS" || s === "READY";
    })
    .sort((a, b) => new Date(b.finishedAt || b.startedAt).getTime() - new Date(a.finishedAt || a.startedAt).getTime())[0];

  return {
    activeImports,
    readyExports,
    weekCount,
    lastBackupAt: lastBackup?.finishedAt ?? lastBackup?.startedAt ?? null,
    lastBackupJob: lastBackup ?? null
  };
}

export function previewCreateEstimate(preview: MenuCsvPreview | null) {
  if (!preview) return { categories: 0, items: 0, modifiers: 0 };
  const cats = new Set(preview.sample.map((r) => r.category).filter(Boolean));
  const items = new Set(preview.sample.map((r) => `${r.category}::${r.item}`).filter((k) => !k.endsWith("::")));
  const mods = preview.sample.filter((r) => r.modifierGroup || r.modifierOption).length;
  const scale = preview.validRows > 0 && preview.sample.length > 0 ? preview.validRows / preview.sample.length : 1;
  return {
    categories: Math.max(cats.size, Math.round(cats.size * scale) || cats.size),
    items: Math.max(items.size, Math.round((preview.validRows || items.size) * 0.55)),
    modifiers: Math.round(mods * scale)
  };
}

export function formatLimitBytes(bytes: number) {
  return formatBytes(bytes);
}

export type ImportWizardStep =
  | "type"
  | "source"
  | "upload"
  | "analyzing"
  | "analysis"
  | "mapping"
  | "validation"
  | "conflict"
  | "preview"
  | "confirm"
  | "running"
  | "done";

export type ExportWizardStep = "type" | "scope" | "format" | "options" | "destination" | "running" | "done";

export const IMPORT_STEP_ORDER: ImportWizardStep[] = [
  "type",
  "source",
  "upload",
  "analyzing",
  "analysis",
  "mapping",
  "validation",
  "conflict",
  "preview",
  "confirm",
  "running",
  "done"
];

export const EXPORT_STEP_ORDER: ExportWizardStep[] = [
  "type",
  "scope",
  "format",
  "options",
  "destination",
  "running",
  "done"
];

export function wizardProgress(step: string, order: string[]) {
  const idx = order.indexOf(step);
  if (idx < 0) return 0;
  const interactive = order.filter((s) => s !== "analyzing" && s !== "running" && s !== "done");
  const interactiveIdx = interactive.indexOf(step);
  if (interactiveIdx >= 0) return Math.round(((interactiveIdx + 1) / interactive.length) * 100);
  if (step === "analyzing" || step === "running") return Math.min(92, Math.round(((idx + 1) / order.length) * 100));
  return 100;
}

/** Venue-neutral copy for data-type cards (all venue types, not restaurant-only). */
const TARGET_BLURBS: Record<string, string> = {
  menu: "Categories, items, modifiers, prices, availability, and menu structure.",
  categories: "Category structure and sort order.",
  items: "Items, prices, and core product attributes.",
  "modifier-groups": "Modifier group definitions and rules.",
  "modifier-options": "Modifier options and price deltas.",
  availability: "Schedules and channel availability rules.",
  tables: "Floor plan labels and table identities.",
  customers: "Customer profiles and supported attributes.",
  staff: "Staff accounts and role assignments.",
  loyalty: "Loyalty members and balances.",
  "gift-cards": "Gift card inventory and balances.",
  inventory: "Products, stock levels, and inventory metadata.",
  media: "Media library asset manifests and references.",
  "qr-codes": "QR identities and venue assignments.",
  orders: "Historical orders for reporting and analysis.",
  other: "Custom or unsupported datasets."
};

export function targetBlurb(key: string, fallback: string) {
  return TARGET_BLURBS[key] ?? fallback;
}
