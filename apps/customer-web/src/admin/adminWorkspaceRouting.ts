import { isAdminFullPageHash } from "./adminTopHashes";

export type WorkspaceId =
  | "live-ops"
  | "orders"
  | "venue"
  | "devices"
  | "comms"
  | "automations"
  | "config"
  | "business"
  | "analytics";

export const DEFAULT_ADMIN_HASH = "#ws-live-ops/live-overview";

export type AdminRoute =
  | { kind: "workspace"; workspaceId: WorkspaceId; presetId: string }
  | { kind: "full-page"; hash: string };

export type WorkspacePreset = {
  id: string;
  label: string;
  tab: string;
  filter?: string;
  layout?: string;
  description?: string;
};

export function buildNavHref(workspaceId: WorkspaceId, presetId: string): string {
  return `#ws-${workspaceId}/${presetId}`;
}

export function parseAdminRoute(hash: string): AdminRoute {
  const normalized = (hash || DEFAULT_ADMIN_HASH).split("?")[0]!;
  if (isAdminFullPageHash(normalized)) {
    return { kind: "full-page", hash: normalized };
  }
  const match = normalized.match(/^#ws-([a-z-]+)\/([^/]+)$/);
  if (match) {
    return {
      kind: "workspace",
      workspaceId: match[1] as WorkspaceId,
      presetId: match[2]!
    };
  }
  return legacyHashToRoute(normalized);
}

function legacyHashToRoute(hash: string): AdminRoute {
  const legacy: Record<string, AdminRoute> = {
    "#control-room": { kind: "workspace", workspaceId: "live-ops", presetId: "live-overview" },
    "#orders": { kind: "workspace", workspaceId: "orders", presetId: "all-orders" },
    "#menu-admin": { kind: "workspace", workspaceId: "config", presetId: "menu-builder" },
    "#top-billing": { kind: "full-page", hash: "#top-billing" },
    "#venue-control-centre": { kind: "full-page", hash: "#venue-control-centre" }
  };
  return legacy[hash] ?? { kind: "workspace", workspaceId: "live-ops", presetId: "live-overview" };
}

export function adminRouteKey(route: AdminRoute): string {
  if (route.kind === "full-page") return route.hash;
  return `#ws-${route.workspaceId}/${route.presetId}`;
}

export const ADMIN_NAV_SYNC_EVENT = "serveos:admin-nav-sync";

/** Update the URL and sidebar active state without a full page transition. */
export function syncAdminNavHash(href: string) {
  if (typeof window === "undefined") return;
  const next = href.startsWith("#") ? href : `#${href}`;
  if (window.location.hash === next) return;
  const url = `${window.location.pathname}${window.location.search}${next}`;
  window.history.replaceState(null, "", url);
  window.dispatchEvent(new CustomEvent(ADMIN_NAV_SYNC_EVENT, { detail: { hash: next } }));
}

export function isWorkspaceRoute(route: AdminRoute): route is Extract<AdminRoute, { kind: "workspace" }> {
  return route.kind === "workspace";
}

export const GROUP_WORKSPACE_MAP: Record<string, WorkspaceId> = {
  "control-room": "live-ops",
  "orders-system": "orders",
  operations: "venue",
  "devices-hardware": "devices",
  "communication-hub": "comms",
  automations: "automations",
  configuration: "config",
  "business-settings": "business",
  insights: "analytics"
};

export function findNavItemByPreset(presetId: string): { groupId: string; workspaceId: WorkspaceId } | null {
  for (const [groupId, workspaceId] of Object.entries(GROUP_WORKSPACE_MAP)) {
    const presets = WORKSPACE_PRESETS[workspaceId];
    if (presets.some((p) => p.id === presetId)) {
      return { groupId, workspaceId };
    }
  }
  return null;
}

export const WORKSPACE_META: Record<
  WorkspaceId,
  { title: string; eyebrow: string; description: string; icon?: string }
> = {
  "live-ops": {
    eyebrow: "Control",
    title: "LiveOps workspace",
    description: "One mission-control surface — nav items switch tab, filter, and layout mode.",
    icon: "/icons/settings.png"
  },
  orders: {
    eyebrow: "Orders",
    title: "Orders workspace",
    description: "Unified order lifecycle — perspectives change view mode, not the engine.",
    icon: "/icons/checkout.png"
  },
  venue: {
    eyebrow: "Operations",
    title: "Venue workspace",
    description: "Floor, reservations, queue, and timeline in one venue operating canvas.",
    icon: "/icons/system-update.png"
  },
  devices: {
    eyebrow: "Devices",
    title: "Devices workspace",
    description: "Hardware health monitors — filters by device class and venue.",
    icon: "/icons/responsive.png"
  },
  comms: {
    eyebrow: "Communication",
    title: "Communication workspace",
    description: "Chats and inboxes — scope changes per nav item, same hub.",
    icon: "/icons/notification-bell-on-svgrepo-com.svg"
  },
  automations: {
    eyebrow: "Automations",
    title: "Automations workspace",
    description: "Rules and routing — each item opens a rule family in the same builder.",
    icon: "/icons/curved-arrows-svgrepo-com.svg"
  },
  config: {
    eyebrow: "Configuration",
    title: "Config workspace",
    description: "Restaurant builder — sections are tabs inside one admin configuration system.",
    icon: "/icons/configuration-svgrepo-com.svg"
  },
  business: {
    eyebrow: "Business",
    title: "Business workspace",
    description: "Billing, legal, exports, and audit — one business admin surface.",
    icon: "/icons/company-svgrepo-com.svg"
  },
  analytics: {
    eyebrow: "Insights",
    title: "Analytics workspace",
    description: "Metrics and charts — nav items switch chart presets and KPI groups.",
    icon: "/icons/insights-svgrepo-com.svg"
  }
};

export const WORKSPACE_PRESETS: Record<WorkspaceId, WorkspacePreset[]> = {
  "live-ops": [
    { id: "live-overview", label: "Live overview", tab: "overview", description: "Mission control dashboard" },
    { id: "live-orders", label: "Live orders", tab: "orders", filter: "active", description: "KDS + orders unified" },
    { id: "table-status", label: "Table status", tab: "tables", layout: "floor-focus" },
    { id: "active-reservations", label: "Active reservations", tab: "reservations", filter: "active" },
    { id: "live-alerts", label: "Live alerts", tab: "alerts", layout: "panel-open" },
    { id: "staff-on-shift", label: "Staff on shift", tab: "staff", filter: "on-shift" }
  ],
  orders: [
    { id: "all-orders", label: "All orders", tab: "board", filter: "all" },
    { id: "active-orders", label: "Active orders", tab: "board", filter: "active" },
    { id: "kitchen-view", label: "Kitchen view", tab: "kds", layout: "kds-full", description: "KDS mode" },
    {
      id: "problem-orders",
      label: "Problem orders",
      tab: "board",
      filter: "problems",
      description: "Delays, refunds, and failures"
    },
    { id: "completed-orders", label: "Completed orders", tab: "board", filter: "completed" },
    { id: "order-history", label: "Order history", tab: "timeline", layout: "history" }
  ],
  venue: [
    { id: "reservations", label: "Reservations", tab: "reservations" },
    { id: "tables", label: "Tables / seating", tab: "tables", layout: "seating-map" },
    { id: "walk-ins", label: "Walk-ins", tab: "walk-ins" },
    { id: "queue", label: "Queue / waiting list", tab: "queue" },
    { id: "venue-timeline", label: "Venue timeline", tab: "timeline", layout: "day-view" }
  ],
  devices: [
    { id: "all-devices", label: "All connected devices", tab: "all", filter: "all" },
    { id: "kds-status", label: "KDS screens status", tab: "monitors", filter: "kds" },
    { id: "pos-checkout", label: "POS / checkout devices", tab: "monitors", filter: "pos" },
    { id: "customer-displays", label: "Customer display screens", tab: "monitors", filter: "customer-display" },
    { id: "printer-status", label: "Printer status", tab: "monitors", filter: "printers" },
    { id: "network-health", label: "Network health per venue", tab: "network", layout: "venue-matrix" }
  ],
  comms: [
    { id: "order-chats", label: "Order chats", tab: "inbox", filter: "order", description: "Inside orders" },
    { id: "staff-internal-chat", label: "Staff internal chat", tab: "inbox", filter: "staff" },
    { id: "customer-inbox", label: "Customer messaging inbox", tab: "inbox", filter: "customer" },
    { id: "system-messages", label: "System messages", tab: "inbox", filter: "system", description: "Alerts & warnings" }
  ],
  automations: [
    { id: "auto-accept", label: "Auto-accept orders rules", tab: "rules", filter: "auto-accept" },
    { id: "kitchen-routing", label: "Auto-route orders to kitchen stations", tab: "rules", filter: "kitchen-routing" },
    { id: "auto-close", label: "Auto-close orders after payment", tab: "rules", filter: "auto-close" },
    { id: "delay-notify", label: "Auto-notify delayed orders", tab: "rules", filter: "delay-notify" },
    { id: "table-assign", label: "Auto-assign tables for reservations", tab: "rules", filter: "table-assign" }
  ],
  config: [
    { id: "restaurant-profile", label: "Restaurant profile", tab: "profile" },
    { id: "locations", label: "Locations", tab: "locations" },
    { id: "menu-builder", label: "Menu builder", tab: "menu", layout: "builder" },
    { id: "categories", label: "Categories", tab: "menu", filter: "categories" },
    { id: "items", label: "Items", tab: "menu", filter: "items" },
    { id: "modifiers", label: "Modifiers", tab: "menu", filter: "modifiers" },
    { id: "staff-list", label: "Staff list", tab: "staff" },
    { id: "roles", label: "Roles & permissions", tab: "roles" },
    { id: "payment-methods", label: "Payment methods", tab: "payments" }
  ],
  business: [
    { id: "subscription-billing", label: "Subscription & billing", tab: "billing" },
    { id: "legal-entity", label: "Legal entity / company info", tab: "legal" },
    { id: "multi-location-rules", label: "Multi-location switching rules", tab: "locations" },
    { id: "data-export", label: "Data export", tab: "export" },
    { id: "audit-logs", label: "Audit logs", tab: "audit" }
  ],
  analytics: [
    { id: "sales-overview", label: "Sales overview", tab: "sales", layout: "overview" },
    { id: "order-speed", label: "Order speed", tab: "operations", filter: "speed" },
    { id: "peak-times", label: "Peak times", tab: "operations", filter: "peaks" },
    { id: "best-sellers", label: "Best selling items", tab: "menu", filter: "top-items" },
    { id: "staff-performance", label: "Staff performance", tab: "staff", filter: "performance" }
  ]
};

export function resolveWorkspacePreset(workspaceId: WorkspaceId, presetId: string): WorkspacePreset {
  const presets = WORKSPACE_PRESETS[workspaceId];
  return presets.find((p) => p.id === presetId) ?? presets[0]!;
}
