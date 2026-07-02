/** Mirrors `services/api/src/lib/mobileExperience.ts` — do not infer menus client-side. */

export type MobileRoleType = "CUSTOMER" | "ADMIN" | "STAFF";

export type MobileTabIconKey =
  | "home"
  | "bookings"
  | "orders"
  | "messages"
  | "profile"
  | "dashboard"
  | "tasks"
  | "chat"
  | "schedule"
  | "menu"
  | "staff";

export type MobileTabManifest = {
  key: string;
  label: string;
  icon: MobileTabIconKey;
  visible: boolean;
};

/** @deprecated Customer legacy keys only — use `MobileTabManifest.key`. */
export type MobileTabId = "home" | "bookings" | "orders" | "messages" | "account";

export type MeHubRowAction =
  | "open_reservations"
  | "open_orders"
  | "open_review"
  | "open_support"
  | "navigate_section"
  | "navigate_screen"
  | "sign_out"
  | "choose_venue";

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
  | "shortcuts"
  | "communication"
  | "navigation"
  | "sounds_voice";

export type VenueAccessState = "none" | "active" | "pending_approval" | "suspended";

export type ActiveExperienceInfo = {
  mode: "CUSTOMER" | "WORKSPACE";
  label: string;
  restaurantId?: string;
  restaurantName?: string;
  roleLabel?: string;
};

export type MobileExperienceManifest = {
  roleType: MobileRoleType;
  permissions: string[];
  customerAccess: boolean;
  activeExperience: ActiveExperienceInfo;
  venueAccess?: {
    state: VenueAccessState;
    pendingVenueName?: string;
  };
  screens: Record<string, WorkspaceScreenManifest>;
  tabScreens?: Partial<Record<string, string>>;
  tabs: MobileTabManifest[];
  meHub: {
    sections: MeHubSectionManifest[];
    showNotificationToggles: boolean;
    showVenueLine: boolean;
  };
  controlCentre: {
    chips: ControlCentreChipManifest[];
    sections: ControlCentreSectionManifest[];
  };
  settings: {
    accountKeys: SettingsDetailKey[];
    generalKeys: SettingsDetailKey[];
  };
};
