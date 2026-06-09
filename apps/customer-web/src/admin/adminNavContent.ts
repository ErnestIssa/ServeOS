export type AdminNavItem = {
  id: string;
  label: string;
  href: string;
  description?: string;
};

export type AdminNavGroup = {
  id: string;
  label: string;
  /** Public icon path under /icons */
  icon: string;
  items: AdminNavItem[];
};

export const ADMIN_NAV_GROUPS: AdminNavGroup[] = [
  {
    id: "control-room",
    label: "CONTROL",
    icon: "/icons/settings.png",
    items: [
      { id: "live-overview", label: "Live overview", href: "#control-room", description: "Mission control dashboard" },
      { id: "live-orders", label: "Live orders", href: "#orders", description: "KDS + orders unified" },
      { id: "table-status", label: "Table status", href: "#operations-tables" },
      { id: "active-reservations", label: "Active reservations", href: "#operations-reservations" },
      { id: "live-alerts", label: "Live alerts", href: "#control-alerts" },
      { id: "staff-on-shift", label: "Staff on shift", href: "#control-staff" }
    ]
  },
  {
    id: "orders-system",
    label: "ORDERS",
    icon: "/icons/checkout.png",
    items: [
      { id: "all-orders", label: "All orders", href: "#orders" },
      { id: "active-orders", label: "Active orders", href: "#orders" },
      { id: "kitchen-view", label: "Kitchen view", href: "#orders", description: "KDS mode" },
      { id: "completed-orders", label: "Completed orders", href: "#orders-history" },
      { id: "order-history", label: "Order history", href: "#orders-history" }
    ]
  },
  {
    id: "operations",
    label: "Operations",
    icon: "/icons/system-update.png",
    items: [
      { id: "reservations", label: "Reservations", href: "#operations-reservations" },
      { id: "tables", label: "Tables / seating", href: "#operations-tables" },
      { id: "walk-ins", label: "Walk-ins", href: "#operations-walkins" },
      { id: "queue", label: "Queue / waiting list", href: "#operations-queue" },
      { id: "venue-timeline", label: "Venue timeline", href: "#operations-timeline" }
    ]
  },
  {
    id: "devices-hardware",
    label: "DEVICES",
    icon: "/icons/responsive.png",
    items: [
      { id: "all-devices", label: "All connected devices", href: "#devices-all" },
      { id: "kds-status", label: "KDS screens status", href: "#devices-kds" },
      { id: "pos-checkout", label: "POS / checkout devices", href: "#devices-pos" },
      { id: "customer-displays", label: "Customer display screens", href: "#devices-customer-display" },
      { id: "printer-status", label: "Printer status", href: "#devices-printers" },
      { id: "network-health", label: "Network health per venue", href: "#devices-network" }
    ]
  },
  {
    id: "communication-hub",
    label: "Communication hub",
    icon: "/icons/notification-bell-on-svgrepo-com.svg",
    items: [
      { id: "order-chats", label: "Order chats", href: "#comms-order-chats", description: "Inside orders" },
      { id: "staff-internal-chat", label: "Staff internal chat", href: "#comms-staff-chat" },
      { id: "customer-inbox", label: "Customer messaging inbox", href: "#comms-customer-inbox" },
      { id: "system-messages", label: "System messages", href: "#comms-system-messages", description: "Alerts & warnings" }
    ]
  },
  {
    id: "automations",
    label: "Automations",
    icon: "/icons/curved-arrows-svgrepo-com.svg",
    items: [
      { id: "auto-accept", label: "Auto-accept orders rules", href: "#automation-auto-accept" },
      { id: "kitchen-routing", label: "Auto-route orders to kitchen stations", href: "#automation-kitchen-routing" },
      { id: "auto-close", label: "Auto-close orders after payment", href: "#automation-auto-close" },
      { id: "delay-notify", label: "Auto-notify delayed orders", href: "#automation-delay-notify" },
      { id: "table-assign", label: "Auto-assign tables for reservations", href: "#automation-table-assign" }
    ]
  },
  {
    id: "configuration",
    label: "Configuration",
    icon: "/icons/configuration-svgrepo-com.svg",
    items: [
      { id: "restaurant-profile", label: "Restaurant profile", href: "#config-restaurant" },
      { id: "locations", label: "Locations", href: "#config-locations" },
      { id: "menu-builder", label: "Menu builder", href: "#menu-admin" },
      { id: "categories", label: "Categories", href: "#menu-admin" },
      { id: "items", label: "Items", href: "#menu-admin" },
      { id: "modifiers", label: "Modifiers", href: "#menu-admin" },
      { id: "staff-list", label: "Staff list", href: "#config-staff" },
      { id: "roles", label: "Roles & permissions", href: "#config-roles" },
      { id: "payment-methods", label: "Payment methods", href: "#config-payments" }
    ]
  },
  {
    id: "business-settings",
    label: "BUSINESS",
    icon: "/icons/company-svgrepo-com.svg",
    items: [
      { id: "subscription-billing", label: "Subscription & billing", href: "#business-billing" },
      { id: "legal-entity", label: "Legal entity / company info", href: "#business-legal-entity" },
      { id: "multi-location-rules", label: "Multi-location switching rules", href: "#business-multi-location" },
      { id: "data-export", label: "Data export", href: "#business-data-export" },
      { id: "audit-logs", label: "Audit logs", href: "#business-audit-logs" }
    ]
  },
  {
    id: "insights",
    label: "Insights",
    icon: "/icons/insights-svgrepo-com.svg",
    items: [
      { id: "sales-overview", label: "Sales overview", href: "#insights-sales" },
      { id: "order-speed", label: "Order speed", href: "#insights-speed" },
      { id: "peak-times", label: "Peak times", href: "#insights-peaks" },
      { id: "best-sellers", label: "Best selling items", href: "#insights-items" },
      { id: "staff-performance", label: "Staff performance", href: "#insights-staff" }
    ]
  }
];

export const ADMIN_QUICK_ACTIONS = [
  { id: "create-order", label: "Create order", href: "#orders" },
  { id: "add-reservation", label: "Add reservation", href: "#operations-reservations" },
  { id: "add-staff", label: "Add staff", href: "#config-staff" }
] as const;

export const ADMIN_THEME_ICONS = {
  dark: "/icons/themes (1).png",
  light: "/icons/light-mode-svgrepo-com.svg"
} as const;

export const ADMIN_TOP_ICONS = {
  menu: "/icons/menu.png",
  billing: "/icons/pay-svgrepo-com.svg",
  notifications: "/icons/notification-bell-on-svgrepo-com.svg",
  addUser: "/icons/user-add-account-profile-svgrepo-com.svg",
  help: "/icons/question-svgrepo-com.svg"
} as const;

export const ADMIN_TOP_TOOL_HINTS = {
  help: {
    title: "Platform help",
    description: "Guides, FAQs, and self-serve support outside live chat.",
    cta: "Get help"
  },
  addUser: {
    title: "Add staff",
    description: "Invite team members and configure roles.",
    cta: "Manage staff"
  },
  notifications: {
    title: "Notifications",
    description: "System alerts and venue-wide updates.",
    cta: "View alerts"
  },
  billing: {
    title: "Billing",
    description: "Payment methods, invoices, and payouts.",
    cta: "Open billing"
  },
  quickActions: {
    title: "Quick actions",
    description: "Create records without leaving your workspace.",
    kicker: "Create"
  },
  profile: {
    title: "Your account",
    description: "Profile, settings, and session."
  }
} as const;

/** Contact person from owner signup / registration profile; fallback "Owner". */
export function readOwnerContactName(signupProfile: unknown): string {
  if (signupProfile && typeof signupProfile === "object" && !Array.isArray(signupProfile)) {
    const root = signupProfile as Record<string, unknown>;
    const reg = root.registrationProfile;
    if (reg && typeof reg === "object" && !Array.isArray(reg)) {
      const contact = (reg as { contactPerson?: string }).contactPerson?.trim();
      if (contact) return contact;
      const fullName = (reg as { fullName?: string }).fullName?.trim();
      if (fullName) return fullName;
    }
    const first = String(root.firstName ?? "").trim();
    const last = String(root.lastName ?? "").trim();
    if (first || last) return [first, last].filter(Boolean).join(" ");
    if (typeof root.contactPerson === "string" && root.contactPerson.trim()) {
      return root.contactPerson.trim();
    }
  }
  return "Owner";
}

const SIDEBAR_PIN_KEY = "serveos.admin.sidebarPinned";
const THEME_KEY = "serveos.admin.theme";

export type AdminTheme = "light" | "dark";

export function readAdminHash(): string {
  if (typeof window === "undefined") return "#control-room";
  return window.location.hash || "#control-room";
}

export function readSidebarPinned(): boolean {
  try {
    return localStorage.getItem(SIDEBAR_PIN_KEY) === "1";
  } catch {
    return false;
  }
}

export function writeSidebarPinned(pinned: boolean) {
  try {
    localStorage.setItem(SIDEBAR_PIN_KEY, pinned ? "1" : "0");
  } catch {
    /* ignore */
  }
}

export function readAdminTheme(): AdminTheme {
  try {
    const v = localStorage.getItem(THEME_KEY);
    return v === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
}

export function writeAdminTheme(theme: AdminTheme) {
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    /* ignore */
  }
}

export function defaultGroupHref(group: AdminNavGroup): string {
  return group.items[0]?.href ?? "#control-room";
}
