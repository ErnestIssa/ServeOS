/** Customer reservation flow screens (UI shell — API wiring later). */
export type ReservationScreenId =
  | "landing"
  | "builder"
  | "availability"
  | "checkout"
  | "confirmation"
  | "management"
  | "group_event";

export type ReservationDraft = {
  branchId: string | null;
  /** Quick-bar calendar id (`d0`…), set after server validation. */
  quickDateId: string | null;
  quickPickIds: string[];
  guests: number;
  dateLabel: string;
  timeLabel: string;
  seatingPreference: string | null;
  occasion: string | null;
  accessibilityNotes: string;
  tableId: string | null;
  slotLabel: string | null;
};

export const EMPTY_RESERVATION_DRAFT: ReservationDraft = {
  branchId: null,
  quickDateId: null,
  quickPickIds: [],
  guests: 1,
  dateLabel: "Today",
  timeLabel: "21:00",
  seatingPreference: null,
  occasion: null,
  accessibilityNotes: "",
  tableId: null,
  slotLabel: null
};

export type ReservationFlowContext = {
  restaurantId: string;
  restaurantName: string;
  userDisplayName: string;
};
