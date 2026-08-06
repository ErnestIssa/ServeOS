import type { DataTransferJobRow } from "../../../api";

export function isUiOnlyTransferId(id: string) {
  return id.startsWith("ui-mock-transfer-");
}

function hoursAgo(hours: number) {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}

function mockJob(
  partial: Partial<DataTransferJobRow> & {
    id: string;
    direction: "IMPORT" | "EXPORT";
    targetKey: string;
    status: string;
  }
): DataTransferJobRow {
  const startedAt = partial.startedAt ?? hoursAgo(1);
  return {
    id: partial.id,
    restaurantId: "ui-mock-venue",
    direction: partial.direction,
    status: partial.status,
    targetKey: partial.targetKey,
    sourceFormat: partial.sourceFormat ?? (partial.direction === "IMPORT" ? "csv" : "csv"),
    fileName: partial.fileName ?? null,
    fileHash: partial.fileHash ?? null,
    fileSizeBytes: partial.fileSizeBytes ?? null,
    rowCount: partial.rowCount ?? 0,
    importedCount: partial.importedCount ?? 0,
    updatedCount: partial.updatedCount ?? 0,
    skippedCount: partial.skippedCount ?? 0,
    failedCount: partial.failedCount ?? 0,
    warningCount: partial.warningCount ?? 0,
    dryRun: partial.dryRun ?? false,
    summary: partial.summary ?? null,
    error: partial.error ?? null,
    startedByUserId: partial.startedByUserId ?? "ui-mock-alex",
    startedAt,
    finishedAt: partial.finishedAt ?? (partial.status === "RUNNING" ? null : startedAt),
    undoExpiresAt: partial.undoExpiresAt ?? null,
    undoAvailable: partial.undoAvailable ?? false,
    createdAt: startedAt,
    updatedAt: partial.finishedAt ?? startedAt
  };
}

/** Local preview rows for Recent operations — not persisted / not sent to the API. */
export const UI_MOCK_TRANSFER_JOBS: DataTransferJobRow[] = [
  mockJob({
    id: "ui-mock-transfer-01",
    direction: "IMPORT",
    targetKey: "menu",
    status: "COMPLETED",
    fileName: "dinner-menu.xlsx",
    fileSizeBytes: 2_450_000,
    rowCount: 1284,
    importedCount: 1261,
    warningCount: 19,
    failedCount: 4,
    skippedCount: 4,
    startedAt: hoursAgo(2),
    undoAvailable: true
  }),
  mockJob({
    id: "ui-mock-transfer-02",
    direction: "EXPORT",
    targetKey: "orders",
    status: "READY",
    fileName: "orders-export.csv",
    rowCount: 18420,
    startedAt: hoursAgo(8),
    startedByUserId: "ui-mock-sam"
  }),
  mockJob({
    id: "ui-mock-transfer-03",
    direction: "IMPORT",
    targetKey: "menu",
    status: "COMPLETED",
    fileName: "lunch-specials.csv",
    rowCount: 96,
    importedCount: 88,
    warningCount: 8,
    startedAt: hoursAgo(14),
    undoAvailable: true
  }),
  mockJob({
    id: "ui-mock-transfer-04",
    direction: "EXPORT",
    targetKey: "menu",
    status: "COMPLETED",
    fileName: "menu-backup.csv",
    rowCount: 842,
    startedAt: hoursAgo(26)
  }),
  mockJob({
    id: "ui-mock-transfer-05",
    direction: "IMPORT",
    targetKey: "customers",
    status: "FAILED",
    fileName: "crm-export.csv",
    rowCount: 3200,
    failedCount: 3200,
    error: "Target not available yet",
    startedAt: hoursAgo(30),
    startedByUserId: "ui-mock-jordan"
  }),
  mockJob({
    id: "ui-mock-transfer-06",
    direction: "IMPORT",
    targetKey: "menu",
    status: "RUNNING",
    fileName: "weekend-menu.csv",
    rowCount: 540,
    importedCount: 210,
    startedAt: hoursAgo(0.4),
    finishedAt: null
  }),
  mockJob({
    id: "ui-mock-transfer-07",
    direction: "EXPORT",
    targetKey: "staff",
    status: "COMPLETED",
    fileName: "staff-roster.csv",
    rowCount: 28,
    startedAt: hoursAgo(40)
  }),
  mockJob({
    id: "ui-mock-transfer-08",
    direction: "IMPORT",
    targetKey: "inventory",
    status: "COMPLETED",
    dryRun: true,
    fileName: "stock-check.csv",
    rowCount: 410,
    importedCount: 0,
    warningCount: 12,
    startedAt: hoursAgo(48)
  }),
  mockJob({
    id: "ui-mock-transfer-09",
    direction: "EXPORT",
    targetKey: "media",
    status: "READY",
    fileName: "media-manifest.json",
    sourceFormat: "json",
    rowCount: 156,
    startedAt: hoursAgo(52)
  }),
  mockJob({
    id: "ui-mock-transfer-10",
    direction: "IMPORT",
    targetKey: "tables",
    status: "COMPLETED",
    fileName: "floor-plan.csv",
    rowCount: 42,
    importedCount: 42,
    startedAt: hoursAgo(60),
    undoAvailable: true
  }),
  mockJob({
    id: "ui-mock-transfer-11",
    direction: "EXPORT",
    targetKey: "customers",
    status: "COMPLETED",
    fileName: "guests-q2.csv",
    rowCount: 9021,
    startedAt: hoursAgo(72),
    startedByUserId: "ui-mock-sam"
  }),
  mockJob({
    id: "ui-mock-transfer-12",
    direction: "IMPORT",
    targetKey: "loyalty",
    status: "FAILED",
    fileName: "loyalty-members.csv",
    rowCount: 640,
    failedCount: 12,
    warningCount: 4,
    error: "Invalid balance rows",
    startedAt: hoursAgo(80)
  }),
  mockJob({
    id: "ui-mock-transfer-13",
    direction: "EXPORT",
    targetKey: "qr-codes",
    status: "COMPLETED",
    fileName: "qr-identities.csv",
    rowCount: 64,
    startedAt: hoursAgo(90)
  }),
  mockJob({
    id: "ui-mock-transfer-14",
    direction: "IMPORT",
    targetKey: "menu",
    status: "COMPLETED",
    fileName: "modifiers-only.csv",
    rowCount: 220,
    importedCount: 198,
    skippedCount: 22,
    startedAt: hoursAgo(100)
  }),
  mockJob({
    id: "ui-mock-transfer-15",
    direction: "EXPORT",
    targetKey: "orders",
    status: "COMPLETED",
    fileName: "orders-june.csv",
    rowCount: 12400,
    startedAt: hoursAgo(120)
  }),
  mockJob({
    id: "ui-mock-transfer-16",
    direction: "IMPORT",
    targetKey: "staff",
    status: "COMPLETED",
    fileName: "new-hires.csv",
    rowCount: 6,
    importedCount: 6,
    startedAt: hoursAgo(130),
    undoAvailable: true
  }),
  mockJob({
    id: "ui-mock-transfer-17",
    direction: "EXPORT",
    targetKey: "menu",
    status: "READY",
    fileName: "full-menu-backup.csv",
    rowCount: 1102,
    startedAt: hoursAgo(140)
  }),
  mockJob({
    id: "ui-mock-transfer-18",
    direction: "IMPORT",
    targetKey: "availability",
    status: "COMPLETED",
    fileName: "schedules.csv",
    rowCount: 18,
    importedCount: 18,
    warningCount: 2,
    startedAt: hoursAgo(150)
  }),
  mockJob({
    id: "ui-mock-transfer-19",
    direction: "EXPORT",
    targetKey: "inventory",
    status: "FAILED",
    fileName: null,
    rowCount: 0,
    error: "Export timed out",
    startedAt: hoursAgo(160)
  }),
  mockJob({
    id: "ui-mock-transfer-20",
    direction: "IMPORT",
    targetKey: "menu",
    status: "COMPLETED",
    dryRun: true,
    fileName: "validate-spring.csv",
    rowCount: 310,
    warningCount: 5,
    startedAt: hoursAgo(170),
    startedByUserId: "ui-mock-jordan"
  }),
  mockJob({
    id: "ui-mock-transfer-21",
    direction: "EXPORT",
    targetKey: "orders",
    status: "COMPLETED",
    fileName: "orders-may.csv",
    rowCount: 15220,
    startedAt: hoursAgo(180),
    startedByUserId: "ui-mock-sam"
  }),
  mockJob({
    id: "ui-mock-transfer-22",
    direction: "IMPORT",
    targetKey: "menu",
    status: "COMPLETED",
    fileName: "brunch-items.csv",
    rowCount: 64,
    importedCount: 61,
    warningCount: 3,
    startedAt: hoursAgo(190),
    undoAvailable: true
  }),
  mockJob({
    id: "ui-mock-transfer-23",
    direction: "EXPORT",
    targetKey: "customers",
    status: "READY",
    fileName: "customers-active.csv",
    rowCount: 4480,
    startedAt: hoursAgo(200)
  }),
  mockJob({
    id: "ui-mock-transfer-24",
    direction: "IMPORT",
    targetKey: "gift-cards",
    status: "FAILED",
    fileName: "gift-cards.csv",
    rowCount: 120,
    failedCount: 120,
    error: "Gift cards import is not available yet",
    startedAt: hoursAgo(210)
  }),
  mockJob({
    id: "ui-mock-transfer-25",
    direction: "EXPORT",
    targetKey: "menu",
    status: "COMPLETED",
    fileName: "menu-snapshot-v3.csv",
    rowCount: 980,
    startedAt: hoursAgo(220)
  }),
  mockJob({
    id: "ui-mock-transfer-26",
    direction: "IMPORT",
    targetKey: "staff",
    status: "RUNNING",
    fileName: "seasonal-staff.csv",
    rowCount: 14,
    importedCount: 4,
    startedAt: hoursAgo(0.8),
    finishedAt: null,
    startedByUserId: "ui-mock-alex"
  }),
  mockJob({
    id: "ui-mock-transfer-27",
    direction: "EXPORT",
    targetKey: "qr-codes",
    status: "COMPLETED",
    fileName: "qr-patio.csv",
    rowCount: 22,
    startedAt: hoursAgo(240)
  }),
  mockJob({
    id: "ui-mock-transfer-28",
    direction: "IMPORT",
    targetKey: "inventory",
    status: "COMPLETED",
    fileName: "bar-stock.csv",
    rowCount: 188,
    importedCount: 180,
    skippedCount: 8,
    startedAt: hoursAgo(250),
    undoAvailable: true
  }),
  mockJob({
    id: "ui-mock-transfer-29",
    direction: "EXPORT",
    targetKey: "media",
    status: "FAILED",
    fileName: "media-pack.json",
    sourceFormat: "json",
    rowCount: 0,
    error: "Manifest generation failed",
    startedAt: hoursAgo(260),
    startedByUserId: "ui-mock-jordan"
  }),
  mockJob({
    id: "ui-mock-transfer-30",
    direction: "IMPORT",
    targetKey: "menu",
    status: "COMPLETED",
    dryRun: true,
    fileName: "wine-list-check.csv",
    rowCount: 76,
    warningCount: 1,
    startedAt: hoursAgo(270)
  }),
  mockJob({
    id: "ui-mock-transfer-31",
    direction: "EXPORT",
    targetKey: "orders",
    status: "READY",
    fileName: "orders-last-30d.csv",
    rowCount: 22110,
    startedAt: hoursAgo(280)
  }),
  mockJob({
    id: "ui-mock-transfer-32",
    direction: "IMPORT",
    targetKey: "tables",
    status: "COMPLETED",
    fileName: "terrace-tables.csv",
    rowCount: 16,
    importedCount: 16,
    startedAt: hoursAgo(290)
  }),
  mockJob({
    id: "ui-mock-transfer-33",
    direction: "EXPORT",
    targetKey: "staff",
    status: "COMPLETED",
    fileName: "roles-export.csv",
    rowCount: 31,
    startedAt: hoursAgo(300),
    startedByUserId: "ui-mock-sam"
  }),
  mockJob({
    id: "ui-mock-transfer-34",
    direction: "IMPORT",
    targetKey: "loyalty",
    status: "COMPLETED",
    fileName: "loyalty-topup.csv",
    rowCount: 540,
    importedCount: 520,
    warningCount: 20,
    startedAt: hoursAgo(310)
  }),
  mockJob({
    id: "ui-mock-transfer-35",
    direction: "EXPORT",
    targetKey: "inventory",
    status: "COMPLETED",
    fileName: "inventory-week.csv",
    rowCount: 260,
    startedAt: hoursAgo(320)
  }),
  mockJob({
    id: "ui-mock-transfer-36",
    direction: "IMPORT",
    targetKey: "menu",
    status: "FAILED",
    fileName: "broken-headers.csv",
    rowCount: 40,
    failedCount: 40,
    error: "Invalid CSV header",
    startedAt: hoursAgo(330)
  }),
  mockJob({
    id: "ui-mock-transfer-37",
    direction: "EXPORT",
    targetKey: "customers",
    status: "COMPLETED",
    fileName: "newsletter-optins.csv",
    rowCount: 1820,
    startedAt: hoursAgo(340)
  }),
  mockJob({
    id: "ui-mock-transfer-38",
    direction: "IMPORT",
    targetKey: "availability",
    status: "COMPLETED",
    fileName: "holiday-hours.csv",
    rowCount: 9,
    importedCount: 9,
    startedAt: hoursAgo(350),
    undoAvailable: true
  }),
  mockJob({
    id: "ui-mock-transfer-39",
    direction: "EXPORT",
    targetKey: "menu",
    status: "READY",
    fileName: "draft-menu-export.csv",
    rowCount: 455,
    startedAt: hoursAgo(360)
  }),
  mockJob({
    id: "ui-mock-transfer-40",
    direction: "IMPORT",
    targetKey: "menu",
    status: "COMPLETED",
    fileName: "desserts-refresh.csv",
    rowCount: 38,
    importedCount: 36,
    skippedCount: 2,
    warningCount: 2,
    startedAt: hoursAgo(370),
    startedByUserId: "ui-mock-alex"
  })
];
