import type { PrismaClient } from "@prisma/client";
import { markTrustEventExecuted } from "./trustEventService.js";
import { writeTrustAuditLog } from "./auditLogService.js";
import { discountPercent } from "./trustPolicies.js";

export async function applyOrderDiscount(
  prisma: PrismaClient,
  params: {
    orderId: string;
    discountCents: number;
    actorUserId: string;
    trustEventId: string;
    reason?: string;
  }
) {
  const before = await prisma.order.findUnique({ where: { id: params.orderId } });
  if (!before) throw Object.assign(new Error("order_not_found"), { statusCode: 404 });

  const nextDiscount = Math.min(before.subtotalCents, before.discountCents + params.discountCents);
  const totalCents = Math.max(0, before.subtotalCents + before.taxCents - nextDiscount);

  const after = await prisma.order.update({
    where: { id: params.orderId },
    data: { discountCents: nextDiscount, totalCents }
  });

  await writeTrustAuditLog(prisma, {
    trustEventId: params.trustEventId,
    workspaceId: before.restaurantId,
    actorId: params.actorUserId,
    actionType: nextDiscount >= before.subtotalCents ? "COMP" : "DISCOUNT",
    entityType: "ORDER",
    entityId: params.orderId,
    beforeState: {
      discountCents: before.discountCents,
      totalCents: before.totalCents,
      subtotalCents: before.subtotalCents
    },
    afterState: {
      discountCents: after.discountCents,
      totalCents: after.totalCents,
      discountPercent: discountPercent(after.discountCents, after.subtotalCents),
      reason: params.reason ?? null
    }
  });
  await markTrustEventExecuted(prisma, params.trustEventId);
  return after;
}

export async function applyOrderRefund(
  prisma: PrismaClient,
  params: {
    orderId: string;
    refundCents: number;
    actorUserId: string;
    trustEventId: string;
    reason?: string;
  }
) {
  const before = await prisma.order.findUnique({ where: { id: params.orderId } });
  if (!before) throw Object.assign(new Error("order_not_found"), { statusCode: 404 });

  const nextRefund = Math.min(before.totalCents, before.refundedCents + params.refundCents);
  const after = await prisma.order.update({
    where: { id: params.orderId },
    data: { refundedCents: nextRefund }
  });

  await writeTrustAuditLog(prisma, {
    trustEventId: params.trustEventId,
    workspaceId: before.restaurantId,
    actorId: params.actorUserId,
    actionType: "REFUND",
    entityType: "ORDER",
    entityId: params.orderId,
    beforeState: { refundedCents: before.refundedCents, totalCents: before.totalCents },
    afterState: { refundedCents: after.refundedCents, reason: params.reason ?? null }
  });
  await markTrustEventExecuted(prisma, params.trustEventId);
  return after;
}

export async function executeApprovedOrderAction(
  prisma: PrismaClient,
  approvalTaskId: string,
  actorUserId: string
) {
  const task = await prisma.approvalTask.findUnique({
    where: { id: approvalTaskId },
    include: { trustEvent: true }
  });
  if (!task || task.status !== "APPROVED") {
    throw Object.assign(new Error("approval_not_approved"), { statusCode: 403 });
  }
  if (task.requestedByUserId !== actorUserId) {
    throw Object.assign(new Error("approval_requester_mismatch"), { statusCode: 403 });
  }

  const payload =
    task.trustEvent.payload && typeof task.trustEvent.payload === "object" && !Array.isArray(task.trustEvent.payload)
      ? (task.trustEvent.payload as Record<string, unknown>)
      : {};

  const action = task.trustEvent.actionType;
  if (action === "DISCOUNT" || action === "COMP") {
    return applyOrderDiscount(prisma, {
      orderId: task.entityId,
      discountCents: Number(payload.discountCents ?? 0),
      actorUserId,
      trustEventId: task.trustEventId,
      reason: typeof payload.reason === "string" ? payload.reason : undefined
    });
  }
  if (action === "REFUND") {
    return applyOrderRefund(prisma, {
      orderId: task.entityId,
      refundCents: Number(payload.refundCents ?? 0),
      actorUserId,
      trustEventId: task.trustEventId,
      reason: typeof payload.reason === "string" ? payload.reason : undefined
    });
  }

  throw Object.assign(new Error("unsupported_approval_action"), { statusCode: 400 });
}
