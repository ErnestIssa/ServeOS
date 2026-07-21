/**
 * Availability evaluation SSOT.
 * All clients (admin, QR, mobile, kiosk, cart) must use these results —
 * never re-implement orderability locally.
 *
 * Precedence (first blocking reason wins):
 * Restaurant closed → Menu unpublished → Category hidden → Item unavailable →
 * Out of stock → Visibility → Location → Channel → Schedule → Default available
 */

import { isVenueOpenNow } from "../venueOpenNow.js";
import {
  AVAILABILITY_CHANNELS,
  CHANNEL_LABELS,
  type AvailabilityChannel,
  type AvailabilityComputedStatus,
  type AvailabilityWindow,
  type MenuAvailabilityWindows
} from "./menuAvailability.js";

export type AvailabilityReason = {
  ok: boolean;
  code: string;
  label: string;
};

export type AvailabilityEvaluation = {
  orderable: boolean;
  status: AvailabilityComputedStatus;
  reasons: AvailabilityReason[];
  matchedWindowKey: string | null;
};

export type AvailabilityEvalContext = {
  now?: Date;
  /** IANA tz — schedules evaluated in restaurant local time when possible */
  timezone?: string;
  openingHours?: string | null;
  restaurantOpen?: boolean;
  menuStatus: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  scheduledPublishAt?: Date | string | null;
  scheduledUnpublishAt?: Date | string | null;
  categoryActive?: boolean;
  itemActive?: boolean;
  itemLifecycle?: "DRAFT" | "ACTIVE" | "ARCHIVED" | null;
  itemSoldOut?: boolean;
  channel?: AvailabilityChannel | null;
  locationId?: string | null;
  audience?: "CUSTOMER" | "STAFF" | "TEST";
  /** When evaluating a single window card in admin */
  windowKey?: string | null;
  windows?: MenuAvailabilityWindows | null;
};

function parseTimeToMinutes(value: string): number | null {
  const m = value.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (!Number.isFinite(h) || !Number.isFinite(min) || h > 23 || min > 59) return null;
  return h * 60 + min;
}

function isWithinTimeWindow(nowMin: number, start: string, end: string): boolean {
  const open = parseTimeToMinutes(start);
  const close = parseTimeToMinutes(end);
  if (open == null || close == null) return false;
  if (close === open) return true;
  if (close > open) return nowMin >= open && nowMin < close;
  return nowMin >= open || nowMin < close;
}

function localParts(now: Date, timezone?: string): { day: number; minute: number; monthDay: string; instant: number } {
  try {
    if (timezone) {
      const fmt = new Intl.DateTimeFormat("en-US", {
        timeZone: timezone,
        weekday: "short",
        hour: "2-digit",
        minute: "2-digit",
        month: "2-digit",
        day: "2-digit",
        hour12: false
      });
      const parts = Object.fromEntries(fmt.formatToParts(now).map((p) => [p.type, p.value]));
      const dayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
      const day = dayMap[parts.weekday ?? ""] ?? now.getDay();
      const hour = Number(parts.hour === "24" ? "0" : parts.hour);
      const minute = Number(parts.minute);
      return {
        day,
        minute: hour * 60 + minute,
        monthDay: `${parts.month}-${parts.day}`,
        instant: now.getTime()
      };
    }
  } catch {
    /* fall through */
  }
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const dayNum = String(now.getDate()).padStart(2, "0");
  return {
    day: now.getDay(),
    minute: now.getHours() * 60 + now.getMinutes(),
    monthDay: `${month}-${dayNum}`,
    instant: now.getTime()
  };
}

function mdInSeason(monthDay: string, startMd: string, endMd: string): boolean {
  if (startMd <= endMd) return monthDay >= startMd && monthDay <= endMd;
  return monthDay >= startMd || monthDay <= endMd;
}

function toDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function push(reasons: AvailabilityReason[], ok: boolean, code: string, label: string) {
  reasons.push({ ok, code, label });
}

function evaluateWindowSchedule(
  window: AvailabilityWindow,
  local: ReturnType<typeof localParts>,
  reasons: AvailabilityReason[]
): { pass: boolean; statusHint?: AvailabilityComputedStatus } {
  const kind = window.scheduleKind ?? "RECURRING";

  if (kind === "TEMPORARY") {
    const startAt = toDate(window.temporaryStartAt);
    const endAt = toDate(window.temporaryEndAt);
    if (startAt && local.instant < startAt.getTime()) {
      push(reasons, false, "temporary_not_started", `Starts ${startAt.toISOString().slice(0, 16)}`);
      return { pass: false, statusHint: "SCHEDULED" };
    }
    if (endAt && local.instant > endAt.getTime()) {
      push(reasons, false, "temporary_expired", "Temporary window expired");
      return { pass: false, statusHint: "EXPIRED" };
    }
    push(reasons, true, "temporary_active", "Temporary window active");
  }

  if (kind === "SEASONAL") {
    const startMd = window.seasonalStartMd;
    const endMd = window.seasonalEndMd;
    if (startMd && endMd) {
      if (!mdInSeason(local.monthDay, startMd, endMd)) {
        push(reasons, false, "seasonal_out", `Outside season ${startMd}–${endMd}`);
        return { pass: false, statusHint: "SEASONAL" };
      }
      push(reasons, true, "seasonal_in", `Season ${startMd}–${endMd}`);
    } else {
      push(reasons, true, "seasonal_open", "Seasonal (dates not set)");
    }
  }

  const dayOk = window.days.length === 0 || window.days.includes(local.day);
  if (!dayOk) {
    push(reasons, false, "day", "Outside scheduled days");
    return { pass: false, statusHint: "SCHEDULED" };
  }
  const dayLabel =
    window.days.length === 7
      ? "Every day"
      : window.days.length === 5 && [1, 2, 3, 4, 5].every((d) => window.days.includes(d))
        ? "Weekdays"
        : window.days.length === 2 && window.days.includes(0) && window.days.includes(6)
          ? "Weekends"
          : "Scheduled day";
  push(reasons, true, "day", dayLabel);

  const timeOk = isWithinTimeWindow(local.minute, window.start, window.end);
  if (!timeOk) {
    push(reasons, false, "hours", `${window.start}–${window.end}`);
    return { pass: false, statusHint: "SCHEDULED" };
  }
  push(reasons, true, "hours", `${window.start}–${window.end}`);
  return { pass: true };
}

function evaluateWindowRules(
  window: AvailabilityWindow,
  ctx: AvailabilityEvalContext,
  local: ReturnType<typeof localParts>,
  reasons: AvailabilityReason[]
): { pass: boolean; status: AvailabilityComputedStatus } {
  if (!window.enabled) {
    push(reasons, false, "disabled", "Window disabled");
    return { pass: false, status: "UNAVAILABLE" };
  }

  if (window.paused) {
    push(reasons, false, "paused", "Paused");
    return { pass: false, status: "PAUSED" };
  }

  if (window.outOfStock) {
    push(reasons, false, "out_of_stock", "Out of stock");
    return { pass: false, status: "OUT_OF_STOCK" };
  }
  push(reasons, true, "stock", "In stock");

  const visibility = window.visibility ?? "CUSTOMERS";
  const audience = ctx.audience ?? "CUSTOMER";
  if (visibility === "HIDDEN") {
    push(reasons, false, "visibility", "Hidden from customers");
    return { pass: false, status: "HIDDEN" };
  }
  if (visibility === "STAFF_ONLY" && audience === "CUSTOMER") {
    push(reasons, false, "visibility", "Staff only");
    return { pass: false, status: "HIDDEN" };
  }
  if (visibility === "TESTING" && audience === "CUSTOMER") {
    push(reasons, false, "visibility", "Internal testing");
    return { pass: false, status: "TESTING" };
  }
  if (visibility === "TESTING") {
    push(reasons, true, "visibility", "Testing audience");
  } else if (visibility === "STAFF_ONLY") {
    push(reasons, true, "visibility", "Staff visibility");
  } else {
    push(reasons, true, "visibility", "Visible to customers");
  }

  const locationMode = window.locationMode ?? "ALL";
  if (locationMode === "SELECTED") {
    const ids = window.locationIds ?? [];
    if (ids.length === 0) {
      push(reasons, false, "location", "No locations selected");
      return { pass: false, status: "UNAVAILABLE" };
    }
    if (ctx.locationId && !ids.includes(ctx.locationId)) {
      push(reasons, false, "location", "Not available at this location");
      return { pass: false, status: "UNAVAILABLE" };
    }
    push(reasons, true, "location", ctx.locationId ? "Location allowed" : "Selected locations");
  } else {
    push(reasons, true, "location", "All locations");
  }

  const channels = window.channels?.length ? window.channels : [...AVAILABILITY_CHANNELS];
  if (ctx.channel) {
    if (!channels.includes(ctx.channel)) {
      push(reasons, false, "channel", `${CHANNEL_LABELS[ctx.channel]} not allowed`);
      return { pass: false, status: "UNAVAILABLE" };
    }
    push(reasons, true, "channel", CHANNEL_LABELS[ctx.channel]);
  } else {
    const summary =
      channels.length === AVAILABILITY_CHANNELS.length
        ? "All channels"
        : channels.map((c) => CHANNEL_LABELS[c]).join(" + ");
    push(reasons, true, "channel", summary);
  }

  const schedule = evaluateWindowSchedule(window, local, reasons);
  if (!schedule.pass) {
    return { pass: false, status: schedule.statusHint ?? "SCHEDULED" };
  }

  if (window.requiresManagerApproval) {
    push(reasons, true, "manager_approval", "Requires manager approval");
  }
  if (window.ageRestricted) {
    push(reasons, true, "age_restricted", window.minAge ? `Age ${window.minAge}+` : "Age restricted");
  }

  return { pass: true, status: kindStatus(window) };
}

function kindStatus(window: AvailabilityWindow): AvailabilityComputedStatus {
  if (window.scheduleKind === "SEASONAL") return "SEASONAL";
  if (window.scheduleKind === "TEMPORARY") return "SCHEDULED";
  if ((window.visibility ?? "CUSTOMERS") === "TESTING") return "TESTING";
  return "AVAILABLE";
}

/**
 * Evaluate orderability for a menu surface (and optional item context).
 */
export function evaluateAvailability(ctx: AvailabilityEvalContext): AvailabilityEvaluation {
  const now = ctx.now ?? new Date();
  const reasons: AvailabilityReason[] = [];
  const local = localParts(now, ctx.timezone);

  const restaurantOpen =
    ctx.restaurantOpen ?? isVenueOpenNow(ctx.openingHours ?? null, now);
  if (!restaurantOpen) {
    push(reasons, false, "restaurant_closed", "Restaurant closed");
    return { orderable: false, status: "UNAVAILABLE", reasons, matchedWindowKey: null };
  }
  push(reasons, true, "restaurant_open", "Restaurant open");

  if (ctx.menuStatus === "ARCHIVED") {
    push(reasons, false, "menu_archived", "Menu archived");
    return { orderable: false, status: "UNAVAILABLE", reasons, matchedWindowKey: null };
  }
  if (ctx.menuStatus !== "PUBLISHED") {
    const publishAt = toDate(ctx.scheduledPublishAt);
    if (publishAt && publishAt.getTime() > now.getTime()) {
      push(reasons, false, "menu_scheduled_publish", "Menu scheduled to publish");
      return { orderable: false, status: "SCHEDULED", reasons, matchedWindowKey: null };
    }
    push(reasons, false, "menu_unpublished", "Menu unpublished");
    return { orderable: false, status: "UNAVAILABLE", reasons, matchedWindowKey: null };
  }
  const unpublishAt = toDate(ctx.scheduledUnpublishAt);
  if (unpublishAt && unpublishAt.getTime() <= now.getTime()) {
    push(reasons, false, "menu_unpublished_schedule", "Menu past scheduled unpublish");
    return { orderable: false, status: "EXPIRED", reasons, matchedWindowKey: null };
  }
  push(reasons, true, "menu_published", "Menu published");

  if (ctx.categoryActive === false) {
    push(reasons, false, "category_hidden", "Category hidden");
    return { orderable: false, status: "HIDDEN", reasons, matchedWindowKey: null };
  }
  if (ctx.categoryActive === true) {
    push(reasons, true, "category_active", "Category active");
  }

  if (ctx.itemLifecycle === "ARCHIVED" || ctx.itemLifecycle === "DRAFT") {
    push(reasons, false, "item_lifecycle", `Item ${ctx.itemLifecycle.toLowerCase()}`);
    return { orderable: false, status: "UNAVAILABLE", reasons, matchedWindowKey: null };
  }
  if (ctx.itemActive === false) {
    push(reasons, false, "item_unavailable", "Item manually unavailable");
    return { orderable: false, status: "UNAVAILABLE", reasons, matchedWindowKey: null };
  }
  if (ctx.itemActive === true) {
    push(reasons, true, "item_active", "Item active");
  }

  if (ctx.itemSoldOut) {
    push(reasons, false, "item_out_of_stock", "Out of stock");
    return { orderable: false, status: "OUT_OF_STOCK", reasons, matchedWindowKey: null };
  }
  if (ctx.itemSoldOut === false) {
    push(reasons, true, "item_stock", "In stock");
  }

  const windows = ctx.windows ?? null;
  const entries = windows ? Object.entries(windows) : [];

  if (ctx.windowKey) {
    const window = windows?.[ctx.windowKey];
    if (!window) {
      push(reasons, false, "window_missing", "Availability window not found");
      return { orderable: false, status: "UNAVAILABLE", reasons, matchedWindowKey: null };
    }
    const result = evaluateWindowRules(window, ctx, local, reasons);
    return {
      orderable: result.pass,
      status: result.status,
      reasons,
      matchedWindowKey: result.pass ? ctx.windowKey : null
    };
  }

  if (entries.length === 0) {
    push(reasons, true, "no_windows", "No schedule rules (default available)");
    return { orderable: true, status: "AVAILABLE", reasons, matchedWindowKey: null };
  }

  let bestStatus: AvailabilityComputedStatus = "SCHEDULED";
  let matchedWindowKey: string | null = null;
  const candidateReasons: AvailabilityReason[][] = [];

  for (const [key, window] of entries) {
    const localReasons: AvailabilityReason[] = [];
    const result = evaluateWindowRules(window, ctx, local, localReasons);
    candidateReasons.push(localReasons);
    if (result.pass) {
      matchedWindowKey = key;
      bestStatus = result.status;
      reasons.push(...localReasons);
      return { orderable: true, status: bestStatus, reasons, matchedWindowKey };
    }
    if (result.status === "OUT_OF_STOCK") bestStatus = "OUT_OF_STOCK";
    else if (result.status === "PAUSED" && bestStatus === "SCHEDULED") bestStatus = "PAUSED";
    else if (result.status === "HIDDEN") bestStatus = "HIDDEN";
    else if (result.status === "TESTING") bestStatus = "TESTING";
    else if (result.status === "EXPIRED") bestStatus = "EXPIRED";
    else if (result.status === "SEASONAL" && bestStatus === "SCHEDULED") bestStatus = "SEASONAL";
  }

  const last = candidateReasons[candidateReasons.length - 1] ?? [];
  reasons.push(...last);
  if (!reasons.some((r) => !r.ok)) {
    push(reasons, false, "no_matching_window", "No matching availability window");
  }
  return { orderable: false, status: bestStatus, reasons, matchedWindowKey: null };
}

/** Admin card snapshot — evaluates one window against restaurant/menu context. */
export function evaluateAvailabilityCard(input: {
  window: AvailabilityWindow;
  windowKey: string;
  menuStatus: AvailabilityEvalContext["menuStatus"];
  openingHours?: string | null;
  timezone?: string;
  scheduledPublishAt?: Date | string | null;
  scheduledUnpublishAt?: Date | string | null;
  now?: Date;
  channel?: AvailabilityChannel | null;
  locationId?: string | null;
  audience?: AvailabilityEvalContext["audience"];
}): AvailabilityEvaluation {
  return evaluateAvailability({
    now: input.now,
    timezone: input.timezone,
    openingHours: input.openingHours,
    menuStatus: input.menuStatus,
    scheduledPublishAt: input.scheduledPublishAt,
    scheduledUnpublishAt: input.scheduledUnpublishAt,
    windows: { [input.windowKey]: input.window },
    windowKey: input.windowKey,
    channel: input.channel,
    locationId: input.locationId,
    audience: input.audience ?? "CUSTOMER"
  });
}
