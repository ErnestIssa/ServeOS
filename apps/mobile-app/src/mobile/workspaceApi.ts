import { apiFetch } from "../api";

export type WorkspaceMembership = {
  restaurantId: string;
  role: string;
  restaurantName: string;
};

export type WorkspaceContext = {
  roleType: string;
  activeRestaurantId: string | null;
  memberships: WorkspaceMembership[];
  summary: {
    activeOrders: number;
    todayRevenueCents: number;
    venueCount: number;
  };
};

export type WorkspaceScreenResponse = {
  ok: true;
  screenKey: string;
  status: "live" | "coming_soon";
  title: string;
  subtitle: string;
  payload: unknown;
};

export async function fetchWorkspaceContext(jwt: string) {
  return apiFetch<{ ok: true; context: WorkspaceContext } | { ok: false; error?: string }>(
    "/workspace/context",
    { headers: { Authorization: `Bearer ${jwt}` } }
  );
}

export async function patchWorkspaceActiveRestaurant(jwt: string, restaurantId: string) {
  return apiFetch<
    | { ok: true; activeRestaurantId: string; context: WorkspaceContext }
    | { ok: false; error?: string }
  >("/workspace/active-restaurant", {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt}` },
    body: JSON.stringify({ restaurantId })
  });
}

export async function fetchWorkspaceScreen(jwt: string, screenKey: string, restaurantId?: string) {
  const q = restaurantId?.trim() ? `?restaurantId=${encodeURIComponent(restaurantId.trim())}` : "";
  return apiFetch<WorkspaceScreenResponse | { ok: false; error?: string }>(
    `/workspace/screens/${encodeURIComponent(screenKey)}${q}`,
    { headers: { Authorization: `Bearer ${jwt}` } }
  );
}

export async function patchOrderStatus(jwt: string, orderId: string, status: string) {
  return apiFetch<{ ok: true } | { ok: false; error?: string }>(`/orders/${orderId}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt}` },
    body: JSON.stringify({ status })
  });
}

export type OclTimelineEvent = {
  id: string;
  kind: "system";
  at: string;
  title: string;
  detail?: string;
  status?: string;
};

export type OclAction = {
  id: string;
  label: string;
  nextStatus: string;
  variant: "primary" | "secondary";
};

export type OperationalEntityType = "order" | "reservation";

export type OrderOclThread = {
  entityType: OperationalEntityType;
  orderId: string | null;
  reservationId?: string;
  chatRoomId: string | null;
  restaurantId: string;
  header: {
    orderId: string;
    shortId: string;
    status: string;
    statusLabel: string;
    serviceLabel: string;
    tableLabel: string | null;
    totalCents: number;
    elapsedMinutes: number;
    prepMinutes: number;
    customerLabel: string;
    restaurantName: string;
    note: string | null;
  };
  lines: Array<{ id: string; name: string; quantity: number; lineTotalCents: number }>;
  timeline: OclTimelineEvent[];
  messages: Array<{
    id: string;
    content: string;
    senderRole: string;
    createdAt: string;
    isMine?: boolean;
  }>;
  actions: OclAction[];
  canSendMessage: boolean;
  canUpdateStatus: boolean;
};

export async function fetchOrderOcl(jwt: string, orderId: string) {
  return apiFetch<{ ok: true; thread: OrderOclThread } | { ok: false; error?: string }>(
    `/workspace/orders/${encodeURIComponent(orderId)}/ocl`,
    { headers: { Authorization: `Bearer ${jwt}` } }
  );
}

export async function postOrderOclStatus(
  jwt: string,
  orderId: string,
  status: string,
  opts?: { announceInChat?: boolean; note?: string }
) {
  return apiFetch<{ ok: true; thread: OrderOclThread } | { ok: false; error?: string }>(
    `/workspace/orders/${encodeURIComponent(orderId)}/ocl/status`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt}` },
      body: JSON.stringify({ status, ...opts })
    }
  );
}

export async function postOrderOclMessage(jwt: string, orderId: string, content: string) {
  return apiFetch<{ ok: true; thread: OrderOclThread } | { ok: false; error?: string }>(
    `/workspace/orders/${encodeURIComponent(orderId)}/ocl/message`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt}` },
      body: JSON.stringify({ content })
    }
  );
}

export async function fetchReservationOcl(jwt: string, reservationId: string) {
  return apiFetch<{ ok: true; thread: OrderOclThread } | { ok: false; error?: string }>(
    `/workspace/reservations/${encodeURIComponent(reservationId)}/ocl`,
    { headers: { Authorization: `Bearer ${jwt}` } }
  );
}

export async function postReservationOclStatus(jwt: string, reservationId: string, status: string, note?: string) {
  return apiFetch<{ ok: true; thread: OrderOclThread } | { ok: false; error?: string }>(
    `/workspace/reservations/${encodeURIComponent(reservationId)}/ocl/status`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt}` },
      body: JSON.stringify({ status, note })
    }
  );
}

export async function postReservationOclMessage(jwt: string, reservationId: string, content: string) {
  return apiFetch<{ ok: true; thread: OrderOclThread } | { ok: false; error?: string }>(
    `/workspace/reservations/${encodeURIComponent(reservationId)}/ocl/message`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt}` },
      body: JSON.stringify({ content })
    }
  );
}

export type WorkspaceTabResponse = {
  ok: true;
  tabKey: string;
  title: string;
  view: string;
  payload: unknown;
};

export async function fetchWorkspaceTab(
  jwt: string,
  tabKey: string,
  opts?: { restaurantId?: string; filter?: string; queueMode?: string }
) {
  const params = new URLSearchParams();
  if (opts?.restaurantId?.trim()) params.set("restaurantId", opts.restaurantId.trim());
  if (opts?.filter?.trim()) params.set("filter", opts.filter.trim());
  if (opts?.queueMode?.trim()) params.set("queueMode", opts.queueMode.trim());
  const q = params.toString();
  return apiFetch<WorkspaceTabResponse | { ok: false; error?: string }>(
    `/workspace/tabs/${encodeURIComponent(tabKey)}${q ? `?${q}` : ""}`,
    { headers: { Authorization: `Bearer ${jwt}` } }
  );
}

export async function dismissStaffTask(jwt: string, restaurantId: string, taskId: string) {
  return apiFetch<{ ok: true } | { ok: false; error?: string }>("/workspace/tasks/dismiss", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt}` },
    body: JSON.stringify({ restaurantId, taskId })
  });
}

export async function shiftClockIn(jwt: string, restaurantId: string) {
  return apiFetch<{ ok: true; shift: unknown } | { ok: false; error?: string }>("/workspace/shift/clock-in", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt}` },
    body: JSON.stringify({ restaurantId })
  });
}

export async function shiftClockOut(jwt: string, restaurantId: string) {
  return apiFetch<{ ok: true; shift: unknown } | { ok: false; error?: string }>("/workspace/shift/clock-out", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt}` },
    body: JSON.stringify({ restaurantId })
  });
}

export async function shiftBreakToggle(jwt: string, restaurantId: string) {
  return apiFetch<{ ok: true; shift: unknown } | { ok: false; error?: string }>("/workspace/shift/break-toggle", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt}` },
    body: JSON.stringify({ restaurantId })
  });
}

export async function fetchVenueChatMessages(jwt: string, restaurantId: string, chatRoomId: string) {
  return apiFetch<{ ok: true; messages: unknown[] } | { ok: false; error?: string }>(
    `/restaurants/${encodeURIComponent(restaurantId)}/chat/rooms/${encodeURIComponent(chatRoomId)}/messages`,
    { headers: { Authorization: `Bearer ${jwt}` } }
  );
}

export async function sendVenueChatMessage(
  jwt: string,
  restaurantId: string,
  chatRoomId: string,
  content: string
) {
  return apiFetch<{ ok: true } | { ok: false; error?: string }>(
    `/restaurants/${encodeURIComponent(restaurantId)}/chat/rooms/${encodeURIComponent(chatRoomId)}/messages`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt}` },
      body: JSON.stringify({ content })
    }
  );
}

export async function patchMenuItemActive(
  jwt: string,
  restaurantId: string,
  itemId: string,
  isActive: boolean
) {
  return apiFetch<{ ok: true } | { ok: false; error?: string }>(
    `/restaurants/${encodeURIComponent(restaurantId)}/menu/items/${encodeURIComponent(itemId)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt}` },
      body: JSON.stringify({ isActive })
    }
  );
}
