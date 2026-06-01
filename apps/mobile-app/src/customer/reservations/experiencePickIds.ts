import type { ReservationDraft } from "./reservationTypes";

/** All step-1 experience card ids (branches + quick picks), including legacy `branchId`. */
export function mergedExperiencePickIds(draft: Pick<ReservationDraft, "quickPickIds" | "branchId">): string[] {
  const ids = [...draft.quickPickIds];
  if (draft.branchId && !ids.includes(draft.branchId)) ids.push(draft.branchId);
  return [...new Set(ids)];
}
