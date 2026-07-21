/**
 * Menu availability windows — persisted as JSON on Menu.availabilityWindows.
 * Backend is SSOT for shape, sanitization, and evaluation.
 */

export const AVAILABILITY_CHANNELS = [
  "DINE_IN",
  "TAKEAWAY",
  "DELIVERY",
  "QR",
  "KIOSK",
  "STAFF"
] as const;

export type AvailabilityChannel = (typeof AVAILABILITY_CHANNELS)[number];

export const AVAILABILITY_SCHEDULE_KINDS = ["RECURRING", "TEMPORARY", "SEASONAL"] as const;
export type AvailabilityScheduleKind = (typeof AVAILABILITY_SCHEDULE_KINDS)[number];

export const AVAILABILITY_VISIBILITIES = ["CUSTOMERS", "HIDDEN", "STAFF_ONLY", "TESTING"] as const;
export type AvailabilityVisibility = (typeof AVAILABILITY_VISIBILITIES)[number];

export const AVAILABILITY_COMPUTED_STATUSES = [
  "AVAILABLE",
  "UNAVAILABLE",
  "SCHEDULED",
  "OUT_OF_STOCK",
  "HIDDEN",
  "SEASONAL",
  "EXPIRED",
  "PAUSED",
  "TESTING",
  "INHERITED"
] as const;
export type AvailabilityComputedStatus = (typeof AVAILABILITY_COMPUTED_STATUSES)[number];

export type AvailabilityAuditEntry = {
  at: string;
  action: string;
  detail?: string;
  actorUserId?: string | null;
};

export type AvailabilityWindow = {
  enabled: boolean;
  start: string;
  end: string;
  days: number[];
  label: string;
  color: string;
  scheduleKind?: AvailabilityScheduleKind;
  temporaryStartAt?: string | null;
  temporaryEndAt?: string | null;
  seasonalStartMd?: string | null;
  seasonalEndMd?: string | null;
  channels?: AvailabilityChannel[];
  locationMode?: "ALL" | "SELECTED";
  locationIds?: string[];
  visibility?: AvailabilityVisibility;
  outOfStock?: boolean;
  requiresManagerApproval?: boolean;
  ageRestricted?: boolean;
  minAge?: number | null;
  paused?: boolean;
  history?: AvailabilityAuditEntry[];
};

export type MenuAvailabilityWindows = Record<string, AvailabilityWindow>;

const COLOR_RE = /^#[0-9A-Fa-f]{6}$/;
const TIME_RE = /^([01]?\d|2[0-3]):([0-5]\d)$/;
const MD_RE = /^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

function asString(v: unknown): string | null {
  return typeof v === "string" ? v : null;
}

function asBool(v: unknown): boolean | null {
  return typeof v === "boolean" ? v : null;
}

function sanitizeChannels(raw: unknown): AvailabilityChannel[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out = raw.filter((c): c is AvailabilityChannel =>
    typeof c === "string" && (AVAILABILITY_CHANNELS as readonly string[]).includes(c)
  );
  return out.length ? [...new Set(out)] : undefined;
}

function sanitizeHistory(raw: unknown): AvailabilityAuditEntry[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: AvailabilityAuditEntry[] = [];
  for (const entry of raw.slice(-40)) {
    if (!entry || typeof entry !== "object") continue;
    const e = entry as Partial<AvailabilityAuditEntry>;
    if (typeof e.at !== "string" || typeof e.action !== "string") continue;
    out.push({
      at: e.at,
      action: e.action.slice(0, 80),
      ...(typeof e.detail === "string" ? { detail: e.detail.slice(0, 240) } : {}),
      ...(e.actorUserId === null || typeof e.actorUserId === "string"
        ? { actorUserId: e.actorUserId }
        : {})
    });
  }
  return out.length ? out : undefined;
}

export function isUserCreatedAvailabilityWindow(window: unknown): window is AvailabilityWindow {
  if (!window || typeof window !== "object") return false;
  const w = window as Partial<AvailabilityWindow>;
  return (
    typeof w.label === "string" &&
    w.label.trim().length > 0 &&
    typeof w.color === "string" &&
    COLOR_RE.test(w.color) &&
    typeof w.start === "string" &&
    typeof w.end === "string" &&
    Array.isArray(w.days) &&
    w.days.every((d) => Number.isInteger(d)) &&
    typeof w.enabled === "boolean"
  );
}

export function sanitizeAvailabilityWindow(value: unknown): AvailabilityWindow | null {
  if (!isUserCreatedAvailabilityWindow(value)) return null;
  const w = value as AvailabilityWindow & Record<string, unknown>;

  const days = [...new Set(w.days.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))];
  const start = TIME_RE.test(w.start) ? w.start : "09:00";
  const end = TIME_RE.test(w.end) ? w.end : "17:00";

  const scheduleKind =
    typeof w.scheduleKind === "string" &&
    (AVAILABILITY_SCHEDULE_KINDS as readonly string[]).includes(w.scheduleKind)
      ? (w.scheduleKind as AvailabilityScheduleKind)
      : "RECURRING";

  const visibility =
    typeof w.visibility === "string" &&
    (AVAILABILITY_VISIBILITIES as readonly string[]).includes(w.visibility)
      ? (w.visibility as AvailabilityVisibility)
      : "CUSTOMERS";

  const locationMode = w.locationMode === "SELECTED" ? "SELECTED" : "ALL";
  const locationIds = Array.isArray(w.locationIds)
    ? w.locationIds.filter((id): id is string => typeof id === "string" && id.trim().length > 0).slice(0, 50)
    : [];

  const seasonalStartMd =
    typeof w.seasonalStartMd === "string" && MD_RE.test(w.seasonalStartMd) ? w.seasonalStartMd : null;
  const seasonalEndMd =
    typeof w.seasonalEndMd === "string" && MD_RE.test(w.seasonalEndMd) ? w.seasonalEndMd : null;

  const temporaryStartAt = asString(w.temporaryStartAt);
  const temporaryEndAt = asString(w.temporaryEndAt);

  const minAge =
    typeof w.minAge === "number" && Number.isFinite(w.minAge)
      ? Math.max(0, Math.min(120, Math.round(w.minAge)))
      : null;

  const channels = sanitizeChannels(w.channels);
  const history = sanitizeHistory(w.history);

  return {
    enabled: w.enabled,
    start,
    end,
    days,
    label: w.label.trim().slice(0, 48),
    color: w.color,
    scheduleKind,
    temporaryStartAt: temporaryStartAt || null,
    temporaryEndAt: temporaryEndAt || null,
    seasonalStartMd,
    seasonalEndMd,
    channels,
    locationMode,
    locationIds: locationMode === "SELECTED" ? locationIds : [],
    visibility,
    outOfStock: asBool(w.outOfStock) ?? false,
    requiresManagerApproval: asBool(w.requiresManagerApproval) ?? false,
    ageRestricted: asBool(w.ageRestricted) ?? false,
    minAge,
    paused: asBool(w.paused) ?? false,
    ...(history ? { history } : {})
  };
}

export function sanitizeAvailabilityWindows(raw: unknown): MenuAvailabilityWindows | null {
  if (!raw || typeof raw !== "object") return null;
  const out: MenuAvailabilityWindows = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!key || key.startsWith("__")) continue;
    const sanitized = sanitizeAvailabilityWindow(value);
    if (!sanitized) continue;
    out[key] = sanitized;
  }
  return Object.keys(out).length > 0 ? out : null;
}

export function appendAvailabilityHistory(
  window: AvailabilityWindow,
  entry: Omit<AvailabilityAuditEntry, "at"> & { at?: string }
): AvailabilityWindow {
  const next: AvailabilityAuditEntry = {
    at: entry.at ?? new Date().toISOString(),
    action: entry.action.slice(0, 80),
    ...(entry.detail ? { detail: entry.detail.slice(0, 240) } : {}),
    ...(entry.actorUserId !== undefined ? { actorUserId: entry.actorUserId } : {})
  };
  const history = [...(window.history ?? []), next].slice(-40);
  return { ...window, history };
}

export function cloneAvailabilityWindow(window: AvailabilityWindow, labelSuffix = " (copy)"): AvailabilityWindow {
  const { history: _h, ...rest } = window;
  return {
    ...rest,
    label: `${window.label}${labelSuffix}`.slice(0, 48),
    history: [
      {
        at: new Date().toISOString(),
        action: "copied",
        detail: `Copied from “${window.label}”`
      }
    ]
  };
}

export const CHANNEL_LABELS: Record<AvailabilityChannel, string> = {
  DINE_IN: "Dine-in",
  TAKEAWAY: "Takeaway",
  DELIVERY: "Delivery",
  QR: "QR ordering",
  KIOSK: "Kiosk",
  STAFF: "Staff orders"
};

export const STATUS_LABELS: Record<AvailabilityComputedStatus, string> = {
  AVAILABLE: "Available",
  UNAVAILABLE: "Unavailable",
  SCHEDULED: "Scheduled",
  OUT_OF_STOCK: "Out of Stock",
  HIDDEN: "Hidden",
  SEASONAL: "Seasonal",
  EXPIRED: "Expired",
  PAUSED: "Paused",
  TESTING: "Testing",
  INHERITED: "Inherited"
};
