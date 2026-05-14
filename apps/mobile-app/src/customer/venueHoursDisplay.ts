/** Legacy single-line default (comma-separated); split into rows for display. */
export const DEFAULT_VENUE_HOURS_LINE =
  "Mon–Fri 08:00–20:00, Sat 09:30–17:30, Sun 10:30–16:00";

/** One row per entry; same hours grouped on one row for our default schedule. */
export const DEFAULT_VENUE_LINES = ["Mon–Fri 08:00–20:00", "Sat 09:30–17:30", "Sun 10:30–16:00"] as const;
const DEFAULT_LINES = DEFAULT_VENUE_LINES;

export function displayOpeningHours(openingHours: string | null | undefined): string {
  const t = typeof openingHours === "string" ? openingHours.trim() : "";
  return t.length > 0 ? t : DEFAULT_VENUE_HOURS_LINE;
}

/** Short label for modal / badges. */
export function openingHoursStatusLabel(openingHours: string | null | undefined): string {
  const t = typeof openingHours === "string" ? openingHours.trim() : "";
  return t.length > 0 ? "Owner-listed hours" : "Default hours";
}

/**
 * Opening hours as separate lines (no commas between rows).
 * Default DB null → Mon–Fri / Sat / Sun rows. Owner text: newline chunks, else comma-separated chunks, else one line.
 */
export function formatOpeningHoursLines(openingHours: string | null | undefined): readonly string[] {
  const raw = typeof openingHours === "string" ? openingHours.trim() : "";
  if (!raw) return DEFAULT_LINES;

  const byNl = raw.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  if (byNl.length > 1) return byNl;

  const byComma = raw.split(",").map((s) => s.trim()).filter(Boolean);
  if (byComma.length > 1) return byComma;

  return [raw];
}
