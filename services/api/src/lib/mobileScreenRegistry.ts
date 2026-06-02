import type { MobileRoleType } from "./mobileExperience.js";

export type WorkspaceScreenStatus = "live" | "coming_soon";

export type WorkspaceScreenDef = {
  title: string;
  subtitle: string;
  permission: string;
  status: WorkspaceScreenStatus;
  roleTypes: MobileRoleType[];
};

/** Authoritative screen catalog — API validates `screenKey` against this map + user permissions. */
export const WORKSPACE_SCREENS: Record<string, WorkspaceScreenDef> = {
  "admin.dashboard": {
    title: "Business dashboard",
    subtitle: "Today at your venue",
    permission: "admin.dashboard",
    status: "live",
    roleTypes: ["ADMIN"]
  },
  "admin.live_orders": {
    title: "Live orders",
    subtitle: "Active service queue",
    permission: "admin.live_orders",
    status: "live",
    roleTypes: ["ADMIN"]
  },
  "admin.restaurant_profile": {
    title: "Restaurant profile",
    subtitle: "Venue identity",
    permission: "admin.restaurant_profile",
    status: "live",
    roleTypes: ["ADMIN"]
  },
  "admin.restaurant_settings": {
    title: "Restaurant settings",
    subtitle: "Hours and policies",
    permission: "admin.restaurant_settings",
    status: "live",
    roleTypes: ["ADMIN"]
  },
  "admin.menu": {
    title: "Menu management",
    subtitle: "Categories and items",
    permission: "admin.menu",
    status: "live",
    roleTypes: ["ADMIN"]
  },
  "admin.reservations": {
    title: "Reservation management",
    subtitle: "Bookings at this venue",
    permission: "admin.reservations",
    status: "live",
    roleTypes: ["ADMIN"]
  },
  "admin.revenue": {
    title: "Revenue overview",
    subtitle: "Sales snapshot",
    permission: "admin.revenue",
    status: "coming_soon",
    roleTypes: ["ADMIN"]
  },
  "admin.analytics": {
    title: "Analytics",
    subtitle: "Reports and KPIs",
    permission: "admin.analytics",
    status: "coming_soon",
    roleTypes: ["ADMIN"]
  },
  "admin.staff_management": {
    title: "Staff management",
    subtitle: "Team roster",
    permission: "admin.staff_management",
    status: "coming_soon",
    roleTypes: ["ADMIN"]
  },
  "staff.assigned_orders": {
    title: "Assigned orders",
    subtitle: "Your service queue",
    permission: "staff.assigned_orders",
    status: "live",
    roleTypes: ["STAFF"]
  },
  "staff.kitchen_queue": {
    title: "Kitchen tools",
    subtitle: "Prep and expo tickets",
    permission: "staff.kitchen",
    status: "live",
    roleTypes: ["STAFF"]
  },
  "staff.checkout_queue": {
    title: "Checkout tools",
    subtitle: "Payments and handoff",
    permission: "staff.checkout",
    status: "live",
    roleTypes: ["STAFF"]
  },
  "staff.reservations": {
    title: "Reservations",
    subtitle: "Today's bookings",
    permission: "staff.reservations",
    status: "coming_soon",
    roleTypes: ["STAFF"]
  },
  "shared.help": {
    title: "Help",
    subtitle: "FAQs and contact",
    permission: "shared.help",
    status: "live",
    roleTypes: ["CUSTOMER", "ADMIN", "STAFF"]
  },
  "shared.sessions": {
    title: "Session management",
    subtitle: "Devices signed in",
    permission: "shared.sessions",
    status: "coming_soon",
    roleTypes: ["CUSTOMER", "ADMIN", "STAFF"]
  },
  "shared.connected_devices": {
    title: "Connected devices",
    subtitle: "Hardware pairing",
    permission: "shared.connected_devices",
    status: "coming_soon",
    roleTypes: ["CUSTOMER", "ADMIN", "STAFF"]
  },
  "shared.about": {
    title: "About ServeOS",
    subtitle: "Platform information",
    permission: "shared.about",
    status: "live",
    roleTypes: ["CUSTOMER", "ADMIN", "STAFF"]
  },
  "me.security": {
    title: "Security",
    subtitle: "Account protection",
    permission: "shared.profile",
    status: "coming_soon",
    roleTypes: ["ADMIN", "STAFF"]
  },
  "me.notifications": {
    title: "Notifications",
    subtitle: "Alert preferences",
    permission: "shared.notifications",
    status: "coming_soon",
    roleTypes: ["ADMIN", "STAFF"]
  }
};

/** Maps control-centre / ME row ids → workspace screen keys. */
export const ROW_ID_TO_SCREEN_KEY: Record<string, string> = {
  "app:dashboard": "admin.dashboard",
  "app:live_orders": "admin.live_orders",
  "app:restaurant_profile": "admin.restaurant_profile",
  "app:restaurant_settings": "admin.restaurant_settings",
  "app:menu": "admin.menu",
  "app:reservations_mgmt": "admin.reservations",
  "app:revenue": "admin.revenue",
  "app:analytics": "admin.analytics",
  "app:staff_mgmt": "admin.staff_management",
  "app:assigned_orders": "staff.assigned_orders",
  "app:staff_kitchen": "staff.kitchen_queue",
  "app:staff_checkout": "staff.checkout_queue",
  "app:staff_reservations": "staff.reservations",
  "app:chip:help": "shared.help",
  "app:sessions": "shared.sessions",
  "app:connected": "shared.connected_devices",
  "app:about": "shared.about",
  "me:security": "me.security",
  "me:notifications": "me.notifications"
};

export function screenKeysForManifest(roleType: MobileRoleType, permissions: string[]): Record<string, WorkspaceScreenDef> {
  const out: Record<string, WorkspaceScreenDef> = {};
  for (const [key, def] of Object.entries(WORKSPACE_SCREENS)) {
    if (!def.roleTypes.includes(roleType)) continue;
    if (!permissions.includes(def.permission)) continue;
    out[key] = def;
  }
  return out;
}

export function resolveScreenKeyForRow(rowId: string): string | null {
  return ROW_ID_TO_SCREEN_KEY[rowId] ?? null;
}
