import { apiHttpToWsBase, API_URL } from "../../api";
import type { CustomerChatHubMessage } from "../customerChatApi";

export type ChatWsPayload =
  | { type: "new_message"; message: CustomerChatHubMessage }
  | { type: "user_typing"; chatRoomId: string; role: string; isTyping: boolean }
  | { type: "messages_read"; chatRoomId: string; readerRole: string; readAt: string }
  | {
      type: "message_delivery";
      chatRoomId: string;
      messageId: string;
      status: "delivered";
      deliveredAt: string;
    };

type RelayHandler = (payload: ChatWsPayload) => void;

const handlers = new Set<RelayHandler>();
let socket: WebSocket | null = null;
let tokenRef = "";

export function subscribeChatRelay(handler: RelayHandler): () => void {
  handlers.add(handler);
  return () => handlers.delete(handler);
}

function emit(payload: ChatWsPayload) {
  for (const h of handlers) h(payload);
}

export function connectCustomerChatSocket(token: string) {
  if (!token.trim()) return;
  if (socket && tokenRef === token) return;
  tokenRef = token;
  try {
    socket?.close();
  } catch {
    /* ignore */
  }

  const url = `${apiHttpToWsBase(API_URL)}/customer/chat/events?${new URLSearchParams({ token }).toString()}`;
  const ws = new WebSocket(url);
  socket = ws;

  ws.onmessage = (ev) => {
    try {
      const data = JSON.parse(String(ev.data)) as ChatWsPayload;
      if (data?.type) emit(data);
    } catch {
      /* ignore */
    }
  };

  ws.onclose = () => {
    if (socket === ws) socket = null;
  };
}

export function disconnectCustomerChatSocket() {
  tokenRef = "";
  try {
    socket?.close();
  } catch {
    /* ignore */
  }
  socket = null;
}

export function joinChatRoom(chatRoomId: string) {
  if (!socket || socket.readyState !== WebSocket.OPEN) return;
  socket.send(JSON.stringify({ event: "join_room", chatRoomId }));
}

export function sendChatTyping(chatRoomId: string, isTyping: boolean) {
  if (!socket || socket.readyState !== WebSocket.OPEN) return;
  socket.send(JSON.stringify({ event: "typing", chatRoomId, isTyping }));
}

export function sendChatRead(chatRoomId: string) {
  if (!socket || socket.readyState !== WebSocket.OPEN) return;
  socket.send(JSON.stringify({ event: "messages_read", chatRoomId }));
}
