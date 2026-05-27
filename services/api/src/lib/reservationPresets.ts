/** Server copy of mobile `reservationPresets` / `reservationQuickDates` — keep IDs in sync. */

export const GUEST_COUNTS = [1, 2, 3, 4, 5, 6, 8] as const;

export const TIME_OPTIONS = [
  { id: "17:30", label: "17:30" },
  { id: "18:00", label: "18:00" },
  { id: "18:30", label: "18:30" },
  { id: "19:00", label: "19:00" },
  { id: "19:30", label: "19:30" },
  { id: "20:00", label: "20:00" },
  { id: "20:30", label: "20:30" },
  { id: "21:00", label: "21:00" }
] as const;

export const LEGACY_DATE_OPTIONS = [
  { id: "today", label: "Today" },
  { id: "tomorrow", label: "Tomorrow" },
  { id: "weekend", label: "This weekend" },
  { id: "next_week", label: "Next week" }
] as const;

export const BRANCH_OPTIONS = [
  { id: "main", label: "Main dining room" },
  { id: "terrace", label: "Terrace" },
  { id: "lounge", label: "Private lounge" }
] as const;

export const RECOMMENDATION_PICKS = [
  { id: "quiet", label: "Quiet table" },
  { id: "early", label: "Earlier slot" },
  { id: "booth", label: "Booth" }
] as const;

export type QuickDateOption = {
  id: string;
  label: string;
  dateLabel: string;
  sublabel?: string;
};

const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function formatSublabel(d: Date): string {
  return `${d.getDate()} ${MONTH_SHORT[d.getMonth()]}`;
}

function formatDateLabel(d: Date, offset: number): { label: string; dateLabel: string } {
  if (offset === 0) return { label: "Today", dateLabel: "Today" };
  if (offset === 1) return { label: "Tomorrow", dateLabel: "Tomorrow" };
  const wd = WEEKDAY_SHORT[d.getDay()];
  const sub = formatSublabel(d);
  return { label: wd, dateLabel: `${wd} · ${sub}` };
}

export function buildQuickDateOptions(dayCount = 10, now = new Date()): QuickDateOption[] {
  const base = startOfDay(now);
  const out: QuickDateOption[] = [];
  for (let i = 0; i < dayCount; i++) {
    const d = addDays(base, i);
    const { label, dateLabel } = formatDateLabel(d, i);
    out.push({
      id: `d${i}`,
      label,
      dateLabel,
      sublabel: i >= 2 ? formatSublabel(d) : undefined
    });
  }
  return out;
}

export function resolveQuickDateId(
  options: readonly QuickDateOption[],
  dateLabel: string,
  quickDateId?: string | null
): string | null {
  if (quickDateId && options.some((o) => o.id === quickDateId)) return quickDateId;
  const hit = options.find((o) => o.dateLabel === dateLabel || o.label === dateLabel);
  return hit?.id ?? null;
}
