/**
 * Platform Imports & Exports catalog — backend SSOT for the Configuration
 * data-transfer center. Domains register targets here; the UI must not invent
 * available entities or formats locally.
 */

export type DataTransferAvailability = "available" | "planned";

export type ImportExportSectionId = "imports" | "exports" | "templates" | "migration" | "history";

export type ImportExportTarget = {
  key: string;
  label: string;
  description: string;
  availability: DataTransferAvailability;
  directions: Array<"import" | "export">;
  formats: string[];
  /** Menu permission entity used until dedicated import/export caps ship. */
  permissionEntity: "menu" | "media";
};

export type ImportExportSource = {
  key: string;
  label: string;
  availability: DataTransferAvailability;
};

export type ImportExportFormat = {
  key: string;
  label: string;
  availability: DataTransferAvailability;
  extensions: string[];
};

export type MigrationProvider = {
  key: string;
  label: string;
  availability: DataTransferAvailability;
  description?: string;
};

export type MigrationGuideStep = {
  key: string;
  title: string;
  summary: string;
  detail: string;
};

export type ImportExportCatalog = {
  sections: Array<{ id: ImportExportSectionId; label: string; description: string }>;
  targets: ImportExportTarget[];
  sources: ImportExportSource[];
  formats: ImportExportFormat[];
  migrationProviders: MigrationProvider[];
  migrationSteps: MigrationGuideStep[];
  uploadOrigins: Array<{ key: string; label: string; availability: DataTransferAvailability }>;
  conflictStrategies: Array<{ key: string; label: string; availability: DataTransferAvailability }>;
  limits: {
    maxCsvBytes: number;
    maxCsvRows: number;
  };
};

export const IMPORT_EXPORT_LIMITS = {
  maxCsvBytes: 5 * 1024 * 1024,
  maxCsvRows: 20_000
} as const;

export function getImportExportCatalog(): ImportExportCatalog {
  return {
    sections: [
      {
        id: "imports",
        label: "Imports",
        description: "Bring data into ServeOS from files, backups, or connected systems."
      },
      {
        id: "exports",
        label: "Exports",
        description: "Download or deliver restaurant data in supported formats."
      },
      {
        id: "templates",
        label: "Templates",
        description: "Start from restaurant templates instead of blank spreadsheets."
      },
      {
        id: "migration",
        label: "Migration",
        description: "Move from another POS while preserving external IDs."
      },
      {
        id: "history",
        label: "History",
        description: "Every import and export job for this venue."
      }
    ],
    targets: [
      {
        key: "menu",
        label: "Menu",
        description: "Categories, items, and modifiers as a flat CSV catalog.",
        availability: "available",
        directions: ["import", "export"],
        formats: ["csv"],
        permissionEntity: "menu"
      },
      {
        key: "categories",
        label: "Categories",
        description: "Category-only transfer.",
        availability: "planned",
        directions: ["import", "export"],
        formats: ["csv"],
        permissionEntity: "menu"
      },
      {
        key: "items",
        label: "Items",
        description: "Item-only transfer.",
        availability: "planned",
        directions: ["import", "export"],
        formats: ["csv"],
        permissionEntity: "menu"
      },
      {
        key: "modifier-groups",
        label: "Modifier groups",
        description: "Modifier group definitions.",
        availability: "planned",
        directions: ["import", "export"],
        formats: ["csv"],
        permissionEntity: "menu"
      },
      {
        key: "modifier-options",
        label: "Modifier options",
        description: "Modifier option rows.",
        availability: "planned",
        directions: ["import", "export"],
        formats: ["csv"],
        permissionEntity: "menu"
      },
      {
        key: "availability",
        label: "Availability",
        description: "Schedules and channel rules.",
        availability: "planned",
        directions: ["import", "export"],
        formats: ["csv", "json"],
        permissionEntity: "menu"
      },
      {
        key: "tables",
        label: "Tables",
        description: "Floor plan and table labels.",
        availability: "planned",
        directions: ["import", "export"],
        formats: ["csv"],
        permissionEntity: "menu"
      },
      {
        key: "customers",
        label: "Customers",
        description: "Guest CRM records.",
        availability: "planned",
        directions: ["import", "export"],
        formats: ["csv"],
        permissionEntity: "menu"
      },
      {
        key: "staff",
        label: "Staff",
        description: "Staff accounts and roles.",
        availability: "planned",
        directions: ["import", "export"],
        formats: ["csv"],
        permissionEntity: "menu"
      },
      {
        key: "loyalty",
        label: "Loyalty",
        description: "Loyalty members and balances.",
        availability: "planned",
        directions: ["import", "export"],
        formats: ["csv"],
        permissionEntity: "menu"
      },
      {
        key: "gift-cards",
        label: "Gift cards",
        description: "Gift card inventory.",
        availability: "planned",
        directions: ["import", "export"],
        formats: ["csv"],
        permissionEntity: "menu"
      },
      {
        key: "inventory",
        label: "Inventory",
        description: "Stock and suppliers.",
        availability: "planned",
        directions: ["import", "export"],
        formats: ["csv"],
        permissionEntity: "menu"
      },
      {
        key: "media",
        label: "Media",
        description: "Media library asset manifests.",
        availability: "planned",
        directions: ["export"],
        formats: ["json"],
        permissionEntity: "media"
      },
      {
        key: "qr-codes",
        label: "QR codes",
        description: "QR identities and assignments.",
        availability: "planned",
        directions: ["export"],
        formats: ["csv", "json"],
        permissionEntity: "menu"
      },
      {
        key: "orders",
        label: "Orders",
        description: "Historical order exports.",
        availability: "planned",
        directions: ["export"],
        formats: ["csv", "json"],
        permissionEntity: "menu"
      },
      {
        key: "other",
        label: "Other",
        description: "Custom or unsupported targets.",
        availability: "planned",
        directions: ["import", "export"],
        formats: ["csv", "json"],
        permissionEntity: "menu"
      }
    ],
    sources: [
      { key: "csv", label: "CSV", availability: "available" },
      { key: "xlsx", label: "Excel (.xlsx)", availability: "planned" },
      { key: "json", label: "JSON", availability: "planned" },
      { key: "pos-provider", label: "POS provider", availability: "planned" },
      { key: "serveos-backup", label: "ServeOS backup", availability: "planned" },
      { key: "cloud", label: "Cloud import", availability: "planned" },
      { key: "restaurant-template", label: "Restaurant template", availability: "planned" }
    ],
    formats: [
      { key: "csv", label: "CSV", availability: "available", extensions: [".csv"] },
      { key: "xlsx", label: "Excel", availability: "planned", extensions: [".xlsx"] },
      { key: "json", label: "JSON", availability: "planned", extensions: [".json"] },
      { key: "pdf", label: "PDF", availability: "planned", extensions: [".pdf"] },
      {
        key: "serveos-backup",
        label: "ServeOS backup",
        availability: "planned",
        extensions: [".restaurantbackup"]
      }
    ],
    migrationProviders: [
      {
        key: "toast",
        label: "Toast",
        availability: "planned",
        description: "Toast POS export — connector coming soon."
      },
      {
        key: "square",
        label: "Square",
        availability: "planned",
        description: "Square catalog export — connector coming soon."
      },
      {
        key: "lightspeed",
        label: "Lightspeed",
        availability: "planned",
        description: "Lightspeed restaurant data — connector coming soon."
      },
      {
        key: "clover",
        label: "Clover",
        availability: "planned",
        description: "Clover items and modifiers — connector coming soon."
      },
      {
        key: "sumup",
        label: "SumUp",
        availability: "planned",
        description: "SumUp product lists — connector coming soon."
      },
      {
        key: "rekki",
        label: "Rekki",
        availability: "planned",
        description: "Rekki supplier catalogs — connector coming soon."
      },
      {
        key: "excel",
        label: "Excel",
        availability: "planned",
        description: "Excel workbooks (.xlsx) — planned after CSV."
      },
      {
        key: "custom-csv",
        label: "Custom CSV",
        availability: "available",
        description: "Migrate now with a CSV file through the import wizard."
      }
    ],
    migrationSteps: [
      {
        key: "choose",
        title: "Choose system",
        summary: "Pick the POS or file source you’re leaving.",
        detail:
          "Use the Source system menu on this Migration panel. Custom CSV is available today; other providers can be requested for assisted migration until their connectors ship."
      },
      {
        key: "upload",
        title: "Upload / Connect",
        summary: "Provide an export file or approve a connection.",
        detail:
          "For Custom CSV, Start migration opens the import wizard so you can upload your file. Connected POS providers will use a secure OAuth or export handshake when they become available."
      },
      {
        key: "analyze",
        title: "Analyze",
        summary: "ServeOS inspects structure, IDs, and data quality.",
        detail:
          "We detect columns, external IDs, and obvious issues before anything is written. Analysis results appear in the wizard so you can fix problems early."
      },
      {
        key: "map",
        title: "Map",
        summary: "Match source fields to ServeOS fields.",
        detail:
          "Map categories, items, prices, and modifiers to the ServeOS schema. Preserving external IDs here keeps future sync and re-imports safer."
      },
      {
        key: "preview",
        title: "Preview",
        summary: "Review creates, updates, and skips before commit.",
        detail:
          "Preview shows what will change on this venue. Nothing live updates until you confirm — dry runs are available for menu CSV today."
      },
      {
        key: "import",
        title: "Import",
        summary: "Apply the migration into this venue.",
        detail:
          "Confirmed imports run as tracked transfer jobs. You can follow progress under Overview and History, and download or retry when supported."
      },
      {
        key: "verify",
        title: "Verify",
        summary: "Spot-check the venue and keep a backup export.",
        detail:
          "After import, check menus and key records in admin. Export a ServeOS backup when you’re happy so you have a restore point."
      }
    ],
    uploadOrigins: [
      { key: "device", label: "Browse / drag files", availability: "available" },
      { key: "google-drive", label: "Google Drive", availability: "planned" },
      { key: "dropbox", label: "Dropbox", availability: "planned" },
      { key: "onedrive", label: "OneDrive", availability: "planned" }
    ],
    conflictStrategies: [
      { key: "skip", label: "Skip existing", availability: "available" },
      { key: "replace", label: "Replace", availability: "planned" },
      { key: "update", label: "Update", availability: "planned" },
      { key: "duplicate", label: "Duplicate", availability: "planned" },
      { key: "ask", label: "Ask me", availability: "planned" }
    ],
    limits: { ...IMPORT_EXPORT_LIMITS }
  };
}

export function findImportExportTarget(key: string): ImportExportTarget | undefined {
  return getImportExportCatalog().targets.find((t) => t.key === key);
}
