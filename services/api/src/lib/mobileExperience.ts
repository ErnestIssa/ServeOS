/**
 * Mobile app experience manifest — backend source of truth.
 * Frontend maps row `id` values to navigation handlers; visibility is never inferred from JWT role alone.
 */

import {
  resolveScreenKeyForRow,
  screenKeysForManifest,
  WORKSPACE_SCREENS
} from "./mobileScreenRegistry.js";

export type MobileRoleType = "CUSTOMER" | "ADMIN" | "STAFF";

export type MobileTabId = "home" | "bookings" | "orders" | "messages" | "account";

export type MeHubRowAction =
  | "open_reservations"
  | "open_orders"
  | "open_review"
  | "open_support"
  | "navigate_section"
  | "navigate_screen"
  | "sign_out";

export type ControlCentreRowAction =
  | "navigate_help"
  | "navigate_safety"
  | "navigate_settings"
  | "navigate_section"
  | "navigate_screen"
  | "choose_venue";

export type MeHubRowManifest = {
  id: string;
  title: string;
  subtitle: string;
  action: MeHubRowAction;
  screenKey?: string;
  /** Present when action is navigate_section or navigate_screen */
  sectionTitle?: string;
  sectionSubtitle?: string;
  danger?: boolean;
};

export type MeHubSectionManifest = {
  id: string;
  label: string;
  rows: MeHubRowManifest[];
};

export type ControlCentreChipManifest = {
  id: string;
  label: string;
  action: "navigate_help" | "navigate_safety" | "navigate_settings";
};

export type ControlCentreRowManifest = {
  id: string;
  title: string;
  subtitle: string;
  action: ControlCentreRowAction;
  screenKey?: string;
  sectionTitle?: string;
  sectionSubtitle?: string;
  last?: boolean;
};

export type WorkspaceScreenManifest = {
  title: string;
  subtitle: string;
  permission: string;
  status: "live" | "coming_soon";
};

export type ControlCentreSectionManifest = {
  id: string;
  label: string;
  rows: ControlCentreRowManifest[];
};

export type SettingsDetailKey =
  | "manage_account"
  | "privacy"
  | "address"
  | "accessibility"
  | "night_mode"
  | "shortcuts"
  | "communication"
  | "navigation"
  | "sounds_voice";

export type MobileExperienceManifest = {
  roleType: MobileRoleType;
  permissions: string[];
  /** Screen catalog the user may open (keys → metadata). */
  screens: Record<string, WorkspaceScreenManifest>;
  /** Primary workspace screen per tab (admin/staff only). */
  tabScreens: Partial<Record<MobileTabId, string>>;
  tabs: MobileTabId[];
  meHub: {
    sections: MeHubSectionManifest[];
    showNotificationToggles: boolean;
    showVenueLine: boolean;
  };
  controlCentre: {
    chips: ControlCentreChipManifest[];
    sections: ControlCentreSectionManifest[];
    showDarkModeToggle: boolean;
  };
  settings: {
    accountKeys: SettingsDetailKey[];
    generalKeys: SettingsDetailKey[];
  };
};

/** Maps persisted backend role strings → mobile role bucket. */
export function mapBackendRoleToBucket(role: string): MobileRoleType {
  const u = role.trim().toUpperCase();
  if (u === "OWNER" || u === "MANAGER") return "ADMIN";
  if (u === "STAFF" || u === "KITCHEN" || u === "CASHIER" || u === "WAITER") return "STAFF";
  return "CUSTOMER";
}

export function resolveMobileRoleType(roleStrings: string[]): MobileRoleType {
  const buckets = roleStrings.map(mapBackendRoleToBucket);
  if (buckets.includes("ADMIN")) return "ADMIN";
  if (buckets.includes("STAFF")) return "STAFF";
  return "CUSTOMER";
}

const PERMS = {
  customer: {
    reservations: "customer.reservations",
    orders: "customer.orders",
    review: "customer.review",
    orderHistory: "customer.order_history",
    favorites: "customer.favorites",
    payments: "customer.payments",
    addresses: "customer.addresses",
    rewards: "customer.rewards",
    dietary: "customer.dietary",
    support: "shared.support"
  },
  staff: {
    assignedOrders: "staff.assigned_orders",
    shift: "staff.shift_tools",
    reservations: "staff.reservations",
    tables: "staff.tables",
    kitchen: "staff.kitchen",
    checkout: "staff.checkout",
    devices: "staff.device_status"
  },
  admin: {
    restaurantProfile: "admin.restaurant_profile",
    restaurantSettings: "admin.restaurant_settings",
    dashboard: "admin.dashboard",
    revenue: "admin.revenue",
    analytics: "admin.analytics",
    hours: "admin.opening_hours",
    reservations: "admin.reservations",
    tables: "admin.tables",
    menu: "admin.menu",
    modifiers: "admin.modifiers",
    staffMgmt: "admin.staff_management",
    roles: "admin.roles_permissions",
    devices: "admin.devices",
    kds: "admin.kds",
    checkout: "admin.checkout",
    integrations: "admin.integrations",
    payments: "admin.payment_settings",
    billing: "admin.billing",
    liveOrders: "admin.live_orders",
    kitchenOverview: "admin.kitchen_overview",
    alerts: "admin.operational_alerts"
  },
  shared: {
    help: "shared.help",
    safety: "shared.safety",
    settings: "shared.app_settings",
    privacy: "shared.privacy",
    sessions: "shared.sessions",
    devices: "shared.connected_devices",
    about: "shared.about",
    accessibility: "shared.accessibility",
    communication: "shared.communication",
    theme: "shared.theme",
    notifications: "shared.notifications",
    profile: "shared.profile",
    support: "shared.support"
  }
} as const;

function permissionsForRoleType(roleType: MobileRoleType, staffFlags: StaffCapabilityFlags): string[] {
  const p = new Set<string>([
    PERMS.shared.help,
    PERMS.shared.safety,
    PERMS.shared.settings,
    PERMS.shared.privacy,
    PERMS.shared.sessions,
    PERMS.shared.devices,
    PERMS.shared.about,
    PERMS.shared.accessibility,
    PERMS.shared.communication,
    PERMS.shared.theme,
    PERMS.shared.notifications,
    PERMS.shared.profile,
    PERMS.shared.support
  ]);

  if (roleType === "CUSTOMER") {
    for (const k of Object.values(PERMS.customer)) p.add(k);
    return [...p];
  }

  if (roleType === "ADMIN") {
    for (const k of Object.values(PERMS.admin)) p.add(k);
    for (const k of Object.values(PERMS.shared)) p.add(k);
    return [...p];
  }

  // STAFF
  p.add(PERMS.staff.assignedOrders);
  p.add(PERMS.staff.shift);
  p.add(PERMS.staff.reservations);
  p.add(PERMS.staff.tables);
  p.add(PERMS.staff.devices);
  if (staffFlags.kitchen) p.add(PERMS.staff.kitchen);
  if (staffFlags.checkout) p.add(PERMS.staff.checkout);

  return [...p];
}

export type StaffCapabilityFlags = {
  kitchen: boolean;
  checkout: boolean;
  reservations: boolean;
  tables: boolean;
};

export function readStaffCapabilityFlags(signupProfile: unknown, membershipRoles: string[]): StaffCapabilityFlags {
  const roles = membershipRoles.map((r) => r.toUpperCase());
  const profile =
    signupProfile && typeof signupProfile === "object" && !Array.isArray(signupProfile)
      ? (signupProfile as Record<string, unknown>)
      : {};
  const caps = Array.isArray(profile.staffCapabilities)
    ? profile.staffCapabilities.filter((x): x is string => typeof x === "string")
    : [];
  const all = [...roles, ...caps.map((c) => c.toUpperCase())];
  return {
    kitchen: all.some((r) => r === "KITCHEN" || r === "STAFF"),
    checkout: all.some((r) => r === "CASHIER" || r === "STAFF"),
    reservations: all.some((r) => r === "STAFF" || r === "WAITER"),
    tables: all.some((r) => r === "STAFF" || r === "WAITER")
  };
}

function tabsForRole(roleType: MobileRoleType): MobileTabId[] {
  switch (roleType) {
    case "CUSTOMER":
      return ["home", "bookings", "orders", "messages", "account"];
    case "ADMIN":
      return ["home", "orders", "messages", "account"];
    case "STAFF":
      return ["orders", "messages", "account"];
  }
}

function tabScreensForRole(
  roleType: MobileRoleType,
  permSet: Set<string>,
  staffFlags: StaffCapabilityFlags
): Partial<Record<MobileTabId, string>> {
  if (roleType === "ADMIN") {
    const out: Partial<Record<MobileTabId, string>> = {};
    if (permSet.has(PERMS.admin.dashboard)) out.home = "admin.dashboard";
    if (permSet.has(PERMS.admin.liveOrders)) out.orders = "admin.live_orders";
    return out;
  }
  if (roleType === "STAFF") {
    const out: Partial<Record<MobileTabId, string>> = {};
    if (staffFlags.kitchen && !staffFlags.checkout && permSet.has(PERMS.staff.kitchen)) {
      out.orders = "staff.kitchen_queue";
    } else if (staffFlags.checkout && !staffFlags.kitchen && permSet.has(PERMS.staff.checkout)) {
      out.orders = "staff.checkout_queue";
    } else if (permSet.has(PERMS.staff.assignedOrders)) {
      out.orders = "staff.assigned_orders";
    }
    return out;
  }
  return {};
}

function buildCustomerMeHub(): MeHubSectionManifest[] {
  return [
    {
      id: "activity",
      label: "Activity",
      rows: [
        {
          id: "me:reservations",
          title: "Upcoming reservations",
          subtitle: "Tables and events you've booked",
          action: "open_reservations"
        },
        {
          id: "me:active_orders",
          title: "Active orders",
          subtitle: "Track live order status",
          action: "open_orders"
        },
        {
          id: "me:review",
          title: "Review",
          subtitle: "Rate your visits and share feedback",
          action: "open_review"
        },
        {
          id: "me:order_history",
          title: "Order history",
          subtitle: "Past orders, receipts, and reorder",
          action: "navigate_section",
          sectionTitle: "Order history",
          sectionSubtitle: "Receipts and past totals"
        }
      ]
    },
    {
      id: "places",
      label: "Places & payment",
      rows: [
        {
          id: "me:favorites",
          title: "Saved & favorite venues",
          subtitle: "Restaurants you love",
          action: "navigate_section",
          sectionTitle: "Saved venues",
          sectionSubtitle: "Favorites and recents"
        },
        {
          id: "me:payments",
          title: "Payment methods",
          subtitle: "Cards and Swish",
          action: "navigate_section",
          sectionTitle: "Payment methods",
          sectionSubtitle: "Stripe / Swish"
        },
        {
          id: "me:addresses",
          title: "Addresses",
          subtitle: "Delivery and saved locations",
          action: "navigate_section",
          sectionTitle: "Addresses",
          sectionSubtitle: "Saved delivery addresses"
        }
      ]
    },
    {
      id: "rewards",
      label: "Rewards",
      rows: [
        {
          id: "me:rewards",
          title: "Rewards & loyalty",
          subtitle: "Points, offers, and perks",
          action: "navigate_section",
          sectionTitle: "Rewards & loyalty",
          sectionSubtitle: "Coming soon"
        }
      ]
    },
    {
      id: "preferences",
      label: "Personal preferences",
      rows: [
        {
          id: "me:preferences",
          title: "Dietary & allergies",
          subtitle: "Filters for menu and ordering",
          action: "navigate_section",
          sectionTitle: "Dietary & allergies",
          sectionSubtitle: "Set preferences for safer ordering"
        }
      ]
    },
    {
      id: "help",
      label: "Help",
      rows: [
        {
          id: "me:support",
          title: "Support",
          subtitle: "Quick help and contact",
          action: "open_support"
        }
      ]
    },
    {
      id: "session",
      label: "Session",
      rows: [
        {
          id: "me:sign_out",
          title: "Log out",
          subtitle: "Ends this session on your device",
          action: "sign_out",
          danger: true
        }
      ]
    }
  ];
}

function buildStaffAdminMeHub(roleType: MobileRoleType): MeHubSectionManifest[] {
  return [
    {
      id: "workspace",
      label: roleType === "ADMIN" ? "Workspace" : "Shift",
      rows: [
        {
          id: "me:notifications",
          title: "Notifications",
          subtitle: "Operational and account alerts",
          action: "navigate_section",
          sectionTitle: "Notifications",
          sectionSubtitle: "Push and in-app alerts"
        },
        {
          id: "me:security",
          title: "Security",
          subtitle: "Password and session safety",
          action: "navigate_section",
          sectionTitle: "Security",
          sectionSubtitle: "Protect your account"
        }
      ]
    },
    {
      id: "help",
      label: "Help",
      rows: [
        {
          id: "me:support",
          title: "Support",
          subtitle: "Quick help and contact",
          action: "open_support"
        }
      ]
    },
    {
      id: "session",
      label: "Session",
      rows: [
        {
          id: "me:sign_out",
          title: "Log out",
          subtitle: "Ends this session on your device",
          action: "sign_out",
          danger: true
        }
      ]
    }
  ];
}

function buildCustomerControlCentre(): {
  chips: ControlCentreChipManifest[];
  sections: ControlCentreSectionManifest[];
} {
  return {
    chips: [
      { id: "app:chip:help", label: "Help", action: "navigate_help" },
      { id: "app:chip:safety", label: "Safety", action: "navigate_safety" },
      { id: "app:chip:settings", label: "App settings", action: "navigate_settings" }
    ],
    sections: [
      {
        id: "privacy_app",
        label: "Privacy & app",
        rows: [
          {
            id: "app:safety_privacy",
            title: "Safety & privacy",
            subtitle: "Policies and data controls",
            action: "navigate_safety"
          },
          {
            id: "app:chip:settings",
            title: "App settings",
            subtitle: "Theme, language, device",
            action: "navigate_settings"
          },
          {
            id: "app:connected",
            title: "Connected devices",
            subtitle: "Printers, KDS, displays",
            action: "navigate_section",
            sectionTitle: "Connected devices",
            sectionSubtitle: "Hardware pairing"
          }
        ]
      },
      {
        id: "platform",
        label: "Platform",
        rows: [
          {
            id: "app:sessions",
            title: "Session management",
            subtitle: "Active sessions and devices",
            action: "navigate_section",
            sectionTitle: "Session management",
            sectionSubtitle: "Devices signed in"
          },
          {
            id: "app:about",
            title: "About ServeOS",
            subtitle: "Platform version and legal",
            action: "navigate_section",
            sectionTitle: "About ServeOS",
            sectionSubtitle: "System information",
            last: true
          }
        ]
      }
    ]
  };
}

function buildAdminControlCentre(perms: Set<string>): {
  chips: ControlCentreChipManifest[];
  sections: ControlCentreSectionManifest[];
} {
  const restaurantRows: ControlCentreRowManifest[] = [];
  const add = (row: ControlCentreRowManifest, perm: string) => {
    if (perms.has(perm)) restaurantRows.push(row);
  };

  add(
    {
      id: "app:restaurant_profile",
      title: "Restaurant profile",
      subtitle: "Name, venue type, location",
      action: "navigate_section",
      sectionTitle: "Restaurant profile",
      sectionSubtitle: "Venue identity"
    },
    PERMS.admin.restaurantProfile
  );
  add(
    {
      id: "app:restaurant_settings",
      title: "Restaurant settings",
      subtitle: "Hours, policies, service rules",
      action: "navigate_section",
      sectionTitle: "Restaurant settings",
      sectionSubtitle: "Operational configuration"
    },
    PERMS.admin.restaurantSettings
  );
  add(
    {
      id: "app:dashboard",
      title: "Business dashboard",
      subtitle: "Owner and manager overview",
      action: "navigate_section",
      sectionTitle: "Business dashboard",
      sectionSubtitle: "Web admin and analytics"
    },
    PERMS.admin.dashboard
  );
  add(
    {
      id: "app:revenue",
      title: "Revenue overview",
      subtitle: "Sales and trends",
      action: "navigate_section",
      sectionTitle: "Revenue overview",
      sectionSubtitle: "Financial snapshot"
    },
    PERMS.admin.revenue
  );
  add(
    {
      id: "app:analytics",
      title: "Analytics",
      subtitle: "Performance insights",
      action: "navigate_section",
      sectionTitle: "Analytics",
      sectionSubtitle: "Reports and KPIs"
    },
    PERMS.admin.analytics
  );
  add(
    {
      id: "app:hours",
      title: "Opening hours",
      subtitle: "Service windows",
      action: "navigate_section",
      sectionTitle: "Opening hours",
      sectionSubtitle: "Weekly schedule"
    },
    PERMS.admin.hours
  );
  add(
    {
      id: "app:reservations_mgmt",
      title: "Reservation management",
      subtitle: "Bookings and holds",
      action: "navigate_section",
      sectionTitle: "Reservation management",
      sectionSubtitle: "Floor plan bookings"
    },
    PERMS.admin.reservations
  );
  add(
    {
      id: "app:tables",
      title: "Table management",
      subtitle: "Sections and capacity",
      action: "navigate_section",
      sectionTitle: "Table management",
      sectionSubtitle: "Layout and assignments"
    },
    PERMS.admin.tables
  );
  add(
    {
      id: "app:menu",
      title: "Menu management",
      subtitle: "Categories and items",
      action: "navigate_section",
      sectionTitle: "Menu management",
      sectionSubtitle: "Edit menu catalog"
    },
    PERMS.admin.menu
  );
  add(
    {
      id: "app:modifiers",
      title: "Modifier management",
      subtitle: "Options and groups",
      action: "navigate_section",
      sectionTitle: "Modifier management",
      sectionSubtitle: "Item customization"
    },
    PERMS.admin.modifiers
  );
  add(
    {
      id: "app:staff_mgmt",
      title: "Staff management",
      subtitle: "Team and invites",
      action: "navigate_section",
      sectionTitle: "Staff management",
      sectionSubtitle: "Roster and access"
    },
    PERMS.admin.staffMgmt
  );
  add(
    {
      id: "app:roles",
      title: "Roles & permissions",
      subtitle: "Who can do what",
      action: "navigate_section",
      sectionTitle: "Roles & permissions",
      sectionSubtitle: "Access control"
    },
    PERMS.admin.roles
  );
  add(
    {
      id: "app:devices",
      title: "Device management",
      subtitle: "KDS, printers, displays",
      action: "navigate_section",
      sectionTitle: "Device management",
      sectionSubtitle: "Hardware registry"
    },
    PERMS.admin.devices
  );
  add(
    {
      id: "app:kds",
      title: "KDS management",
      subtitle: "Kitchen display setup",
      action: "navigate_section",
      sectionTitle: "KDS management",
      sectionSubtitle: "Kitchen screens"
    },
    PERMS.admin.kds
  );
  add(
    {
      id: "app:checkout_mgmt",
      title: "Checkout management",
      subtitle: "POS and payment flow",
      action: "navigate_section",
      sectionTitle: "Checkout management",
      sectionSubtitle: "Front-of-house"
    },
    PERMS.admin.checkout
  );
  add(
    {
      id: "app:integrations",
      title: "Integrations",
      subtitle: "Stripe, Swish, partners",
      action: "navigate_section",
      sectionTitle: "Integrations",
      sectionSubtitle: "Payment and platform links"
    },
    PERMS.admin.integrations
  );
  add(
    {
      id: "app:payments",
      title: "Payment settings",
      subtitle: "Providers and payouts",
      action: "navigate_section",
      sectionTitle: "Payment settings",
      sectionSubtitle: "Billing configuration"
    },
    PERMS.admin.payments
  );
  add(
    {
      id: "app:billing",
      title: "Subscription & billing",
      subtitle: "Plan and invoices",
      action: "navigate_section",
      sectionTitle: "Subscription & billing",
      sectionSubtitle: "ServeOS plan"
    },
    PERMS.admin.billing
  );

  if (restaurantRows.length > 0) {
    restaurantRows[restaurantRows.length - 1]!.last = true;
  }

  const opsRows: ControlCentreRowManifest[] = [];
  const addOp = (row: ControlCentreRowManifest, perm: string) => {
    if (perms.has(perm)) opsRows.push(row);
  };
  addOp(
    {
      id: "app:live_orders",
      title: "Live orders",
      subtitle: "Active service queue",
      action: "navigate_screen",
      screenKey: "admin.live_orders",
      sectionTitle: "Live orders",
      sectionSubtitle: "Real-time operations"
    },
    PERMS.admin.liveOrders
  );
  addOp(
    {
      id: "app:kitchen_overview",
      title: "Kitchen overview",
      subtitle: "Prep and expo status",
      action: "navigate_section",
      sectionTitle: "Kitchen overview",
      sectionSubtitle: "Back-of-house"
    },
    PERMS.admin.kitchenOverview
  );
  addOp(
    {
      id: "app:alerts",
      title: "Operational alerts",
      subtitle: "Exceptions and SLA",
      action: "navigate_section",
      sectionTitle: "Operational alerts",
      sectionSubtitle: "Notifications hub"
    },
    PERMS.admin.alerts
  );
  if (opsRows.length > 0) opsRows[opsRows.length - 1]!.last = true;

  const platform = buildCustomerControlCentre();
  const sections: ControlCentreSectionManifest[] = [];
  if (restaurantRows.length) sections.push({ id: "restaurant", label: "Restaurant", rows: restaurantRows });
  if (opsRows.length) sections.push({ id: "operations", label: "Operations", rows: opsRows });
  sections.push(...platform.sections);

  return {
    chips: platform.chips,
    sections
  };
}

function buildStaffControlCentre(perms: Set<string>, flags: StaffCapabilityFlags): {
  chips: ControlCentreChipManifest[];
  sections: ControlCentreSectionManifest[];
} {
  const ops: ControlCentreRowManifest[] = [];
  const add = (row: ControlCentreRowManifest, ok: boolean) => {
    if (ok) ops.push(row);
  };

  add(
    {
      id: "app:assigned_orders",
      title: "Assigned orders",
      subtitle: "Your service queue",
      action: "navigate_screen",
      screenKey: "staff.assigned_orders",
      sectionTitle: "Assigned orders",
      sectionSubtitle: "Orders for your shift"
    },
    perms.has(PERMS.staff.assignedOrders)
  );
  add(
    {
      id: "app:shift",
      title: "Shift tools",
      subtitle: "Clock-in and handoff",
      action: "navigate_section",
      sectionTitle: "Shift tools",
      sectionSubtitle: "Shift workflow"
    },
    perms.has(PERMS.staff.shift)
  );
  add(
    {
      id: "app:staff_reservations",
      title: "Reservations",
      subtitle: "Today's bookings",
      action: "navigate_section",
      sectionTitle: "Reservations",
      sectionSubtitle: "Guest seating"
    },
    perms.has(PERMS.staff.reservations) && flags.reservations
  );
  add(
    {
      id: "app:staff_tables",
      title: "Tables",
      subtitle: "Floor and assignments",
      action: "navigate_section",
      sectionTitle: "Tables",
      sectionSubtitle: "Table status"
    },
    perms.has(PERMS.staff.tables) && flags.tables
  );
  add(
    {
      id: "app:staff_kitchen",
      title: "Kitchen tools",
      subtitle: "Prep and tickets",
      action: "navigate_section",
      sectionTitle: "Kitchen tools",
      sectionSubtitle: "Kitchen display"
    },
    perms.has(PERMS.staff.kitchen) && flags.kitchen
  );
  add(
    {
      id: "app:staff_checkout",
      title: "Checkout tools",
      subtitle: "Payments and close",
      action: "navigate_section",
      sectionTitle: "Checkout tools",
      sectionSubtitle: "Cashier functions"
    },
    perms.has(PERMS.staff.checkout) && flags.checkout
  );
  add(
    {
      id: "app:device_status",
      title: "Device status",
      subtitle: "Printers and KDS health",
      action: "navigate_section",
      sectionTitle: "Device status",
      sectionSubtitle: "Connected hardware"
    },
    perms.has(PERMS.staff.devices)
  );

  if (ops.length) ops[ops.length - 1]!.last = true;

  const shared = buildCustomerControlCentre();
  const sections: ControlCentreSectionManifest[] = [];
  if (ops.length) sections.push({ id: "operations", label: "Operations", rows: ops });
  sections.push(...shared.sections.filter((s) => s.id === "privacy_app" || s.id === "platform"));

  return { chips: shared.chips, sections };
}

function settingsForRole(roleType: MobileRoleType): {
  accountKeys: SettingsDetailKey[];
  generalKeys: SettingsDetailKey[];
} {
  const sharedGeneral: SettingsDetailKey[] = [
    "accessibility",
    "night_mode",
    "communication",
    "sounds_voice"
  ];
  if (roleType === "CUSTOMER") {
    return {
      accountKeys: ["manage_account", "privacy", "address"],
      generalKeys: [...sharedGeneral, "shortcuts", "navigation"]
    };
  }
  return {
    accountKeys: ["manage_account", "privacy"],
    generalKeys: sharedGeneral
  };
}

export function buildMobileExperienceManifest(input: {
  userRole: string;
  membershipRoles: string[];
  signupProfile: unknown;
}): MobileExperienceManifest {
  const roleStrings = [input.userRole, ...input.membershipRoles];
  const roleType = resolveMobileRoleType(roleStrings);
  const staffFlags = readStaffCapabilityFlags(input.signupProfile, input.membershipRoles);
  const permissions = permissionsForRoleType(roleType, staffFlags);
  const permSet = new Set(permissions);

  let meHubSections: MeHubSectionManifest[];
  let controlCentre: { chips: ControlCentreChipManifest[]; sections: ControlCentreSectionManifest[] };
  let showNotificationToggles: boolean;
  let showVenueLine: boolean;

  if (roleType === "CUSTOMER") {
    meHubSections = buildCustomerMeHub();
    controlCentre = buildCustomerControlCentre();
    showNotificationToggles = true;
    showVenueLine = true;
  } else if (roleType === "ADMIN") {
    meHubSections = buildStaffAdminMeHub("ADMIN");
    controlCentre = buildAdminControlCentre(permSet);
    showNotificationToggles = false;
    showVenueLine = false;
  } else {
    meHubSections = buildStaffAdminMeHub("STAFF");
    controlCentre = buildStaffControlCentre(permSet, staffFlags);
    showNotificationToggles = false;
    showVenueLine = false;
  }

  const settings = settingsForRole(roleType);

  const screens = screenKeysForManifest(roleType, permissions);
  const enrichedControl = {
    ...controlCentre,
    sections: enrichSectionsWithScreens(controlCentre.sections, permissions)
  };
  const enrichedMe = {
    sections: enrichSectionsWithScreens(meHubSections, permissions)
  };

  return {
    roleType,
    permissions,
    screens,
    tabScreens: tabScreensForRole(roleType, permSet, staffFlags),
    tabs: tabsForRole(roleType),
    meHub: {
      sections: enrichedMe.sections,
      showNotificationToggles,
      showVenueLine
    },
    controlCentre: {
      ...enrichedControl,
      showDarkModeToggle: permSet.has(PERMS.shared.theme)
    },
    settings
  };
}

function enrichSectionsWithScreens<T extends { id: string; rows: Array<{ id: string; action: string; title: string; subtitle: string; sectionTitle?: string; sectionSubtitle?: string; screenKey?: string }> }>(
  sections: T[],
  permissions: string[]
): T[] {
  return sections.map((section) => ({
    ...section,
    rows: section.rows.map((row) => enrichRowWithScreen(row, permissions))
  }));
}

function enrichRowWithScreen<
  T extends { id: string; action: string; title: string; subtitle: string; sectionTitle?: string; sectionSubtitle?: string; screenKey?: string }
>(row: T, permissions: string[]): T {
  const screenKey = row.screenKey ?? resolveScreenKeyForRow(row.id);
  if (!screenKey) return row;
  const def = WORKSPACE_SCREENS[screenKey];
  if (!def || !permissions.includes(def.permission)) return row;
  if (row.action === "sign_out" || row.action === "open_reservations" || row.action === "open_orders" || row.action === "open_review" || row.action === "open_support" || row.action === "choose_venue") {
    return row;
  }
  return {
    ...row,
    screenKey,
    title: row.title || def.title,
    subtitle: row.subtitle || def.subtitle,
    sectionTitle: def.title,
    sectionSubtitle: def.subtitle,
    action: def.status === "live" ? "navigate_screen" : "navigate_section"
  } as T;
}

export function userHasPermission(manifest: MobileExperienceManifest | null | undefined, perm: string): boolean {
  return !!manifest?.permissions.includes(perm);
}
