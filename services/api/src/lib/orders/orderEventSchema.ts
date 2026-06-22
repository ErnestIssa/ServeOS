/** Versioned order event contract — safe for replay, analytics rebuild, and debugging. */

import { z } from "zod";
import type { OrderEventType } from "./orderTypes.js";

export const ORDER_EVENT_SCHEMA_VERSION = 1 as const;

const orderEventPayloadV1 = z.object({
  status: z.string(),
  canonicalStatus: z.string(),
  totalCents: z.number().int().nonnegative(),
  customerUserId: z.string().nullable(),
  displayNumber: z.string(),
  paymentStatus: z.string().nullable(),
  fromStatus: z.string().nullable(),
  actorUserId: z.string().nullable()
});

export const orderEventEnvelopeV1Schema = z.object({
  schemaVersion: z.literal(1),
  eventId: z.string().min(1),
  type: z.string() as z.ZodType<OrderEventType>,
  orderId: z.string().min(1),
  restaurantId: z.string().min(1),
  sequence: z.number().int().positive(),
  occurredAt: z.string().datetime(),
  payload: orderEventPayloadV1.passthrough()
});

export type OrderEventEnvelopeV1 = z.infer<typeof orderEventEnvelopeV1Schema>;

export function parseOrderEventEnvelope(raw: unknown): OrderEventEnvelopeV1 {
  return orderEventEnvelopeV1Schema.parse(raw);
}

/** Documents what is frozen when pricingLockedAt is set. */
export const PRICING_SNAPSHOT_FIELDS = [
  "lines.nameSnapshot",
  "lines.unitPriceCents",
  "lines.selectedModifiers",
  "lines.lineTotalCents",
  "subtotalCents",
  "taxCents",
  "serviceFeeCents",
  "discountCents",
  "totalCents"
] as const;

export type PricingSnapshotPolicy = {
  frozenAt: string | null;
  fields: readonly string[];
  managerOverrideAllowed: false;
};

export function describePricingSnapshot(pricingLockedAt: Date | null): PricingSnapshotPolicy {
  return {
    frozenAt: pricingLockedAt?.toISOString() ?? null,
    fields: PRICING_SNAPSHOT_FIELDS,
    managerOverrideAllowed: false
  };
}
