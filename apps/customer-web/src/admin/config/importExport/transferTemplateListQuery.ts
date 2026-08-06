import type { DataTransferTemplateRow } from "../../../api";
import type { MenuListQueryPreset } from "../menu/menuListQuery";

export const TRANSFER_TEMPLATE_LIST_QUERY: MenuListQueryPreset = {
  defaultSort: "updated_desc",
  filterGroups: [
    {
      id: "status",
      label: "Status",
      options: [
        { id: "status:active", label: "Active", description: "Ready to download and use" },
        { id: "status:draft", label: "Draft", description: "Still being prepared" },
        { id: "status:archived", label: "Archived", description: "Hidden from default list" }
      ]
    },
    {
      id: "data",
      label: "Data type",
      options: [
        { id: "data:menu", label: "Menu" },
        { id: "data:customers", label: "Customers" },
        { id: "data:staff", label: "Staff" },
        { id: "data:inventory", label: "Inventory" },
        { id: "data:other", label: "Other" }
      ]
    },
    {
      id: "origin",
      label: "Origin",
      options: [
        { id: "origin:system", label: "ServeOS defaults", description: "Seeded platform templates" },
        { id: "origin:custom", label: "Custom", description: "Created or duplicated here" }
      ]
    }
  ],
  sortOptions: [
    { id: "updated_desc", label: "Recently updated", description: "Newest edits first" },
    { id: "updated_asc", label: "Oldest updated" },
    { id: "name_asc", label: "Name A–Z" },
    { id: "name_desc", label: "Name Z–A" },
    { id: "version_desc", label: "Highest version" },
    { id: "rows_desc", label: "Most sample rows" }
  ]
};

function groupSelected(active: string[], groupId: string) {
  const group = TRANSFER_TEMPLATE_LIST_QUERY.filterGroups.find((g) => g.id === groupId);
  if (!group) return [];
  return group.options.map((o) => o.id).filter((id) => active.includes(id));
}

function dataBucket(targetKey: string) {
  if (["menu", "categories", "items", "modifier-groups", "modifier-options", "availability"].includes(targetKey)) {
    return "data:menu";
  }
  if (targetKey === "customers") return "data:customers";
  if (targetKey === "staff") return "data:staff";
  if (targetKey === "inventory") return "data:inventory";
  return "data:other";
}

function filterMatch(row: DataTransferTemplateRow, id: string) {
  switch (id) {
    case "status:active":
      return row.status === "ACTIVE";
    case "status:draft":
      return row.status === "DRAFT";
    case "status:archived":
      return row.status === "ARCHIVED";
    case "data:menu":
    case "data:customers":
    case "data:staff":
    case "data:inventory":
    case "data:other":
      return dataBucket(row.targetKey) === id;
    case "origin:system":
      return row.isSystem;
    case "origin:custom":
      return !row.isSystem;
    default:
      return false;
  }
}

export function applyTransferTemplateFilters(rows: DataTransferTemplateRow[], filters: string[]) {
  if (filters.length === 0) return rows;
  return rows.filter((row) => {
    for (const group of TRANSFER_TEMPLATE_LIST_QUERY.filterGroups) {
      const selected = groupSelected(filters, group.id);
      if (selected.length === 0) continue;
      if (!selected.some((id) => filterMatch(row, id))) return false;
    }
    return true;
  });
}

export function applyTransferTemplateSort(rows: DataTransferTemplateRow[], sortId: string) {
  const next = [...rows];
  switch (sortId) {
    case "updated_asc":
      return next.sort((a, b) => new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime());
    case "name_asc":
      return next.sort((a, b) => a.name.localeCompare(b.name));
    case "name_desc":
      return next.sort((a, b) => b.name.localeCompare(a.name));
    case "version_desc":
      return next.sort((a, b) => b.version - a.version);
    case "rows_desc":
      return next.sort((a, b) => b.rowEstimate - a.rowEstimate);
    case "updated_desc":
    default:
      return next.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }
}
