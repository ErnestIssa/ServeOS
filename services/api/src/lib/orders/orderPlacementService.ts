import type { Prisma, PrismaClient } from "@prisma/client";
import type { OrderSource } from "@prisma/client";
import type { EventEmitter } from "node:events";
import type { FastifyBaseLogger } from "fastify";
import {
  appendOrderAuditLog,
  appendOrderStatusHistory,
  persistOrderDomainEvent
} from "./orderAuditService.js";
import { buildPricedOrderSnapshot } from "./orderPricing.js";
import { withOrderIdempotency, enqueueOrderOutboxEvent, hashIdempotencyPayload } from "./orderIdempotencyService.js";
import { flushOrderOutboxForOrder } from "./orderOutboxProcessor.js";
import { describePricingSnapshot } from "./orderEventSchema.js";
import { transitionOrderStatus } from "./orderTransitionService.js";
import { mergeOrderEnginePolicy } from "./orderTenantPolicies.js";
import { normalizeOrderStatus, toPrismaOrderStatus, type PlaceOrderInput } from "./orderTypes.js";

async function nextDisplaySeq(tx: Prisma.TransactionClient, restaurantId: string): Promise<number> {
  const agg = await tx.order.aggregate({
    where: { restaurantId },
    _max: { displaySeq: true }
  });
  return (agg._max.displaySeq ?? 0) + 1;
}

function resolveOrderSource(input: PlaceOrderInput): OrderSource {
  if (input.source) return input.source;
  if (input.createdByContext === "STAFF") return "STAFF_CREATED";
  return "QR_ORDER";
}

async function createOrderRecord(
  prisma: PrismaClient,
  input: PlaceOrderInput,
  buses?: { domainEventBus?: EventEmitter; orderBus?: EventEmitter },
  log?: FastifyBaseLogger
) {
  if (!input.lines.length) {
    throw Object.assign(new Error("order_lines_required"), { statusCode: 400 });
  }

  const restaurant = await prisma.restaurant.findUnique({ where: { id: input.restaurantId } });
  if (!restaurant) throw Object.assign(new Error("restaurant_not_found"), { statusCode: 404 });

  const { pricedLines, totals } = await buildPricedOrderSnapshot(prisma, input.restaurantId, input.lines);
  const initialStatus = toPrismaOrderStatus(input.initialStatus ?? "CREATED");
  const source = resolveOrderSource(input);
  const paymentStatus = input.paymentStatus ?? "UNPAID";

  const created = await prisma.$transaction(async (tx) => {
    const displaySeq = await nextDisplaySeq(tx, input.restaurantId);

    const o = await tx.order.create({
      data: {
        restaurantId: input.restaurantId,
        customerUserId: input.customerUserId ?? null,
        createdByUserId: input.createdByUserId ?? input.customerUserId ?? null,
        createdByContext: input.createdByContext ?? (input.customerUserId ? "CUSTOMER" : "STAFF"),
        displaySeq,
        source,
        status: initialStatus,
        paymentStatus,
        subtotalCents: totals.subtotalCents,
        taxCents: totals.taxCents,
        serviceFeeCents: totals.serviceFeeCents,
        totalCents: totals.totalCents,
        note: input.note?.trim() || null,
        customerName: input.customerName?.trim() || null,
        customerPhone: input.customerPhone?.trim() || null,
        customerEmail: input.customerEmail?.trim() || null,
        tableLabel: input.tableLabel?.trim() || null,
        assignedStaffUserId: input.assignedStaffUserId ?? null,
        lines: {
          create: pricedLines.map((l) => ({
            menuItemId: l.menuItemId,
            nameSnapshot: l.nameSnapshot,
            quantity: l.quantity,
            unitPriceCents: l.unitPriceCents,
            selectedModifiers: l.selectedModifiers as unknown as Prisma.InputJsonValue,
            lineTotalCents: l.lineTotalCents
          }))
        }
      },
      include: { lines: true, restaurant: { select: { name: true } } }
    });

    await appendOrderStatusHistory(tx, {
      orderId: o.id,
      fromStatus: null,
      toStatus: initialStatus,
      actorUserId: input.createdByUserId ?? input.customerUserId ?? null,
      actorSource: input.createdByContext === "STAFF" ? "STAFF" : input.customerUserId ? "CUSTOMER" : "SYSTEM",
      reason: "order_placed"
    });

    await appendOrderAuditLog(tx, {
      orderId: o.id,
      restaurantId: o.restaurantId,
      action: "order.created",
      actorUserId: input.createdByUserId ?? input.customerUserId ?? null,
      actorSource: input.createdByContext === "STAFF" ? "STAFF" : input.customerUserId ? "CUSTOMER" : "SYSTEM",
      afterState: {
        status: o.status,
        paymentStatus: o.paymentStatus,
        totalCents: o.totalCents,
        lineCount: o.lines.length,
        pricingSnapshot: describePricingSnapshot(null)
      },
      metadata: { source, lineSnapshots: pricedLines }
    });

    const envelope = await enqueueOrderOutboxEvent(tx, {
      type: "order.created",
      order: o,
      actorUserId: input.createdByUserId ?? input.customerUserId ?? null
    });

    await persistOrderDomainEvent(tx, {
      orderId: o.id,
      restaurantId: o.restaurantId,
      type: "order.created",
      payload: envelope as unknown as Record<string, unknown>
    });

    return o;
  });

  if (buses) {
    await flushOrderOutboxForOrder(prisma, created.id, buses, log);
  }

  const policy = mergeOrderEnginePolicy(restaurant.orderEnginePolicy);
  const canon = normalizeOrderStatus(created.status);
  if (policy.autoAcceptOnCreate && (canon === "CREATED" || canon === "PAID")) {
    const accepted = await transitionOrderStatus(
      prisma,
      {
        orderId: created.id,
        targetStatus: "ACCEPTED",
        actor: { source: "SYSTEM" },
        reason: "tenant_policy:auto_accept_on_create"
      },
      buses,
      log
    );
    if (buses) await flushOrderOutboxForOrder(prisma, accepted.id, buses, log);
    return accepted;
  }

  return created;
}

export async function placeOrder(
  prisma: PrismaClient,
  input: PlaceOrderInput,
  buses?: { domainEventBus?: EventEmitter; orderBus?: EventEmitter },
  log?: FastifyBaseLogger
) {
  if (!input.idempotencyKey) {
    return createOrderRecord(prisma, input, buses, log);
  }

  return withOrderIdempotency(
    prisma,
    {
      scope: "place_order",
      key: input.idempotencyKey,
      restaurantId: input.restaurantId,
      requestHash: hashIdempotencyPayload({
        restaurantId: input.restaurantId,
        lines: input.lines,
        customerUserId: input.customerUserId
      })
    },
    async () => {
      const order = await createOrderRecord(prisma, input, buses, log);
      return { orderId: order.id, response: order };
    }
  );
}
