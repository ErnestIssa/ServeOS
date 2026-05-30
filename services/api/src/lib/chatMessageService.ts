import type { ChatMessageType, PrismaClient } from "@prisma/client";
import { ensureChatMessageImageEnum } from "./chatImageEnum.js";
import { computeOutgoingDeliveryStatus, type OutgoingDeliveryStatus } from "./chatReadStatus.js";

export type { OutgoingDeliveryStatus };

export type SerializedChatMessage = {
  id: string;
  chatRoomId: string;
  senderUserId: string | null;
  senderRole: string;
  content: string;
  type: ChatMessageType;
  createdAt: string;
  deliveryStatus?: "sent" | "delivered" | "read";
  isMine?: boolean;
};

function displayContent(raw: string, type: ChatMessageType): string {
  const marker = raw.split("|")[0] ?? "";
  if (raw.includes("|") && /^status:[A-Z_]+$/.test(marker)) {
    return raw.split("|").slice(1).join("|").trim() || raw;
  }
  if (type === "SYSTEM" && raw.includes("|")) {
    const parts = raw.split("|");
    return parts.slice(1).join("|").trim() || parts[0];
  }
  return raw;
}

export function serializeMessage(
  row: {
    id: string;
    chatRoomId: string;
    senderUserId: string | null;
    senderRole: string;
    content: string;
    type: ChatMessageType;
    createdAt: Date;
    deliveredToVenueAt: Date | null;
  },
  viewer: { userId: string; role: "CUSTOMER" | "STAFF" | "OWNER" },
  room: { restaurantLastReadAt: Date | null; customerLastReadAt: Date | null }
): SerializedChatMessage {
  const isMine =
    viewer.role === "CUSTOMER"
      ? row.senderRole === "CUSTOMER"
      : row.senderRole === "STAFF" || row.senderRole === "OWNER";

  const out: SerializedChatMessage = {
    id: row.id,
    chatRoomId: row.chatRoomId,
    senderUserId: row.senderUserId,
    senderRole: row.senderRole,
    content: displayContent(row.content, row.type),
    type: row.type,
    createdAt: row.createdAt.toISOString()
  };

  if (isMine && (row.type === "TEXT" || row.type === "IMAGE") && viewer.role === "CUSTOMER") {
    out.isMine = true;
    out.deliveryStatus = computeOutgoingDeliveryStatus({
      messageCreatedAt: row.createdAt,
      deliveredToVenueAt: row.deliveredToVenueAt,
      restaurantLastReadAt: room.restaurantLastReadAt
    });
  }

  return out;
}

export async function createChatTextMessage(
  prisma: PrismaClient,
  input: { chatRoomId: string; senderUserId: string; senderRole: string; content: string }
) {
  const trimmed = input.content.trim();
  if (!trimmed.length) throw Object.assign(new Error("empty_message"), { statusCode: 400 });
  if (trimmed.length > 2000) throw Object.assign(new Error("message_too_long"), { statusCode: 400 });

  const preview = trimmed.length > 120 ? `${trimmed.slice(0, 117)}…` : trimmed;
  const now = new Date();

  const row = await prisma.$transaction(async (tx) => {
    const msg = await tx.chatMessage.create({
      data: {
        chatRoomId: input.chatRoomId,
        senderUserId: input.senderUserId,
        senderRole: input.senderRole,
        content: trimmed,
        type: "TEXT"
      }
    });
    await tx.chatRoom.update({
      where: { id: input.chatRoomId },
      data: {
        lastMessageAt: now,
        lastMessagePreview: preview,
        lastMessageSenderRole: input.senderRole,
        updatedAt: now
      }
    });
    return msg;
  });

  return row;
}

export async function createChatImageMessages(
  prisma: PrismaClient,
  input: {
    chatRoomId: string;
    senderUserId: string;
    senderRole: string;
    dataUris: string[];
  }
) {
  if (!input.dataUris.length) throw Object.assign(new Error("no_images"), { statusCode: 400 });

  try {
    await ensureChatMessageImageEnum(prisma);
  } catch {
    throw Object.assign(new Error("chat_schema_not_ready"), { statusCode: 503 });
  }

  const now = new Date();
  const preview = input.dataUris.length > 1 ? `📷 ${input.dataUris.length} photos` : "📷 Photo";

  return prisma.$transaction(async (tx) => {
    const rows = [];
    for (const content of input.dataUris) {
      const msg = await tx.chatMessage.create({
        data: {
          chatRoomId: input.chatRoomId,
          senderUserId: input.senderUserId,
          senderRole: input.senderRole,
          content,
          type: "IMAGE"
        }
      });
      rows.push(msg);
    }
    await tx.chatRoom.update({
      where: { id: input.chatRoomId },
      data: {
        lastMessageAt: now,
        lastMessagePreview: preview,
        lastMessageSenderRole: input.senderRole,
        updatedAt: now
      }
    });
    return rows;
  });
}

async function assertCustomerRoomAccess(
  prisma: PrismaClient,
  chatRoomId: string,
  customerUserId: string
) {
  const room = await prisma.chatRoom.findFirst({
    where: {
      id: chatRoomId,
      OR: [{ customerUserId }, { order: { customerUserId } }]
    }
  });
  if (!room) throw Object.assign(new Error("room_not_found"), { statusCode: 404 });
  return room;
}

export async function markCustomerRead(prisma: PrismaClient, chatRoomId: string, customerUserId: string) {
  await assertCustomerRoomAccess(prisma, chatRoomId, customerUserId);
  const readAt = new Date();
  await prisma.chatRoom.update({
    where: { id: chatRoomId },
    data: { customerLastReadAt: readAt }
  });
  return readAt;
}

export async function listRoomMessages(
  prisma: PrismaClient,
  chatRoomId: string,
  viewer: { userId: string; role: "CUSTOMER" }
) {
  const room = await prisma.chatRoom.findFirst({
    where: {
      id: chatRoomId,
      OR: [{ customerUserId: viewer.userId }, { order: { customerUserId: viewer.userId } }]
    }
  });
  if (!room) return [];

  const rows = await prisma.chatMessage.findMany({
    where: { chatRoomId, NOT: { type: "SYSTEM" } },
    orderBy: { createdAt: "asc" },
    take: 100
  });

  return rows.map((m) =>
    serializeMessage(m, viewer, {
      restaurantLastReadAt: room.restaurantLastReadAt,
      customerLastReadAt: room.customerLastReadAt
    })
  );
}
