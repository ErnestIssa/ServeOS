import type { EventEmitter } from "node:events";
import { publishDomainEvent } from "../eventBus.js";
import { createDomainEvent } from "../notificationProcessor.js";
import type { OclEntityType } from "../../lib/oclRealtime.js";

export async function notifyOclUpdated(
  bus: EventEmitter,
  input: {
    entityType: OclEntityType;
    entityId: string;
    restaurantId: string;
    orderId?: string;
    reservationId?: string;
    customerUserId?: string | null;
    actorUserId?: string;
  }
): Promise<void> {
  await publishDomainEvent(
    bus,
    createDomainEvent(
      "ocl.updated",
      {
        entityType: input.entityType,
        entityId: input.entityId,
        restaurantId: input.restaurantId,
        orderId: input.orderId,
        reservationId: input.reservationId,
        customerUserId: input.customerUserId ?? null
      },
      { restaurantId: input.restaurantId, actorUserId: input.actorUserId }
    )
  );
}
