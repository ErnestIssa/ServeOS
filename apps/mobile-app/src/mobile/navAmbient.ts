import type { AmbientNativeTab } from "@serveos/core-ambient/themes";

/** Maps any backend nav tab key to a customer ambient palette (no role logic). */
export function navKeyToAmbientTab(tabKey: string): AmbientNativeTab {
  switch (tabKey) {
    case "home":
    case "dashboard":
    case "menu":
      return "home";
    case "bookings":
    case "tasks":
    case "schedule":
      return "bookings";
    case "orders":
      return "orders";
    case "messages":
    case "chat":
      return "messages";
    case "account":
    case "profile":
    case "staff":
      return "account";
    default:
      return "home";
  }
}
