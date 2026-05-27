import type { PrismaClient } from "@prisma/client";

const INCOMING_ROLES = ["STAFF", "OWNER", "SYSTEM"] as const;

/** Count venue messages the customer has not read yet (all rooms). */
export async function countCustomerChatUnread(prisma: PrismaClient, customerUserId: string): Promise<number> {
  const rooms = await prisma.chatRoom.findMany({
    where: {
      OR: [{ customerUserId }, { order: { customerUserId } }]
    },
    select: { id: true, customerLastReadAt: true }
  });

  if (rooms.length === 0) return 0;

  let total = 0;
  for (const room of rooms) {
    const readAt = room.customerLastReadAt ?? new Date(0);
    const n = await prisma.chatMessage.count({
      where: {
        chatRoomId: room.id,
        senderRole: { in: [...INCOMING_ROLES] },
        createdAt: { gt: readAt },
        NOT: { type: "SYSTEM" }
      }
    });
    total += n;
  }
  return total;
}

export async function countRoomUnreadForCustomer(
  prisma: PrismaClient,
  chatRoomId: string,
  customerUserId: string
): Promise<number> {
  const room = await prisma.chatRoom.findFirst({
    where: {
      id: chatRoomId,
      OR: [{ customerUserId }, { order: { customerUserId } }]
    },
    select: { customerLastReadAt: true }
  });
  if (!room) return 0;
  const readAt = room.customerLastReadAt ?? new Date(0);
  return prisma.chatMessage.count({
    where: {
      chatRoomId,
      senderRole: { in: [...INCOMING_ROLES] },
      createdAt: { gt: readAt },
      NOT: { type: "SYSTEM" }
    }
  });
}
