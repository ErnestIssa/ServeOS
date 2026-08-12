import type { Role } from "@prisma/client";

/**
 * Granular venue permission keys — stored on Membership.permissions and StaffInvitation.permissions.
 * Must match keys referenced in mobileExperience.ts / mobileScreenRegistry.ts.
 */
export const VENUE_PERMISSION = {
  // Staff management (OWNER / MANAGER only)
  staffInvite: "admin.staff_invite",
  staffApprove: "admin.staff_approve",
  staffPermissionsEdit: "admin.staff_permissions_edit",
  staffSuspend: "admin.staff_suspend",
  staffRemove: "admin.staff_remove",
  staffInviteManager: "admin.staff_invite_manager",

  // Operations
  ordersView: "staff.assigned_orders",
  ordersUpdateStatus: "admin.live_orders",
  reservations: "staff.reservations",
  tables: "staff.tables",
  walkIns: "staff.shift_tools",

  // Kitchen
  kds: "staff.kitchen",
  kitchenOverview: "admin.kitchen_overview",

  // Payments
  checkout: "staff.checkout",
  paymentSettings: "admin.payment_settings",

  // Content — menu surfaces, catalog, and media
  menuView: "admin.menu",
  menuEdit: "admin.modifiers",
  menuPublish: "admin.menu_publish",
  menuArchive: "admin.menu_archive",
  menuCategory: "admin.menu_category",
  menuItem: "admin.menu_item",
  menuModifier: "admin.menu_modifier",
  menuMedia: "admin.menu_media",

  // Management
  dashboard: "admin.dashboard",
  analytics: "admin.analytics",
  revenue: "admin.revenue",
  reports: "admin.analytics",

  // Restaurant config
  restaurantProfile: "admin.restaurant_profile",
  restaurantSettings: "admin.restaurant_settings",
  hours: "admin.opening_hours",
  reservationsMgmt: "admin.reservations",
  tablesMgmt: "admin.tables",

  // System
  devices: "admin.devices",
  integrations: "admin.integrations",
  billing: "admin.billing",
  roles: "admin.roles_permissions",
  staffMgmt: "admin.staff_management",
  alerts: "admin.operational_alerts",
  deviceStatus: "staff.device_status"
} as const;

export type VenuePermissionKey = (typeof VENUE_PERMISSION)[keyof typeof VENUE_PERMISSION];

/** UI grouping for invite / permission editor (frontend maps labels only). */
export const PERMISSION_GROUPS: Array<{
  id: string;
  label: string;
  keys: VenuePermissionKey[];
}> = [
  {
    id: "operations",
    label: "Operations",
    keys: [
      VENUE_PERMISSION.ordersView,
      VENUE_PERMISSION.ordersUpdateStatus,
      VENUE_PERMISSION.reservations,
      VENUE_PERMISSION.tables,
      VENUE_PERMISSION.walkIns
    ]
  },
  {
    id: "kitchen",
    label: "Kitchen",
    keys: [VENUE_PERMISSION.kds, VENUE_PERMISSION.kitchenOverview]
  },
  {
    id: "payments",
    label: "Payments",
    keys: [VENUE_PERMISSION.checkout, VENUE_PERMISSION.paymentSettings]
  },
  {
    id: "content",
    label: "Content",
    keys: [
      VENUE_PERMISSION.menuView,
      VENUE_PERMISSION.menuEdit,
      VENUE_PERMISSION.menuPublish,
      VENUE_PERMISSION.menuArchive,
      VENUE_PERMISSION.menuCategory,
      VENUE_PERMISSION.menuItem,
      VENUE_PERMISSION.menuModifier,
      VENUE_PERMISSION.menuMedia
    ]
  },
  {
    id: "management",
    label: "Management",
    keys: [
      VENUE_PERMISSION.dashboard,
      VENUE_PERMISSION.analytics,
      VENUE_PERMISSION.revenue,
      VENUE_PERMISSION.reports
    ]
  },
  {
    id: "restaurant",
    label: "Restaurant",
    keys: [
      VENUE_PERMISSION.restaurantProfile,
      VENUE_PERMISSION.restaurantSettings,
      VENUE_PERMISSION.hours,
      VENUE_PERMISSION.reservationsMgmt,
      VENUE_PERMISSION.tablesMgmt
    ]
  },
  {
    id: "system",
    label: "System",
    keys: [
      VENUE_PERMISSION.devices,
      VENUE_PERMISSION.integrations,
      VENUE_PERMISSION.billing,
      VENUE_PERMISSION.alerts,
      VENUE_PERMISSION.deviceStatus
    ]
  }
];

const ADMIN_STAFF_MGMT: VenuePermissionKey[] = [
  VENUE_PERMISSION.staffInvite,
  VENUE_PERMISSION.staffApprove,
  VENUE_PERMISSION.staffPermissionsEdit,
  VENUE_PERMISSION.staffSuspend,
  VENUE_PERMISSION.staffRemove,
  VENUE_PERMISSION.staffMgmt,
  VENUE_PERMISSION.roles
];

const ALL_VENUE_KEYS = Object.values(VENUE_PERMISSION);

export function parsePermissionList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((x): x is string => typeof x === "string" && x.trim().length > 0);
}

export function defaultPermissionsForRole(role: Role): string[] {
  const r = role;
  if (r === "OWNER" || r === "MANAGER") {
    return [...new Set([...ALL_VENUE_KEYS, ...ADMIN_STAFF_MGMT])];
  }
  if (r === "KITCHEN") {
    return [
      VENUE_PERMISSION.ordersView,
      VENUE_PERMISSION.kds,
      VENUE_PERMISSION.kitchenOverview,
      VENUE_PERMISSION.deviceStatus
    ];
  }
  if (r === "CASHIER") {
    return [
      VENUE_PERMISSION.ordersView,
      VENUE_PERMISSION.checkout,
      VENUE_PERMISSION.ordersUpdateStatus,
      VENUE_PERMISSION.deviceStatus
    ];
  }
  // STAFF — minimal ops; admins assign more at invite time
  return [
    VENUE_PERMISSION.ordersView,
    VENUE_PERMISSION.reservations,
    VENUE_PERMISSION.tables,
    VENUE_PERMISSION.walkIns
  ];
}

/** Roles allowed via standard “invite team member” (not MANAGER). */
export const INVITABLE_OPERATIONAL_ROLES: Role[] = ["STAFF", "KITCHEN", "CASHIER"];

export function isAdminMembershipRole(role: string): boolean {
  const u = role.trim().toUpperCase();
  return u === "OWNER" || u === "MANAGER";
}

export function canManageStaff(permissions: string[]): boolean {
  return (
    permissions.includes(VENUE_PERMISSION.staffMgmt) ||
    permissions.includes(VENUE_PERMISSION.staffInvite)
  );
}

export function validatePermissionKeys(keys: string[]): string[] {
  const allowed = new Set<string>(ALL_VENUE_KEYS);
  return keys.filter((k) => allowed.has(k));
}

export function resolveMembershipPermissions(role: Role, stored: unknown): string[] {
  const custom = validatePermissionKeys(parsePermissionList(stored));
  if (custom.length > 0) return custom;
  return defaultPermissionsForRole(role);
}
