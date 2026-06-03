import type { EventEmitter } from "node:events";
import type { ChatWsPayload } from "../../lib/chatRealtime.js";
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
  }
): Promise<void> {
  await publishDomainEvent(
    bus,
    createDomainEvent(
      "chat.message_sent",
      {
        chatRoomId: input.chatRoomId,
        customerUserId: input.customerUserId,
        preview: input.preview,
        wsPayload: input.wsPayload
      },
      { restaurantId: input.restaurantId, actorUserId: input.actorUserId }
    )
  );
}
