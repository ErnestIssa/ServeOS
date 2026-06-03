import type { EventEmitter } from "node:events";
import { publishDomainEvent } from "../eventBus.js";
import { createDomainEvent } from "../notificationProcessor.js";

export async function notifyOrderUpdated(
  bus: EventEmitter,
  input: {
    orderId: string;
    restaurantId: string;
    status: string;
    totalCents: number;
    restaurantName?: string;
    customerUserId?: string | null;
  }
): Promise<void> {
  const type = input.status === "COMPLETED" ? "order.delivered" : "order.updated";

  await publishDomainEvent(
    bus,
    createDomainEvent(
      type,
      {
        orderId: input.orderId,
        restaurantId: input.restaurantId,
        status: input.status,
        totalCents: input.totalCents,
        restaurantName: input.restaurantName,
        customerUserId: input.customerUserId
      },
      { restaurantId: input.restaurantId }
    )
  );
}

export async function notifyOrderCreated(
  bus: EventEmitter,
  input: {
    orderId: string;
    restaurantId: string;
    status: string;
    totalCents: number;
    restaurantName?: string;
    customerUserId?: string | null;
  }
): Promise<void> {
  await publishDomainEvent(
    bus,
    createDomainEvent(
      "order.created",
      {
        orderId: input.orderId,
        restaurantId: input.restaurantId,
        status: input.status,
        totalCents: input.totalCents,
        restaurantName: input.restaurantName,
        customerUserId: input.customerUserId
      },
      { restaurantId: input.restaurantId }
    )
  );
}
