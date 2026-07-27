import type { QrCodeRow } from "../../../api";
import type { MenuListFilterGroup, MenuListQueryPreset, MenuListToolOption } from "../menu/menuListQuery";

export const QR_LIST_QUERY: MenuListQueryPreset = {
  defaultSort: "name_asc",
  filterGroups: [
    {
      id: "status",
      label: "Status",
      hint: "Match any selected status.",
      options: [
        { id: "status:active", label: "Active", description: "Ready to scan" },
        { id: "status:inactive", label: "Inactive", description: "Temporarily disabled" },
        { id: "status:rotated", label: "Rotated", description: "Replaced by a new public code" },
        { id: "status:archived", label: "Archived", description: "Hidden from normal lists" }
      ]
    },
    {
      id: "type",
      label: "Type",
      options: [
        { id: "type:table", label: "Table", description: "Table ordering identities" },
        { id: "type:menu", label: "Menu", description: "Menu / poster QRs" },
        { id: "type:takeaway", label: "Takeaway", description: "Pickup / takeaway" },
        { id: "type:staff", label: "Staff", description: "Staff pairing" },
        { id: "type:marketing", label: "Marketing", description: "Promo destinations" },
        { id: "type:feedback", label: "Feedback", description: "Guest feedback" }
      ]
    },
    {
      id: "experience",
      label: "Experience",
      options: [
        { id: "exp:ordering", label: "Ordering", description: "Creates ordering sessions" },
        { id: "exp:browse", label: "Menu browse", description: "Browse-only" },
        { id: "exp:other", label: "Other", description: "Feedback, promo, reservation" }
      ]
    },
    {
      id: "rules",
      label: "Rules",
      options: [
        { id: "rules:ordering_on", label: "Ordering enabled", description: "Guests can place orders" },
        { id: "rules:ordering_off", label: "Ordering disabled", description: "Browse or non-order flows" },
        { id: "rules:pay_venue", label: "Pay at venue", description: "Pay at table / counter" },
        { id: "rules:prepay", label: "Pay online", description: "Prepay required" },
        { id: "rules:hybrid", label: "Hybrid payment", description: "Both payment modes" },
        { id: "rules:has_menu", label: "Has menu destination", description: "Bound to a specific menu" },
        { id: "rules:auto_menu", label: "Auto menu", description: "Uses first published menu" }
      ]
    }
  ],
  sortOptions: [
    { id: "name_asc", label: "Name A–Z" },
    { id: "name_desc", label: "Name Z–A" },
    { id: "scans_desc", label: "Most scans" },
    { id: "scans_asc", label: "Fewest scans" },
    { id: "orders_desc", label: "Most orders" },
    { id: "orders_asc", label: "Fewest orders" },
    { id: "updated_desc", label: "Recently updated" },
    { id: "updated_asc", label: "Oldest updated" },
    { id: "type_asc", label: "Type" },
    { id: "status_asc", label: "Status" }
  ]
};

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
  return true;
}

function qrFilterMatch(row: QrCodeRow, id: string) {
  switch (id) {
    case "status:active":
      return row.status === "ACTIVE";
    case "status:inactive":
      return row.status === "INACTIVE";
    case "status:rotated":
      return row.status === "ROTATED";
    case "status:archived":
      return row.status === "ARCHIVED";
    case "type:table":
      return row.type === "TABLE";
    case "type:menu":
      return row.type === "MENU";
    case "type:takeaway":
      return row.type === "TAKEAWAY";
    case "type:staff":
      return row.type === "STAFF";
    case "type:marketing":
      return row.type === "MARKETING";
    case "type:feedback":
      return row.type === "FEEDBACK";
    case "exp:ordering":
      return row.experience === "ORDERING";
    case "exp:browse":
      return row.experience === "MENU_BROWSE";
    case "exp:other":
      return row.experience === "FEEDBACK" || row.experience === "PROMOTION" || row.experience === "RESERVATION";
    case "rules:ordering_on":
      return row.allowOrdering;
    case "rules:ordering_off":
      return !row.allowOrdering;
    case "rules:pay_venue":
      return row.paymentMode === "PAY_AT_VENUE";
    case "rules:prepay":
      return row.paymentMode === "PREPAY";
    case "rules:hybrid":
      return row.paymentMode === "HYBRID";
    case "rules:has_menu":
      return Boolean(row.menuId || row.menuName);
    case "rules:auto_menu":
      return !row.menuId && !row.menuName;
    default:
      return false;
  }
}

export function applyQrListFilters(rows: QrCodeRow[], active: string[]) {
  return rows.filter((row) => matchesGroupedFilters(active, QR_LIST_QUERY.filterGroups, (id) => qrFilterMatch(row, id)));
}

function cmpStr(a: string, b: string) {
  return a.localeCompare(b, undefined, { sensitivity: "base" });
}

export function applyQrListSort(rows: QrCodeRow[], sortId: string | null) {
  const id = sortId || QR_LIST_QUERY.defaultSort;
  const sorted = [...rows];
  sorted.sort((a, b) => {
    switch (id) {
      case "name_desc":
        return cmpStr(b.name, a.name);
      case "scans_desc":
        return b.scanCount - a.scanCount;
      case "scans_asc":
        return a.scanCount - b.scanCount;
      case "orders_desc":
        return b.orderCount - a.orderCount;
      case "orders_asc":
        return a.orderCount - b.orderCount;
      case "updated_desc":
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      case "updated_asc":
        return new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
      case "type_asc":
        return cmpStr(a.type, b.type) || cmpStr(a.name, b.name);
      case "status_asc":
        return cmpStr(a.status, b.status) || cmpStr(a.name, b.name);
      case "name_asc":
      default:
        return cmpStr(a.name, b.name);
    }
  });
  return sorted;
}

export function matchesQrSearch(row: QrCodeRow, query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const haystack = [
    row.name,
    row.type,
    row.status,
    row.experience,
    row.locationLabel,
    row.areaLabel,
    row.tableLabel,
    row.menuName,
    row.publicCode,
    row.paymentMode,
    row.allowOrdering ? "ordering enabled" : "ordering disabled",
    String(row.scanCount),
    String(row.orderCount)
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(q);
}

export type { MenuListToolOption };
