import type { MenuListItem } from "./menuService.js";
import { sanitizeAvailabilityWindows } from "./menuAvailability.js";

export type MenuListQueryInput = {
  q?: string;
  sort?: string;
  filters?: string[];
};

function windowCount(menu: MenuListItem) {
  const windows = sanitizeAvailabilityWindows(menu.availabilityWindows) ?? {};
  return Object.keys(windows).length;
}

function matchesFilter(menu: MenuListItem, id: string) {
  const windows = windowCount(menu);
  switch (id) {
    case "status:draft":
      return menu.status === "DRAFT";
    case "status:published":
      return menu.status === "PUBLISHED";
    case "status:retired":
      return menu.status === "RETIRED";
    case "status:archived":
      return menu.status === "ARCHIVED";
    case "content:has_categories":
      return menu.categoryCount > 0;
    case "content:no_categories":
      return menu.categoryCount === 0;
    case "content:has_items":
      return menu.itemCount > 0;
    case "content:no_items":
      return menu.itemCount === 0;
    case "release:draft_changes":
      return Boolean(menu.hasUnpublishedChanges);
    case "release:in_sync":
      return !menu.hasUnpublishedChanges;
    case "release:scheduled":
      return Boolean(menu.scheduledPublishAt) || menu.releaseState === "scheduled";
    case "media:has_cover":
      return Boolean(menu.coverMediaKey);
    case "media:missing_cover":
      return !menu.coverMediaKey;
    case "schedule:has_windows":
      return windows > 0;
    case "schedule:no_windows":
      return windows === 0;
    default:
      return false;
  }
}

const FILTER_GROUPS: string[][] = [
  ["status:draft", "status:published", "status:retired", "status:archived"],
  ["content:has_categories", "content:no_categories", "content:has_items", "content:no_items"],
  ["release:draft_changes", "release:in_sync", "release:scheduled"],
  ["media:has_cover", "media:missing_cover", "schedule:has_windows", "schedule:no_windows"]
];

function matchesFilters(menu: MenuListItem, filters: string[]) {
  if (!filters.length) return true;
  for (const group of FILTER_GROUPS) {
    const selected = group.filter((id) => filters.includes(id));
    if (!selected.length) continue;
    if (!selected.some((id) => matchesFilter(menu, id))) return false;
  }
  return true;
}

function matchesSearch(menu: MenuListItem, q: string) {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  const hay = [
    menu.name,
    menu.description ?? "",
    menu.surfaceKey ?? "",
    menu.status,
    menu.releaseLabel,
    menu.scopeLabel,
    String(menu.categoryCount),
    String(menu.itemCount)
  ]
    .join(" ")
    .toLowerCase();
  return hay.includes(needle);
}

function cmpStr(a: string, b: string) {
  return a.localeCompare(b, undefined, { sensitivity: "base" });
}

function sortMenus(rows: MenuListItem[], sortId: string) {
  const next = [...rows];
  switch (sortId) {
    case "name_asc":
      return next.sort((a, b) => cmpStr(a.name, b.name));
    case "name_desc":
      return next.sort((a, b) => cmpStr(b.name, a.name));
    case "updated_desc":
      return next.sort((a, b) => cmpStr(b.updatedAt, a.updatedAt));
    case "updated_asc":
      return next.sort((a, b) => cmpStr(a.updatedAt, b.updatedAt));
    case "items_desc":
      return next.sort((a, b) => b.itemCount - a.itemCount);
    case "items_asc":
      return next.sort((a, b) => a.itemCount - b.itemCount);
    case "categories_desc":
      return next.sort((a, b) => b.categoryCount - a.categoryCount);
    case "version_desc":
      return next.sort((a, b) => (b.activeVersionNumber ?? 0) - (a.activeVersionNumber ?? 0));
    case "status_asc":
      return next.sort((a, b) => cmpStr(a.status, b.status) || cmpStr(a.name, b.name));
    case "sort_order_asc":
    default:
      return next.sort((a, b) => a.sortOrder - b.sortOrder || cmpStr(a.name, b.name));
  }
}

/** Apply admin list search / filter / sort on serialized menu rows (SSOT). */
export function applyMenuListQuery(menus: MenuListItem[], query: MenuListQueryInput = {}) {
  const filters = (query.filters ?? []).map((f) => f.trim()).filter(Boolean);
  let rows = menus.filter((m) => matchesSearch(m, query.q ?? "") && matchesFilters(m, filters));
  return sortMenus(rows, query.sort?.trim() || "sort_order_asc");
}
