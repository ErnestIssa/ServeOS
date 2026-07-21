import type { MenuStatus } from "@prisma/client";
import type { ActiveVenueMembership } from "../venueAccessGuard.js";
import { getMenuCapabilities } from "./menuPermissions.js";
import type { MenuListItem } from "./menuService.js";

export type MenuScopeTone = "live" | "draft" | "problem";

export type MenuPanelVariant = "active" | "live" | "archived";

export type MenuManageActionId =
  | "edit"
  | "delete-draft"
  | "delete-menu"
  | "share"
  | "archive"
  | "publish-drafts"
  | "publish-changes"
  | "version-history"
  | "qr"
  | "insights"
  | "move";

export type MenuManageActionDescriptor = {
  id: MenuManageActionId;
  label: string;
  description: string;
  danger?: boolean;
};

export type MenuManageContext = {
  multiLocation: boolean;
  targets: MenuListItem[];
  draftTargetIds: string[];
  actions: MenuManageActionDescriptor[];
  moveDestinations: Array<{ id: string; name: string }>;
};

/** Authoritative scope health for manage UI chips — computed server-side only. */
export function deriveMenuScopeHealth(
  menu: Pick<MenuListItem, "status" | "itemCount"> & { hasUnpublishedChanges?: boolean }
): {
  scopeTone: MenuScopeTone;
  scopeLabel: string;
} {
  if (menu.status === "ARCHIVED") {
    return { scopeTone: "problem", scopeLabel: "Archived" };
  }
  if (menu.status === "PUBLISHED" && menu.itemCount === 0) {
    return { scopeTone: "problem", scopeLabel: "Needs attention" };
  }
  if (menu.status === "PUBLISHED" && menu.hasUnpublishedChanges) {
    return { scopeTone: "draft", scopeLabel: "Draft changes" };
  }
  if (menu.status === "PUBLISHED") {
    return { scopeTone: "live", scopeLabel: "Live" };
  }
  return { scopeTone: "draft", scopeLabel: "Draft" };
}

export function withMenuScopeHealth<T extends Pick<MenuListItem, "status" | "itemCount">>(
  menu: T
): T & { scopeTone: MenuScopeTone; scopeLabel: string } {
  const health = deriveMenuScopeHealth(menu);
  return { ...menu, ...health };
}

function panelVariantToStatusFilter(variant: MenuPanelVariant): MenuStatus | "active" {
  if (variant === "live") return "PUBLISHED";
  if (variant === "archived") return "ARCHIVED";
  return "active";
}

export function resolveManageTargetsFromList(menus: MenuListItem[], menuIds?: string[]) {
  if (menuIds && menuIds.length > 0) {
    const idSet = new Set(menuIds);
    return menus.filter((m) => idSet.has(m.id));
  }
  return menus;
}

export function resolveDraftTargetIds(targets: MenuListItem[]) {
  return targets.filter((m) => m.status === "DRAFT").map((m) => m.id);
}

/** Authoritative manage drawer actions — permission and status rules enforced here. */
export function buildMenuManageActions(input: {
  targets: MenuListItem[];
  draftTargetIds: string[];
  panelVariant: MenuPanelVariant;
  membership: ActiveVenueMembership;
  multiLocation: boolean;
}): MenuManageActionDescriptor[] {
  const { targets, draftTargetIds, panelVariant, membership, multiLocation } = input;
  const actions: MenuManageActionDescriptor[] = [];
  if (targets.length === 0) return actions;

  const caps = getMenuCapabilities(membership);
  const canDelete = caps.entities.menu.delete;
  const canArchive = caps.entities.menu.archive;
  const canPublish = caps.entities.menu.publish;
  const canView = caps.entities.menu.view;
  const canEdit = caps.entities.menu.edit;

  const draftCount = targets.filter((m) => m.status === "DRAFT").length;
  const archivableCount = targets.filter((m) => m.status !== "ARCHIVED").length;
  const editableCount = targets.filter((m) => m.status !== "ARCHIVED").length;

  if (panelVariant !== "archived" && editableCount > 0 && canEdit) {
    actions.push({
      id: "edit",
      label: editableCount === 1 ? "Edit menu" : "Edit a menu",
      description:
        editableCount === 1
          ? "Update this menu’s name, description, and type."
          : "Choose one menu to edit its name, description, and type."
    });
  }

  actions.push({
    id: "share",
    label: targets.length === 1 ? "Share menu" : `Share ${targets.length} menus`,
    description: "Copy or share menu names and status."
  });

  if (panelVariant !== "archived" && draftTargetIds.length > 0 && canPublish) {
    actions.push({
      id: "publish-drafts",
      label: draftTargetIds.length === 1 ? "Publish changes" : `Publish ${draftTargetIds.length} menus`,
      description: "Release selected draft menus as new live versions for guests."
    });
  }

  const pendingPublishIds = targets.filter(
    (m) => m.status === "PUBLISHED" && (m.hasUnpublishedChanges || m.draftChangeCount > 0)
  );
  if (panelVariant !== "archived" && pendingPublishIds.length > 0 && canPublish) {
    actions.push({
      id: "publish-changes",
      label:
        pendingPublishIds.length === 1
          ? "Publish changes"
          : `Publish changes (${pendingPublishIds.length})`,
      description: "Release draft workspace edits as a new live version."
    });
  }

  if (panelVariant !== "archived" && canView) {
    actions.push({
      id: "qr",
      label: "Share QR code",
      description: targets.length > 1 ? "Choose one menu for the QR code." : "Generate a guest ordering QR code."
    });
  }

  if (canView) {
    actions.push({
      id: "insights",
      label: "View insights",
      description: "Open analytics for a menu — pick the report you want."
    });
  }

  if (multiLocation && panelVariant !== "archived" && canEdit) {
    actions.push({
      id: "move",
      label: targets.length === 1 ? "Move to another location" : `Move ${targets.length} menus`,
      description: "Transfer menus to a different venue in your group."
    });
  }

  if (panelVariant !== "archived" && draftCount > 0 && canDelete) {
    actions.push({
      id: "delete-draft",
      label: draftCount === 1 ? "Delete draft" : `Delete ${draftCount} drafts`,
      description: "Permanently remove draft menus that were never published.",
      danger: true
    });
  }

  if (panelVariant !== "archived" && archivableCount > 0 && canDelete) {
    actions.push({
      id: "delete-menu",
      label: archivableCount === 1 ? "Delete menu" : `Delete ${archivableCount} menus`,
      description: "Remove drafts permanently or archive live menus.",
      danger: true
    });
  }

  if (panelVariant !== "archived" && archivableCount > 0 && canArchive) {
    actions.push({
      id: "archive",
      label: archivableCount === 1 ? "Archive" : `Archive ${archivableCount}`,
      description: "Hide from guests and move to archived. Prefer archive over unpublish.",
      danger: true
    });
  }

  if (panelVariant !== "archived" && targets.length === 1 && canView) {
    actions.push({
      id: "version-history",
      label: "Version history",
      description: "Browse published versions, compare, and roll back."
    });
  }

  return actions;
}

export type MenuRowAction = {
  id: string;
  label: string;
  danger?: boolean;
};

/** Per-card ⋯ menu actions — computed server-side from permissions and menu status. */
export function buildMenuRowActions(
  menu: MenuListItem,
  panelVariant: MenuPanelVariant,
  membership: ActiveVenueMembership
): MenuRowAction[] {
  const caps = getMenuCapabilities(membership);
  const actions: MenuRowAction[] = [];

  if (caps.entities.menu.view) {
    actions.push({ id: "preview", label: "Preview" });
    actions.push({ id: "details", label: "Menu details" });
  }

  if (
    panelVariant !== "archived" &&
    caps.entities.menu.publish &&
    (menu.status === "DRAFT" || menu.hasUnpublishedChanges)
  ) {
    actions.push({ id: "publish-changes", label: "Publish changes" });
  }

  if (panelVariant !== "archived" && caps.entities.menu.edit && menu.status !== "ARCHIVED") {
    actions.push({ id: "schedule-release", label: "Schedule release" });
  }

  if (caps.entities.menu.view && (menu.activeVersionNumber != null || menu.status === "PUBLISHED")) {
    actions.push({ id: "version-history", label: "Version history" });
  }

  if (
    panelVariant !== "archived" &&
    caps.entities.menu.publish &&
    menu.activeVersionNumber != null &&
    menu.activeVersionNumber >= 1
  ) {
    actions.push({ id: "rollback", label: "Rollback" });
  }

  if (caps.entities.menu.create) {
    actions.push({ id: "duplicate", label: "Duplicate" });
  }

  if (panelVariant !== "archived" && menu.status !== "ARCHIVED" && caps.entities.menu.archive) {
    actions.push({ id: "archive", label: "Archive", danger: true });
  }

  return actions;
}

export function statusFilterToPanelVariant(status: "active" | MenuStatus): MenuPanelVariant {
  if (status === "PUBLISHED") return "live";
  if (status === "ARCHIVED") return "archived";
  return "active";
}

export function buildMenuManageContext(input: {
  menus: MenuListItem[];
  menuIds?: string[];
  panelVariant: MenuPanelVariant;
  membership: ActiveVenueMembership;
  multiLocation: boolean;
  moveDestinations: Array<{ id: string; name: string }>;
}): MenuManageContext {
  const targets = resolveManageTargetsFromList(input.menus, input.menuIds);
  const draftTargetIds = resolveDraftTargetIds(targets);
  const actions = buildMenuManageActions({
    targets,
    draftTargetIds,
    panelVariant: input.panelVariant,
    membership: input.membership,
    multiLocation: input.multiLocation
  });

  return {
    multiLocation: input.multiLocation,
    targets,
    draftTargetIds,
    actions,
    moveDestinations: input.moveDestinations
  };
}

export { panelVariantToStatusFilter };
