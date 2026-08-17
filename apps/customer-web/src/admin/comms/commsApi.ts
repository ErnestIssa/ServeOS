import { getApiBaseUrl } from "../../api";

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } as const;
}

async function commsFetch<T>(token: string, path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${getApiBaseUrl()}${path}`, {
    ...init,
    headers: { ...authHeaders(token), ...(init?.headers ?? {}) }
  });
  const text = await res.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    return { ok: false, error: "bad_response" } as T;
  }
}

export type CommsView = "order" | "customer" | "staff" | "system";

export type CommsThread = {
  id: string;
  kind: "room" | "event";
  type: string;
  name: string;
  preview: string;
  lastMessageAt: string;
  unread: boolean;
  orderId: string | null;
  reservationId: string | null;
  orderStatus: string | null;
  customerLabel: string | null;
  channelKey: string | null;
  lifecycle?: string;
  tableLabel?: string | null;
  href: string;
  eventKey?: string;
  entityType?: string;
  entityId?: string | null;
};

export type CommsMessage = {
  id: string;
  chatRoomId: string;
  senderUserId: string | null;
  senderRole: string;
  content: string;
  type: string;
  createdAt: string;
  isSystem?: boolean;
  deliveryStatus?: "sent" | "delivered" | "read";
};

export type CommsContext = {
  roomId: string;
  type: string;
  table?: { tableId: string; tableLabel: string | null; sourceSessionId: string | null } | null;
  order: {
    id: string;
    displayNumber: string;
    status: string;
    paymentStatus: string;
    customerName: string;
    tableLabel: string | null;
    totalCents: number;
    note: string | null;
    items: Array<{ id: string; name: string; quantity: number; lineTotalCents: number }>;
  } | null;
  reservation: {
    id: string;
    confirmationCode: string;
    status: string;
    startsAt: string;
  } | null;
};

export function adminHrefFromTarget(payload: Record<string, unknown> | undefined): string | null {
  if (!payload) return null;
  if (typeof payload.href === "string" && payload.href.startsWith("#")) return payload.href;
  const chatRoomId = typeof payload.chatRoomId === "string" ? payload.chatRoomId : null;
  const entityType = typeof payload.entityType === "string" ? payload.entityType : "";
  if (chatRoomId) {
    if (entityType === "STAFF") return `#ws-comms/staff-internal-chat?roomId=${encodeURIComponent(chatRoomId)}`;
    return `#ws-comms/order-chats?roomId=${encodeURIComponent(chatRoomId)}`;
  }
  switch (entityType) {
    case "ORDER":
      return "#ws-orders/all-orders";
    case "RESERVATION":
      return "#ws-venue/reservations";
    case "PAYMENT":
      return "#ws-config/payments?tab=transactions";
    case "DEVICE":
      return "#ws-devices/all-devices";
    case "STAFF":
      return "#top-add-staff";
    case "SYSTEM":
      return "#top-notify-system-updates";
    default:
      return null;
  }
}

export function commsViewFromFilter(filter?: string): CommsView {
  if (filter === "customer") return "customer";
  if (filter === "staff") return "staff";
  if (filter === "system") return "system";
  return "order";
}

export function venueChatWebSocketUrl(token: string, restaurantId: string) {
  const u = new URL(getApiBaseUrl());
  const wsProto = u.protocol === "https:" ? "wss:" : "ws:";
  const sp = new URLSearchParams({ token, restaurantId });
  return `${wsProto}//${u.host}/restaurants/chat/events?${sp}`;
}

export function notificationsWebSocketUrl(token: string) {
  const u = new URL(getApiBaseUrl());
  const wsProto = u.protocol === "https:" ? "wss:" : "ws:";
  return `${wsProto}//${u.host}/notifications/ws?token=${encodeURIComponent(token)}`;
}

export async function fetchCommsThreads(
  token: string,
  restaurantId: string,
  view: CommsView,
  opts?: { q?: string; unread?: boolean; cursor?: string }
) {
  const sp = new URLSearchParams({ view });
  if (opts?.q) sp.set("q", opts.q);
  if (opts?.unread) sp.set("unread", "true");
  if (opts?.cursor) sp.set("cursor", opts.cursor);
  return commsFetch<{
    ok: boolean;
    error?: string;
    view?: CommsView;
    threads?: CommsThread[];
    nextCursor?: string | null;
  }>(token, `/restaurants/${encodeURIComponent(restaurantId)}/comms/threads?${sp}`);
}

export async function fetchCommsThread(token: string, restaurantId: string, chatRoomId: string) {
  return commsFetch<{
    ok: boolean;
    error?: string;
    room?: CommsThread;
    messages?: CommsMessage[];
  }>(
    token,
    `/restaurants/${encodeURIComponent(restaurantId)}/comms/threads/${encodeURIComponent(chatRoomId)}`
  );
}

export async function fetchCommsContext(token: string, restaurantId: string, chatRoomId: string) {
  return commsFetch<{ ok: boolean; error?: string; context?: CommsContext }>(
    token,
    `/restaurants/${encodeURIComponent(restaurantId)}/comms/threads/${encodeURIComponent(chatRoomId)}/context`
  );
}

export async function sendCommsMessage(token: string, restaurantId: string, chatRoomId: string, content: string) {
  const clientMessageId = crypto.randomUUID();
  return commsFetch<{ ok: boolean; error?: string; message?: CommsMessage }>(
    token,
    `/restaurants/${encodeURIComponent(restaurantId)}/comms/threads/${encodeURIComponent(chatRoomId)}/messages`,
    { method: "POST", body: JSON.stringify({ content, clientMessageId }) }
  );
}

export async function fetchCommsCatchUp(token: string, restaurantId: string, since: string) {
  return commsFetch<{ ok: boolean; error?: string; messages?: Array<{ id: string; chatRoomId: string; createdAt: string }> }>(
    token,
    `/restaurants/${encodeURIComponent(restaurantId)}/comms/catch-up?since=${encodeURIComponent(since)}`
  );
}

export async function fetchCommsThreadAfter(token: string, restaurantId: string, chatRoomId: string, after: string) {
  return commsFetch<{
    ok: boolean;
    error?: string;
    room?: CommsThread;
    messages?: CommsMessage[];
  }>(
    token,
    `/restaurants/${encodeURIComponent(restaurantId)}/comms/threads/${encodeURIComponent(chatRoomId)}?after=${encodeURIComponent(after)}`
  );
}

export async function fetchCommsAudit(token: string, restaurantId: string) {
  return commsFetch<{ ok: boolean; error?: string; events?: CommsThread[] }>(
    token,
    `/restaurants/${encodeURIComponent(restaurantId)}/comms/audit`
  );
}

export type AdminNotificationRow = {
  id: string;
  category: string;
  eventKey: string;
  title: string;
  body: string;
  payload: Record<string, unknown>;
  priority: string;
  readAt: string | null;
  createdAt: string;
  restaurantId: string | null;
};

export async function fetchAdminNotifications(token: string, filter: string) {
  const q = filter && filter !== "all" ? `?filter=${encodeURIComponent(filter)}&limit=50` : "?limit=50";
  return commsFetch<{ ok: boolean; error?: string; notifications?: AdminNotificationRow[] }>(
    token,
    `/notifications${q}`
  );
}

export async function fetchNotificationUnreadCount(token: string) {
  return commsFetch<{ ok: boolean; count?: number }>(token, "/notifications/unread-count");
}

export async function markNotificationRead(token: string, id: string) {
  return commsFetch<{ ok: boolean }>(token, `/notifications/${encodeURIComponent(id)}/read`, { method: "PATCH" });
}

export async function markAllNotificationsRead(token: string) {
  return commsFetch<{ ok: boolean }>(token, "/notifications/read-all", { method: "PATCH" });
}
