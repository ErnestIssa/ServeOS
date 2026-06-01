import { apiFetch } from "../../api";
import { EXPERIENCE_BRANCH_IDS } from "./reservationPresets";
import type { ReservationDraft } from "./reservationTypes";
import { buildQuickDateOptions, quickDateIdFromLabel } from "./reservationQuickDates";
import { mergedExperiencePickIds } from "./experiencePickIds";

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
  const experienceIds = mergedExperiencePickIds(draft);
  const branchId = experienceIds.find((id) => EXPERIENCE_BRANCH_IDS.has(id)) ?? null;
  return {
    guests: draft.guests,
    dateLabel: draft.dateLabel,
    quickDateId: quickDateId ?? null,
    timeLabel: draft.timeLabel,
    branchId,
    quickPickIds: experienceIds
  };
}

export function reservationStartErrorMessage(fields?: ReservationStartFieldErrors): string {
  if (!fields || Object.keys(fields).length === 0) {
    return "We couldn't start your reservation. Please try again.";
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
  const quickPickIds = mergedExperiencePickIds({
    ...current,
    branchId: validated.branchId,
    quickPickIds: validated.quickPickIds
  });
  return {
    ...current,
    guests: validated.guests,
    dateLabel: validated.dateLabel,
    quickDateId: validated.quickDateId,
    timeLabel: validated.timeLabel,
    branchId: null,
    quickPickIds
  };
}

export type CustomerReservationApi = {
  id: string;
  restaurantId: string;
  restaurantName: string;
  confirmationCode: string;
  status: "CONFIRMED" | "CANCELLED" | "COMPLETED";
  startsAt: string;
  createdAt: string;
  updatedAt: string;
  draft: ReservationDraft;
};

export async function fetchUpcomingReservations(token: string) {
  return apiFetch<{ ok: true; reservations: CustomerReservationApi[] } | { ok: false; error?: string }>(
    "/customer/reservations/upcoming",
    { headers: { Authorization: `Bearer ${token}` } }
  );
}

export async function fetchCustomerReservation(token: string, reservationId: string) {
  return apiFetch<{ ok: true; reservation: CustomerReservationApi } | { ok: false; error?: string }>(
    `/customer/reservations/${encodeURIComponent(reservationId)}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
}

export async function confirmCustomerReservation(
  token: string,
  restaurantId: string,
  draft: ReservationDraft
) {
  return apiFetch<{ ok: true; reservation: CustomerReservationApi } | { ok: false; error?: string; fields?: ReservationStartFieldErrors }>(
    `/customer/restaurants/${encodeURIComponent(restaurantId)}/reservations`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        ...reservationStartPayload(draft),
        seatingPreference: draft.seatingPreference,
        occasion: draft.occasion,
        accessibilityNoteIds: draft.accessibilityNoteIds,
        restaurantNote: draft.restaurantNote,
        tableId: draft.tableId,
        slotLabel: draft.slotLabel
      })
    }
  );
}

export async function patchCustomerReservation(
  token: string,
  reservationId: string,
  patch: Partial<ReservationDraft>
) {
  return apiFetch<{ ok: true; reservation: CustomerReservationApi } | { ok: false; error?: string; fields?: ReservationStartFieldErrors }>(
    `/customer/reservations/${encodeURIComponent(reservationId)}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(patch)
    }
  );
}

export async function cancelCustomerReservation(token: string, reservationId: string) {
  return apiFetch<{ ok: true; reservation: CustomerReservationApi } | { ok: false; error?: string }>(
    `/customer/reservations/${encodeURIComponent(reservationId)}/cancel`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` }
    }
  );
}
