import type { MenuListQueryPreset } from "../menu/menuListQuery";
import type { PaymentMethodCatalogEntry, PaymentMethodGroup } from "./paymentMethodCatalog";
import type {
  PaymentMethodConfig,
  PaymentMethodReadiness,
  VenuePaymentMethodCapability,
  VenuePaymentSettings
} from "../../../api";

export type PaymentMethodHealth =
  | "active"
  | "inactive"
  | "pending"
  | "issue"
  | "setup"
  | "ready"
  | "disconnected";

export type PaymentMethodListRow = PaymentMethodCatalogEntry & {
  enabled: boolean;
  isDefault: boolean;
  health: PaymentMethodHealth;
  config: PaymentMethodConfig;
  statusLabel: string;
  channelLabel: string;
  supportLabel: string;
  readiness?: PaymentMethodReadiness;
  canEnable?: boolean;
  setupReason?: string;
};

export function resolvePaymentMethodHealth(
  settings: VenuePaymentSettings,
  config: PaymentMethodConfig
): PaymentMethodHealth {
  if (!config.enabled) return "inactive";

  const provider = config.provider ?? "none";
  const stripe = settings.providers?.stripe;
  const swish = settings.providers?.swish;

  if (provider === "stripe" || provider === "terminal") {
    if (!stripe?.connected) return "issue";
    if (stripe.environment === "sandbox") return "pending";
  }
  if (provider === "swish") {
    if (!swish?.connected) return "issue";
    if (swish.environment === "sandbox") return "pending";
  }

  if (!(config.supportedOrderSources?.length)) return "issue";
  if (config.requiresStaffConfirmation && !(config.allowedRoles?.length)) return "issue";
  if (config.requiresReference && !(config.instructionsStaff ?? "").trim()) return "pending";
  if (config.reconciliationMode === "required" && provider === "manual" && !config.requiresStaffConfirmation) {
    return "pending";
  }

  return "active";
}

export function paymentMethodHealthLabel(health: PaymentMethodHealth, isDefault = false) {
  if (health === "inactive") return "Off";
  if (health === "setup") return "Set up";
  if (health === "ready") return "Ready to enable";
  if (health === "pending") return "Pending";
  if (health === "issue") return "Issue";
  if (health === "disconnected") return "Disconnected";
  return isDefault ? "Default" : "Active";
}

export function healthFromReadiness(readiness: PaymentMethodReadiness | undefined, fallback: PaymentMethodHealth) {
  if (!readiness) return fallback;
  return readiness.uiHealth as PaymentMethodHealth;
}

export function applyServerMethodCapability(
  row: PaymentMethodListRow,
  capability: VenuePaymentMethodCapability | undefined
): PaymentMethodListRow {
  if (!capability?.readiness) return row;
  const readiness = capability.readiness;
  return {
    ...row,
    enabled: capability.enabled,
    isDefault: capability.isDefault,
    health: readiness.uiHealth as PaymentMethodHealth,
    statusLabel: readiness.statusLabel,
    readiness,
    canEnable: readiness.canEnable,
    setupReason: readiness.reason
  };
}

export function paymentMethodHealthBadgeClass(health: PaymentMethodHealth) {
  if (health === "active" || health === "ready") return "is-ok";
  if (health === "pending" || health === "setup") return "is-warning";
  if (health === "issue" || health === "disconnected") return "is-critical";
  return "is-muted";
}

export const PAYMENT_METHODS_LIST_QUERY: MenuListQueryPreset = {
  defaultSort: "priority_asc",
  filterGroups: [
    {
      id: "status",
      label: "Status",
      options: [
        { id: "status:on", label: "Enabled", description: "Currently accepting this method" },
        { id: "status:off", label: "Disabled", description: "Not available at this venue" },
        { id: "status:pending", label: "Pending", description: "On, but still needs setup" },
        { id: "status:issue", label: "Issue", description: "On, but blocked or misconfigured" },
        { id: "status:default", label: "Default", description: "Venue default method" }
      ]
    },
    {
      id: "channel",
      label: "Channel",
      options: [
        { id: "channel:online", label: "Online / app", description: "QR and mobile checkout" },
        { id: "channel:venue", label: "Pay at venue", description: "In-restaurant settlement" },
        { id: "channel:business", label: "Business", description: "Invoice and B2B" }
      ]
    },
    {
      id: "rails",
      label: "Rails",
      options: [
        { id: "rails:card", label: "Card / wallet", description: "Card acquiring family" },
        { id: "rails:swish", label: "Swish", description: "Swish rails" },
        { id: "rails:klarna", label: "Klarna", description: "BNPL rails" },
        { id: "rails:terminal", label: "Terminal", description: "In-person terminal" },
        { id: "rails:cash", label: "Cash", description: "Cash settlement" },
        { id: "rails:other", label: "Other", description: "Gift, bank, invoice, external" }
      ]
    }
  ],
  sortOptions: [
    { id: "priority_asc", label: "Priority", description: "Default sort for venue ops" },
    { id: "name_asc", label: "Name A–Z" },
    { id: "name_desc", label: "Name Z–A" },
    { id: "status_on_first", label: "Enabled first" },
    { id: "channel_asc", label: "Channel" }
  ]
};

export function matchesPaymentMethodSearch(row: PaymentMethodListRow, query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const hay = [
    row.label,
    row.family,
    row.hint,
    row.group,
    row.rails,
    row.config.displayName,
    row.channelLabel,
    row.supportLabel,
    row.statusLabel
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return hay.includes(q);
}

function filterMatch(row: PaymentMethodListRow, id: string) {
  if (id === "status:on") return row.enabled;
  if (id === "status:off") return !row.enabled;
  if (id === "status:pending") return row.health === "pending";
  if (id === "status:issue") return row.health === "issue";
  if (id === "status:default") return row.isDefault;
  if (id.startsWith("channel:")) return row.group === (id.slice("channel:".length) as PaymentMethodGroup);
  if (id === "rails:card") return row.rails === "card";
  if (id === "rails:swish") return row.rails === "swish";
  if (id === "rails:klarna") return row.rails === "klarna";
  if (id === "rails:terminal") return row.rails === "terminal";
  if (id === "rails:cash") return row.rails === "cash";
  if (id === "rails:other") return ["invoice", "bank", "gift", "external"].includes(row.rails);
  return false;
}

export function applyPaymentMethodFilters(rows: PaymentMethodListRow[], active: string[]) {
  if (!active.length) return rows;
  const groups = PAYMENT_METHODS_LIST_QUERY.filterGroups;
  return rows.filter((row) => {
    for (const group of groups) {
      const selected = group.options.map((o) => o.id).filter((id) => active.includes(id));
      if (!selected.length) continue;
      if (!selected.some((id) => filterMatch(row, id))) return false;
    }
    return true;
  });
}

export function applyPaymentMethodSort(rows: PaymentMethodListRow[], sortId: string | null) {
  const id = sortId || PAYMENT_METHODS_LIST_QUERY.defaultSort;
  const next = [...rows];
  next.sort((a, b) => {
    if (id === "name_asc") return a.label.localeCompare(b.label);
    if (id === "name_desc") return b.label.localeCompare(a.label);
    if (id === "status_on_first") return Number(b.enabled) - Number(a.enabled) || a.label.localeCompare(b.label);
    if (id === "channel_asc") return a.group.localeCompare(b.group) || a.label.localeCompare(b.label);
    const pa = a.config.priority ?? 100;
    const pb = b.config.priority ?? 100;
    return pa - pb || a.label.localeCompare(b.label);
  });
  return next;
}

/** Filter by catalog family chip (`all` = every family). */
export function applyPaymentMethodFamilyFilter(
  rows: PaymentMethodListRow[],
  family: string
): PaymentMethodListRow[] {
  if (!family || family === "all") return rows;
  return rows.filter((row) => row.family === family);
}

/** Group a sorted list into catalog family sections (preserves row order within each family). */
export function groupPaymentMethodRowsByFamily(
  rows: PaymentMethodListRow[],
  familyOrder: string[]
): Array<{ family: string; rows: PaymentMethodListRow[] }> {
  const byFamily = new Map<string, PaymentMethodListRow[]>();
  for (const row of rows) {
    const list = byFamily.get(row.family) ?? [];
    list.push(row);
    byFamily.set(row.family, list);
  }
  const ordered: Array<{ family: string; rows: PaymentMethodListRow[] }> = [];
  for (const family of familyOrder) {
    const list = byFamily.get(family);
    if (list?.length) ordered.push({ family, rows: list });
  }
  for (const [family, list] of byFamily) {
    if (!familyOrder.includes(family) && list.length) ordered.push({ family, rows: list });
  }
  return ordered;
}
