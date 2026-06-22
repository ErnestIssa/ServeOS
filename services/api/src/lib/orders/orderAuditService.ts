import type { Prisma, PrismaClient } from "@prisma/client";
import type { OrderActorSource } from "@prisma/client";
import { randomUUID } from "node:crypto";
import type { OrderEventType } from "./orderTypes.js";

export async function appendOrderStatusHistory(
  tx: Prisma.TransactionClient,
  input: {
    orderId: string;
    fromStatus: string | null;
    toStatus: string;
    actorUserId?: string | null;
    actorSource: OrderActorSource;
    reason?: string;
  }
) {
  await tx.orderStatusHistory.create({
    data: {
      orderId: input.orderId,
      fromStatus: input.fromStatus as never,
      toStatus: input.toStatus as never,
      actorUserId: input.actorUserId ?? null,
      actorSource: input.actorSource,
      reason: input.reason ?? null
    }
  });
}

export async function appendOrderAuditLog(
  tx: Prisma.TransactionClient,
  input: {
    orderId: string;
    restaurantId: string;
    action: string;
    actorUserId?: string | null;
    actorSource: OrderActorSource;
    beforeState?: Record<string, unknown>;
    afterState?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
  }
) {
  await tx.orderAuditLog.create({
    data: {
      orderId: input.orderId,
      restaurantId: input.restaurantId,
      action: input.action,
      actorUserId: input.actorUserId ?? null,
      actorSource: input.actorSource,
      beforeState: input.beforeState as Prisma.InputJsonValue,
      afterState: input.afterState as Prisma.InputJsonValue,
      metadata: input.metadata as Prisma.InputJsonValue
    }
  });
}

export async function persistOrderDomainEvent(
  tx: Prisma.TransactionClient,
  input: {
    orderId: string;
    restaurantId: string;
    type: OrderEventType | string;
    payload: Record<string, unknown>;
  }
) {
  await tx.orderDomainEvent.create({
    data: {
      id: randomUUID(),
      orderId: input.orderId,
      restaurantId: input.restaurantId,
      type: input.type,
      payload: input.payload as Prisma.InputJsonValue
    }
  });
}

export async function listOrderAuditTrail(prisma: PrismaClient, orderId: string, take = 50) {
  return prisma.orderAuditLog.findMany({
    where: { orderId },
    orderBy: { createdAt: "desc" },
    take
  });
}

export async function listOrderStatusHistory(prisma: PrismaClient, orderId: string, take = 50) {
  return prisma.orderStatusHistory.findMany({
    where: { orderId },
    orderBy: { createdAt: "asc" },
    take
  });
}

export async function listOrderDomainEvents(prisma: PrismaClient, orderId: string, take = 50) {
  return prisma.orderDomainEvent.findMany({
    where: { orderId },
    orderBy: { createdAt: "desc" },
    take
  });
}
