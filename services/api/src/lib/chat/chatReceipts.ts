import type { EventEmitter } from "node:events";
import type { PrismaClient } from "@prisma/client";
import { emitChatEvent } from "./chatRealtime.js";

async function roomCustomerUserId(
  prisma: PrismaClient,
  room: { id: string; customerUserId: string | null; orderId: string | null }
): Promise<string | null> {
  if (room.customerUserId) return room.customerUserId;
  if (!room.orderId) return null;
  const order = await prisma.order.findUnique({
    where: { id: room.orderId },
    select: { customerUserId: true }
  });
  return order?.customerUserId ?? null;
}

export async function markCustomerMessagesDeliveredInRoom(
  prisma: PrismaClient,
  chatBus: EventEmitter,
  chatRoomId: string
) {
  const room = await prisma.chatRoom.findUnique({ where: { id: chatRoomId } });
  if (!room) return [];

  const pending = await prisma.chatMessage.findMany({
    where: {
      chatRoomId,
      senderRole: "CUSTOMER",
      type: "TEXT",
      deliveredToVenueAt: null
    },
    select: { id: true }
  });
  if (!pending.length) return [];

  const deliveredAt = new Date();
  await prisma.chatMessage.updateMany({
    where: { id: { in: pending.map((p) => p.id) } },
    data: { deliveredToVenueAt: deliveredAt }
  });

  const customerId = await roomCustomerUserId(prisma, room);
  for (const { id } of pending) {
    emitChatEvent(chatBus, chatRoomId, customerId, {
      type: "message_delivery",
      chatRoomId,
      messageId: id,
      status: "delivered",
      deliveredAt: deliveredAt.toISOString()
    });
  }
  return pending.map((p) => p.id);
}

export async function markCustomerMessagesDeliveredForOrder(
  prisma: PrismaClient,
  chatBus: EventEmitter,
  orderId: string
) {
  const room = await prisma.chatRoom.findUnique({ where: { orderId } });
  if (!room) return [];
  return markCustomerMessagesDeliveredInRoom(prisma, chatBus, room.id);
}

export async function markMessageDelivered(
  prisma: PrismaClient,
  chatBus: EventEmitter,
  messageId: string
) {
  const msg = await prisma.chatMessage.findUnique({
    where: { id: messageId },
    include: { chatRoom: true }
  });
  if (!msg || msg.senderRole !== "CUSTOMER" || msg.deliveredToVenueAt) return null;

  const deliveredAt = new Date();
  await prisma.chatMessage.update({
    where: { id: messageId },
    data: { deliveredToVenueAt: deliveredAt }
  });

  const customerId = await roomCustomerUserId(prisma, msg.chatRoom);
  emitChatEvent(chatBus, msg.chatRoomId, customerId, {
    type: "message_delivery",
    chatRoomId: msg.chatRoomId,
    messageId,
    status: "delivered",
    deliveredAt: deliveredAt.toISOString()
  });
  return messageId;
}

export async function markRestaurantReadInRoom(
  prisma: PrismaClient,
  chatBus: EventEmitter,
  chatRoomId: string
) {
  const room = await prisma.chatRoom.findUnique({ where: { id: chatRoomId } });
  if (!room) return null;

  const readAt = new Date();
  await prisma.chatRoom.update({
    where: { id: chatRoomId },
    data: { restaurantLastReadAt: readAt }
  });

  const customerId = await roomCustomerUserId(prisma, room);
  emitChatEvent(chatBus, chatRoomId, customerId, {
    type: "messages_read",
    chatRoomId,
    readerRole: "RESTAURANT",
    readAt: readAt.toISOString()
  });
  return readAt;
}
