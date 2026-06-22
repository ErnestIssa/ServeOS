import type { EventEmitter } from "node:events";
import type { Prisma, PrismaClient } from "@prisma/client";
import { notifyOrderCreated, notifyOrderUpdated } from "../../notifications/integrations/orders.js";
import { persistOrderDomainEvent } from "./orderAuditService.js";
import type { OrderEventType } from "./orderTypes.js";
import { formatDisplayNumber } from "./orderTypes.js";
import { normalizeOrderStatus } from "./orderTypes.js";

export type OrderBroadcastPayload = {
  orderId: string;
  restaurantId: string;
  status: string;
  totalCents: number;
  restaurantName?: string;
  customerUserId?: string | null;
  displayNumber?: string;
  paymentStatus?: string;
};

function mapEventToNotificationType(eventType: OrderEventType): "order.created" | "order.updated" | "order.delivered" {
  if (eventType === "order.created") return "order.created";
  if (eventType === "order.completed") return "order.delivered";
  return "order.updated";
}

export async function emitOrderLifecycleEvent(
  tx: Prisma.TransactionClient,
  input: {
    type: OrderEventType;
    order: {
      id: string;
      restaurantId: string;
      status: string;
      totalCents: number;
      customerUserId: string | null;
      displaySeq?: number | null;
      paymentStatus?: string;
      restaurant?: { name: string };
    };
    actorUserId?: string | null;
    fromStatus?: string | null;
    metadata?: Record<string, unknown>;
  }
) {
  const payload: Record<string, unknown> = {
    orderId: input.order.id,
    restaurantId: input.order.restaurantId,
    status: input.order.status,
    canonicalStatus: normalizeOrderStatus(input.order.status as never),
    totalCents: input.order.totalCents,
    customerUserId: input.order.customerUserId,
    displayNumber: formatDisplayNumber(input.order.displaySeq, input.order.id),
    paymentStatus: input.order.paymentStatus,
    actorUserId: input.actorUserId ?? null,
    fromStatus: input.fromStatus ?? null,
    ...input.metadata
  };

  await persistOrderDomainEvent(tx, {
    orderId: input.order.id,
    restaurantId: input.order.restaurantId,
    type: input.type,
    payload
  });

  return payload as OrderBroadcastPayload & Record<string, unknown>;
}

export async function broadcastOrderEvent(
  domainEventBus: EventEmitter | undefined,
  orderBus: EventEmitter | undefined,
  eventType: OrderEventType,
  payload: OrderBroadcastPayload
) {
  if (domainEventBus) {
    const notifyType = mapEventToNotificationType(eventType);
    const input = {
      orderId: payload.orderId,
      restaurantId: payload.restaurantId,
      status: payload.status,
      totalCents: payload.totalCents,
      restaurantName: payload.restaurantName,
      customerUserId: payload.customerUserId
    };
    if (notifyType === "order.created") await notifyOrderCreated(domainEventBus, input);
    else await notifyOrderUpdated(domainEventBus, input);
  }

  if (orderBus) {
    const wsPayload = {
      type: eventType === "order.created" ? "order_created" : "order_updated",
      ...payload
    };
    orderBus.emit(`order:${payload.orderId}`, wsPayload);
    orderBus.emit(`restaurant:${payload.restaurantId}`, wsPayload);
    if (payload.customerUserId) {
      orderBus.emit(`customer:${payload.customerUserId}`, wsPayload);
    }
  }
}

export async function loadOrderBroadcastContext(prisma: PrismaClient, orderId: string) {
  return prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      restaurantId: true,
      status: true,
      totalCents: true,
      customerUserId: true,
      displaySeq: true,
      paymentStatus: true,
      restaurant: { select: { name: true } }
    }
  });
}
