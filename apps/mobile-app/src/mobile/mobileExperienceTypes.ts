/** Mirrors `services/api/src/lib/mobileExperience.ts` — do not infer menus client-side. */

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
  screens: Record<string, WorkspaceScreenManifest>;
  /** Primary workspace screen per tab — set by API for admin/staff. */
  tabScreens?: Partial<Record<MobileTabId, string>>;
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
