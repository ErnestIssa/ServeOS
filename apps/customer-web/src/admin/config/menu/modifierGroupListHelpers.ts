import type { useAdminMenu } from "../useAdminMenu";

export type ModifierGroupListRow = ReturnType<typeof useAdminMenu>["flatModifierGroups"][number];

export function modifierGroupStatusLabel(group: ModifierGroupListRow) {
  if (group.lifecycle === "ARCHIVED") return "Archived";
  return "Active";
}

export function modifierGroupStatusClass(group: ModifierGroupListRow) {
  if (group.lifecycle === "ARCHIVED") return "admin-menu-surface-status--archived";
  return "admin-menu-surface-status--live";
}
