import type { OrderEventEnvelopeV1 } from "./orderEventSchema.js";

/** What each downstream system needs from order events — producer contract reference. */

export type KdsOrderEventView = Pick<
  OrderEventEnvelopeV1["payload"],
  "status" | "canonicalStatus" | "displayNumber"
> & {
  orderId: string;
  restaurantId: string;
  sequence: number;
  eventId: string;
};

export type AdminOrderEventView = KdsOrderEventView & {
  totalCents: number;
  paymentStatus: string | null;
  fromStatus: string | null;
};

export type CustomerTrackingEventView = Pick<
  OrderEventEnvelopeV1["payload"],
  "status" | "canonicalStatus" | "displayNumber"
> & {
  orderId: string;
  sequence: number;
  occurredAt: string;
};

export type AnalyticsOrderEventRow = {
  eventId: string;
  type: string;
  orderId: string;
  restaurantId: string;
  sequence: number;
  occurredAt: string;
  canonicalStatus: string;
  totalCents: number;
  paymentStatus: string | null;
};

export function toKdsView(envelope: OrderEventEnvelopeV1): KdsOrderEventView {
  return {
    eventId: envelope.eventId,
    orderId: envelope.orderId,
    restaurantId: envelope.restaurantId,
    sequence: envelope.sequence,
    status: envelope.payload.status,
    canonicalStatus: envelope.payload.canonicalStatus,
    displayNumber: envelope.payload.displayNumber
  };
}

export function toAdminView(envelope: OrderEventEnvelopeV1): AdminOrderEventView {
  return {
    ...toKdsView(envelope),
    totalCents: envelope.payload.totalCents,
    paymentStatus: envelope.payload.paymentStatus,
    fromStatus: envelope.payload.fromStatus
  };
}

export function toAnalyticsRow(envelope: OrderEventEnvelopeV1): AnalyticsOrderEventRow {
  return {
    eventId: envelope.eventId,
    type: envelope.type,
    orderId: envelope.orderId,
    restaurantId: envelope.restaurantId,
    sequence: envelope.sequence,
    occurredAt: envelope.occurredAt,
    canonicalStatus: envelope.payload.canonicalStatus,
    totalCents: envelope.payload.totalCents,
    paymentStatus: envelope.payload.paymentStatus
  };
}
