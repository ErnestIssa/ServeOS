import type { PrismaClient } from "@prisma/client";
import { createChatTextMessage, serializeMessage } from "./chatMessageService.js";
import type { MobileAuthContext } from "./mobileAuthContext.js";
import { requireVenueMembership } from "./mobileAuthContext.js";

export async function listVenueChatThreads(prisma: PrismaClient, restaurantId: string) {
  const rooms = await prisma.chatRoom.findMany({
    where: { restaurantId },
    orderBy: { lastMessageAt: "desc" },
    take: 60,
    include: {
      order: { select: { id: true, status: true } },
      reservation: { select: { id: true, confirmationCode: true, status: true } },
      customer: { select: { email: true } }
    }
  });

  return rooms.map((r) => ({
    id: r.id,
    type: r.type,
    orderId: r.orderId,
    reservationId: r.reservationId,
    orderStatus: r.order?.status ?? r.reservation?.status ?? null,
    customerLabel: r.customer?.email ?? "Guest",
    preview: r.lastMessagePreview ?? "No messages yet",
    lastMessageAt: r.lastMessageAt?.toISOString() ?? r.createdAt.toISOString(),
    unreadForVenue:
      !!r.lastMessageAt &&
      (!r.restaurantLastReadAt || r.lastMessageAt > r.restaurantLastReadAt) &&
      r.lastMessageSenderRole === "CUSTOMER"
  }));
}

export async function listVenueRoomMessages(
  prisma: PrismaClient,
  restaurantId: string,
  chatRoomId: string
) {
  const room = await prisma.chatRoom.findFirst({
    where: { id: chatRoomId, restaurantId }
  });
  if (!room) throw Object.assign(new Error("room_not_found"), { statusCode: 404 });

  const rows = await prisma.chatMessage.findMany({
    where: { chatRoomId, NOT: { type: "SYSTEM" } },
    orderBy: { createdAt: "asc" },
    take: 120
  });

  return rows.map((m) =>
    serializeMessage(
      m,
      { userId: "", role: "STAFF" },
      {
        restaurantLastReadAt: room.restaurantLastReadAt,
        customerLastReadAt: room.customerLastReadAt
      }
    )
  );
}

export async function sendVenueStaffMessage(
  prisma: PrismaClient,
  ctx: MobileAuthContext,
  restaurantId: string,
  chatRoomId: string,
  content: string
) {
  await requireVenueMembership(prisma, ctx, restaurantId);
  const room = await prisma.chatRoom.findFirst({
    where: { id: chatRoomId, restaurantId }
  });
  if (!room) throw Object.assign(new Error("room_not_found"), { statusCode: 404 });

  const membership = ctx.memberships.find((m) => m.restaurantId === restaurantId);
  const role = membership?.role ?? "STAFF";

  return createChatTextMessage(prisma, {
    chatRoomId,
    senderUserId: ctx.userId,
    senderRole: role,
    content: content.trim()
  });
}
