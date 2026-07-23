import type { ActiveVenueMembership } from "../venueAccessGuard.js";
import { isAdminMembershipRole, VENUE_PERMISSION } from "../venuePermissions.js";

export type MenuPermissionAction = "view" | "create" | "edit" | "publish" | "delete" | "archive";

export type MenuEntity =
  | "menu"
  | "category"
  | "item"
  | "modifier_group"
  | "modifier_option"
  | "description"
  | "media";

export type MenuEntityAction =
  | "view"
  | "create"
  | "edit"
  | "delete"
  | "publish"
  | "archive"
  | "reorder"
  | "upload"
  | "remove";

export const MENU_ITEM_MEDIA_LIMITS = {
  maxImagesPerItem: 10,
  maxVideosPerItem: 3,
  maxVideoDurationMs: 60_000,
  maxVideoBytes: 250 * 1024 * 1024
} as const;

export type MenuCapabilities = {
  entities: Record<MenuEntity, Record<MenuEntityAction, boolean>>;
  limits: typeof MENU_ITEM_MEDIA_LIMITS;
};

function forbidden() {
  return Object.assign(new Error("menu_permission_denied"), { statusCode: 403 });
}

function has(perms: string[], key: string) {
  return perms.includes(key);
}

function isOwner(role: string) {
  return role === "OWNER";
}

function isOwnerOrManager(role: string) {
  return role === "OWNER" || role === "MANAGER";
}

function canViewMenu(perms: string[], role: string) {
  return (
    has(perms, VENUE_PERMISSION.menuView) ||
    has(perms, VENUE_PERMISSION.menuEdit) ||
    has(perms, VENUE_PERMISSION.menuCategory) ||
    has(perms, VENUE_PERMISSION.menuItem) ||
    has(perms, VENUE_PERMISSION.menuModifier) ||
    has(perms, VENUE_PERMISSION.menuMedia) ||
    isAdminMembershipRole(role)
  );
}

function canEditEntity(entity: MenuEntity, perms: string[], role: string) {
  if (isOwnerOrManager(role)) return true;

  switch (entity) {
    case "menu":
      return has(perms, VENUE_PERMISSION.menuEdit);
    case "category":
      return has(perms, VENUE_PERMISSION.menuCategory) || has(perms, VENUE_PERMISSION.menuEdit);
    case "item":
    case "description":
      return has(perms, VENUE_PERMISSION.menuItem) || has(perms, VENUE_PERMISSION.menuEdit);
    case "modifier_group":
    case "modifier_option":
      return has(perms, VENUE_PERMISSION.menuModifier) || has(perms, VENUE_PERMISSION.menuEdit);
    case "media":
      return (
        has(perms, VENUE_PERMISSION.menuMedia) ||
        has(perms, VENUE_PERMISSION.menuItem) ||
        has(perms, VENUE_PERMISSION.menuEdit)
      );
    default:
      return false;
  }
}

function canDeleteEntity(entity: MenuEntity, perms: string[], role: string) {
  if (isOwner(role)) return true;
  if (entity === "menu") {
    return isOwnerOrManager(role) && (has(perms, VENUE_PERMISSION.menuArchive) || has(perms, VENUE_PERMISSION.menuPublish));
  }
  if (has(perms, VENUE_PERMISSION.menuArchive) && canEditEntity(entity, perms, role)) return true;
  return isOwnerOrManager(role) && canEditEntity(entity, perms, role);
}

function canPublish(perms: string[], role: string) {
  if (isOwner(role)) return true;
  if (role === "MANAGER" && (has(perms, VENUE_PERMISSION.menuPublish) || has(perms, VENUE_PERMISSION.menuEdit))) {
    return true;
  }
  return has(perms, VENUE_PERMISSION.menuPublish);
}

function canArchive(perms: string[], role: string) {
  if (isOwner(role)) return true;
  return has(perms, VENUE_PERMISSION.menuArchive) || has(perms, VENUE_PERMISSION.menuPublish);
}

/** Backend-only menu permission gate — never trust the frontend. */
export function assertMenuEntityPermission(
  entity: MenuEntity,
  action: MenuEntityAction,
  membership: ActiveVenueMembership
): void {
  const perms = membership.permissions;
  const role = membership.role;

  if (action === "view") {
    if (canViewMenu(perms, role)) return;
    throw forbidden();
  }

  if (action === "create" || action === "edit" || action === "reorder") {
    if (canEditEntity(entity, perms, role)) return;
    throw forbidden();
  }

  if (action === "delete") {
    if (canDeleteEntity(entity, perms, role)) return;
    throw forbidden();
  }

  if (action === "upload") {
    if (canEditEntity("media", perms, role)) return;
    throw forbidden();
  }

  if (action === "remove") {
    if (canEditEntity("media", perms, role)) return;
    throw forbidden();
  }

  if (action === "publish") {
    if (canPublish(perms, role)) return;
    throw forbidden();
  }

  if (action === "archive") {
    if (canArchive(perms, role)) return;
    throw forbidden();
  }

  throw forbidden();
}

export function assertMenuPermission(action: MenuPermissionAction, membership: ActiveVenueMembership): void {
  if (action === "view") return assertMenuEntityPermission("menu", "view", membership);
  if (action === "create") return assertMenuEntityPermission("menu", "create", membership);
  if (action === "edit") return assertMenuEntityPermission("menu", "edit", membership);
  if (action === "publish") return assertMenuEntityPermission("menu", "publish", membership);
  if (action === "delete") return assertMenuEntityPermission("menu", "delete", membership);
  if (action === "archive") return assertMenuEntityPermission("menu", "archive", membership);
  throw forbidden();
}

const ALL_ENTITIES: MenuEntity[] = [
  "menu",
  "category",
  "item",
  "modifier_group",
  "modifier_option",
  "description",
  "media"
];

const ALL_ACTIONS: MenuEntityAction[] = [
  "view",
  "create",
  "edit",
  "delete",
  "publish",
  "archive",
  "reorder",
  "upload",
  "remove"
];

export function getMenuCapabilities(membership: ActiveVenueMembership): MenuCapabilities {
  const entities = {} as MenuCapabilities["entities"];

  for (const entity of ALL_ENTITIES) {
    entities[entity] = {} as Record<MenuEntityAction, boolean>;
    for (const action of ALL_ACTIONS) {
      try {
        assertMenuEntityPermission(entity, action, membership);
        entities[entity][action] = true;
      } catch {
        entities[entity][action] = false;
      }
    }
  }

  return { entities, limits: MENU_ITEM_MEDIA_LIMITS };
}
