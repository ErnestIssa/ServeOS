/**
 * Domain event names for payment — publish ONLY after DB commit via outbox.
 */
export const PAYMENT_DOMAIN_EVENTS = [
  "payment.attempt_created",
  "payment.processing",
  "payment.authorized",
  "payment.succeeded",
  "payment.failed",
  "payment.unknown",
  "payment.refunded",
  "payment.disputed",
  "payment.order_mismatch",
  "payment.reconciled"
] as const;

export type PaymentDomainEventType = (typeof PAYMENT_DOMAIN_EVENTS)[number];

export type PaymentDomainEvent = {
  type: PaymentDomainEventType;
  restaurantId: string;
  orderId: string;
  attemptId?: string;
  paymentStatus?: string;
  amountCents?: number;
  at: string;
};

/**
 * Real-time is an optimization. Clients must re-fetch authoritative state on reconnect.
 */
export function buildPaymentReconnectQuery(orderId: string) {
  return {
    path: `/orders/${orderId}`,
    reason: "realtime_reconnect",
    note: "Fetch authoritative order+payment state before resuming event subscriptions."
  };
}
