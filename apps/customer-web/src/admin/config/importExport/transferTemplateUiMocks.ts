import type { DataTransferTemplateRow } from "../../../api";
import { MENU_CSV_TEMPLATE } from "./transferUiHelpers";

export function isUiOnlyTemplateId(id: string) {
  return id.startsWith("ui-mock-template-");
}

function hoursAgo(hours: number) {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}

function mockTemplate(
  partial: Partial<DataTransferTemplateRow> & {
    id: string;
    name: string;
    targetKey: string;
    status: DataTransferTemplateRow["status"];
  }
): DataTransferTemplateRow {
  const updatedAt = partial.updatedAt ?? hoursAgo(1);
  const content = partial.content ?? MENU_CSV_TEMPLATE;
  const lineCount = content.split(/\r?\n/).filter((l) => l.trim()).length;
  return {
    id: partial.id,
    restaurantId: "ui-mock-venue",
    name: partial.name,
    description: partial.description ?? null,
    targetKey: partial.targetKey,
    targetLabel: partial.targetLabel ?? partial.targetKey,
    format: partial.format ?? "csv",
    version: partial.version ?? 1,
    status: partial.status,
    content,
    systemKey: partial.systemKey ?? null,
    isSystem: partial.isSystem ?? false,
    rowEstimate: partial.rowEstimate ?? Math.max(0, lineCount - 1),
    createdByUserId: partial.createdByUserId ?? "ui-mock-alex",
    updatedByUserId: partial.updatedByUserId ?? "ui-mock-alex",
    createdAt: partial.createdAt ?? updatedAt,
    updatedAt
  };
}

/** Local preview rows for Templates — not persisted / not sent to the API. */
export const UI_MOCK_TRANSFER_TEMPLATES: DataTransferTemplateRow[] = [
  mockTemplate({
    id: "ui-mock-template-01",
    name: "Brunch menu starter pack",
    description: "Weekend brunch categories with sample modifiers.",
    targetKey: "menu",
    targetLabel: "Menu",
    status: "ACTIVE",
    version: 2,
    updatedAt: hoursAgo(5)
  }),
  mockTemplate({
    id: "ui-mock-template-02",
    name: "Seasonal specials sheet",
    description: "Draft columns for limited-time items.",
    targetKey: "menu",
    targetLabel: "Menu",
    status: "DRAFT",
    version: 1,
    updatedAt: hoursAgo(18),
    createdByUserId: "ui-mock-sam"
  }),
  mockTemplate({
    id: "ui-mock-template-03",
    name: "Loyalty guests CSV",
    description: "Custom customer fields for a loyalty import.",
    targetKey: "customers",
    targetLabel: "Customers",
    status: "ACTIVE",
    content: "external_id,full_name,email,phone,notes\n",
    rowEstimate: 0,
    version: 3,
    updatedAt: hoursAgo(40),
    createdByUserId: "ui-mock-jordan"
  }),
  mockTemplate({
    id: "ui-mock-template-04",
    name: "Opening inventory checklist",
    description: "Stock take columns for opening week.",
    targetKey: "inventory",
    targetLabel: "Inventory",
    status: "DRAFT",
    content: "sku,name,quantity,unit,notes\n",
    rowEstimate: 0,
    updatedAt: hoursAgo(72)
  }),
  mockTemplate({
    id: "ui-mock-template-05",
    name: "Legacy staff roster",
    description: "Archived after migration — kept for reference.",
    targetKey: "staff",
    targetLabel: "Staff",
    status: "ARCHIVED",
    content: "external_id,full_name,email,role,active\n",
    rowEstimate: 0,
    version: 4,
    updatedAt: hoursAgo(120)
  })
];
