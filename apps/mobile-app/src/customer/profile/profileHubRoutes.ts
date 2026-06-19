import type { SettingsDetailKey } from "./profilePrefsStorage";
import type { CustomerReservationApi } from "../reservations/reservationApi";

/** Bottom nav ME tab — personal customer space. */
export type MeStackRoute =
  | { name: "home" }
  | { name: "review" }
  | { name: "workspace"; screenKey: string; title: string; subtitle?: string }
  | { name: "section"; title: string; subtitle?: string }
  | { name: "settings" }
  | { name: "settings_detail"; key: SettingsDetailKey }
  | { name: "help" }
  | { name: "safety" }
  | { name: "upcoming_reservations" }
  | { name: "reservation_details"; reservation: CustomerReservationApi };

/** Hamburger menu — system / app control space. */
export type AppStackRoute =
  | { name: "home" }
  | { name: "settings" }
  | { name: "settings_detail"; key: SettingsDetailKey }
  | { name: "help" }
  | { name: "safety" }
  | { name: "workspace"; screenKey: string; title: string; subtitle?: string }
  | { name: "section"; title: string; subtitle?: string };

/** @deprecated Use AppStackRoute */
export type ProfileStackRoute = AppStackRoute;

export function meStackOverlayTitle(route: MeStackRoute): string | null {
  switch (route.name) {
    case "home":
    case "review":
    case "upcoming_reservations":
    case "reservation_details":
      return null;
    case "settings":
      return "App settings";
    case "settings_detail": {
      const titles: Record<string, string> = {
        manage_account: "Manage account",
        privacy: "Privacy",
        address: "Delivery address",
        accessibility: "Accessibility",
        night_mode: "Night mode",
        shortcuts: "Shortcuts",
        communication: "Communication",
        navigation: "Navigation",
        sounds_voice: "Sounds & voice"
      };
      return titles[route.key] ?? "App settings";
    }
    case "help":
      return "Help";
    case "safety":
      return "Safety & privacy";
    case "workspace":
      return route.title;
    case "section":
      return route.title;
    default:
      return null;
  }
}

export function splitHubStack(stack: AppStackRoute[]): {
  base: AppStackRoute;
  overlay: AppStackRoute | null;
} {
  if (stack.length <= 1) {
    return { base: stack[0] ?? { name: "home" }, overlay: null };
  }
  const top = stack[stack.length - 1]!;
  if (stack[0]?.name === "home") {
    if (stack.length === 2) {
      return { base: stack[0], overlay: top };
    }
    return { base: stack[stack.length - 2]!, overlay: top };
  }
  return { base: top, overlay: null };
}

export function appStackOverlayTitle(route: AppStackRoute): string | null {
  switch (route.name) {
    case "home":
      return null;
    case "settings":
      return "App settings";
    case "settings_detail": {
      const titles: Record<string, string> = {
        manage_account: "Manage account",
        privacy: "Privacy",
        address: "Delivery address",
        accessibility: "Accessibility",
        night_mode: "Night mode",
        shortcuts: "Shortcuts",
        communication: "Communication",
        navigation: "Navigation",
        sounds_voice: "Sounds & voice"
      };
      return titles[route.key] ?? "App settings";
    }
    case "help":
      return "Help";
    case "safety":
      return "Safety & privacy";
    case "workspace":
      return route.title;
    case "section":
      return route.title;
    default:
      return null;
  }
}
