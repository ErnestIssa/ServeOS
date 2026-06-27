import {
  defaultPermissionsForRole,
  VENUE_PERMISSION,
  type VenueMembershipRole,
  type VenuePermissionKey
} from "./venuePermissionKeys";

export type VenueProfileAction =
  | "view"
  | "editProfile"
  | "editBusiness"
  | "editHours"
  | "editDining"
  | "editTables"
  | "editReceipt"
  | "editBranding"
  | "editNotifications"
  | "createLocation"
  | "editLocation"
  | "disableLocation"
  | "pauseOrdering"
  | "maintenanceMode"
  | "archiveVenue";

export type VenueProfileAccess = {
  role: VenueMembershipRole;
  permissions: VenuePermissionKey[];
  can: (action: VenueProfileAction) => boolean;
  reason: (action: VenueProfileAction) => string | null;
};

function normalizeRole(role: string): VenueMembershipRole {
  const r = role.trim().toUpperCase();
  if (r === "OWNER" || r === "MANAGER" || r === "STAFF" || r === "KITCHEN" || r === "CASHIER") return r;
  return "STAFF";
}

function has(permissions: VenuePermissionKey[], key: VenuePermissionKey) {
  return permissions.includes(key);
}

export function buildVenueProfileAccess(role: string, storedPermissions?: string[]): VenueProfileAccess {
  const normalizedRole = normalizeRole(role);
  const permissions = (storedPermissions?.length
    ? storedPermissions.filter((k): k is VenuePermissionKey => ALL_SET.has(k))
    : defaultPermissionsForRole(normalizedRole)) as VenuePermissionKey[];

  const isOwner = normalizedRole === "OWNER";
  const isManager = normalizedRole === "MANAGER";
  const isAdmin = isOwner || isManager;

  function can(action: VenueProfileAction): boolean {
    switch (action) {
      case "view":
        return true;
      case "editProfile":
        return isAdmin || has(permissions, VENUE_PERMISSION.restaurantProfile);
      case "editBusiness":
      case "editDining":
      case "editTables":
      case "editReceipt":
      case "editNotifications":
        return isAdmin || has(permissions, VENUE_PERMISSION.restaurantSettings);
      case "editBranding":
        return isAdmin || has(permissions, VENUE_PERMISSION.restaurantProfile);
      case "editHours":
        return isAdmin || has(permissions, VENUE_PERMISSION.hours);
      case "createLocation":
        return isOwner;
      case "editLocation":
      case "disableLocation":
        return isAdmin;
      case "pauseOrdering":
      case "maintenanceMode":
        return isAdmin;
      case "archiveVenue":
        return isOwner;
      default:
        return false;
    }
  }

  function reason(action: VenueProfileAction): string | null {
    if (can(action)) return null;
    if (action === "archiveVenue") return "Only venue owners can archive a location.";
    if (action === "createLocation") return "Only owners can create new locations.";
    if (action === "editProfile") return "You need Restaurant profile permission to edit this section.";
    if (action === "editHours") return "You need Opening hours permission to edit schedules.";
    return "Your role does not include permission for this action.";
  }

  return { role: normalizedRole, permissions, can, reason };
}

const ALL_SET = new Set<string>(Object.values(VENUE_PERMISSION));
