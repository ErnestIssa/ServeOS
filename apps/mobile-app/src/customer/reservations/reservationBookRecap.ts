import { accessibilityRecapLabels } from "./accessibilitySelection";
import { experienceRecapLabels } from "./experienceSelection";
import type { ReservationDraft } from "./reservationTypes";

/** How many prior book steps to reflect (step 2 → 1, step 3 → 1–2, confirmation recap → 1–3). */
export type BookRecapLevel = 1 | 2 | 3;

/** Read-only summary parts — never repeats questions from later steps. */
export function buildBookRecapParts(draft: ReservationDraft, throughLevel: BookRecapLevel): string[] {
  const parts: string[] = [];

  if (throughLevel >= 1) {
    const guests = Math.max(1, draft.guests);
    parts.push(`${guests} guest${guests === 1 ? "" : "s"}`);
    if (draft.dateLabel.trim()) parts.push(draft.dateLabel.trim());
    const time = (draft.timeLabel || draft.slotLabel || "").trim();
    if (time) parts.push(time);

    const experience = experienceRecapLabels(draft.quickPickIds);
    if (experience.length > 0) parts.push(experience.join(", "));
  }

  if (throughLevel >= 2) {
    const access = accessibilityRecapLabels(draft.accessibilityNoteIds);
    if (access.length > 0) parts.push(access.join(", "));
  }

  if (throughLevel >= 3) {
    const note = draft.restaurantNote.trim();
    if (note) {
      parts.push(note.length > 48 ? `${note.slice(0, 45)}…` : note);
    }
  }

  return parts;
}
