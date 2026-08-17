import type { OrderStatus, PrismaClient } from "@prisma/client";

const ORDER_RESOLVED: ReadonlySet<string> = new Set([
  "COMPLETED",
  "CANCELLED",
  "REFUNDED",
  "ARCHIVED",
  "REJECTED"
]);

const RESERVATION_RESOLVED: ReadonlySet<string> = new Set(["COMPLETED", "CANCELLED"]);

export async function syncChatRoomLifecycleForOrder(
  prisma: PrismaClient,
  orderId: string,
  status: OrderStatus | string
) {
  const resolved = ORDER_RESOLVED.has(String(status));
  await prisma.chatRoom.updateMany({
    where: { orderId, isSystemChannel: false },
    data: {
      lifecycle: resolved ? "RESOLVED" : "OPEN",
      resolvedAt: resolved ? new Date() : null
    }
  });
}

export async function syncChatRoomLifecycleForReservation(
  prisma: PrismaClient,
  reservationId: string,
  status: string
) {
  const resolved = RESERVATION_RESOLVED.has(status);
  await prisma.chatRoom.updateMany({
    where: { reservationId, isSystemChannel: false },
    data: {
      lifecycle: resolved ? "RESOLVED" : "OPEN",
      resolvedAt: resolved ? new Date() : null
    }
  });
}

export async function resolveTableRoomsForSession(prisma: PrismaClient, sourceSessionId: string) {
  await prisma.chatRoom.updateMany({
    where: { type: "TABLE", sourceSessionId, isSystemChannel: false, lifecycle: "OPEN" },
    data: { lifecycle: "RESOLVED", resolvedAt: new Date() }
  });
}

/**
 * One TABLE room per (restaurant, table, QR session).
 * A new guest at the same table gets a new session and a new room — they do not inherit the previous conversation.
 */
export async function ensureTableChatRoom(
  prisma: PrismaClient,
  input: {
    restaurantId: string;
    tableId: string;
    tableLabel?: string | null;
    sourceSessionId?: string | null;
    customerUserId?: string | null;
  }
) {
  if (!input.sourceSessionId) {
    throw Object.assign(new Error("table_session_required"), { statusCode: 400 });
  }
  const existing = await prisma.chatRoom.findFirst({
    where: {
      restaurantId: input.restaurantId,
      tableId: input.tableId,
      sourceSessionId: input.sourceSessionId,
      type: "TABLE"
    }
  });
  if (existing) return existing;
  try {
    return await prisma.chatRoom.create({
      data: {
        type: "TABLE",
        restaurantId: input.restaurantId,
        tableId: input.tableId,
        tableLabel: input.tableLabel ?? null,
        sourceSessionId: input.sourceSessionId,
        name: input.tableLabel ? `Table ${input.tableLabel}` : "Table"
      }
    });
  } catch {
    const raced = await prisma.chatRoom.findFirst({
      where: {
        restaurantId: input.restaurantId,
        tableId: input.tableId,
        sourceSessionId: input.sourceSessionId,
        type: "TABLE"
      }
    });
    if (raced) return raced;
    throw Object.assign(new Error("table_room_failed"), { statusCode: 500 });
  }
}
