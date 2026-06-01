import type { ReservationScreenId } from "./reservationTypes";

/** Reserve-a-table linear flow (landing is step 1 — no label on card). */
export const RESERVATION_BOOK_STEP_TOTAL = 4;

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

/** Display index per screen (landing = 1 is never shown on the card). */
export const RESERVATION_BOOK_STEP_NUMBER = {
  builder: 2,
  availability: 3,
  confirmation: 4
} as const;

export function reservationBookStepNumber(screen: ReservationScreenId): number | null {
  const n =
    screen === "builder"
      ? 2
      : screen === "availability"
        ? 3
        : screen === "confirmation"
          ? 4
          : null;
  return n;
}
