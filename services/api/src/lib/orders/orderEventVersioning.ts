/**
 * Event schema evolution — producers emit latest version; consumers accept all supported versions.
 */

import { z } from "zod";
import { orderEventEnvelopeV1Schema, type OrderEventEnvelopeV1 } from "./orderEventSchema.js";

export const SUPPORTED_EVENT_SCHEMA_VERSIONS = [1] as const;
export const CURRENT_EVENT_SCHEMA_VERSION = 1 as const;

/** V2 reserved — additive fields only; consumers must ignore unknown keys. */
export const orderEventEnvelopeV2Schema = orderEventEnvelopeV1Schema.extend({
  schemaVersion: z.literal(2),
  payload: orderEventEnvelopeV1Schema.shape.payload.extend({
    slaSignal: z.string().nullable().optional(),
    tenantPolicyVersion: z.number().int().optional()
  })
});

export type OrderEventEnvelopeV2 = z.infer<typeof orderEventEnvelopeV2Schema>;

export type NormalizedOrderEventEnvelope = OrderEventEnvelopeV1 & {
  schemaVersion: number;
};

export function parseOrderEventEnvelopeAny(raw: unknown): NormalizedOrderEventEnvelope {
  const version =
    typeof raw === "object" && raw !== null && "schemaVersion" in raw ? Number((raw as { schemaVersion: unknown }).schemaVersion) : 1;

  if (version === 1) {
    return orderEventEnvelopeV1Schema.parse(raw);
  }

  if (version === 2) {
    const v2 = orderEventEnvelopeV2Schema.parse(raw);
    return orderEventEnvelopeV1Schema.parse({
      ...v2,
      schemaVersion: 1,
      payload: {
        status: v2.payload.status,
        canonicalStatus: v2.payload.canonicalStatus,
        totalCents: v2.payload.totalCents,
        customerUserId: v2.payload.customerUserId,
        displayNumber: v2.payload.displayNumber,
        paymentStatus: v2.payload.paymentStatus,
        fromStatus: v2.payload.fromStatus,
        actorUserId: v2.payload.actorUserId
      }
    });
  }

  throw new Error(`unsupported_order_event_schema_version:${version}`);
}

/** Replay / reprocess pipeline must use this — never reject unknown future versions silently. */
export function canConsumerProcessVersion(consumerMinVersion: number, envelopeVersion: number): boolean {
  return envelopeVersion >= consumerMinVersion && SUPPORTED_EVENT_SCHEMA_VERSIONS.includes(envelopeVersion as 1);
}

export const EVENT_EVOLUTION_POLICY = {
  strategy: "additive-only" as const,
  breakingChanges: "new event types only — never mutate existing type semantics" as const,
  consumerRule: "ignore unknown payload fields; dedupe on eventId" as const,
  replayRule: "reprocess from OrderDomainEvent + outbox using parseOrderEventEnvelopeAny" as const
} as const;
