import type { MenuAvailabilityWindow, MenuAvailabilityWindows, MenuSurfaceRow } from "../../../api";
import { scheduleRestaurantMenu } from "../../../api";

export const AVAILABILITY_DAY_OPTIONS = [
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
  { value: 0, label: "Sun" }
] as const;

export const AVAILABILITY_COLOR_PRESETS = [
  "#7c3aed",
  "#2563eb",
  "#059669",
  "#d97706",
  "#dc2626",
  "#db2777",
  "#0891b2",
  "#4f46e5"
] as const;

export const DEFAULT_AVAILABILITY_COLOR = AVAILABILITY_COLOR_PRESETS[0];

export type AvailabilityCard = {
  key: string;
  menuId: string;
  menuName: string;
  window: MenuAvailabilityWindow;
};

export function isUserCreatedAvailabilityWindow(window: unknown): window is MenuAvailabilityWindow {
  if (!window || typeof window !== "object") return false;
  const w = window as Partial<MenuAvailabilityWindow>;
  return (
    typeof w.label === "string" &&
    w.label.trim().length > 0 &&
    typeof w.color === "string" &&
    /^#[0-9A-Fa-f]{6}$/.test(w.color) &&
    typeof w.start === "string" &&
    typeof w.end === "string" &&
    Array.isArray(w.days) &&
    typeof w.enabled === "boolean"
  );
}

export function filterUserCreatedWindows(windows: MenuAvailabilityWindows | null | undefined): MenuAvailabilityWindows {
  const out: MenuAvailabilityWindows = {};
  for (const [key, window] of Object.entries(windows ?? {})) {
    if (isUserCreatedAvailabilityWindow(window)) out[key] = window;
  }
  return out;
}

export function listAvailabilityCards(menus: MenuSurfaceRow[]): AvailabilityCard[] {
  const cards: AvailabilityCard[] = [];
  for (const menu of menus) {
    const windows = filterUserCreatedWindows(menu.availabilityWindows ?? null);
    for (const [key, window] of Object.entries(windows)) {
      cards.push({ key, menuId: menu.id, menuName: menu.name, window });
    }
  }
  return cards.sort((a, b) => a.window.label.localeCompare(b.window.label));
}

export function formatAvailabilityDays(days: number[]) {
  const sorted = [...new Set(days)].sort((a, b) => {
    const order = (d: number) => (d === 0 ? 7 : d);
    return order(a) - order(b);
  });
  if (sorted.length === 0) return "No days selected";
  if (sorted.length === 7) return "Every day";
  const labels = sorted.map((d) => AVAILABILITY_DAY_OPTIONS.find((o) => o.value === d)?.label ?? String(d));
  return labels.join(", ");
}

export function makeAvailabilityKey(label: string) {
  const base =
    label
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "window";
  return `${base}-${Math.random().toString(36).slice(2, 8)}`;
}

export function normalizeHexColor(raw: string) {
  const trimmed = raw.trim();
  if (/^#[0-9A-Fa-f]{6}$/.test(trimmed)) return trimmed;
  if (/^[0-9A-Fa-f]{6}$/.test(trimmed)) return `#${trimmed}`;
  return null;
}

export function resolveAvailabilityColor(raw: string) {
  const normalized = normalizeHexColor(raw);
  if (normalized && AVAILABILITY_COLOR_PRESETS.some((c) => c.toLowerCase() === normalized.toLowerCase())) {
    return normalized;
  }
  return DEFAULT_AVAILABILITY_COLOR;
}

export async function saveMenuAvailabilityWindows(
  token: string,
  restaurantId: string,
  menuId: string,
  currentWindows: MenuAvailabilityWindows | null | undefined,
  nextWindows: MenuAvailabilityWindows
) {
  const cleaned = filterUserCreatedWindows(currentWindows);
  return scheduleRestaurantMenu(token, restaurantId, menuId, {
    availabilityWindows: { ...cleaned, ...nextWindows }
  });
}

export async function removeMenuAvailabilityWindow(
  token: string,
  restaurantId: string,
  menuId: string,
  currentWindows: MenuAvailabilityWindows | null | undefined,
  windowKey: string
) {
  const cleaned = filterUserCreatedWindows(currentWindows);
  const { [windowKey]: _removed, ...rest } = cleaned;
  return scheduleRestaurantMenu(token, restaurantId, menuId, { availabilityWindows: rest });
}

export function availabilityCardStyle(color: string) {
  return {
    background: `color-mix(in srgb, ${color} 16%, var(--admin-stat-bg))`,
    borderColor: `color-mix(in srgb, ${color} 42%, var(--admin-border))`,
    boxShadow: `inset 0 1px 0 color-mix(in srgb, ${color} 22%, transparent)`
  } as const;
}

function getContrastTextColor(hex: string) {
  const normalized = resolveAvailabilityColor(hex).slice(1);
  const r = Number.parseInt(normalized.slice(0, 2), 16);
  const g = Number.parseInt(normalized.slice(2, 4), 16);
  const b = Number.parseInt(normalized.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.58 ? "#1e1b2e" : "#ffffff";
}

export function availabilityPreviewCardStyle(color: string) {
  const resolved = resolveAvailabilityColor(color);
  const textColor = getContrastTextColor(resolved);
  return {
    background: resolved,
    borderColor: `color-mix(in srgb, ${resolved} 82%, #000)`,
    color: textColor,
    boxShadow: `inset 0 1px 0 color-mix(in srgb, #fff 18%, transparent), 0 10px 24px color-mix(in srgb, ${resolved} 28%, transparent)`
  } as const;
}
