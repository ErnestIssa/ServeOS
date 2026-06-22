import type { EventEmitter } from "node:events";
import type { FastifyBaseLogger } from "fastify";
import type { OrderStatus, Prisma, PrismaClient } from "@prisma/client";
import {
  appendOrderAuditLog,
  appendOrderStatusHistory
} from "./orderAuditService.js";
import { persistOrderDomainEvent } from "./orderAuditService.js";
import {
  deriveLockFlags,
  validateTransition,
  STATUS_LABELS
} from "./orderStatusMachine.js";
import {
  normalizeOrderStatus,
  type OrderEventType,
  type OrderTransitionRequest
} from "./orderTypes.js";
import { withOrderIdempotency, enqueueOrderOutboxEvent } from "./orderIdempotencyService.js";
import { optimisticOrderUpdate, resolveOrderEngineActor } from "./orderEnginePermissions.js";
import { flushOrderOutboxForOrder } from "./orderOutboxProcessor.js";
import { logOrderEngineInvalidTransition, logOrderEngineVersionConflict } from "./orderEngineLog.js";
import { describePricingSnapshot } from "./orderEventSchema.js";
import { loadRestaurantOrderPolicy } from "./orderTenantPolicies.js";

function resolveLifecycleEventType(from: OrderStatus, to: OrderStatus): OrderEventType {
  const toCanon = normalizeOrderStatus(to);
  if (toCanon === "PAID") return "order.paid";
  if (toCanon === "ACCEPTED") return "order.accepted";
  if (toCanon === "REJECTED") return "order.rejected";
  if (toCanon === "CANCELLED") return "order.cancelled";
  if (toCanon === "REFUNDED") return "order.refunded";
  if (toCanon === "PARTIALLY_REFUNDED") return "order.partially_refunded";
  if (toCanon === "COMPLETED") return "order.completed";
  if (toCanon === "ARCHIVED") return "order.archived";
  return "order.status_changed";
}

function buildStatusPatch(
  from: OrderStatus,
  to: OrderStatus,
  existing: { pricingLockedAt: Date | null; kitchenStartedAt: Date | null; completedAt: Date | null; paymentStatus: string }
): Prisma.OrderUpdateInput {
  const toCanon = normalizeOrderStatus(to);
  const patch: Prisma.OrderUpdateInput = { status: to };

  if (toCanon === "PAID" && !existing.pricingLockedAt) {
    patch.pricingLockedAt = new Date();
    patch.paymentStatus = "PAID";
  }

  if (toCanon === "PREPARING" && !existing.kitchenStartedAt) {
    patch.kitchenStartedAt = new Date();
  }

  if (toCanon === "COMPLETED" && !existing.completedAt) {
    patch.completedAt = new Date();
  }

  if (toCanon === "CANCELLED") {
    patch.paymentStatus = existing.paymentStatus === "PAID" ? "REFUNDED" : "UNPAID";
  }

  if (toCanon === "REFUNDED") {
    patch.paymentStatus = "REFUNDED";
  }

  if (toCanon === "PARTIALLY_REFUNDED") {
    patch.paymentStatus = "PARTIAL_REFUND";
  }

  return patch;
}

async function executeTransition(
  prisma: PrismaClient,
  request: OrderTransitionRequest,
  buses?: { chatBus?: EventEmitter; domainEventBus?: EventEmitter; orderBus?: EventEmitter },
  log?: FastifyBaseLogger
) {
  const existing = await prisma.order.findUnique({
    where: { id: request.orderId },
    include: { restaurant: { select: { name: true } }, chatRoom: true }
  });
  if (!existing) throw Object.assign(new Error("order_not_found"), { statusCode: 404 });

  const actor = await resolveOrderEngineActor(prisma, existing.restaurantId, request.actor);
  const tenant = await loadRestaurantOrderPolicy(prisma, existing.restaurantId);
  const locks = deriveLockFlags(existing);

  try {
    validateTransition(existing.status, request.targetStatus, actor, locks, tenant);
  } catch (err) {
    const code = (err as Error).message;
    logOrderEngineInvalidTransition(log, {
      orderId: request.orderId,
      restaurantId: existing.restaurantId,
      action: "transition_rejected",
      fromStatus: existing.status,
      toStatus: request.targetStatus,
      actorUserId: actor.userId
    }, code);
    throw err;
  }

  const eventType = resolveLifecycleEventType(existing.status, request.targetStatus);
  const patch = buildStatusPatch(existing.status, request.targetStatus, existing);

  let order;
  try {
    order = await prisma.$transaction(async (tx) => {
      const updated = await optimisticOrderUpdate(tx, {
        orderId: request.orderId,
        expectedVersion: existing.version,
        data: patch
      });

      await appendOrderStatusHistory(tx, {
        orderId: updated.id,
        fromStatus: existing.status,
        toStatus: request.targetStatus,
        actorUserId: actor.userId ?? null,
        actorSource: actor.source,
        reason: request.reason
      });

      await appendOrderAuditLog(tx, {
        orderId: updated.id,
        restaurantId: updated.restaurantId,
        action: eventType,
        actorUserId: actor.userId ?? null,
        actorSource: actor.source,
        beforeState: {
          status: existing.status,
          paymentStatus: existing.paymentStatus,
          totalCents: existing.totalCents,
          version: existing.version,
          pricingSnapshot: describePricingSnapshot(existing.pricingLockedAt)
        },
        afterState: {
          status: updated.status,
          paymentStatus: updated.paymentStatus,
          totalCents: updated.totalCents,
          version: updated.version,
          pricingSnapshot: describePricingSnapshot(updated.pricingLockedAt)
        },
        metadata: {
          trustEventId: request.trustEventId,
          label: STATUS_LABELS[normalizeOrderStatus(request.targetStatus)]
        }
      });

      const envelope = await enqueueOrderOutboxEvent(tx, {
        type: eventType,
        order: updated,
        fromStatus: existing.status,
        actorUserId: actor.userId
      });

      await persistOrderDomainEvent(tx, {
        orderId: updated.id,
        restaurantId: updated.restaurantId,
        type: eventType,
        payload: envelope as unknown as Record<string, unknown>
      });

      return updated;
    });
  } catch (err) {
    if ((err as Error).message === "order_version_conflict") {
      logOrderEngineVersionConflict(log, {
        orderId: request.orderId,
        restaurantId: existing.restaurantId,
        action: "transition_version_conflict",
        fromStatus: existing.status,
        toStatus: request.targetStatus
      });
    }
    throw err;
  }

  if (buses) {
    await flushOrderOutboxForOrder(prisma, order.id, buses, log);
  }

  return order;
}

/**
 * Core order state transition — the ONLY path allowed to mutate order.status.
 * Supports idempotency keys to survive mobile/web retries.
 */
export async function transitionOrderStatus(
  prisma: PrismaClient,
  request: OrderTransitionRequest,
  buses?: { chatBus?: EventEmitter; domainEventBus?: EventEmitter; orderBus?: EventEmitter },
  log?: FastifyBaseLogger
) {
  if (request.idempotencyKey) {
    const scopeKey = request.idempotencyKey;
    return withOrderIdempotency(
      prisma,
      {
        scope: "status_transition",
        key: scopeKey,
        requestHash: `${request.orderId}:${request.targetStatus}`
      },
      async () => {
        const order = await executeTransition(prisma, request, buses, log);
        return {
          orderId: order.id,
          response: order
        };
      }
    ) as ReturnType<typeof executeTransition> extends Promise<infer R> ? R : never;
  }

  return executeTransition(prisma, request, buses, log);
}
