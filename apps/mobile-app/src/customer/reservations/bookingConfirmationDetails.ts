import { accessibilityRecapLabels } from "./accessibilitySelection";
import { experienceRecapLabels } from "./experienceSelection";
import type { ReservationDraft } from "./reservationTypes";

export type BookingConfirmationDetailRow = {
  label: string;
  value: string;
};

/** Plain detail rows for confirmation (no cards or bordered sections). */
export function buildBookingConfirmationDetailRows(draft: ReservationDraft): BookingConfirmationDetailRow[] {
  const rows: BookingConfirmationDetailRow[] = [];
  const guests = Math.max(1, draft.guests);

  rows.push({
    label: "Visit",
    value: `${guests} guest${guests === 1 ? "" : "s"} · ${draft.dateLabel.trim()} · ${(draft.timeLabel || draft.slotLabel || "").trim()}`
  });

  const experience = experienceRecapLabels(draft.quickPickIds);
  if (experience.length > 0) {
    rows.push({ label: "Experience", value: experience.join(", ") });
  }

  const access = accessibilityRecapLabels(draft.accessibilityNoteIds);
  if (access.length > 0) {
    rows.push({ label: "Accessibility", value: access.join(", ") });
  }

  const note = draft.restaurantNote.trim();
  if (note) {
    rows.push({ label: "Note for the restaurant", value: note });
  }

  return rows;
}
