import type { SettingsDetailKey } from "./profilePrefsStorage";
import type { CustomerReservationApi } from "../reservations/reservationApi";

/** Bottom nav ME tab — personal customer space. */
export type MeStackRoute =
  | { name: "home" }
  | { name: "review" }
  | { name: "section"; title: string; subtitle?: string }
  | { name: "upcoming_reservations" }
  | { name: "reservation_details"; reservation: CustomerReservationApi };

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
