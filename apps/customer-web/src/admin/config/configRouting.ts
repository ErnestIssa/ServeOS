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
  | "imports"
  | "exports"
  | "templates"
  | "migration"
  | "history";

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
  payments: "Everything related to money — providers, methods, payouts, taxes, and security.",
  "media-library":
    "Restaurant-wide media library — images and videos for menus, items, covers, and future surfaces.",
  "qr-codes":
    "QR codes for table ordering, menus, takeaway, and other guest experiences. The printed code stays the same; each guest visit is temporary.",
  "imports-exports":
    "Platform data transfer center — import, export, templates, migrations, and job history across ServeOS."
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
  imports: "Imports",
  exports: "Exports",
  templates: "Templates",
  migration: "Migration",
  history: "History"
};

export const IMPORTS_EXPORTS_TABS: ImportsExportsSectionTab[] = [
  "imports",
  "exports",
  "templates",
  "migration",
  "history"
];
