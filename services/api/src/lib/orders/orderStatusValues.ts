/** All writable order statuses for API validation (excludes legacy aliases). */
export const ORDER_STATUS_VALUES = [
  "CREATED",
  "PENDING_PAYMENT",
  "PAID",
  "ACCEPTED",
  "REJECTED",
  "PREPARING",
  "READY",
  "COMPLETED",
  "CANCELLED",
  "REFUNDED",
  "PARTIALLY_REFUNDED",
  "ARCHIVED",
  "PENDING",
  "CONFIRMED"
] as const;

export type ApiOrderStatus = (typeof ORDER_STATUS_VALUES)[number];
