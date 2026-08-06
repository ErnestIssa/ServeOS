export type ConfigPresetId =
  | "menu"
  | "payments"
  | "media-library"
  | "qr-codes"
  | "imports-exports";

export type MenuSectionTab =
  | "menus"
  | "categories"
  | "items"
  | "modifier-groups"
  | "modifier-options"
  | "availability"
  | "preview"
  | "archived"
  | "live";

export type ImportsExportsSectionTab =
  | "overview"
  | "history"
  | "templates"
  | "migration";

export type PaymentsSectionTab =
  | "overview"
  | "methods"
  | "rules"
  | "providers"
  | "refunds"
  | "reconciliation"
  | "payouts"
  | "transactions"
  | "logs";

const LEGACY_CONFIG_PRESET_MAP: Record<string, ConfigPresetId> = {
  "menu-builder": "menu",
  categories: "menu",
  items: "menu",
  modifiers: "menu",
  "modifier-groups": "menu",
  "modifier-options": "menu",
  "staff-list": "menu",
  roles: "menu",
  "payment-methods": "payments",
  images: "media-library",
  "menu-images": "media-library",
  media: "media-library",
  qr: "qr-codes",
  "qr-codes": "qr-codes",
  "import-export": "imports-exports",
  "imports-exports": "imports-exports",
  "data-export": "imports-exports"
};

export function normalizeConfigPresetId(presetId: string): ConfigPresetId {
  if (
    presetId === "menu" ||
    presetId === "payments" ||
    presetId === "media-library" ||
    presetId === "qr-codes" ||
    presetId === "imports-exports"
  ) {
    return presetId;
  }
  return LEGACY_CONFIG_PRESET_MAP[presetId] ?? "menu";
}

export function menuTabFromLegacyPreset(presetId: string): MenuSectionTab | null {
  if (presetId === "categories") return "categories";
  if (presetId === "items") return "items";
  if (presetId === "modifiers" || presetId === "modifier-groups") return "modifier-groups";
  if (presetId === "modifier-options") return "modifier-options";
  if (presetId === "availability") return "availability";
  if (presetId === "images" || presetId === "menu-images") return null;
  if (presetId === "preview" || presetId === "menu-preview") return "preview";
  if (presetId === "import-export" || presetId === "imports-exports" || presetId === "data-export") {
    return null;
  }
  if (presetId === "qr-codes" || presetId === "qr") return null;
  if (presetId === "archived") return "archived";
  if (presetId === "live") return "live";
  if (presetId === "menu-builder" || presetId === "menus") return "menus";
  return null;
}

export const CONFIG_PRESET_DESCRIPTIONS: Record<ConfigPresetId, string> = {
  menu: "Everything related to products — menus, categories, items, modifiers, and availability.",
  payments:
    "Venue money infrastructure — how this restaurant accepts, processes, refunds, reconciles, and settles guest payments (not ServeOS subscription billing).",
  "media-library":
    "Restaurant-wide media library — images and videos for menus, items, covers, and future surfaces.",
  "qr-codes":
    "QR codes for table ordering, menus, takeaway, and other guest experiences. The printed code stays the same; each guest visit is temporary.",
  "imports-exports": "Import, export, and review venue data transfers."
};

export const MENU_TAB_LABELS: Record<MenuSectionTab, string> = {
  menus: "Menus",
  categories: "Categories",
  items: "Items",
  "modifier-groups": "Modifier groups",
  "modifier-options": "Modifier options",
  availability: "Availability",
  preview: "Preview",
  archived: "Archived",
  live: "Live"
};

export const MENU_TABS: MenuSectionTab[] = [
  "menus",
  "categories",
  "items",
  "modifier-groups",
  "modifier-options",
  "availability",
  "preview",
  "archived",
  "live"
];

export const IMPORTS_EXPORTS_TAB_LABELS: Record<ImportsExportsSectionTab, string> = {
  overview: "Overview",
  history: "History",
  templates: "Templates",
  migration: "Migration"
};

export const IMPORTS_EXPORTS_TABS: ImportsExportsSectionTab[] = [
  "overview",
  "history",
  "templates",
  "migration"
];

/** Legacy hash tab values from older Imports & Exports URLs. */
export function normalizeImportsExportsTab(value: string | null): ImportsExportsSectionTab | null {
  if (!value) return null;
  if ((IMPORTS_EXPORTS_TABS as string[]).includes(value)) return value as ImportsExportsSectionTab;
  if (value === "imports" || value === "exports") return "overview";
  return null;
}

export const PAYMENTS_TAB_LABELS: Record<PaymentsSectionTab, string> = {
  overview: "Overview",
  methods: "Payment methods",
  rules: "Payment rules",
  providers: "Providers",
  refunds: "Refunds",
  reconciliation: "Reconciliation",
  payouts: "Payouts",
  transactions: "Transactions",
  logs: "Payment logs"
};

export const PAYMENTS_TABS: PaymentsSectionTab[] = [
  "overview",
  "methods",
  "rules",
  "providers",
  "refunds",
  "reconciliation",
  "payouts",
  "transactions",
  "logs"
];

/** Legacy hash tab values from older Payments URLs. */
export function normalizePaymentsTab(value: string | null): PaymentsSectionTab | null {
  if (!value) return null;
  if ((PAYMENTS_TABS as string[]).includes(value)) return value as PaymentsSectionTab;
  if (value === "payment-methods" || value === "methods-config") return "methods";
  if (value === "security" || value === "webhooks") return "providers";
  if (value === "history") return "transactions";
  return null;
}
