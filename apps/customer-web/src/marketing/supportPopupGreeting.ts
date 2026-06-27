export const SUPPORT_POPUP_BRAND_ICON = "/icons/themes (1).png";

export function getSupportGreetingEmoji(): string {
  return "👋";
}

export function formatSupportGreetingName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed || trimmed === "ServeOS user") return "there";
  return trimmed.split(/\s+/)[0] ?? trimmed;
}
