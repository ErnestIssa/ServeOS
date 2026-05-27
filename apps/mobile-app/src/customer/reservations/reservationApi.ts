import { apiFetch } from "../../api";
import type { ReservationDraft } from "./reservationTypes";
import { buildQuickDateOptions, quickDateIdFromLabel } from "./reservationQuickDates";

export type ReservationStartFieldErrors = Partial<
  Record<"guests" | "dateLabel" | "timeLabel" | "experience" | "branchId" | "quickPickIds", string>
>;

export type ValidateReservationStartOk = {
  ok: true;
  nextScreen: "builder";
  draft: {
    guests: number;
    dateLabel: string;
    quickDateId: string;
    dayLabel: string;
    timeLabel: string;
    timeId: string;
    branchId: string | null;
    quickPickIds: string[];
  };
};

export type ValidateReservationStartFail = {
  ok: false;
  error: string;
  fields?: ReservationStartFieldErrors;
};

export function reservationStartPayload(draft: ReservationDraft) {
  const dateOptions = buildQuickDateOptions(10);
  const quickDateId =
    draft.quickDateId ?? quickDateIdFromLabel(dateOptions, draft.dateLabel) ?? undefined;
  return {
    guests: draft.guests,
    dateLabel: draft.dateLabel,
    quickDateId: quickDateId ?? null,
    timeLabel: draft.timeLabel,
    branchId: draft.branchId,
    quickPickIds: draft.quickPickIds
  };
}

export function reservationStartErrorMessage(fields?: ReservationStartFieldErrors): string {
  if (!fields || Object.keys(fields).length === 0) {
    return "We couldn't start your reservation. Please try again.";
  }
  if (fields.experience === "pick_at_least_one") {
    return "Choose at least one experience — a branch or a quick pick.";
  }
  if (fields.guests) return "Select how many guests are dining.";
  if (fields.dateLabel) return "Select a date for your visit.";
  if (fields.timeLabel) return "Select a time for your visit.";
  if (fields.branchId || fields.quickPickIds) return "One of your experience choices isn't available.";
  return "Please check your booking details and try again.";
}

export async function validateReservationStart(
  token: string,
  restaurantId: string,
  draft: ReservationDraft
): Promise<ValidateReservationStartOk | ValidateReservationStartFail> {
  return apiFetch<ValidateReservationStartOk | ValidateReservationStartFail>(
    `/customer/restaurants/${encodeURIComponent(restaurantId)}/reservations/validate-start`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(reservationStartPayload(draft))
    }
  );
}

export function mergeValidatedDraft(
  current: ReservationDraft,
  validated: ValidateReservationStartOk["draft"]
): ReservationDraft {
  return {
    ...current,
    guests: validated.guests,
    dateLabel: validated.dateLabel,
    quickDateId: validated.quickDateId,
    timeLabel: validated.timeLabel,
    branchId: validated.branchId,
    quickPickIds: validated.quickPickIds
  };
}
