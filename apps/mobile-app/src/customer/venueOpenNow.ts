import React from "react";
import { formatOpeningHoursLines } from "./venueHoursDisplay";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

function minutesOfDay(d: Date): number {
  return d.getHours() * 60 + d.getMinutes();
}

/** First open–close range in a line (supports - or en-dash). */
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

/** 12-hour label for a minute-of-day (0–1440), normalized for overnight display. */
function formatMinutes12h(totalMin: number): string {
  const m = ((totalMin % (24 * 60)) + 24 * 60) % (24 * 60);
  const h = Math.floor(m / 60);
  const min = m % 60;
  const period = h >= 12 ? "PM" : "AM";
  const hr12 = h % 12 === 0 ? 12 : h % 12;
  return `${hr12}:${min.toString().padStart(2, "0")} ${period}`;
}

/**
 * When the venue is open now, returns the closing time for today’s applicable range (e.g. `"9:00 PM"`).
 * Otherwise `null` (no hint while closed or hours not parseable).
 */
export function formatTodaysClosingHint(openingHours: string | null | undefined, now: Date = new Date()): string | null {
  const lines = formatOpeningHoursLines(openingHours);
  if (lines.length === 0) return null;
  const dayIx = now.getDay();
  const line = pickLineForWeekday(lines, dayIx);
  let r = parseTimeRange(line);
  if (!r) {
    r = parseTimeRange(lines[0]);
  }
  if (!r) return null;
  const nowMin = minutesOfDay(now);
  if (!isWithin(nowMin, r.open, r.close)) return null;
  return formatMinutes12h(r.close);
}

/**
 * Whole minutes until closing for the **current** open session, or `null` if closed / unparseable.
 */
export function minutesUntilClosingIfOpen(openingHours: string | null | undefined, now: Date = new Date()): number | null {
  const lines = formatOpeningHoursLines(openingHours);
  if (lines.length === 0) return null;
  const dayIx = now.getDay();
  const line = pickLineForWeekday(lines, dayIx);
  let r = parseTimeRange(line);
  if (!r) {
    r = parseTimeRange(lines[0]);
  }
  if (!r) return null;
  const nowMin = minutesOfDay(now);
  if (!isWithin(nowMin, r.open, r.close)) return null;
  if (r.close >= r.open) {
    return r.close - nowMin;
  }
  if (nowMin >= r.open) {
    return 24 * 60 - nowMin + r.close;
  }
  return r.close - nowMin;
}

/**
 * Whether the venue is considered open at `now` from free-text / structured hours lines.
 * Three-line schedules use Mon–Fri / Sat / Sun rows; otherwise match day name or Mon–Fri block for weekdays.
 */
export function isVenueOpenNow(openingHours: string | null | undefined, now: Date = new Date()): boolean {
  const lines = formatOpeningHoursLines(openingHours);
  if (lines.length === 0) return false;

  const dayIx = now.getDay();
  const nowMin = minutesOfDay(now);
  const line = pickLineForWeekday(lines, dayIx);
  const r = parseTimeRange(line);
  if (r) return isWithin(nowMin, r.open, r.close);
  const r0 = parseTimeRange(lines[0]);
  if (r0) return isWithin(nowMin, r0.open, r0.close);
  return false;
}

/** Re-render periodically so Open / Closed updates while the user stays on screen. */
export function useVenueClockTick(intervalMs = 30000): Date {
  const [now, setNow] = React.useState(() => new Date());
  React.useEffect(() => {
    const t = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}
