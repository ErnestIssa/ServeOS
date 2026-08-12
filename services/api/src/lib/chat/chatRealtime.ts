import type { EventEmitter } from "node:events";
import type { SerializedChatMessage } from "./chatMessageService.js";

export type ChatWsPayload =
  | { type: "new_message"; message: SerializedChatMessage }
  | { type: "user_typing"; chatRoomId: string; role: string; isTyping: boolean }
  | { type: "messages_read"; chatRoomId: string; readerRole: string; readAt: string }
  | {
      type: "message_delivery";
      chatRoomId: string;
      messageId: string;
      status: "delivered";
      deliveredAt: string;
    };

export function roomChat(chatRoomId: string) {
  return `chat:${chatRoomId}`;
}

export function roomCustomerChat(userId: string) {
  return `chat_customer:${userId}`;
}

export function emitChatEvent(bus: EventEmitter, chatRoomId: string, customerUserId: string | null, payload: ChatWsPayload) {
  bus.emit(roomChat(chatRoomId), payload);
  if (customerUserId) {
    bus.emit(roomCustomerChat(customerUserId), payload);
  }
}
