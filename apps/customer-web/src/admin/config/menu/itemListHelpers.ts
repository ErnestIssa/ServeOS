import type { MenuSurfaceRow } from "../../../api";
import type { useAdminMenu } from "../useAdminMenu";

export type ItemListRow = ReturnType<typeof useAdminMenu>["flatItems"][number] & {
  menuName: string;
  menuStatus: MenuSurfaceRow["status"];
};

export function enrichItemRow(
  item: ReturnType<typeof useAdminMenu>["flatItems"][number],
  menus: MenuSurfaceRow[]
): ItemListRow {
  const menu = item.menuId ? menus.find((m) => m.id === item.menuId) : null;
  return {
    ...item,
    menuName: menu?.name ?? (item.id.startsWith("ui-mock-") ? "Preview" : "—"),
    menuStatus:
      menu?.status ??
      (item.id.startsWith("ui-mock-")
        ? item.sortOrder % 2 === 0
          ? "DRAFT"
          : "PUBLISHED"
        : "DRAFT")
  };
}

export function itemStatusLabel(item: ItemListRow) {
  if (item.lifecycle === "ARCHIVED") return "Archived";
  if (item.lifecycle === "DRAFT") return "Draft";
  if (item.isSoldOut) return "Unavailable";
  if (!item.isActive) return "Hidden";
  return "Available";
}

export function itemStatusClass(item: ItemListRow) {
  if (item.lifecycle === "ARCHIVED") return "admin-menu-surface-status--archived";
  if (item.lifecycle === "DRAFT") return "admin-menu-surface-status--draft";
  if (item.isSoldOut) return "admin-menu-surface-status--draft";
  if (!item.isActive) return "admin-menu-surface-status--archived";
  return "admin-menu-surface-status--live";
}
