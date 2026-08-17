import type { EventEmitter } from "node:events";
import type { ChatWsPayload } from "../../lib/chat/chatRealtime.js";
import { publishDomainEvent } from "../eventBus.js";
import { createDomainEvent } from "../notificationProcessor.js";

export async function notifyChatMessage(
  bus: EventEmitter,
  input: {
    chatRoomId: string;
    restaurantId: string;
    customerUserId: string | null;
    actorUserId: string;
    preview: string;
    wsPayload: ChatWsPayload;
    href?: string;
    roomType?: string;
    channelKey?: string | null;
  }
): Promise<void> {
    const messageId =
      input.wsPayload.type === "new_message" ? input.wsPayload.message.id : undefined;
    await publishDomainEvent(
      bus,
      createDomainEvent(
        "chat.message_sent",
        {
          chatRoomId: input.chatRoomId,
          customerUserId: input.customerUserId,
          preview: input.preview,
          wsPayload: input.wsPayload,
          entityType: "CHAT_ROOM",
          entityId: input.chatRoomId,
          roomType: input.roomType,
          channelKey: input.channelKey ?? null,
          href: input.href,
          messageId
        },
        {
          restaurantId: input.restaurantId,
          actorUserId: input.actorUserId,
          entityType: "CHAT_ROOM",
          entityId: input.chatRoomId,
          causationId: messageId ?? null
        }
      )
    );
}
