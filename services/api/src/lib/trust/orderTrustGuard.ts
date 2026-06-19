import type { EventEmitter } from "node:events";
import type { OrderStatus, PrismaClient } from "@prisma/client";
import { applyOrderDiscount, applyOrderRefund } from "./orderTrustService.js";
import {
  buildStaffTrustContext,
  guardSensitiveAction,
  trustGuardHttpError
} from "./trustGuard.js";
import { markTrustEventExecuted } from "./trustEventService.js";
import { writeTrustAuditLog } from "./auditLogService.js";

export async function guardOrderStatusChange(
  prisma: PrismaClient,
  params: {
    orderId: string;
    actorUserId: string;
    targetStatus: OrderStatus;
    approvalTaskId?: string;
  },
  domainEventBus?: EventEmitter
) {
  const order = await prisma.order.findUnique({ where: { id: params.orderId } });
  if (!order) throw Object.assign(new Error("order_not_found"), { statusCode: 404 });

  const ctx = await buildStaffTrustContext(prisma, params.actorUserId, order.restaurantId);

  const guard = await guardSensitiveAction(
    prisma,
    {
      workspaceId: order.restaurantId,
      actorUserId: params.actorUserId,
      actorContext: ctx.actorContext,
      entityType: "ORDER",
      entityId: order.id,
      actionType: params.targetStatus === "CANCELLED" ? "ORDER_CANCEL" : "ORDER_STATUS",
      metadata: {
        customerUserId: order.customerUserId,
        orderSubtotalCents: order.subtotalCents,
        orderTotalCents: order.totalCents,
        targetStatus: params.targetStatus,
        actorMembershipRole: ctx.actorMembershipRole ?? undefined
      },
      executePayload: { targetStatus: params.targetStatus },
      skipIfApprovalId: params.approvalTaskId
    },
    domainEventBus
  );

  if (!guard.ok) throw trustGuardHttpError(guard);
  return { order, trustEventId: guard.trustEventId };
}

export async function finalizeOrderStatusAudit(
  prisma: PrismaClient,
  params: {
    trustEventId: string;
    orderId: string;
    actorUserId: string;
    beforeStatus: string;
    afterStatus: string;
  }
) {
  const order = await prisma.order.findUnique({ where: { id: params.orderId } });
  if (!order) return;
  await writeTrustAuditLog(prisma, {
    trustEventId: params.trustEventId,
    workspaceId: order.restaurantId,
    actorId: params.actorUserId,
    actionType: "ORDER_STATUS",
    entityType: "ORDER",
    entityId: params.orderId,
    beforeState: { status: params.beforeStatus },
    afterState: { status: params.afterStatus }
  });
  await markTrustEventExecuted(prisma, params.trustEventId);
}

export async function handleOrderDiscountRequest(
  prisma: PrismaClient,
  params: {
    orderId: string;
    actorUserId: string;
    discountCents: number;
    reason?: string;
    approvalTaskId?: string;
  },
  domainEventBus?: EventEmitter
) {
  const order = await prisma.order.findUnique({ where: { id: params.orderId } });
  if (!order) throw Object.assign(new Error("order_not_found"), { statusCode: 404 });

  const ctx = await buildStaffTrustContext(prisma, params.actorUserId, order.restaurantId);
  const isComp = params.discountCents >= order.subtotalCents - order.discountCents;

  const guard = await guardSensitiveAction(
    prisma,
    {
      workspaceId: order.restaurantId,
      actorUserId: params.actorUserId,
      actorContext: ctx.actorContext,
      entityType: "ORDER",
      entityId: order.id,
      actionType: isComp ? "COMP" : "DISCOUNT",
      metadata: {
        customerUserId: order.customerUserId,
        orderSubtotalCents: order.subtotalCents,
        orderTotalCents: order.totalCents,
        discountCents: params.discountCents,
        actorMembershipRole: ctx.actorMembershipRole ?? undefined
      },
      executePayload: {
        discountCents: params.discountCents,
        reason: params.reason ?? null
      },
      skipIfApprovalId: params.approvalTaskId
    },
    domainEventBus
  );

  if (!guard.ok) throw trustGuardHttpError(guard);

  return applyOrderDiscount(prisma, {
    orderId: order.id,
    discountCents: params.discountCents,
    actorUserId: params.actorUserId,
    trustEventId: guard.trustEventId,
    reason: params.reason
  });
}

export async function handleOrderRefundRequest(
  prisma: PrismaClient,
  params: {
    orderId: string;
    actorUserId: string;
    refundCents: number;
    reason?: string;
    approvalTaskId?: string;
  },
  domainEventBus?: EventEmitter
) {
  const order = await prisma.order.findUnique({ where: { id: params.orderId } });
  if (!order) throw Object.assign(new Error("order_not_found"), { statusCode: 404 });

  const ctx = await buildStaffTrustContext(prisma, params.actorUserId, order.restaurantId);

  const guard = await guardSensitiveAction(
    prisma,
    {
      workspaceId: order.restaurantId,
      actorUserId: params.actorUserId,
      actorContext: ctx.actorContext,
      entityType: "ORDER",
      entityId: order.id,
      actionType: "REFUND",
      metadata: {
        customerUserId: order.customerUserId,
        orderSubtotalCents: order.subtotalCents,
        orderTotalCents: order.totalCents,
        refundCents: params.refundCents,
        actorMembershipRole: ctx.actorMembershipRole ?? undefined
      },
      executePayload: {
        refundCents: params.refundCents,
        reason: params.reason ?? null
      },
      skipIfApprovalId: params.approvalTaskId
    },
    domainEventBus
  );

  if (!guard.ok) throw trustGuardHttpError(guard);

  return applyOrderRefund(prisma, {
    orderId: order.id,
    refundCents: params.refundCents,
    actorUserId: params.actorUserId,
    trustEventId: guard.trustEventId,
    reason: params.reason
  });
}
