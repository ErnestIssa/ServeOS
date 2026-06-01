import type { AppStackRoute } from "./profileHubRoutes";

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
    case "section":
      return route.title;
    default:
      return null;
  }
}
