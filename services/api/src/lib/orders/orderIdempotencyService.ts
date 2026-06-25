import { createHash, randomUUID } from "node:crypto";
import type { Prisma, PrismaClient } from "@prisma/client";
import { ORDER_EVENT_SCHEMA_VERSION, type OrderEventEnvelopeV1 } from "./orderEventSchema.js";
import type { OrderEventType } from "./orderTypes.js";
import { formatDisplayNumber, normalizeOrderStatus } from "./orderTypes.js";

const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_IN_PROGRESS_WAIT_MS = 8_000;
const IN_PROGRESS_POLL_MS = 120;

export function hashIdempotencyPayload(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export async function withOrderIdempotency<T extends Record<string, unknown>>(
  prisma: PrismaClient,
  params: {
    scope: "place_order" | "status_transition" | "payment_webhook" | "order_edit";
    key: string;
    restaurantId?: string;
    requestHash?: string;
  },
  execute: () => Promise<{ orderId: string; response: T }>
): Promise<T> {
  const expiresAt = new Date(Date.now() + IDEMPOTENCY_TTL_MS);
  const existing = await prisma.orderIdempotencyKey.findUnique({
    where: { scope_key: { scope: params.scope, key: params.key } }
  });

  if (existing?.status === "COMPLETED" && existing.response) {
    return existing.response as T;
  }

  if (existing?.status === "IN_PROGRESS") {
    const waited = await waitForIdempotencyCompletion(prisma, params.scope, params.key);
    if (waited) return waited as T;
    throw Object.assign(new Error("idempotency_in_progress"), { statusCode: 409 });
  }

  try {
    await prisma.orderIdempotencyKey.create({
      data: {
        scope: params.scope,
        key: params.key,
        restaurantId: params.restaurantId ?? null,
        requestHash: params.requestHash ?? null,
        status: "IN_PROGRESS",
        expiresAt
      }
    });
  } catch {
    const raced = await prisma.orderIdempotencyKey.findUnique({
      where: { scope_key: { scope: params.scope, key: params.key } }
    });
    if (raced?.status === "COMPLETED" && raced.response) return raced.response as T;
    throw Object.assign(new Error("idempotency_conflict"), { statusCode: 409 });
  }

  try {
    const { orderId, response } = await execute();
    await prisma.orderIdempotencyKey.update({
      where: { scope_key: { scope: params.scope, key: params.key } },
      data: {
        status: "COMPLETED",
        orderId,
        response: response as Prisma.InputJsonValue
      }
    });
    return response;
  } catch (err) {
    await prisma.orderIdempotencyKey
      .delete({ where: { scope_key: { scope: params.scope, key: params.key } } })
      .catch(() => undefined);
    throw err;
  }
}

async function waitForIdempotencyCompletion(
  prisma: PrismaClient,
  scope: string,
  key: string
): Promise<Record<string, unknown> | null> {
  const deadline = Date.now() + MAX_IN_PROGRESS_WAIT_MS;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, IN_PROGRESS_POLL_MS));
    const row = await prisma.orderIdempotencyKey.findUnique({
      where: { scope_key: { scope, key } }
    });
    if (row?.status === "COMPLETED" && row.response) return row.response as Record<string, unknown>;
    if (!row || row.status !== "IN_PROGRESS") return null;
  }
  return null;
}

export async function nextOutboxSequence(
  tx: Prisma.TransactionClient,
  orderId: string
): Promise<number> {
  const agg = await tx.orderEventOutbox.aggregate({
    where: { orderId },
    _max: { sequence: true }
  });
  return (agg._max.sequence ?? 0) + 1;
}

export function buildOrderEventEnvelope(input: {
  type: OrderEventType;
  orderId: string;
  restaurantId: string;
  sequence: number;
  status: string;
  totalCents: number;
  customerUserId?: string | null;
  displaySeq?: number | null;
  displayPeriodKey?: string;
  paymentStatus?: string;
  fromStatus?: string | null;
  actorUserId?: string | null;
  metadata?: Record<string, unknown>;
}): OrderEventEnvelopeV1 {
  return {
    schemaVersion: ORDER_EVENT_SCHEMA_VERSION,
    eventId: randomUUID(),
    type: input.type,
    orderId: input.orderId,
    restaurantId: input.restaurantId,
    sequence: input.sequence,
    occurredAt: new Date().toISOString(),
    payload: {
      status: input.status,
      canonicalStatus: normalizeOrderStatus(input.status as never),
      totalCents: input.totalCents,
      customerUserId: input.customerUserId ?? null,
      displayNumber: formatDisplayNumber(input.displaySeq, input.orderId, input.displayPeriodKey ?? "all"),
      paymentStatus: input.paymentStatus ?? null,
      fromStatus: input.fromStatus ?? null,
      actorUserId: input.actorUserId ?? null,
      ...input.metadata
    }
  };
}

export async function enqueueOrderOutboxEvent(
  tx: Prisma.TransactionClient,
  input: {
    type: OrderEventType;
    order: {
      id: string;
      restaurantId: string;
      status: string;
      totalCents: number;
      customerUserId: string | null;
      displaySeq?: number | null;
      displayPeriodKey?: string;
      paymentStatus?: string;
    };
    fromStatus?: string | null;
    actorUserId?: string | null;
    metadata?: Record<string, unknown>;
  }
): Promise<OrderEventEnvelopeV1> {
  const sequence = await nextOutboxSequence(tx, input.order.id);
  const envelope = buildOrderEventEnvelope({
    type: input.type,
    orderId: input.order.id,
    restaurantId: input.order.restaurantId,
    sequence,
    status: input.order.status,
    totalCents: input.order.totalCents,
    customerUserId: input.order.customerUserId,
    displaySeq: input.order.displaySeq,
    displayPeriodKey: input.order.displayPeriodKey,
    paymentStatus: input.order.paymentStatus,
    fromStatus: input.fromStatus,
    actorUserId: input.actorUserId,
    metadata: input.metadata
  });

  await tx.orderEventOutbox.create({
    data: {
      orderId: input.order.id,
      restaurantId: input.order.restaurantId,
      sequence,
      eventType: input.type,
      schemaVersion: ORDER_EVENT_SCHEMA_VERSION,
      payload: envelope as unknown as Prisma.InputJsonValue,
      status: "PENDING"
    }
  });

  return envelope;
}
