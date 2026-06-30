/** Mirrors services/api/src/lib/venuePermissions.ts — keep in sync for admin UI gates. */
export const VENUE_PERMISSION = {
  staffInvite: "admin.staff_invite",
  staffApprove: "admin.staff_approve",
  staffPermissionsEdit: "admin.staff_permissions_edit",
  staffSuspend: "admin.staff_suspend",
  staffRemove: "admin.staff_remove",
  staffInviteManager: "admin.staff_invite_manager",
  ordersView: "staff.assigned_orders",
  ordersUpdateStatus: "admin.live_orders",
  reservations: "staff.reservations",
  tables: "staff.tables",
  walkIns: "staff.shift_tools",
  kds: "staff.kitchen",
  kitchenOverview: "admin.kitchen_overview",
  checkout: "staff.checkout",
  paymentSettings: "admin.payment_settings",
  menuView: "admin.menu",
  menuEdit: "admin.modifiers",
  menuPublish: "admin.menu_publish",
  menuArchive: "admin.menu_archive",
  menuCategory: "admin.menu_category",
  menuItem: "admin.menu_item",
  menuModifier: "admin.menu_modifier",
  menuMedia: "admin.menu_media",
  dashboard: "admin.dashboard",
  analytics: "admin.analytics",
  revenue: "admin.revenue",
  reports: "admin.analytics",
  restaurantProfile: "admin.restaurant_profile",
  restaurantSettings: "admin.restaurant_settings",
  hours: "admin.opening_hours",
  reservationsMgmt: "admin.reservations",
  tablesMgmt: "admin.tables",
  devices: "admin.devices",
  integrations: "admin.integrations",
  billing: "admin.billing",
  roles: "admin.roles_permissions",
  staffMgmt: "admin.staff_management",
  alerts: "admin.operational_alerts",
  deviceStatus: "staff.device_status"
} as const;

export type VenuePermissionKey = (typeof VENUE_PERMISSION)[keyof typeof VENUE_PERMISSION];

export type VenueMembershipRole = "OWNER" | "MANAGER" | "STAFF" | "KITCHEN" | "CASHIER";

const ALL_KEYS = Object.values(VENUE_PERMISSION);

export function defaultPermissionsForRole(role: string): VenuePermissionKey[] {
  const r = role.trim().toUpperCase();
  if (r === "OWNER" || r === "MANAGER") return [...ALL_KEYS];
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
  return [
    VENUE_PERMISSION.ordersView,
    VENUE_PERMISSION.reservations,
    VENUE_PERMISSION.tables,
    VENUE_PERMISSION.walkIns
  ];
}
