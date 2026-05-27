/** Calendar-backed quick picks for the landing booking bar. */

export type QuickDateOption = {
  id: string;
  /** Compact chip label (Today, Tomorrow, Fri). */
  label: string;
  /** Stored on `ReservationDraft.dateLabel`. */
  dateLabel: string;
  /** Secondary line under chip when space allows. */
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

/** Rolling window from today (inclusive). */
export function buildQuickDateOptions(dayCount = 10): QuickDateOption[] {
  const base = startOfDay(new Date());
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

export function quickDateIdFromLabel(
  options: readonly QuickDateOption[],
  dateLabel: string
): string | null {
  const hit = options.find((o) => o.dateLabel === dateLabel || o.label === dateLabel);
  return hit?.id ?? options[0]?.id ?? null;
}
