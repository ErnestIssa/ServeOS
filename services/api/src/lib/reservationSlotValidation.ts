import {
  buildQuickDateOptions,
  dayFromQuickDateOption,
  mergeVisitIntoDateOptions,
  quickDateFromStartsAt,
  resolveQuickDateId,
  timeLabelFromStartsAt,
  TIME_OPTIONS,
  type QuickDateOption
} from "./reservationPresets.js";
import { resolveReservationStartsAt } from "./reservationBooking.js";
import {
  getHoursRangeForDate,
  isTimeWithinRange,
  parse24hLabel
} from "./venueHours.js";
import { validateReservationStartInput, type ReservationStartValidated } from "./reservationStartValidation.js";

/** Must book at least this many minutes ahead of now. */
export const RESERVATION_MIN_LEAD_MINUTES = 30;

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

function dayFromQuickDateId(
  quickDateId: string | null,
  dateLabel: string,
  now = new Date(),
  dateOptions?: readonly QuickDateOption[]
): Date {
  const quick = dateOptions ?? buildQuickDateOptions(10, now);
  const id = resolveQuickDateId(quick, dateLabel, quickDateId);
  const opt = id ? quick.find((o) => o.id === id) : quick.find((o) => o.dateLabel === dateLabel);
  if (opt) return dayFromQuickDateOption(opt, now);
  let dayOffset = 0;
  if (id?.match(/^d(\d+)$/)) {
    dayOffset = Number.parseInt(id.slice(1), 10);
  } else if (dateLabel === "Today") {
    dayOffset = 0;
  } else if (dateLabel === "Tomorrow") {
    dayOffset = 1;
  }
  return addDays(startOfDay(now), dayOffset);
}

export type SlotTimeOption = {
  id: string;
  label: string;
  available: boolean;
  reason?: string;
};

export type SlotDateOption = QuickDateOption & { hasAvailableSlots: boolean };

export type SlotPickerPayload = {
  dateOptions: SlotDateOption[];
  timeOptions: SlotTimeOption[];
  quickDateId: string;
  dateLabel: string;
  timeLabel: string;
  minLeadMinutes: number;
};

/** Existing booking slot — always selectable in edit picker on its visit day. */
export type PinnedReservationSlot = {
  quickDateId: string;
  dateLabel: string;
  timeLabel: string;
  /** Start-of-day ms for the booked visit (stable vs rolling d0…d9 ids). */
  visitDayMs: number;
};

function pinnedAppliesToVisitDay(
  pinned: PinnedReservationSlot | null | undefined,
  visitDay: Date
): boolean {
  if (!pinned) return false;
  return startOfDay(visitDay).getTime() === pinned.visitDayMs;
}

function unavailableReason(
  startsAt: Date,
  now: Date,
  minutes: number,
  hours: { open: number; close: number } | null
): string | null {
  const minStart = new Date(now.getTime() + RESERVATION_MIN_LEAD_MINUTES * 60_000);
  if (startsAt.getTime() < minStart.getTime()) {
    return "too_soon";
  }
  if (hours && !isTimeWithinRange(minutes, hours.open, hours.close)) {
    return "outside_hours";
  }
  return null;
}

export function buildSlotPickerForDate(
  openingHours: string | null | undefined,
  quickDateId: string | null,
  dateLabel: string,
  preferredTimeLabel: string | null,
  now = new Date(),
  pinnedSlot?: PinnedReservationSlot | null,
  dateOptionsBase?: readonly QuickDateOption[]
): SlotPickerPayload {
  const dateOptions = dateOptionsBase ?? buildQuickDateOptions(10, now);
  const resolvedId = resolveQuickDateId(dateOptions, dateLabel, quickDateId) ?? dateOptions[0]?.id ?? "d0";
  const dateOpt = dateOptions.find((o) => o.id === resolvedId) ?? dateOptions[0]!;
  const visitDay = dayFromQuickDateId(resolvedId, dateOpt.dateLabel, now, dateOptions);
  const hours = getHoursRangeForDate(openingHours, visitDay);
  const pinActive = pinnedAppliesToVisitDay(pinnedSlot, visitDay);

  const timeOptions: SlotTimeOption[] = TIME_OPTIONS.map((t) => {
    const minutes = parse24hLabel(t.label);
    const slotStart = new Date(visitDay);
    slotStart.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
    const reason = unavailableReason(slotStart, now, minutes, hours);
    const pinned = pinActive && pinnedSlot!.timeLabel === t.label;
    const available = reason == null || pinned;
    return {
      id: t.id,
      label: t.label,
      available,
      ...(reason && !pinned ? { reason } : {})
    };
  });

  const available = timeOptions.filter((t) => t.available);
  let timeLabel = preferredTimeLabel ?? "";
  if (!timeLabel || !available.some((t) => t.label === timeLabel)) {
    timeLabel = available[0]?.label ?? "";
  }

  return {
    dateOptions: dateOptions.map((d) => ({
      ...d,
      hasAvailableSlots: d.id === resolvedId ? available.length > 0 : true
    })),
    timeOptions,
    quickDateId: resolvedId,
    dateLabel: dateOpt.dateLabel,
    timeLabel,
    minLeadMinutes: RESERVATION_MIN_LEAD_MINUTES
  };
}

/** Full picker for book bar + edit — only dates/times the API allows. */
export function buildReservationSlotPicker(
  openingHours: string | null | undefined,
  quickDateId: string | null,
  dateLabel: string,
  preferredTimeLabel: string | null,
  now = new Date(),
  pinnedSlot?: PinnedReservationSlot | null,
  visitStartsAt?: Date | null
): SlotPickerPayload {
  let baseDates = buildQuickDateOptions(10, now);
  if (visitStartsAt) {
    baseDates = mergeVisitIntoDateOptions(baseDates, visitStartsAt, now);
  }
  const timesScratch: Record<string, string[]> = {};
  const dated = baseDates.map((d) => {
    const slice = buildSlotPickerForDate(openingHours, d.id, d.dateLabel, null, now, pinnedSlot, baseDates);
    const labels = slice.timeOptions.filter((t) => t.available).map((t) => t.label);
    timesScratch[d.id] = labels;
    return { ...d, hasAvailableSlots: labels.length > 0 };
  });

  const { bookableDates } = pruneEditSlotMatrix(timesScratch, dated);

  let resolvedId = resolveQuickDateId(bookableDates, dateLabel, quickDateId) ?? bookableDates[0]?.id ?? "d0";
  let dateOpt = bookableDates.find((o) => o.id === resolvedId) ?? bookableDates[0];
  if (!dateOpt) {
    return {
      dateOptions: [],
      timeOptions: TIME_OPTIONS.map((t) => ({ id: t.id, label: t.label, available: false })),
      quickDateId: "d0",
      dateLabel: "Today",
      timeLabel: "",
      minLeadMinutes: RESERVATION_MIN_LEAD_MINUTES
    };
  }

  const picker = buildSlotPickerForDate(
    openingHours,
    resolvedId,
    dateOpt.dateLabel,
    preferredTimeLabel,
    now,
    pinnedSlot,
    baseDates
  );

  return {
    ...picker,
    dateOptions: bookableDates
  };
}

export type EditSlotPickerPayload = SlotPickerPayload & {
  /** Available HH:mm labels per date id — for edit UI without refetch per spin. */
  timesByDateId: Record<string, string[]>;
};

/** One load for manage-booking edit: all bookable days + their times. */
export function buildEditReservationSlotPicker(
  openingHours: string | null | undefined,
  visitStartsAt: Date,
  now = new Date(),
  pinnedSlot?: PinnedReservationSlot | null
): EditSlotPickerPayload {
  let baseDates = buildQuickDateOptions(10, now);
  baseDates = mergeVisitIntoDateOptions(baseDates, visitStartsAt, now);

  const timesByDateId: Record<string, string[]> = {};
  const dated: SlotDateOption[] = baseDates.map((d) => {
    const visitDay = dayFromQuickDateOption(d, now);
    const preferred =
      pinnedSlot && pinnedAppliesToVisitDay(pinnedSlot, visitDay) ? pinnedSlot.timeLabel : null;
    const slice = buildSlotPickerForDate(
      openingHours,
      d.id,
      d.dateLabel,
      preferred,
      now,
      pinnedSlot,
      baseDates
    );
    const labels = slice.timeOptions.filter((t) => t.available).map((t) => t.label);
    timesByDateId[d.id] = labels;
    return { ...d, hasAvailableSlots: labels.length > 0 };
  });

  const canonical = quickDateFromStartsAt(visitStartsAt, now);
  const timeLabel = timeLabelFromStartsAt(visitStartsAt);
  let resolvedId = canonical.id;
  let dateOpt = dated.find((o) => o.id === resolvedId) ?? dated.find((o) => o.hasAvailableSlots) ?? dated[0]!;
  if (!dateOpt.hasAvailableSlots) {
    const fallback = dated.find((o) => o.hasAvailableSlots);
    if (fallback) {
      resolvedId = fallback.id;
      dateOpt = fallback;
    }
  }

  const { bookableDates, timesByDateId: prunedTimes } = pruneEditSlotMatrix(timesByDateId, dated);

  if (bookableDates.length === 0) {
    return {
      dateOptions: [],
      timeOptions: [],
      quickDateId: "d0",
      dateLabel: "Today",
      timeLabel: "",
      minLeadMinutes: RESERVATION_MIN_LEAD_MINUTES,
      timesByDateId: {}
    };
  }

  let pickId = resolvedId;
  if (!prunedTimes[pickId]?.length) {
    pickId = bookableDates[0]!.id;
  }
  const pickOpt = bookableDates.find((o) => o.id === pickId) ?? bookableDates[0]!;
  const pickTimes = prunedTimes[pickId] ?? [];
  const pickTime = pickTimes.includes(timeLabel) ? timeLabel : pickTimes[0]!;

  return {
    dateOptions: bookableDates,
    timeOptions: TIME_OPTIONS.map((t) => ({
      id: t.id,
      label: t.label,
      available: pickTimes.includes(t.label)
    })),
    quickDateId: pickId,
    dateLabel: pickOpt.dateLabel,
    timeLabel: pickTime,
    minLeadMinutes: RESERVATION_MIN_LEAD_MINUTES,
    timesByDateId: prunedTimes
  };
}

/** Drop dates with zero times; drop orphan time keys. Date and time lists stay paired. */
function pruneEditSlotMatrix(
  timesByDateId: Record<string, string[]>,
  dated: SlotDateOption[]
): { bookableDates: SlotDateOption[]; timesByDateId: Record<string, string[]> } {
  const pruned: Record<string, string[]> = {};
  const bookableDates: SlotDateOption[] = [];
  for (const d of dated) {
    const labels = (timesByDateId[d.id] ?? []).filter((x) => x.length > 0);
    if (labels.length === 0) continue;
    pruned[d.id] = labels;
    bookableDates.push({ ...d, hasAvailableSlots: true });
  }
  return { bookableDates, timesByDateId: pruned };
}

export type ScheduleValidationResult =
  | { ok: true; validated: ReservationStartValidated; startsAt: Date }
  | { ok: false; error: string; fields?: Record<string, string> };

export function validateReservationSchedule(
  raw: unknown,
  openingHours: string | null | undefined,
  now = new Date(),
  pinnedSlot?: PinnedReservationSlot | null
): ScheduleValidationResult {
  const parsed = validateReservationStartInput(raw);
  if (!parsed.ok) {
    return { ok: false, error: parsed.error, fields: parsed.fields };
  }

  const v = parsed.data;
  const startsAt = resolveReservationStartsAt(v.quickDateId, v.dateLabel, v.timeLabel, now);
  let dateOptions = buildQuickDateOptions(10, now);
  if (pinnedSlot) {
    dateOptions = mergeVisitIntoDateOptions(dateOptions, new Date(pinnedSlot.visitDayMs), now);
  }
  const visitDay = dayFromQuickDateId(v.quickDateId, v.dateLabel, now, dateOptions);
  const hours = getHoursRangeForDate(openingHours, visitDay);
  const minutes = parse24hLabel(v.timeLabel);
  const pinActive =
    pinnedSlot != null &&
    pinnedAppliesToVisitDay(pinnedSlot, visitDay) &&
    pinnedSlot.timeLabel === v.timeLabel;

  const reason = unavailableReason(startsAt, now, minutes, hours);
  if (reason === "too_soon" && !pinActive) {
    return {
      ok: false,
      error: "slot_unavailable",
      fields: {
        timeLabel: "past_or_too_soon",
        dateLabel: visitDay.getTime() <= startOfDay(now).getTime() ? "past" : "invalid"
      }
    };
  }
  if (reason === "outside_hours" && !pinActive) {
    return {
      ok: false,
      error: "slot_unavailable",
      fields: { timeLabel: "outside_hours" }
    };
  }

  return { ok: true, validated: v, startsAt };
}

export function scheduleFieldErrorMessage(fields?: Record<string, string>): string {
  if (!fields) return "Please choose an available date and time.";
  if (fields.timeLabel === "past_or_too_soon") {
    return "That time has already passed. Pick a later slot at least 30 minutes from now.";
  }
  if (fields.timeLabel === "outside_hours") {
    return "That time is outside the restaurant's opening hours.";
  }
  if (fields.dateLabel === "past") return "You can't book a date in the past.";
  if (fields.timeLabel) return "Please choose an available time.";
  if (fields.dateLabel) return "Please choose an available date.";
  return "Please choose an available date and time.";
}
