/**
 * Delivery semantics for all order event consumers (KDS, notifications, admin WS, analytics).
 * Producers guarantee at-least-once ordered delivery per orderId via outbox sequence.
 * Consumers MUST dedupe on `eventId` and tolerate replays.
 */
export const ORDER_EVENT_DELIVERY = {
  guarantee: "at-least-once" as const,
  ordering: "per-orderId by sequence ascending" as const,
  dedupeKey: "eventId" as const,
  idempotentConsumerRequired: true as const
};

export type OrderConsumerIdempotencyRule = {
  consumer: string;
  dedupeField: "eventId" | "orderId+sequence";
  notes: string;
};

export const ORDER_CONSUMER_IDEMPOTENCY_RULES: OrderConsumerIdempotencyRule[] = [
  {
    consumer: "kds",
    dedupeField: "eventId",
    notes: "Apply status only if envelope.sequence > lastAppliedSequence for orderId."
  },
  {
    consumer: "notifications",
    dedupeField: "eventId",
    notes: "Skip push/in-app if notification already sent for eventId."
  },
  {
    consumer: "admin_dashboard_ws",
    dedupeField: "eventId",
    notes: "Refresh list row by orderId; ignore duplicate eventId."
  },
  {
    consumer: "analytics",
    dedupeField: "eventId",
    notes: "Insert into event store with unique eventId constraint."
  },
  {
    consumer: "customer_tracking",
    dedupeField: "orderId+sequence",
    notes: "Timeline entries keyed by sequence; ignore lower or equal sequence."
  }
];

export function shouldApplyOrderEvent(
  lastAppliedSequence: number | null | undefined,
  incomingSequence: number
): boolean {
  if (lastAppliedSequence == null) return true;
  return incomingSequence > lastAppliedSequence;
}
