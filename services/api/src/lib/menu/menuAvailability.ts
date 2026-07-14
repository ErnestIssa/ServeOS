export type AvailabilityWindow = {
  enabled: boolean;
  start: string;
  end: string;
  days: number[];
  label: string;
  color: string;
};

export type MenuAvailabilityWindows = Record<string, AvailabilityWindow>;

export function isUserCreatedAvailabilityWindow(window: unknown): window is AvailabilityWindow {
  if (!window || typeof window !== "object") return false;
  const w = window as Partial<AvailabilityWindow>;
  return (
    typeof w.label === "string" &&
    w.label.trim().length > 0 &&
    typeof w.color === "string" &&
    /^#[0-9A-Fa-f]{6}$/.test(w.color) &&
    typeof w.start === "string" &&
    typeof w.end === "string" &&
    Array.isArray(w.days) &&
    w.days.every((d) => Number.isInteger(d)) &&
    typeof w.enabled === "boolean"
  );
}

export function sanitizeAvailabilityWindows(raw: unknown): MenuAvailabilityWindows | null {
  if (!raw || typeof raw !== "object") return null;
  const out: MenuAvailabilityWindows = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!isUserCreatedAvailabilityWindow(value)) continue;
    out[key] = {
      enabled: value.enabled,
      start: value.start,
      end: value.end,
      days: [...value.days],
      label: value.label.trim(),
      color: value.color
    };
  }
  return Object.keys(out).length > 0 ? out : null;
}
