import { ACCESSIBILITY_CARD_OPTIONS, type AccessibilityCardOption } from "./reservationPresets";
import { detailCardRecapLabels, firstDetailCardScrollIndex } from "./detailCardSelection";

const NONE_ID = "none";

/** Toggle one accessibility card; `none` clears others and vice versa. */
export function toggleAccessibilityNoteId(ids: string[], option: AccessibilityCardOption): string[] {
  if (option.id === NONE_ID) {
    return ids.includes(NONE_ID) ? [] : [NONE_ID];
  }
  const withoutNone = ids.filter((id) => id !== NONE_ID);
  if (withoutNone.includes(option.id)) {
    return withoutNone.filter((id) => id !== option.id);
  }
  return [...withoutNone, option.id];
}

export function accessibilityRecapLabels(ids: string[]): string[] {
  return detailCardRecapLabels(ids, ACCESSIBILITY_CARD_OPTIONS, [NONE_ID]);
}

export function firstAccessibilityScrollIndex(ids: string[]): number | null {
  return firstDetailCardScrollIndex(ids, ACCESSIBILITY_CARD_OPTIONS);
}
