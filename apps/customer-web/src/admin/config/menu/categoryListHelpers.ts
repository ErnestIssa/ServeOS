import type { MenuSurfaceRow, MenuTree } from "../../../api";

export type CategoryListRow = {
  id: string;
  name: string;
  description: string | null;
  menuId: string | null;
  menuName: string;
  /** Publish state inherited from the parent menu surface. */
  menuStatus: MenuSurfaceRow["status"];
  sortOrder: number;
  isActive: boolean;
  itemCount: number;
};

export type CategoryTreeRow = MenuTree["categories"][number];

export function toCategoryListRow(
  category: CategoryTreeRow,
  menus: MenuSurfaceRow[]
): CategoryListRow {
  const menu = category.menuId ? menus.find((m) => m.id === category.menuId) : null;
  return {
    id: category.id,
    name: category.name,
    description: category.description,
    menuId: category.menuId,
    menuName: menu?.name ?? (category.menuId ? "—" : "Preview"),
    menuStatus: menu?.status ?? (category.id.startsWith("ui-mock-") ? (category.sortOrder % 2 === 0 ? "DRAFT" : "PUBLISHED") : "DRAFT"),
    sortOrder: category.sortOrder,
    isActive: category.isActive,
    itemCount: category.items.length
  };
}

export function categoryVisibilityLabel(isActive: boolean) {
  return isActive ? "Visible" : "Hidden";
}

export function categoryPublishLabel(status: MenuSurfaceRow["status"]) {
  if (status === "PUBLISHED") return "Live";
  if (status === "ARCHIVED") return "Archived";
  return "Draft";
}

export function categoryPublishClass(status: MenuSurfaceRow["status"]) {
  if (status === "PUBLISHED") return "admin-menu-surface-status--live";
  if (status === "ARCHIVED") return "admin-menu-surface-status--archived";
  return "admin-menu-surface-status--draft";
}
