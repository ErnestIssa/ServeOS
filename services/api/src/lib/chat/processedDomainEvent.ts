import type { PrismaClient } from "@prisma/client";
import type { CommunicationEntityType, DomainEvent } from "../../notifications/types.js";

export async function claimProjection(
  prisma: PrismaClient,
  event: DomainEvent,
  projection: string
): Promise<boolean> {
  if (event.idempotencyKey) {
    const existing = await prisma.processedDomainEvent.findFirst({
      where: { idempotencyKey: event.idempotencyKey, projection }
    });
    if (existing) return false;
  }
  try {
    await prisma.processedDomainEvent.create({
      data: {
        id: event.id,
        type: event.type,
        restaurantId: event.restaurantId ?? null,
        entityType: event.entityType ?? null,
        entityId: event.entityId ?? null,
        version: event.aggregateVersion ?? event.version ?? 1,
        schemaVersion: event.schemaVersion ?? 1,
        aggregateVersion: event.aggregateVersion,
        idempotencyKey: event.idempotencyKey ?? null,
        correlationId: event.correlationId ?? null,
        causationId: event.causationId ?? null,
        projection
      }
    });
    return true;
  } catch {
    return false;
  }
}

export function inferEntityFromPayload(
  type: string,
  payload: Record<string, unknown>
): { entityType: CommunicationEntityType; entityId: string | null } {
  if (typeof payload.entityType === "string" && payload.entityType) {
    return {
      entityType: payload.entityType as CommunicationEntityType,
      entityId: typeof payload.entityId === "string" ? payload.entityId : null
    };
  }
  if (type.startsWith("order.")) {
    return { entityType: "ORDER", entityId: typeof payload.orderId === "string" ? payload.orderId : null };
  }
  if (type.startsWith("chat.")) {
    return {
      entityType: "CHAT_ROOM",
      entityId: typeof payload.chatRoomId === "string" ? payload.chatRoomId : null
    };
  }
  if (type.startsWith("payment.")) {
    const id =
      typeof payload.paymentId === "string"
        ? payload.paymentId
        : typeof payload.orderId === "string"
          ? payload.orderId
          : null;
    return { entityType: "PAYMENT", entityId: id };
  }
  if (type.startsWith("reservation.")) {
    return {
      entityType: "RESERVATION",
      entityId: typeof payload.reservationId === "string" ? payload.reservationId : null
    };
  }
  if (type.startsWith("staff.")) {
    return { entityType: "STAFF", entityId: typeof payload.userId === "string" ? payload.userId : null };
  }
  if (type === "device.offline" || type === "integration.failed") {
    return { entityType: "DEVICE", entityId: typeof payload.deviceId === "string" ? payload.deviceId : null };
  }
  return { entityType: "SYSTEM", entityId: typeof payload.entityId === "string" ? payload.entityId : null };
}
