import type { PaymentLogRow } from "../../../api";
import type { MenuListQueryPreset } from "../menu/menuListQuery";

export type LogCategory = PaymentLogRow["category"];
export type LogLevel = PaymentLogRow["level"];
export type LogCategoryFilter = "all" | LogCategory;

export const LOG_CATEGORY_ORDER: LogCategory[] = [
  "webhook",
  "payment",
  "refund",
  "security",
  "config",
  "reconciliation"
];

export function logCategoryLabel(category: LogCategory) {
  if (category === "webhook") return "Webhook";
  if (category === "payment") return "Payment";
  if (category === "refund") return "Refund";
  if (category === "security") return "Security";
  if (category === "config") return "Config";
  return "Reconciliation";
}

export function logLevelLabel(level: LogLevel) {
  if (level === "error") return "Error";
  if (level === "warn") return "Warning";
  return "Info";
}

export function logLevelTone(level: LogLevel): "active" | "pending" | "setup" | "issue" | "inactive" {
  if (level === "error") return "issue";
  if (level === "warn") return "setup";
  return "inactive";
}

export const LOGS_LIST_QUERY: MenuListQueryPreset = {
  defaultSort: "newest",
  filterGroups: [
    {
      id: "category",
      label: "Category",
      options: LOG_CATEGORY_ORDER.map((c) => ({
        id: `category:${c}`,
        label: logCategoryLabel(c)
      }))
    },
    {
      id: "level",
      label: "Level",
      options: [
        { id: "level:info", label: "Info" },
        { id: "level:warn", label: "Warning" },
        { id: "level:error", label: "Error" }
      ]
    }
  ],
  sortOptions: [
    { id: "newest", label: "Newest first" },
    { id: "oldest", label: "Oldest first" },
    { id: "level_desc", label: "Errors first" },
    { id: "category_asc", label: "Category" }
  ]
};

export function matchesLogSearch(row: PaymentLogRow, query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const hay = [
    row.id,
    row.message,
    row.category,
    row.level,
    row.source,
    row.at,
    JSON.stringify(row.meta ?? {})
  ]
    .join(" ")
    .toLowerCase();
  return hay.includes(q);
}

export function applyLogFilters(rows: PaymentLogRow[], activeFilters: string[]) {
  const categories = activeFilters.filter((f) => f.startsWith("category:")).map((f) => f.slice("category:".length));
  const levels = activeFilters.filter((f) => f.startsWith("level:")).map((f) => f.slice("level:".length));
  return rows.filter((row) => {
    if (categories.length > 0 && !categories.includes(row.category)) return false;
    if (levels.length > 0 && !levels.includes(row.level)) return false;
    return true;
  });
}

export function applyLogCategoryFilter(rows: PaymentLogRow[], category: LogCategoryFilter) {
  if (category === "all") return rows;
  return rows.filter((row) => row.category === category);
}

const LEVEL_RANK: Record<LogLevel, number> = { error: 0, warn: 1, info: 2 };

export function applyLogSort(rows: PaymentLogRow[], sort: string) {
  return [...rows].sort((a, b) => {
    if (sort === "oldest") return a.at.localeCompare(b.at);
    if (sort === "level_desc") {
      const rank = LEVEL_RANK[a.level] - LEVEL_RANK[b.level];
      return rank !== 0 ? rank : b.at.localeCompare(a.at);
    }
    if (sort === "category_asc") {
      const cat = a.category.localeCompare(b.category);
      return cat !== 0 ? cat : b.at.localeCompare(a.at);
    }
    return b.at.localeCompare(a.at);
  });
}

export function groupLogsByCategory(rows: PaymentLogRow[]) {
  return LOG_CATEGORY_ORDER.map((category) => ({
    category,
    label: logCategoryLabel(category),
    rows: rows.filter((row) => row.category === category)
  })).filter((section) => section.rows.length > 0);
}
