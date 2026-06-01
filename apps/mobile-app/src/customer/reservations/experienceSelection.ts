import { EXPERIENCE_CARD_OPTIONS } from "./reservationPresets";
import { detailCardRecapLabels, toggleDetailCardId, type DetailCardOption } from "./detailCardSelection";

export function toggleExperiencePickId(ids: string[], option: DetailCardOption): string[] {
  return toggleDetailCardId(ids, option);
}

export function experienceRecapLabels(ids: string[]): string[] {
  return detailCardRecapLabels(ids, EXPERIENCE_CARD_OPTIONS);
}
