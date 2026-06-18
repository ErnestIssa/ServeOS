import {
  buildNavHref,
  DEFAULT_ADMIN_HASH,
  GROUP_WORKSPACE_MAP,
  WORKSPACE_PRESETS,
  type WorkspaceId
} from "./adminWorkspaceRouting";

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
  workspaceId: WorkspaceId;
  items: AdminNavItem[];
};

const GROUP_DEFS: Array<{ id: string; label: string; icon: string; workspaceId: WorkspaceId }> = [
  { id: "control-room", label: "CONTROL", icon: "/icons/settings.png", workspaceId: "live-ops" },
  { id: "orders-system", label: "ORDERS", icon: "/icons/checkout.png", workspaceId: "orders" },
  { id: "operations", label: "Operations", icon: "/icons/system-update.png", workspaceId: "venue" },
  { id: "devices-hardware", label: "DEVICES", icon: "/icons/responsive.png", workspaceId: "devices" },
  {
    id: "communication-hub",
    label: "Communication hub",
    icon: "/icons/notification-bell-on-svgrepo-com.svg",
    workspaceId: "comms"
  },
  { id: "automations", label: "Automations", icon: "/icons/curved-arrows-svgrepo-com.svg", workspaceId: "automations" },
  { id: "configuration", label: "Configuration", icon: "/icons/configuration-svgrepo-com.svg", workspaceId: "config" },
  { id: "business-settings", label: "BUSINESS", icon: "/icons/company-svgrepo-com.svg", workspaceId: "business" },
  { id: "insights", label: "Insights", icon: "/icons/insights-svgrepo-com.svg", workspaceId: "analytics" }
];

export const ADMIN_NAV_GROUPS: AdminNavGroup[] = GROUP_DEFS.map((group) => ({
  id: group.id,
  label: group.label,
  icon: group.icon,
  workspaceId: group.workspaceId,
  items: WORKSPACE_PRESETS[group.workspaceId].map((preset) => ({
    id: preset.id,
    label: preset.label,
    description: preset.description,
    href: buildNavHref(group.workspaceId, preset.id)
  }))
}));

export { GROUP_WORKSPACE_MAP };

export {
  ADMIN_TOP_HASHES,
  ADMIN_VENUE_CONTROL_HASH,
  adminFullPageKey,
  isAdminFullPageHash,
  isAdminTopPageHash,
  type AdminTopHash
} from "./adminTopHashes";

export { DEFAULT_ADMIN_HASH } from "./adminWorkspaceRouting";

export const ADMIN_QUICK_ACTIONS = [
  { id: "create-order", label: "Create order", href: buildNavHref("orders", "active-orders") },
  { id: "add-reservation", label: "Add reservation", href: buildNavHref("venue", "reservations") },
  { id: "add-staff", label: "Staff management", href: "#top-add-staff" }
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
    title: "Staff management",
    description: "Workforce, roles, shifts, and live status.",
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
    title: "Your account"
  }
} as const;

/** Person display name from profile — never use role or raw email as identity. */
function isEmailLike(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function pickPersonName(value?: string | null): string | null {
  const trimmed = value?.trim();
  if (!trimmed || isEmailLike(trimmed)) return null;
  return trimmed;
}

export function readUserDisplayName(input: {
  displayName?: string | null;
  fullName?: string | null;
  accountFullName?: string | null;
  email?: string | null;
  signupProfile?: unknown;
}): string {
  const fromDisplay = pickPersonName(input.displayName);
  if (fromDisplay) return fromDisplay;
  const fromFull = pickPersonName(input.fullName);
  if (fromFull) return fromFull;
  const fromAccount = pickPersonName(input.accountFullName);
  if (fromAccount) return fromAccount;
  if (input.signupProfile && typeof input.signupProfile === "object" && !Array.isArray(input.signupProfile)) {
    const root = input.signupProfile as Record<string, unknown>;
    const reg = root.registrationProfile;
    if (reg && typeof reg === "object" && !Array.isArray(reg)) {
      const contact = (reg as { contactPerson?: string }).contactPerson?.trim();
      if (contact) return contact;
      const fullName = (reg as { fullName?: string }).fullName?.trim();
      if (fullName) return fullName;
    }
    const direct = root.fullName;
    if (typeof direct === "string" && direct.trim()) return direct.trim();
    const first = String(root.firstName ?? "").trim();
    const last = String(root.lastName ?? "").trim();
    if (first || last) return [first, last].filter(Boolean).join(" ");
  }
  if (input.email?.trim()) {
    const local = input.email.split("@")[0] ?? "";
    if (local) {
      return local
        .replace(/[._-]+/g, " ")
        .split(/\s+/)
        .filter(Boolean)
        .map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
        .join(" ");
    }
  }
  return "ServeOS user";
}

/** @deprecated Use readUserDisplayName */
export function readOwnerContactName(signupProfile: unknown): string {
  return readUserDisplayName({ signupProfile });
}

const SIDEBAR_PIN_KEY = "serveos.admin.sidebarPinned";
const THEME_KEY = "serveos.admin.theme";

export type AdminTheme = "light" | "dark";

export function readAdminHash(): string {
  if (typeof window === "undefined") return DEFAULT_ADMIN_HASH;
  return window.location.hash || DEFAULT_ADMIN_HASH;
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
  return group.items[0]?.href ?? DEFAULT_ADMIN_HASH;
}
