import type { ReservationScreenId } from "./reservationTypes";

/** Interactive book steps only (landing + confirmation are not counted). */
export const RESERVATION_BOOK_STEP_TOTAL = 3;

export const RESERVATION_BOOK_FLOW: readonly ReservationScreenId[] = [
  "landing",
  "builder",
  "availability",
  "confirmation"
];

/** Legacy persisted screen ids (checkout step removed). */
export function normalizeReservationScreen(id: ReservationScreenId | "checkout"): ReservationScreenId {
  return id === "checkout" ? "availability" : id;
}

export function isReservationBookFlowScreen(id: ReservationScreenId): boolean {
  return (RESERVATION_BOOK_FLOW as readonly string[]).includes(id);
}

export function reservationBookFlowIndex(id: ReservationScreenId): number {
  return RESERVATION_BOOK_FLOW.indexOf(id);
}

/** Display index per interactive screen (landing + confirmation have no step chrome). */
export const RESERVATION_BOOK_STEP_NUMBER = {
  builder: 2,
  availability: 3
} as const;

export function reservationBookStepNumber(screen: ReservationScreenId): number | null {
  if (screen === "builder") return 2;
  if (screen === "availability") return 3;
  return null;
}
