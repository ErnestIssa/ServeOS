import type { EventEmitter } from "node:events";
import type { FastifyBaseLogger } from "fastify";
import type { Prisma, PrismaClient } from "@prisma/client";
import { evaluateOrderSla } from "./orderSlaPolicies.js";
import { loadRestaurantOrderPolicy } from "./orderTenantPolicies.js";
import { processOrderOutboxBatch } from "./orderOutboxProcessor.js";
import { runCompensationSweep, listPendingCompensations } from "./orderCompensationService.js";
import { countOutboxByStatus } from "./orderOutboxDeadLetter.js";
import { evaluateDegradationState, ORDER_DEGRADATION_POLICY } from "./orderDegradationPolicy.js";
import { ORDER_READ_MODEL_POLICY } from "./orderReadModelPolicy.js";
import { logOrderEngineInfo, logOrderEngineWarning } from "./orderEngineLog.js";
import { publishDomainEvent } from "../../notifications/eventBus.js";
import { createDomainEvent } from "../../notifications/notificationProcessor.js";

const ACTIVE_STATUSES = ["CREATED", "PENDING_PAYMENT", "PAID", "ACCEPTED", "PREPARING", "READY", "PENDING", "CONFIRMED"] as const;

async function logRecovery(
  prisma: PrismaClient,
  input: { orderId: string; restaurantId: string; action: string; reason: string; metadata?: Record<string, unknown> }
) {
  await prisma.orderRecoveryLog.create({
    data: {
      orderId: input.orderId,
      restaurantId: input.restaurantId,
      action: input.action,
      reason: input.reason,
      metadata: input.metadata as Prisma.InputJsonValue
    }
  });
}

async function emitRecoverySignal(
  domainEventBus: EventEmitter | undefined,
  input: { orderId: string; restaurantId: string; signal: string; slaSignal: string }
) {
  if (!domainEventBus) return;
  await publishDomainEvent(
    domainEventBus,
    createDomainEvent(
      "order.recovery.escalated",
      {
        orderId: input.orderId,
        restaurantId: input.restaurantId,
        signal: input.signal,
        slaSignal: input.slaSignal
      },
      { restaurantId: input.restaurantId }
    )
  );
}

export async function scanAndRecoverStuckOrders(
  prisma: PrismaClient,
  buses?: { domainEventBus?: EventEmitter; orderBus?: EventEmitter },
  log?: FastifyBaseLogger
) {
  const candidates = await prisma.order.findMany({
    where: { status: { in: [...ACTIVE_STATUSES] } },
    select: {
      id: true,
      restaurantId: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      kitchenStartedAt: true,
      completedAt: true
    },
    take: 200,
    orderBy: { updatedAt: "asc" }
  });

  let escalated = 0;

  for (const order of candidates) {
    const policy = await loadRestaurantOrderPolicy(prisma, order.restaurantId);
    if (!policy.recovery.autoEscalateStuckOrders) continue;

    const sla = evaluateOrderSla({
      status: order.status,
      createdAt: order.createdAt,
      kitchenStartedAt: order.kitchenStartedAt,
      completedAt: order.completedAt,
      updatedAt: order.updatedAt,
      sla: policy.sla
    });

    if (sla === "none") continue;

    const recent = await prisma.orderRecoveryLog.findFirst({
      where: {
        orderId: order.id,
        action: "escalate_sla",
        createdAt: { gte: new Date(Date.now() - 15 * 60 * 1000) }
      }
    });
    if (recent) continue;

    await logRecovery(prisma, {
      orderId: order.id,
      restaurantId: order.restaurantId,
      action: "escalate_sla",
      reason: sla,
      metadata: { status: order.status }
    });

    await emitRecoverySignal(buses?.domainEventBus, {
      orderId: order.id,
      restaurantId: order.restaurantId,
      signal: "sla_breach",
      slaSignal: sla
    });

    escalated += 1;
    logOrderEngineWarning(
      log,
      { orderId: order.id, restaurantId: order.restaurantId, action: "recovery_escalate", extra: { sla } },
      `order_recovery_escalate:${sla}`
    );
  }

  return { escalated };
}

export async function retryStaleOutboxEvents(
  prisma: PrismaClient,
  buses?: { domainEventBus?: EventEmitter; orderBus?: EventEmitter },
  log?: FastifyBaseLogger
) {
  const stale = await prisma.orderEventOutbox.count({
    where: {
      status: "PENDING",
      createdAt: { lt: new Date(Date.now() - 60_000) }
    }
  });

  if (stale > 0) {
    await processOrderOutboxBatch(prisma, buses ?? {}, log);
    logOrderEngineInfo(log, { action: "recovery_outbox_retry", extra: { stale } }, "order_recovery_outbox_retry");
  }

  return { retried: stale };
}

export async function runOrderRecoveryCycle(
  prisma: PrismaClient,
  buses?: { domainEventBus?: EventEmitter; orderBus?: EventEmitter },
  log?: FastifyBaseLogger
) {
  const outboxCounts = await countOutboxByStatus(prisma);
  const degradation = evaluateDegradationState(outboxCounts.PENDING);

  const [stuck, outbox, compensations] = await Promise.all([
    scanAndRecoverStuckOrders(prisma, buses, log),
    retryStaleOutboxEvents(prisma, buses, log),
    runCompensationSweep(prisma, buses, log)
  ]);

  return {
    degradation,
    outboxCounts,
    stuck,
    outbox,
    compensations: compensations.length
  };
}

export function startOrderRecoveryProcessor(
  prisma: PrismaClient,
  buses: { domainEventBus?: EventEmitter; orderBus?: EventEmitter },
  log?: FastifyBaseLogger,
  intervalMs = 5 * 60 * 1000
) {
  const tick = () => {
    void runOrderRecoveryCycle(prisma, buses, log).catch((err) => {
      logOrderEngineWarning(log, { action: "recovery_cycle_failed" }, "order_recovery_cycle_failed", err);
    });
  };

  const timer = setInterval(tick, intervalMs);
  if (typeof timer === "object" && "unref" in timer) timer.unref();
  tick();
  return () => clearInterval(timer);
}

/** Admin/ops snapshot — degradation, compensations, recovery history, policies. */
export async function getOrderEngineOperationalSnapshot(prisma: PrismaClient, restaurantId: string) {
  const [outboxCounts, pendingCompensations, recentRecovery, policy] = await Promise.all([
    countOutboxByStatus(prisma, restaurantId),
    listPendingCompensations(prisma, restaurantId),
    prisma.orderRecoveryLog.findMany({
      where: { restaurantId },
      orderBy: { createdAt: "desc" },
      take: 25
    }),
    loadRestaurantOrderPolicy(prisma, restaurantId)
  ]);

  const degradation = evaluateDegradationState(outboxCounts.PENDING);

  return {
    degradation,
    outboxCounts,
    pendingCompensations,
    recentRecovery,
    tenantPolicy: policy,
    readModelPolicy: ORDER_READ_MODEL_POLICY,
    degradationPolicy: ORDER_DEGRADATION_POLICY
  };
}
