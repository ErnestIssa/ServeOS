import type { ReservationSlotPicker } from "./reservationApi";

/** Client-side mirror of API prune — only dates with ≥1 time, only times for listed dates. */
export function normalizeEditSlotPicker(res: ReservationSlotPicker) {
  const raw = res.timesByDateId ?? {};
  const bookableDates = res.dateOptions.filter((d) => {
    const times = raw[d.id] ?? [];
    return times.length > 0;
  });

  const timesByDateId: Record<string, string[]> = {};
  for (const d of bookableDates) {
    timesByDateId[d.id] = raw[d.id] ?? [];
  }

  const bookableDateIds = bookableDates.map((d) => d.id);
  let quickDateId = res.quickDateId;
  let dateLabel = res.dateLabel;
  let timeLabel = res.timeLabel;

  if (!timesByDateId[quickDateId]?.length && bookableDateIds[0]) {
    quickDateId = bookableDateIds[0]!;
    dateLabel = bookableDates[0]!.dateLabel;
    const times = timesByDateId[quickDateId]!;
    timeLabel = times.includes(timeLabel) ? timeLabel : times[0]!;
  } else {
    const times = timesByDateId[quickDateId] ?? [];
    timeLabel = times.includes(timeLabel) ? timeLabel : times[0] ?? "";
  }

  return {
    dateOptions: bookableDates,
    timesByDateId,
    bookableDateIds,
    quickDateId,
    dateLabel,
    timeLabel,
    hasChoices: bookableDateIds.length > 0 && (timesByDateId[quickDateId]?.length ?? 0) > 0
  };
}
