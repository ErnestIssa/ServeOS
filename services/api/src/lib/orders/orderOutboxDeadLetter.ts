import type { EventEmitter } from "node:events";
import type { FastifyBaseLogger } from "fastify";
import type { OrderStatus, PrismaClient } from "@prisma/client";
import { publishOutboxRow } from "./orderOutboxProcessor.js";
import { logOrderEngineInfo } from "./orderEngineLog.js";

export async function listDeadLetterOutboxEvents(
  prisma: PrismaClient,
  params: { restaurantId?: string; limit?: number }
) {
  return prisma.orderEventOutbox.findMany({
    where: {
      status: "FAILED",
      ...(params.restaurantId ? { restaurantId: params.restaurantId } : {})
    },
    orderBy: { createdAt: "desc" },
    take: params.limit ?? 50
  });
}

export async function replayDeadLetterOutboxEvent(
  prisma: PrismaClient,
  outboxId: string,
  buses: { domainEventBus?: EventEmitter; orderBus?: EventEmitter },
  log?: FastifyBaseLogger
) {
  const row = await prisma.orderEventOutbox.findUnique({ where: { id: outboxId } });
  if (!row) throw Object.assign(new Error("outbox_not_found"), { statusCode: 404 });
  if (row.status !== "FAILED") {
    throw Object.assign(new Error("outbox_not_dead_letter"), { statusCode: 409 });
  }

  await prisma.orderEventOutbox.update({
    where: { id: outboxId },
    data: { status: "PENDING", attempts: 0, lastError: null }
  });

  logOrderEngineInfo(
    log,
    { orderId: row.orderId, restaurantId: row.restaurantId, action: "outbox_replay_queued" },
    "order_outbox_replay_queued"
  );

  await publishOutboxRow(prisma, outboxId, buses, log);
  return prisma.orderEventOutbox.findUniqueOrThrow({ where: { id: outboxId } });
}

export async function countOutboxByStatus(prisma: PrismaClient, restaurantId?: string) {
  const groups = await prisma.orderEventOutbox.groupBy({
    by: ["status"],
    where: restaurantId ? { restaurantId } : undefined,
    _count: { _all: true }
  });
  return {
    PENDING: groups.find((g) => g.status === "PENDING")?._count._all ?? 0,
    PUBLISHED: groups.find((g) => g.status === "PUBLISHED")?._count._all ?? 0,
    FAILED: groups.find((g) => g.status === "FAILED")?._count._all ?? 0
  };
}
