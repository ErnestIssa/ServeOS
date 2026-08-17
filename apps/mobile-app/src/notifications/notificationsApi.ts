import { apiFetch } from "../api";

export type PlatformNotification = {
  id: string;
  category: string;
  eventKey: string;
  title: string;
  body: string;
  payload: unknown;
  target?: NotificationDestination;
  priority: string;
  channels: unknown;
  readAt: string | null;
  createdAt: string;
  restaurantId: string | null;
};

/** Semantic destination — never require Admin `#ws-comms/...` URLs on mobile. */
export type NotificationDestination = {
  entityType: string;
  entityId: string | null;
  chatRoomId?: string;
  restaurantId?: string | null;
  href?: string;
};

export function destinationFromNotification(row: {
  payload?: unknown;
  target?: NotificationDestination;
  restaurantId?: string | null;
}): NotificationDestination | null {
  if (row.target?.entityType) return row.target;
  if (!row.payload || typeof row.payload !== "object") return null;
  const p = row.payload as Record<string, unknown>;
  const entityType = typeof p.entityType === "string" ? p.entityType : "";
  if (!entityType) return null;
  return {
    entityType,
    entityId: typeof p.entityId === "string" ? p.entityId : null,
    chatRoomId: typeof p.chatRoomId === "string" ? p.chatRoomId : undefined,
    restaurantId:
      (typeof p.restaurantId === "string" ? p.restaurantId : null) ?? row.restaurantId ?? null
  };
}

export type NotificationWsPayload = {
  type: "notification" | "connected";
  notificationId?: string;
  category?: string;
  eventKey?: string;
  title?: string;
  body?: string;
  priority?: string;
  payload?: Record<string, unknown>;
  createdAt?: string;
  userId?: string;
};

export async function fetchNotifications(jwt: string, opts?: { limit?: number; unreadOnly?: boolean }) {
  const q = new URLSearchParams();
  if (opts?.limit) q.set("limit", String(opts.limit));
  if (opts?.unreadOnly) q.set("unreadOnly", "true");
  const suffix = q.toString() ? `?${q.toString()}` : "";
  return apiFetch<
    | { ok: true; notifications: PlatformNotification[] }
    | { ok: false; error?: string }
  >(`/notifications${suffix}`, {
    headers: { Authorization: `Bearer ${jwt}` }
  });
}

export async function fetchNotificationUnreadCount(jwt: string) {
  return apiFetch<{ ok: true; count: number } | { ok: false; error?: string }>(
    "/notifications/unread-count",
    { headers: { Authorization: `Bearer ${jwt}` } }
  );
}

export async function markNotificationRead(jwt: string, id: string) {
  return apiFetch<{ ok: true } | { ok: false; error?: string }>(`/notifications/${id}/read`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${jwt}` }
  });
}

export async function markAllNotificationsRead(jwt: string) {
  return apiFetch<{ ok: true } | { ok: false; error?: string }>("/notifications/read-all", {
    method: "PATCH",
    headers: { Authorization: `Bearer ${jwt}` }
  });
}

export async function registerDevicePushToken(
  jwt: string,
  body: { token: string; platform?: string; deviceName?: string }
) {
  return apiFetch<{ ok: true; deviceTokenId?: string } | { ok: false; error?: string }>(
    "/notifications/device-tokens",
    {
      method: "POST",
      headers: { Authorization: `Bearer ${jwt}`, "Content-Type": "application/json" },
      body: JSON.stringify(body)
    }
  );
}

export async function revokeDevicePushToken(jwt: string, token: string) {
  return apiFetch<{ ok: true } | { ok: false; error?: string }>("/notifications/device-tokens", {
    method: "DELETE",
    headers: { Authorization: `Bearer ${jwt}`, "Content-Type": "application/json" },
    body: JSON.stringify({ token })
  });
}
