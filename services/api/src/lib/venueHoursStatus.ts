/** Venue open / closing-soon / closed (same hours rules as mobile). */

const DEFAULT_VENUE_LINES = ["Mon–Fri 08:00–20:00", "Sat 09:30–17:30", "Sun 10:30–16:00"] as const;
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

export type VenueHoursState = "open" | "closing_soon" | "closed";

function formatOpeningHoursLines(openingHours: string | null | undefined): readonly string[] {
  const raw = typeof openingHours === "string" ? openingHours.trim() : "";
  if (!raw) return DEFAULT_VENUE_LINES;
  const byNl = raw.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  if (byNl.length > 1) return byNl;
  const byComma = raw.split(",").map((s) => s.trim()).filter(Boolean);
  if (byComma.length > 1) return byComma;
  return [raw];
}

function minutesOfDay(d: Date): number {
  return d.getHours() * 60 + d.getMinutes();
}

function parseTimeRange(text: string): { open: number; close: number } | null {
  const m = text.match(/(\d{1,2}):(\d{2})\s*[-–]\s*(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const open = parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
  const close = parseInt(m[3], 10) * 60 + parseInt(m[4], 10);
  if (open < 0 || close < 0 || open > 24 * 60 || close > 24 * 60) return null;
  return { open, close };
}

function isWithin(nowMin: number, open: number, close: number): boolean {
  if (close >= open) return nowMin >= open && nowMin <= close;
  return nowMin >= open || nowMin <= close;
}

function pickLineForWeekday(lines: readonly string[], dayIndex: number): string {
  if (lines.length === 3) {
    if (dayIndex >= 1 && dayIndex <= 5) return lines[0];
    if (dayIndex === 6) return lines[1];
    return lines[2];
  }
  const today = DAY_NAMES[dayIndex];
  let hit = lines.find((l) => l.includes(today));
  if (!hit && dayIndex >= 1 && dayIndex <= 5) {
    hit = lines.find((l) => /mon/i.test(l) && /fri/i.test(l));
  }
  return hit ?? lines[0];
}

export function minutesUntilClosingIfOpen(
  openingHours: string | null | undefined,
  now: Date = new Date()
): number | null {
  const lines = formatOpeningHoursLines(openingHours);
  if (lines.length === 0) return null;
  const dayIx = now.getDay();
  const line = pickLineForWeekday(lines, dayIx);
  let r = parseTimeRange(line);
  if (!r) r = parseTimeRange(lines[0]);
  if (!r) return null;
  const nowMin = minutesOfDay(now);
  if (!isWithin(nowMin, r.open, r.close)) return null;
  if (r.close >= r.open) return r.close - nowMin;
  if (nowMin >= r.open) return 24 * 60 - nowMin + r.close;
  return r.close - nowMin;
}

export function isVenueOpenNow(openingHours: string | null | undefined, now: Date = new Date()): boolean {
  return minutesUntilClosingIfOpen(openingHours, now) != null;
}

const CLOSING_SOON_MINUTES = 60;

export function computeVenueHoursState(
  openingHours: string | null | undefined,
  now: Date = new Date()
): VenueHoursState {
  const mins = minutesUntilClosingIfOpen(openingHours, now);
  if (mins == null) return "closed";
  if (mins <= CLOSING_SOON_MINUTES) return "closing_soon";
  return "open";
}

export function buildVenueStatusPayload(
  openingHours: string | null | undefined,
  restaurantOnline: boolean,
  now: Date = new Date()
) {
  const isOpen = isVenueOpenNow(openingHours, now);
  const hoursState = computeVenueHoursState(openingHours, now);
  const minutesUntilClose = minutesUntilClosingIfOpen(openingHours, now);
  return {
    restaurantOnline,
    isOpen,
    hoursState,
    minutesUntilClose,
    closingSoon: hoursState === "closing_soon"
  };
}
