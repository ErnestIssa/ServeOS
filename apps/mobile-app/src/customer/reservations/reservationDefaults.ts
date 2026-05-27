import { getTodaysClosingMinutesOfDay, minutesOfDayTo24hLabel } from "../venueOpenNow";
import { TIME_OPTIONS } from "./reservationPresets";
import { EMPTY_RESERVATION_DRAFT, type ReservationDraft } from "./reservationTypes";

function parse24hLabel(label: string): number {
  const m = label.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return 0;
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
}

/** Nearest preset at or before closing; exact match when listed. */
export function defaultBookingTimeLabel(openingHours: string | null | undefined): string {
  const closeMin = getTodaysClosingMinutesOfDay(openingHours);
  const targetLabel = closeMin != null ? minutesOfDayTo24hLabel(closeMin) : "21:00";
  const labels = TIME_OPTIONS.map((t) => t.label);
  const exact = labels.find((l) => l === targetLabel);
  if (exact) return exact;
  const targetM = parse24hLabel(targetLabel);
  let best = labels[labels.length - 1] ?? "21:00";
  for (const l of labels) {
    if (parse24hLabel(l) <= targetM) {
      best = l;
    }
  }
  return best;
}

export function createDefaultReservationDraft(openingHours?: string | null | undefined): ReservationDraft {
  return {
    ...EMPTY_RESERVATION_DRAFT,
    guests: 1,
    dateLabel: "Today",
    timeLabel: defaultBookingTimeLabel(openingHours ?? null)
  };
}
