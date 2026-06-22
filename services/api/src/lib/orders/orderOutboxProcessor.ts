import type { EventEmitter } from "node:events";
import type { FastifyBaseLogger } from "fastify";
import type { PrismaClient } from "@prisma/client";
import { broadcastOrderEvent } from "./orderEventService.js";
import { parseOrderEventEnvelopeAny, type NormalizedOrderEventEnvelope } from "./orderEventVersioning.js";
import { logOrderEngineInfo, logOrderEngineWarning } from "./orderEngineLog.js";
import type { OrderEventType } from "./orderTypes.js";

const MAX_BATCH = 40;
const MAX_ATTEMPTS = 12;

export async function publishOutboxEnvelope(
  envelope: NormalizedOrderEventEnvelope,
  buses: { domainEventBus?: EventEmitter; orderBus?: EventEmitter }
) {
  await broadcastOrderEvent(buses.domainEventBus, buses.orderBus, envelope.type as OrderEventType, {
    orderId: envelope.orderId,
    restaurantId: envelope.restaurantId,
    status: envelope.payload.status,
    totalCents: envelope.payload.totalCents,
    customerUserId: envelope.payload.customerUserId,
    displayNumber: envelope.payload.displayNumber,
    paymentStatus: envelope.payload.paymentStatus ?? undefined
  });
}

export async function flushOrderOutboxForOrder(
  prisma: PrismaClient,
  orderId: string,
  buses: { domainEventBus?: EventEmitter; orderBus?: EventEmitter },
  log?: FastifyBaseLogger
) {
  const pending = await prisma.orderEventOutbox.findMany({
    where: { orderId, status: "PENDING" },
    orderBy: { sequence: "asc" },
    take: MAX_BATCH
  });

  for (const row of pending) {
    await publishOutboxRow(prisma, row.id, buses, log);
  }
}

export async function publishOutboxRow(
  prisma: PrismaClient,
  outboxId: string,
  buses: { domainEventBus?: EventEmitter; orderBus?: EventEmitter },
  log?: FastifyBaseLogger
) {
  const row = await prisma.orderEventOutbox.findUnique({ where: { id: outboxId } });
  if (!row || row.status !== "PENDING") return;

  try {
    const envelope = parseOrderEventEnvelopeAny(row.payload);
    await publishOutboxEnvelope(envelope, buses);
    await prisma.orderEventOutbox.update({
      where: { id: row.id },
      data: { status: "PUBLISHED", publishedAt: new Date(), lastError: null }
    });
    logOrderEngineInfo(log, { orderId: row.orderId, restaurantId: row.restaurantId, action: "outbox_published" }, "order_outbox_published");
  } catch (err) {
    const attempts = row.attempts + 1;
    const message = err instanceof Error ? err.message : "outbox_publish_failed";
    await prisma.orderEventOutbox.update({
      where: { id: row.id },
      data: {
        attempts,
        lastError: message.slice(0, 500),
        status: attempts >= MAX_ATTEMPTS ? "FAILED" : "PENDING"
      }
    });
    logOrderEngineWarning(
      log,
      { orderId: row.orderId, restaurantId: row.restaurantId, action: "outbox_publish_failed" },
      message,
      err
    );
  }
}

export async function processOrderOutboxBatch(
  prisma: PrismaClient,
  buses: { domainEventBus?: EventEmitter; orderBus?: EventEmitter },
  log?: FastifyBaseLogger
) {
  const pending = await prisma.orderEventOutbox.findMany({
    where: { status: "PENDING" },
    orderBy: [{ createdAt: "asc" }, { sequence: "asc" }],
    take: MAX_BATCH
  });

  for (const row of pending) {
    await publishOutboxRow(prisma, row.id, buses, log);
  }
}

export function startOrderOutboxProcessor(
  prisma: PrismaClient,
  buses: { domainEventBus?: EventEmitter; orderBus?: EventEmitter },
  log?: FastifyBaseLogger,
  intervalMs = 2_000
) {
  const tick = () => {
    void processOrderOutboxBatch(prisma, buses, log).catch((err) => {
      logOrderEngineWarning(log, { action: "outbox_processor_tick" }, "order_outbox_processor_error", err);
    });
  };

  const timer = setInterval(tick, intervalMs);
  if (typeof timer === "object" && "unref" in timer) timer.unref();
  tick();
  return () => clearInterval(timer);
}
