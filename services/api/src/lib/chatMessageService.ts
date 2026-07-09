import type { ChatMessageType, PrismaClient } from "@prisma/client";
import { ensureChatMessageImageEnum } from "./chatImageEnum.js";
import type { ChatImageMime } from "./chatImageLimits.js";
import {
  buildDocumentContent,
  parseDocumentContent,
  type ChatDocumentMime
} from "./chatDocumentLimits.js";
import { computeOutgoingDeliveryStatus, type OutgoingDeliveryStatus } from "./chatReadStatus.js";
import { resolveClientMediaUrl } from "./integrations/objectStorage.js";
import { uploadChatImageBase64 } from "./media/chatImageStorage.js";
import { uploadChatDocumentBase64 } from "./media/chatDocumentStorage.js";

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

export async function serializeMessage(
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
): Promise<SerializedChatMessage> {
  const isMine =
    viewer.role === "CUSTOMER"
      ? row.senderRole === "CUSTOMER"
      : row.senderRole === "STAFF" || row.senderRole === "OWNER";

  let content = displayContent(row.content, row.type);
  if (row.type === "IMAGE") {
    content = await resolveClientMediaUrl(content);
  }
  const doc = parseDocumentContent(row.content);
  if (doc) {
    const url = await resolveClientMediaUrl(doc.contentRef);
    content = `DOC|${doc.fileName}|${url}`;
  }

  const out: SerializedChatMessage = {
    id: row.id,
    chatRoomId: row.chatRoomId,
    senderUserId: row.senderUserId,
    senderRole: row.senderRole,
    content,
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

export async function serializeMessages(
  rows: Array<{
    id: string;
    chatRoomId: string;
    senderUserId: string | null;
    senderRole: string;
    content: string;
    type: ChatMessageType;
    createdAt: Date;
    deliveredToVenueAt: Date | null;
  }>,
  viewer: { userId: string; role: "CUSTOMER" | "STAFF" | "OWNER" },
  room: { restaurantLastReadAt: Date | null; customerLastReadAt: Date | null }
): Promise<SerializedChatMessage[]> {
  return Promise.all(rows.map((row) => serializeMessage(row, viewer, room)));
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
    images: Array<{ mimeType: ChatImageMime; dataBase64: string }>;
  }
) {
  if (!input.images.length) throw Object.assign(new Error("no_images"), { statusCode: 400 });

  try {
    await ensureChatMessageImageEnum(prisma);
  } catch {
    throw Object.assign(new Error("chat_schema_not_ready"), { statusCode: 503 });
  }

  const now = new Date();
  const preview = input.images.length > 1 ? `📷 ${input.images.length} photos` : "📷 Photo";

  return prisma.$transaction(async (tx) => {
    const rows = [];
    for (const image of input.images) {
      const uploaded = await uploadChatImageBase64({
        chatRoomId: input.chatRoomId,
        mimeType: image.mimeType,
        dataBase64: image.dataBase64
      });
      if (!uploaded.ok) {
        throw Object.assign(new Error(uploaded.error), { statusCode: 400 });
      }

      const msg = await tx.chatMessage.create({
        data: {
          chatRoomId: input.chatRoomId,
          senderUserId: input.senderUserId,
          senderRole: input.senderRole,
          content: uploaded.contentRef,
          type: "IMAGE"
        }
      });

      await tx.storedMedia.create({
        data: {
          objectKey: uploaded.objectKey,
          scope: "CHAT_IMAGE",
          contentType: uploaded.contentType,
          byteSize: uploaded.byteSize,
          sha256Hex: uploaded.sha256Hex,
          visibility: "PRIVATE",
          uploadedById: input.senderUserId,
          chatRoomId: input.chatRoomId,
          chatMessageId: msg.id
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

export async function createChatDocumentMessage(
  prisma: PrismaClient,
  input: {
    chatRoomId: string;
    senderUserId: string;
    senderRole: string;
    fileName: string;
    mimeType: ChatDocumentMime;
    dataBase64: string;
  }
) {
  const fileName = input.fileName.trim().slice(0, 180);
  if (!fileName.length) throw Object.assign(new Error("invalid_document"), { statusCode: 400 });

  const uploaded = await uploadChatDocumentBase64({
    chatRoomId: input.chatRoomId,
    mimeType: input.mimeType,
    dataBase64: input.dataBase64
  });
  if (!uploaded.ok) {
    throw Object.assign(new Error(uploaded.error), { statusCode: 400 });
  }

  const now = new Date();
  const content = buildDocumentContent(fileName, uploaded.contentRef);
  const preview = `📄 ${fileName.length > 80 ? `${fileName.slice(0, 77)}…` : fileName}`;

  return prisma.$transaction(async (tx) => {
    const msg = await tx.chatMessage.create({
      data: {
        chatRoomId: input.chatRoomId,
        senderUserId: input.senderUserId,
        senderRole: input.senderRole,
        content,
        type: "TEXT"
      }
    });

    await tx.storedMedia.create({
      data: {
        objectKey: uploaded.objectKey,
        scope: "CHAT_IMAGE",
        contentType: uploaded.contentType,
        byteSize: uploaded.byteSize,
        sha256Hex: uploaded.sha256Hex,
        visibility: "PRIVATE",
        uploadedById: input.senderUserId,
        chatRoomId: input.chatRoomId,
        chatMessageId: msg.id
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

  const messages: SerializedChatMessage[] = [];
  for (const m of rows) {
    messages.push(
      await serializeMessage(m, viewer, {
        restaurantLastReadAt: room.restaurantLastReadAt,
        customerLastReadAt: room.customerLastReadAt
      })
    );
  }
  return messages;
}
