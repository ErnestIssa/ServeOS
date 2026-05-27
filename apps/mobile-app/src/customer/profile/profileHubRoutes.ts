import type { SettingsDetailKey } from "./profilePrefsStorage";

/** Bottom nav ME tab — personal customer space. */
export type MeStackRoute = { name: "home" } | { name: "section"; title: string; subtitle?: string };

/** Hamburger menu — system / app control space. */
export type AppStackRoute =
  | { name: "home" }
  | { name: "settings" }
  | { name: "settings_detail"; key: SettingsDetailKey }
  | { name: "help" }
  | { name: "safety" }
  | { name: "section"; title: string; subtitle?: string };

/** @deprecated Use AppStackRoute */
export type ProfileStackRoute = AppStackRoute;
