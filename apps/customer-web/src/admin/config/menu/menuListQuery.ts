import type { AvailabilityCardPayload, MenuSurfaceRow } from "../../../api";
import { filterUserCreatedWindows } from "./availabilityHelpers";
import type { CategoryListRow } from "./categoryListHelpers";
import type { ItemListRow } from "./itemListHelpers";
import type { ModifierGroupListRow } from "./modifierGroupListHelpers";
import type { ModifierOptionListRow } from "./modifierOptionListHelpers";

export type MenuListToolOption = {
  id: string;
  label: string;
  description?: string;
};

export type MenuListFilterGroup = {
  id: string;
  label: string;
  hint?: string;
  options: MenuListToolOption[];
};

export type MenuListQueryPreset = {
  filterGroups: MenuListFilterGroup[];
  sortOptions: MenuListToolOption[];
  defaultSort: string;
};

export function toggleMenuListFilter(active: string[], id: string): string[] {
  if (id === "__clear__") return [];
  return active.includes(id) ? active.filter((x) => x !== id) : [...active, id];
}

function groupSelected(active: string[], group: MenuListFilterGroup) {
  return group.options.map((o) => o.id).filter((id) => active.includes(id));
}

function matchesGroupedFilters(
  active: string[],
  groups: MenuListFilterGroup[],
  matchOption: (id: string) => boolean
) {
  if (active.length === 0) return true;
  for (const group of groups) {
    const selected = groupSelected(active, group);
    if (selected.length === 0) continue;
    if (!selected.some((id) => matchOption(id))) return false;
  }
  // Ignore unknown filter ids left over from other tabs.
  return true;
}

function cmpStr(a: string, b: string) {
  return a.localeCompare(b, undefined, { sensitivity: "base" });
}

function cmpNum(a: number, b: number) {
  return a - b;
}

/* ── Menus ─────────────────────────────────────────────── */

export const MENU_LIST_QUERY: MenuListQueryPreset = {
  defaultSort: "sort_order_asc",
  filterGroups: [
    {
      id: "status",
      label: "Status",
      hint: "Match any selected publish state.",
      options: [
        { id: "status:draft", label: "Draft", description: "Still in the draft workspace" },
        { id: "status:published", label: "Published", description: "Live for guests" },
        { id: "status:retired", label: "Retired", description: "Retired from guest ordering" },
        { id: "status:archived", label: "Archived", description: "Stored / archived menus" }
      ]
    },
    {
      id: "content",
      label: "Content",
      options: [
        { id: "content:has_categories", label: "Has categories", description: "At least one category" },
        { id: "content:no_categories", label: "No categories", description: "Empty category list" },
        { id: "content:has_items", label: "Has items", description: "At least one item" },
        { id: "content:no_items", label: "No items", description: "Zero items on this menu" }
      ]
    },
    {
      id: "release",
      label: "Publishing",
      options: [
        { id: "release:draft_changes", label: "Draft changes waiting", description: "Unpublished edits exist" },
        { id: "release:in_sync", label: "In sync with live", description: "No pending draft changes" },
        { id: "release:scheduled", label: "Scheduled release", description: "Has a scheduled publish time" }
      ]
    },
    {
      id: "media_schedule",
      label: "Media & schedule",
      options: [
        { id: "media:has_cover", label: "Has cover image", description: "Cover media is set" },
        { id: "media:missing_cover", label: "Missing cover", description: "No cover image yet" },
        { id: "schedule:has_windows", label: "Has availability", description: "At least one schedule window" },
        { id: "schedule:no_windows", label: "No availability", description: "No schedule windows" }
      ]
    }
  ],
  sortOptions: [
    { id: "sort_order_asc", label: "Default order", description: "Menu sort order from the backend" },
    { id: "name_asc", label: "Name A–Z" },
    { id: "name_desc", label: "Name Z–A" },
    { id: "updated_desc", label: "Recently updated" },
    { id: "updated_asc", label: "Oldest updated" },
    { id: "items_desc", label: "Most items" },
    { id: "items_asc", label: "Fewest items" },
    { id: "categories_desc", label: "Most categories" },
    { id: "version_desc", label: "Highest version" },
    { id: "status_asc", label: "Status" }
  ]
};

function menuFilterMatch(menu: MenuSurfaceRow, id: string) {
  const windows = Object.keys(filterUserCreatedWindows(menu.availabilityWindows)).length;
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

export function applyMenuListFilters(rows: MenuSurfaceRow[], filters: string[]) {
  return rows.filter((row) =>
    matchesGroupedFilters(filters, MENU_LIST_QUERY.filterGroups, (id) => menuFilterMatch(row, id))
  );
}

export function applyMenuListSort(rows: MenuSurfaceRow[], sortId: string) {
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
      return next.sort((a, b) => cmpNum(b.itemCount, a.itemCount));
    case "items_asc":
      return next.sort((a, b) => cmpNum(a.itemCount, b.itemCount));
    case "categories_desc":
      return next.sort((a, b) => cmpNum(b.categoryCount, a.categoryCount));
    case "version_desc":
      return next.sort((a, b) => cmpNum(b.activeVersionNumber ?? 0, a.activeVersionNumber ?? 0));
    case "status_asc":
      return next.sort((a, b) => cmpStr(a.status, b.status) || cmpStr(a.name, b.name));
    case "sort_order_asc":
    default:
      return next.sort((a, b) => cmpNum(a.sortOrder, b.sortOrder) || cmpStr(a.name, b.name));
  }
}

/* ── Categories ────────────────────────────────────────── */

export const CATEGORY_LIST_QUERY: MenuListQueryPreset = {
  defaultSort: "sort_order_asc",
  filterGroups: [
    {
      id: "visibility",
      label: "Visibility",
      options: [
        { id: "visibility:visible", label: "Visible", description: "Shown when the menu is live" },
        { id: "visibility:hidden", label: "Hidden", description: "Hidden from guests" }
      ]
    },
    {
      id: "menu_status",
      label: "Parent menu",
      options: [
        { id: "menu:published", label: "On live menu", description: "Parent menu is published" },
        { id: "menu:draft", label: "In draft menu", description: "Parent menu is draft" },
        { id: "menu:retired", label: "Menu retired" },
        { id: "menu:archived", label: "Menu archived" }
      ]
    },
    {
      id: "content",
      label: "Content",
      options: [
        { id: "content:has_items", label: "Has items" },
        { id: "content:empty", label: "Empty category" },
        { id: "content:has_description", label: "Has description" },
        { id: "content:no_description", label: "Missing description" }
      ]
    }
  ],
  sortOptions: [
    { id: "sort_order_asc", label: "Sort order", description: "Category sort from the backend" },
    { id: "name_asc", label: "Name A–Z" },
    { id: "name_desc", label: "Name Z–A" },
    { id: "items_desc", label: "Most items" },
    { id: "items_asc", label: "Fewest items" },
    { id: "menu_name_asc", label: "Menu name" }
  ]
};

function categoryFilterMatch(row: CategoryListRow, id: string) {
  switch (id) {
    case "visibility:visible":
      return row.isActive;
    case "visibility:hidden":
      return !row.isActive;
    case "menu:published":
      return row.menuStatus === "PUBLISHED";
    case "menu:draft":
      return row.menuStatus === "DRAFT";
    case "menu:retired":
      return row.menuStatus === "RETIRED";
    case "menu:archived":
      return row.menuStatus === "ARCHIVED";
    case "content:has_items":
      return row.itemCount > 0;
    case "content:empty":
      return row.itemCount === 0;
    case "content:has_description":
      return Boolean(row.description?.trim());
    case "content:no_description":
      return !row.description?.trim();
    default:
      return false;
  }
}

export function applyCategoryListFilters(rows: CategoryListRow[], filters: string[]) {
  return rows.filter((row) =>
    matchesGroupedFilters(filters, CATEGORY_LIST_QUERY.filterGroups, (id) => categoryFilterMatch(row, id))
  );
}

export function applyCategoryListSort(rows: CategoryListRow[], sortId: string) {
  const next = [...rows];
  switch (sortId) {
    case "name_asc":
      return next.sort((a, b) => cmpStr(a.name, b.name));
    case "name_desc":
      return next.sort((a, b) => cmpStr(b.name, a.name));
    case "items_desc":
      return next.sort((a, b) => cmpNum(b.itemCount, a.itemCount));
    case "items_asc":
      return next.sort((a, b) => cmpNum(a.itemCount, b.itemCount));
    case "menu_name_asc":
      return next.sort((a, b) => cmpStr(a.menuName, b.menuName) || cmpStr(a.name, b.name));
    case "sort_order_asc":
    default:
      return next.sort((a, b) => cmpNum(a.sortOrder, b.sortOrder) || cmpStr(a.name, b.name));
  }
}

/* ── Items ─────────────────────────────────────────────── */

export const ITEM_LIST_QUERY: MenuListQueryPreset = {
  defaultSort: "sort_order_asc",
  filterGroups: [
    {
      id: "status",
      label: "Status",
      options: [
        { id: "status:available", label: "Available", description: "Active and shown to guests" },
        { id: "status:hidden", label: "Hidden" },
        { id: "status:sold_out", label: "Unavailable / sold out" },
        { id: "status:draft", label: "Draft lifecycle" },
        { id: "status:archived", label: "Archived" }
      ]
    },
    {
      id: "menu",
      label: "Parent menu",
      options: [
        { id: "menu:published", label: "On live menu" },
        { id: "menu:draft", label: "In draft menu" },
        { id: "menu:retired", label: "Menu retired" },
        { id: "menu:archived", label: "Menu archived" }
      ]
    },
    {
      id: "content",
      label: "Content & price",
      options: [
        { id: "content:has_modifiers", label: "Has modifiers" },
        { id: "content:no_modifiers", label: "No modifiers" },
        { id: "content:has_description", label: "Has description" },
        { id: "content:no_description", label: "Missing description" },
        { id: "price:free", label: "Free (0)", description: "Base price is zero" },
        { id: "price:paid", label: "Priced", description: "Base price greater than zero" }
      ]
    }
  ],
  sortOptions: [
    { id: "sort_order_asc", label: "Sort order" },
    { id: "name_asc", label: "Name A–Z" },
    { id: "name_desc", label: "Name Z–A" },
    { id: "price_asc", label: "Price: low to high" },
    { id: "price_desc", label: "Price: high to low" },
    { id: "modifiers_desc", label: "Most modifiers" },
    { id: "category_asc", label: "Category name" },
    { id: "menu_asc", label: "Menu name" }
  ]
};

function itemFilterMatch(row: ItemListRow, id: string) {
  switch (id) {
    case "status:available":
      return row.lifecycle === "ACTIVE" && row.isActive && !row.isSoldOut;
    case "status:hidden":
      return !row.isActive && row.lifecycle !== "ARCHIVED";
    case "status:sold_out":
      return row.isSoldOut;
    case "status:draft":
      return row.lifecycle === "DRAFT";
    case "status:archived":
      return row.lifecycle === "ARCHIVED";
    case "menu:published":
      return row.menuStatus === "PUBLISHED";
    case "menu:draft":
      return row.menuStatus === "DRAFT";
    case "menu:retired":
      return row.menuStatus === "RETIRED";
    case "menu:archived":
      return row.menuStatus === "ARCHIVED";
    case "content:has_modifiers":
      return row.modifierCount > 0;
    case "content:no_modifiers":
      return row.modifierCount === 0;
    case "content:has_description":
      return Boolean(row.description?.trim());
    case "content:no_description":
      return !row.description?.trim();
    case "price:free":
      return row.priceCents === 0;
    case "price:paid":
      return row.priceCents > 0;
    default:
      return false;
  }
}

export function applyItemListFilters(rows: ItemListRow[], filters: string[]) {
  return rows.filter((row) =>
    matchesGroupedFilters(filters, ITEM_LIST_QUERY.filterGroups, (id) => itemFilterMatch(row, id))
  );
}

export function applyItemListSort(rows: ItemListRow[], sortId: string) {
  const next = [...rows];
  switch (sortId) {
    case "name_asc":
      return next.sort((a, b) => cmpStr(a.name, b.name));
    case "name_desc":
      return next.sort((a, b) => cmpStr(b.name, a.name));
    case "price_asc":
      return next.sort((a, b) => cmpNum(a.priceCents, b.priceCents));
    case "price_desc":
      return next.sort((a, b) => cmpNum(b.priceCents, a.priceCents));
    case "modifiers_desc":
      return next.sort((a, b) => cmpNum(b.modifierCount, a.modifierCount));
    case "category_asc":
      return next.sort((a, b) => cmpStr(a.categoryName, b.categoryName) || cmpStr(a.name, b.name));
    case "menu_asc":
      return next.sort((a, b) => cmpStr(a.menuName, b.menuName) || cmpStr(a.name, b.name));
    case "sort_order_asc":
    default:
      return next.sort((a, b) => cmpNum(a.sortOrder, b.sortOrder) || cmpStr(a.name, b.name));
  }
}

/* ── Modifier groups ───────────────────────────────────── */

export const MODIFIER_GROUP_LIST_QUERY: MenuListQueryPreset = {
  defaultSort: "name_asc",
  filterGroups: [
    {
      id: "lifecycle",
      label: "Lifecycle",
      options: [
        { id: "lifecycle:active", label: "Active" },
        { id: "lifecycle:archived", label: "Archived" }
      ]
    },
    {
      id: "rules",
      label: "Selection rules",
      options: [
        { id: "rules:required", label: "Required", description: "Min select greater than 0" },
        { id: "rules:optional", label: "Optional", description: "Min select is 0" },
        { id: "rules:multi", label: "Multi-select", description: "Max select greater than 1" },
        { id: "rules:single", label: "Single-select", description: "Max select is 1" }
      ]
    },
    {
      id: "options",
      label: "Options",
      options: [
        { id: "options:has", label: "Has options" },
        { id: "options:empty", label: "No options" }
      ]
    }
  ],
  sortOptions: [
    { id: "name_asc", label: "Name A–Z" },
    { id: "name_desc", label: "Name Z–A" },
    { id: "options_desc", label: "Most options" },
    { id: "options_asc", label: "Fewest options" },
    { id: "item_asc", label: "Parent item" },
    { id: "min_asc", label: "Min select" }
  ]
};

function groupFilterMatch(row: ModifierGroupListRow, id: string) {
  switch (id) {
    case "lifecycle:active":
      return row.lifecycle === "ACTIVE";
    case "lifecycle:archived":
      return row.lifecycle === "ARCHIVED";
    case "rules:required":
      return row.minSelect > 0;
    case "rules:optional":
      return row.minSelect === 0;
    case "rules:multi":
      return row.maxSelect > 1;
    case "rules:single":
      return row.maxSelect <= 1;
    case "options:has":
      return row.optionCount > 0;
    case "options:empty":
      return row.optionCount === 0;
    default:
      return false;
  }
}

export function applyModifierGroupListFilters(rows: ModifierGroupListRow[], filters: string[]) {
  return rows.filter((row) =>
    matchesGroupedFilters(filters, MODIFIER_GROUP_LIST_QUERY.filterGroups, (id) =>
      groupFilterMatch(row, id)
    )
  );
}

export function applyModifierGroupListSort(rows: ModifierGroupListRow[], sortId: string) {
  const next = [...rows];
  switch (sortId) {
    case "name_desc":
      return next.sort((a, b) => cmpStr(b.name, a.name));
    case "options_desc":
      return next.sort((a, b) => cmpNum(b.optionCount, a.optionCount));
    case "options_asc":
      return next.sort((a, b) => cmpNum(a.optionCount, b.optionCount));
    case "item_asc":
      return next.sort((a, b) => cmpStr(a.itemName, b.itemName) || cmpStr(a.name, b.name));
    case "min_asc":
      return next.sort((a, b) => cmpNum(a.minSelect, b.minSelect) || cmpStr(a.name, b.name));
    case "name_asc":
    default:
      return next.sort((a, b) => cmpStr(a.name, b.name));
  }
}

/* ── Modifier options ──────────────────────────────────── */

export const MODIFIER_OPTION_LIST_QUERY: MenuListQueryPreset = {
  defaultSort: "name_asc",
  filterGroups: [
    {
      id: "status",
      label: "Status",
      options: [
        { id: "status:available", label: "Available" },
        { id: "status:unavailable", label: "Unavailable" },
        { id: "status:archived", label: "Archived" }
      ]
    },
    {
      id: "price",
      label: "Price impact",
      options: [
        { id: "price:free", label: "No price change", description: "Delta is zero" },
        { id: "price:extra", label: "Adds cost", description: "Positive price delta" },
        { id: "price:discount", label: "Reduces cost", description: "Negative price delta" }
      ]
    }
  ],
  sortOptions: [
    { id: "name_asc", label: "Name A–Z" },
    { id: "name_desc", label: "Name Z–A" },
    { id: "price_asc", label: "Price delta: low to high" },
    { id: "price_desc", label: "Price delta: high to low" },
    { id: "group_asc", label: "Parent group" },
    { id: "item_asc", label: "Linked item" }
  ]
};

function optionFilterMatch(row: ModifierOptionListRow, id: string) {
  switch (id) {
    case "status:available":
      return row.lifecycle === "ACTIVE" && row.isActive;
    case "status:unavailable":
      return row.lifecycle === "ACTIVE" && !row.isActive;
    case "status:archived":
      return row.lifecycle === "ARCHIVED";
    case "price:free":
      return row.priceDeltaCents === 0;
    case "price:extra":
      return row.priceDeltaCents > 0;
    case "price:discount":
      return row.priceDeltaCents < 0;
    default:
      return false;
  }
}

export function applyModifierOptionListFilters(rows: ModifierOptionListRow[], filters: string[]) {
  return rows.filter((row) =>
    matchesGroupedFilters(filters, MODIFIER_OPTION_LIST_QUERY.filterGroups, (id) =>
      optionFilterMatch(row, id)
    )
  );
}

export function applyModifierOptionListSort(rows: ModifierOptionListRow[], sortId: string) {
  const next = [...rows];
  switch (sortId) {
    case "name_desc":
      return next.sort((a, b) => cmpStr(b.name, a.name));
    case "price_asc":
      return next.sort((a, b) => cmpNum(a.priceDeltaCents, b.priceDeltaCents));
    case "price_desc":
      return next.sort((a, b) => cmpNum(b.priceDeltaCents, a.priceDeltaCents));
    case "group_asc":
      return next.sort((a, b) => cmpStr(a.groupName, b.groupName) || cmpStr(a.name, b.name));
    case "item_asc":
      return next.sort((a, b) => cmpStr(a.itemName, b.itemName) || cmpStr(a.name, b.name));
    case "name_asc":
    default:
      return next.sort((a, b) => cmpStr(a.name, b.name));
  }
}

/* ── Availability ──────────────────────────────────────── */

export const AVAILABILITY_LIST_QUERY: MenuListQueryPreset = {
  defaultSort: "label_asc",
  filterGroups: [
    {
      id: "evaluation",
      label: "Current evaluation",
      options: [
        { id: "eval:orderable", label: "Orderable now" },
        { id: "eval:blocked", label: "Not orderable" },
        { id: "eval:available", label: "Status: available" },
        { id: "eval:unavailable", label: "Status: unavailable" },
        { id: "eval:out_of_stock", label: "Out of stock" },
        { id: "eval:paused", label: "Paused" },
        { id: "eval:hidden", label: "Hidden" }
      ]
    },
    {
      id: "schedule",
      label: "Schedule",
      options: [
        { id: "sched:enabled", label: "Enabled" },
        { id: "sched:disabled", label: "Disabled" },
        { id: "sched:recurring", label: "Recurring" },
        { id: "sched:temporary", label: "Temporary" },
        { id: "sched:seasonal", label: "Seasonal" }
      ]
    },
    {
      id: "menu",
      label: "Parent menu",
      options: [
        { id: "menu:published", label: "Published menu" },
        { id: "menu:draft", label: "Draft menu" },
        { id: "menu:archived", label: "Archived menu" }
      ]
    }
  ],
  sortOptions: [
    { id: "label_asc", label: "Schedule name A–Z" },
    { id: "label_desc", label: "Schedule name Z–A" },
    { id: "menu_asc", label: "Menu name" },
    { id: "start_asc", label: "Start time" },
    { id: "status_asc", label: "Evaluation status" }
  ]
};

function availabilityFilterMatch(row: AvailabilityCardPayload, id: string) {
  const kind = row.window.scheduleKind ?? "RECURRING";
  switch (id) {
    case "eval:orderable":
      return row.evaluation.orderable;
    case "eval:blocked":
      return !row.evaluation.orderable;
    case "eval:available":
      return row.evaluation.status === "AVAILABLE";
    case "eval:unavailable":
      return row.evaluation.status === "UNAVAILABLE";
    case "eval:out_of_stock":
      return row.evaluation.status === "OUT_OF_STOCK" || Boolean(row.window.outOfStock);
    case "eval:paused":
      return row.evaluation.status === "PAUSED" || Boolean(row.window.paused);
    case "eval:hidden":
      return row.evaluation.status === "HIDDEN";
    case "sched:enabled":
      return row.window.enabled;
    case "sched:disabled":
      return !row.window.enabled;
    case "sched:recurring":
      return kind === "RECURRING";
    case "sched:temporary":
      return kind === "TEMPORARY";
    case "sched:seasonal":
      return kind === "SEASONAL";
    case "menu:published":
      return row.menuStatus === "PUBLISHED";
    case "menu:draft":
      return row.menuStatus === "DRAFT";
    case "menu:archived":
      return row.menuStatus === "ARCHIVED";
    default:
      return false;
  }
}

export function applyAvailabilityListFilters(rows: AvailabilityCardPayload[], filters: string[]) {
  return rows.filter((row) =>
    matchesGroupedFilters(filters, AVAILABILITY_LIST_QUERY.filterGroups, (id) =>
      availabilityFilterMatch(row, id)
    )
  );
}

export function applyAvailabilityListSort(rows: AvailabilityCardPayload[], sortId: string) {
  const next = [...rows];
  switch (sortId) {
    case "label_desc":
      return next.sort((a, b) => cmpStr(b.window.label, a.window.label));
    case "menu_asc":
      return next.sort((a, b) => cmpStr(a.menuName, b.menuName) || cmpStr(a.window.label, b.window.label));
    case "start_asc":
      return next.sort((a, b) => cmpStr(a.window.start, b.window.start) || cmpStr(a.window.label, b.window.label));
    case "status_asc":
      return next.sort(
        (a, b) => cmpStr(a.evaluation.status, b.evaluation.status) || cmpStr(a.window.label, b.window.label)
      );
    case "label_asc":
    default:
      return next.sort((a, b) => cmpStr(a.window.label, b.window.label));
  }
}

export function flattenFilterOptions(groups: MenuListFilterGroup[]): MenuListToolOption[] {
  return groups.flatMap((g) => g.options);
}
