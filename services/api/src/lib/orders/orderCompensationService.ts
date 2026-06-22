import type { Prisma, PrismaClient } from "@prisma/client";
import type { EventEmitter } from "node:events";
import type { FastifyBaseLogger } from "fastify";
import { logOrderEngineInfo, logOrderEngineWarning } from "./orderEngineLog.js";
import { transitionOrderStatus } from "./orderTransitionService.js";
import { loadRestaurantOrderPolicy } from "./orderTenantPolicies.js";
import { normalizeOrderStatus } from "./orderTypes.js";
import { flushOrderOutboxForOrder } from "./orderOutboxProcessor.js";

export type CompensationType =
  | "payment_paid_order_not_advanced"
  | "order_rejected_after_payment"
  | "outbox_consumer_duplicate_safe_ignore"
  | "state_rollback_after_delivery";

async function appendCompensation(
  prisma: PrismaClient,
  input: {
    orderId: string;
    restaurantId: string;
    type: CompensationType;
    trigger: string;
    status?: string;
    beforeState?: Record<string, unknown>;
    afterState?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
  }
) {
  return prisma.orderCompensationLog.create({
    data: {
      orderId: input.orderId,
      restaurantId: input.restaurantId,
      type: input.type,
      trigger: input.trigger,
      status: input.status ?? "PENDING",
      beforeState: input.beforeState as Prisma.InputJsonValue,
      afterState: input.afterState as Prisma.InputJsonValue,
      metadata: input.metadata as Prisma.InputJsonValue
    }
  });
}

/** Payment succeeded in DB but order status never reached PAID — reconcile or escalate. */
export async function compensatePaidOrderMismatch(
  prisma: PrismaClient,
  orderId: string,
  buses?: { domainEventBus?: EventEmitter; orderBus?: EventEmitter },
  log?: FastifyBaseLogger
) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) return null;

  const paidRef = await prisma.orderPaymentReference.findFirst({
    where: { orderId, status: "SUCCEEDED" }
  });
  if (!paidRef) return null;

  const canon = normalizeOrderStatus(order.status);
  if (canon === "PAID" || canon === "ACCEPTED" || canon === "PREPARING" || canon === "READY" || canon === "COMPLETED") {
    return null;
  }

  if (canon === "REJECTED" || canon === "CANCELLED") {
    await appendCompensation(prisma, {
      orderId: order.id,
      restaurantId: order.restaurantId,
      type: "order_rejected_after_payment",
      trigger: "compensate_paid_order_mismatch",
      status: "PENDING",
      beforeState: { status: order.status, paymentStatus: order.paymentStatus },
      metadata: { paymentRefId: paidRef.id, action: "refund_review_required" }
    });
    logOrderEngineWarning(
      log,
      { orderId, restaurantId: order.restaurantId, action: "compensation_refund_required" },
      "order_compensation_refund_required"
    );
    return { type: "order_rejected_after_payment" as const };
  }

  const updated = await transitionOrderStatus(
    prisma,
    {
      orderId: order.id,
      targetStatus: "PAID",
      actor: { source: "SYSTEM" },
      reason: "compensation:payment_paid_order_not_advanced"
    },
    buses,
    log
  );

  await appendCompensation(prisma, {
    orderId: order.id,
    restaurantId: order.restaurantId,
    type: "payment_paid_order_not_advanced",
    trigger: "compensate_paid_order_mismatch",
    status: "APPLIED",
    beforeState: { status: order.status },
    afterState: { status: updated.status }
  });

  logOrderEngineInfo(log, { orderId, action: "compensation_paid_reconciled" }, "order_compensation_paid_reconciled");
  return { type: "payment_paid_order_not_advanced" as const, order: updated };
}

/** Safe ignore when consumer already applied eventId — documented compensation no-op. */
export async function recordDuplicateConsumerSafeIgnore(
  prisma: PrismaClient,
  input: { orderId: string; restaurantId: string; eventId: string; consumer: string }
) {
  return appendCompensation(prisma, {
    orderId: input.orderId,
    restaurantId: input.restaurantId,
    type: "outbox_consumer_duplicate_safe_ignore",
    trigger: `consumer:${input.consumer}`,
    status: "SKIPPED",
    metadata: { eventId: input.eventId }
  });
}

export async function listPendingCompensations(prisma: PrismaClient, restaurantId: string, limit = 50) {
  return prisma.orderCompensationLog.findMany({
    where: { restaurantId, status: "PENDING" },
    orderBy: { createdAt: "desc" },
    take: limit
  });
}

export async function runCompensationSweep(
  prisma: PrismaClient,
  buses?: { domainEventBus?: EventEmitter; orderBus?: EventEmitter },
  log?: FastifyBaseLogger
) {
  const mismatches = await prisma.order.findMany({
    where: {
      paymentStatus: "PAID",
      status: { in: ["CREATED", "PENDING_PAYMENT", "PENDING", "REJECTED", "CANCELLED"] }
    },
    select: { id: true },
    take: 30
  });

  const results = [];
  for (const row of mismatches) {
    const order = await prisma.order.findUnique({
      where: { id: row.id },
      select: { restaurantId: true }
    });
    if (!order) continue;
    const policy = await loadRestaurantOrderPolicy(prisma, order.restaurantId);
    if (!policy.recovery.autoReconcilePaidMismatch) continue;

    const r = await compensatePaidOrderMismatch(prisma, row.id, buses, log);
    if (r) results.push(r);
  }
  return results;
}
