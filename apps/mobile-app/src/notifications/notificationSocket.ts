import { apiHttpToWsBase, API_URL } from "../api";
import type { NotificationWsPayload } from "./notificationsApi";

type Handler = (payload: NotificationWsPayload) => void;

const handlers = new Set<Handler>();
let socket: WebSocket | null = null;
let tokenRef = "";

export function subscribeNotificationRelay(handler: Handler): () => void {
  handlers.add(handler);
  return () => handlers.delete(handler);
}

function emit(payload: NotificationWsPayload) {
  for (const h of handlers) h(payload);
}

export function connectNotificationSocket(token: string) {
  if (!token.trim()) return;
  if (socket && tokenRef === token) return;
  tokenRef = token;
  try {
    socket?.close();
  } catch {
    /* ignore */
  }

  const url = `${apiHttpToWsBase(API_URL)}/notifications/ws?${new URLSearchParams({ token }).toString()}`;
  const ws = new WebSocket(url);
  socket = ws;

  ws.onmessage = (ev) => {
    try {
      const data = JSON.parse(String(ev.data)) as NotificationWsPayload;
      if (data?.type) emit(data);
    } catch {
      /* ignore */
    }
  };

  ws.onclose = () => {
    if (socket === ws) socket = null;
  };
}

export function disconnectNotificationSocket() {
  tokenRef = "";
  try {
    socket?.close();
  } catch {
    /* ignore */
  }
  socket = null;
}
