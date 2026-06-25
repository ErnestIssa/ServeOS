import type { EventEmitter } from "node:events";
import type { Prisma, PrismaClient } from "@prisma/client";
import type { FastifyBaseLogger } from "fastify";
import { resolveOrderEngineActor, optimisticOrderUpdate } from "../orders/orderEnginePermissions.js";
import { withOrderIdempotency } from "../orders/orderIdempotencyService.js";
import { flushOrderOutboxForOrder } from "../orders/orderOutboxProcessor.js";
import { assertOrderOwnershipAccess } from "../orderOwnership/orderOwnershipPermissions.js";
import { normalizeToCanonicalSource } from "../orderSource/orderSourceResolution.js";
import { recordSourceInterpretation } from "../orderSource/orderSourceLifecycle.js";
import { resolveEditWindow, validateOrderEdit } from "./orderEditValidation.js";
import {
  applyEditToLines,
  assertEditPaymentSafety,
  computePaymentDelta,
  resolveNoteAfterEdit,
  summarizeLineTotals
} from "./orderEditPricing.js";
import { recordOrderEditAudit } from "./orderEditAudit.js";
import { emitOrderEditEvents } from "./orderEditEvents.js";
import type { OrderEditLineState, OrderEditRequest, OrderEditResult } from "./orderEditTypes.js";
import { isStaffActor } from "./orderEditPermissions.js";

function toLineState(
  line: {
    id: string;
    menuItemId: string;
    nameSnapshot: string;
    quantity: number;
    unitPriceCents: number;
    selectedModifiers: unknown;
    lineTotalCents: number;
  }
): OrderEditLineState {
  return {
    id: line.id,
    menuItemId: line.menuItemId,
    nameSnapshot: line.nameSnapshot,
    quantity: line.quantity,
    unitPriceCents: line.unitPriceCents,
    selectedModifiers: line.selectedModifiers,
    lineTotalCents: line.lineTotalCents
  };
}

async function executeOrderEdit(
  prisma: PrismaClient,
  request: OrderEditRequest,
  buses?: { domainEventBus?: EventEmitter; orderBus?: EventEmitter },
  log?: FastifyBaseLogger
): Promise<OrderEditResult> {
  void log;

  const order = await prisma.order.findUnique({
    where: { id: request.orderId },
    include: { lines: true }
  });
  if (!order) throw Object.assign(new Error("order_not_found"), { statusCode: 404 });

  if (order.version !== request.expectedVersion) {
    throw Object.assign(new Error("order_version_conflict"), { statusCode: 409 });
  }

  const actor = await resolveOrderEngineActor(prisma, order.restaurantId, request.actor);

  if (actor.isCustomer || actor.source === "CUSTOMER") {
    await assertOrderOwnershipAccess(
      prisma,
      order.id,
      { userId: actor.userId!, isCustomer: true },
      "act"
    );
  } else if (actor.userId) {
    await assertOrderOwnershipAccess(
      prisma,
      order.id,
      { userId: actor.userId, isCustomer: false },
      "act"
    );
  }

  const window = resolveEditWindow(order);
  const lineStates = order.lines.map(toLineState);

  validateOrderEdit({
    order,
    lines: lineStates,
    window,
    actor,
    operation: request.operation,
    payload: request.payload,
    reason: request.reason
  });

  assertEditPaymentSafety({
    operation: request.operation,
    sourceMetadata: order.sourceMetadata,
    paymentStatus: order.paymentStatus,
    actorIsStaff: isStaffActor(actor)
  });

  const previousTotalCents = order.totalCents;
  let nextLines = lineStates;
  const noteOnlyOps = ["UPDATE_NOTE", "ADD_ALLERGY_NOTE", "STAFF_CORRECTION"] as const;

  if (!noteOnlyOps.includes(request.operation as (typeof noteOnlyOps)[number])) {
    nextLines = await applyEditToLines(
      prisma,
      order.restaurantId,
      lineStates,
      request.operation,
      request.payload
    );
  }

  const totals = summarizeLineTotals(nextLines, order.discountCents, order.restaurantId);
  const paymentDelta = computePaymentDelta(previousTotalCents, totals.totalCents, order.paymentStatus);

  const pricing = {
    ...totals,
    previousTotalCents,
    paymentDeltaCents: paymentDelta.paymentDeltaCents,
    requiresAdditionalCharge: paymentDelta.requiresAdditionalCharge,
    requiresRefundDelta: paymentDelta.requiresRefundDelta,
    nextPaymentStatus: paymentDelta.nextPaymentStatus
  };

  const nextNote = resolveNoteAfterEdit(order.note, request.operation, request.payload);
  const kdsNotifyRequired = window.kitchenStarted;

  const linesChanged = nextLines.filter((l) => l.isNew || l.isRemoved || l.isModified).length;

  const beforeState = {
    totalCents: order.totalCents,
    subtotalCents: order.subtotalCents,
    note: order.note,
    lineCount: order.lines.length,
    version: order.version
  };

  const updated = await prisma.$transaction(async (tx) => {
    for (const line of nextLines.filter((l) => l.isRemoved && l.id)) {
      await tx.orderLineItem.delete({ where: { id: line.id! } });
    }

    for (const line of nextLines.filter((l) => l.isNew)) {
      await tx.orderLineItem.create({
        data: {
          orderId: order.id,
          menuItemId: line.menuItemId,
          nameSnapshot: line.nameSnapshot,
          quantity: line.quantity,
          unitPriceCents: line.unitPriceCents,
          selectedModifiers: line.selectedModifiers as Prisma.InputJsonValue,
          lineTotalCents: line.lineTotalCents
        }
      });
    }

    for (const line of nextLines.filter((l) => l.isModified && l.id)) {
      await tx.orderLineItem.update({
        where: { id: line.id! },
        data: {
          nameSnapshot: line.nameSnapshot,
          quantity: line.quantity,
          unitPriceCents: line.unitPriceCents,
          selectedModifiers: line.selectedModifiers as Prisma.InputJsonValue,
          lineTotalCents: line.lineTotalCents
        }
      });
    }

    const orderPatch: Prisma.OrderUpdateInput = {
      subtotalCents: totals.subtotalCents,
      taxCents: totals.taxCents,
      serviceFeeCents: totals.serviceFeeCents,
      totalCents: totals.totalCents,
      note: nextNote
    };

    if (paymentDelta.nextPaymentStatus) {
      orderPatch.paymentStatus = paymentDelta.nextPaymentStatus;
    }

    const saved = await optimisticOrderUpdate(tx, {
      orderId: order.id,
      expectedVersion: request.expectedVersion,
      data: orderPatch
    });

    await recordOrderEditAudit(tx, {
      orderId: order.id,
      restaurantId: order.restaurantId,
      operation: request.operation,
      actorUserId: actor.userId,
      actorSource: actor.source,
      reason: request.reason,
      requestSource: request.requestSource,
      beforeState,
      afterState: {
        totalCents: saved.totalCents,
        subtotalCents: saved.subtotalCents,
        note: saved.note,
        version: saved.version
      },
      pricing
    });

    if (
      request.operation === "ADD_ITEM" &&
      isStaffActor(actor) &&
      normalizeToCanonicalSource(order.source) === "QR_ORDER"
    ) {
      const { updatedModifiers } = await recordSourceInterpretation(tx, {
        orderId: order.id,
        restaurantId: order.restaurantId,
        primarySource: "QR_ORDER",
        interpretation: "HYBRID_STAFF_LINE_ADDITION",
        actorUserId: actor.userId,
        actorIsStaff: true,
        note: request.reason,
        currentMetadata: order.sourceMetadata
      });

      const meta = (order.sourceMetadata ?? {}) as Record<string, unknown>;
      const comp = (meta.compositionalAttribution as { primarySource: string; modifiers: unknown[]; revenueSplitPolicy: string } | undefined) ?? {
        primarySource: "QR_ORDER",
        modifiers: [],
        revenueSplitPolicy: "primary_100"
      };

      await tx.order.update({
        where: { id: order.id },
        data: {
          sourceMetadata: {
            ...meta,
            compositionalAttribution: { ...comp, modifiers: updatedModifiers }
          } as Prisma.InputJsonValue
        }
      });
    }

    await emitOrderEditEvents(tx, {
      operation: request.operation,
      order: saved,
      actorUserId: actor.userId,
      pricing,
      kdsNotifyRequired,
      linesChanged
    });

    return saved;
  });

  await flushOrderOutboxForOrder(prisma, updated.id, buses);

  return {
    ok: true,
    orderId: updated.id,
    version: updated.version,
    operation: request.operation,
    pricing,
    linesChanged,
    kdsNotifyRequired
  };
}

/** Central editing entry — all order modifications must flow through here. */
export async function applyOrderEditOperation(
  prisma: PrismaClient,
  request: OrderEditRequest,
  buses?: { domainEventBus?: EventEmitter; orderBus?: EventEmitter },
  log?: FastifyBaseLogger
): Promise<OrderEditResult> {
  if (!request.idempotencyKey) {
    return executeOrderEdit(prisma, request, buses, log);
  }

  return withOrderIdempotency(
    prisma,
    {
      scope: "order_edit",
      key: request.idempotencyKey,
      restaurantId: undefined,
      requestHash: undefined
    },
    async () => {
      const result = await executeOrderEdit(prisma, request, buses, log);
      return { orderId: result.orderId, response: result as unknown as Record<string, unknown> };
    }
  ) as Promise<OrderEditResult>;
}

export const ORDER_EDIT_DOMAIN_RULES = {
  authority: "applyOrderEditOperation is the only path for post-placement order mutations",
  frontendRule: "clients send edit intent + expectedVersion; backend decides permissions and pricing"
} as const;
