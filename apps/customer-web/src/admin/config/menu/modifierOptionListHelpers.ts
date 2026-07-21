import type { useAdminMenu } from "../useAdminMenu";

export type ModifierOptionListRow = ReturnType<typeof useAdminMenu>["flatModifiers"][number];

export function modifierOptionStatusLabel(option: ModifierOptionListRow) {
  if (option.lifecycle === "ARCHIVED") return "Archived";
  if (!option.isActive) return "Unavailable";
  return "Available";
}

export function modifierOptionStatusClass(option: ModifierOptionListRow) {
  if (option.lifecycle === "ARCHIVED") return "admin-menu-surface-status--archived";
  if (!option.isActive) return "admin-menu-surface-status--draft";
  return "admin-menu-surface-status--live";
}
