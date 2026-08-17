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

export function roomVenueChat(restaurantId: string) {
  return `chat_venue:${restaurantId}`;
}

export function roomStaffChannel(restaurantId: string, channelKey: string) {
  return `chat_staff:${restaurantId}:${channelKey}`;
}

export function emitChatEvent(
  bus: EventEmitter,
  chatRoomId: string,
  customerUserId: string | null,
  payload: ChatWsPayload,
  restaurantId?: string | null,
  meta?: { roomType?: string | null; channelKey?: string | null }
) {
  bus.emit(roomChat(chatRoomId), payload);
  if (customerUserId) {
    bus.emit(roomCustomerChat(customerUserId), payload);
  }
  if (meta?.roomType === "STAFF" && restaurantId && meta.channelKey) {
    bus.emit(roomStaffChannel(restaurantId, meta.channelKey), payload);
    return;
  }
  if (restaurantId) {
    bus.emit(roomVenueChat(restaurantId), payload);
  }
}
