/** Server copy of mobile venue hours helpers — keep parsing in sync. */

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

export const DEFAULT_VENUE_LINES = ["Mon–Fri 08:00–20:00", "Sat 09:30–17:30", "Sun 10:30–16:00"] as const;

export function formatOpeningHoursLines(openingHours: string | null | undefined): readonly string[] {
  const raw = typeof openingHours === "string" ? openingHours.trim() : "";
  if (!raw) return DEFAULT_VENUE_LINES;

  const byNl = raw.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  if (byNl.length > 1) return byNl;

  const byComma = raw.split(",").map((s) => s.trim()).filter(Boolean);
  if (byComma.length > 1) return byComma;

  return [raw];
}

function parseTimeRange(text: string): { open: number; close: number } | null {
  const m = text.match(/(\d{1,2}):(\d{2})\s*[-–]\s*(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const open = parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
  const close = parseInt(m[3], 10) * 60 + parseInt(m[4], 10);
  if (open < 0 || close < 0 || open > 24 * 60 || close > 24 * 60) return null;
  return { open, close };
}

function pickLineForWeekday(lines: readonly string[], dayIndex: number): string {
  if (lines.length === 3) {
    if (dayIndex >= 1 && dayIndex <= 5) return lines[0]!;
    if (dayIndex === 6) return lines[1]!;
    return lines[2]!;
  }
  const today = DAY_NAMES[dayIndex];
  let hit = lines.find((l) => l.includes(today));
  if (!hit && dayIndex >= 1 && dayIndex <= 5) {
    hit = lines.find((l) => /mon/i.test(l) && /fri/i.test(l));
  }
  return hit ?? lines[0]!;
}

export function getHoursRangeForDate(
  openingHours: string | null | undefined,
  day: Date
): { open: number; close: number } | null {
  const lines = formatOpeningHoursLines(openingHours);
  if (lines.length === 0) return null;
  const line = pickLineForWeekday(lines, day.getDay());
  let r = parseTimeRange(line);
  if (!r) r = parseTimeRange(lines[0]!);
  return r;
}

export function parse24hLabel(label: string): number {
  const m = label.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return 0;
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
}

export function isTimeWithinRange(minutes: number, open: number, close: number): boolean {
  if (close >= open) return minutes >= open && minutes <= close;
  return minutes >= open || minutes <= close;
}
