/**
 * Dev default: same-origin + Vite proxy → API gateway (works with localhost/LAN hostnames).
 * Override with `VITE_API_URL` when the API is on another origin.
 */
const fromEnv = import.meta.env.VITE_API_URL?.trim();
export const API_URL = fromEnv || (import.meta.env.DEV ? "" : "http://127.0.0.1:3000");

async function jsonFetch<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, init);
  } catch {
    return { ok: false, error: "network_unreachable_is_backend_running" } as T;
  }
  const text = await res.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    return { ok: false, error: "bad_response" } as T;
  }
}

export type OrderEventPayload = {
  type: "order_updated";
  orderId: string;
  restaurantId: string;
  status: string;
  totalCents: number;
  restaurantName?: string;
};

/** WebSocket URL for `/orders/events` (gateway → order-service). Uses `ws:` / `wss:` from API base. */
export function orderEventsWebSocketUrl(params: {
  orderId?: string;
  restaurantId?: string;
  mine?: boolean;
  token?: string;
}) {
  const httpBase =
    API_URL || (typeof window !== "undefined" ? window.location.origin : "http://127.0.0.1:3000");
  const u = new URL(httpBase.startsWith("http") ? httpBase : `http://${httpBase}`);
  const wsProto = u.protocol === "https:" ? "wss:" : "ws:";
  const sp = new URLSearchParams();
  if (params.orderId) sp.set("orderId", params.orderId);
  if (params.restaurantId) sp.set("restaurantId", params.restaurantId);
  if (params.mine) sp.set("mine", "1");
  if (params.token) sp.set("token", params.token);
  return `${wsProto}//${u.host}/orders/events?${sp.toString()}`;
}

export type PublicMenu = {
  ok: boolean;
  error?: string;
  restaurant?: { id: string; name: string };
  categories?: Array<{
    id: string;
    name: string;
    items: Array<{
      id: string;
      name: string;
      description: string | null;
      priceCents: number;
      modifierGroups: Array<{
        id: string;
        name: string;
        minSelect: number;
        maxSelect: number;
        options: Array<{ id: string; name: string; priceDeltaCents: number }>;
      }>;
    }>;
  }>;
};

export async function getPublicMenu(restaurantId: string) {
  return jsonFetch<PublicMenu>(`/restaurants/public/menu/${encodeURIComponent(restaurantId)}`);
}

export type PlaceOrderResponse = {
  ok: boolean;
  error?: string;
  order?: {
    id: string;
    totalCents: number;
    status: string;
    lines: Array<{ id: string; name: string; quantity: number; lineTotalCents: number }>;
  };
};

export async function placeOrder(params: {
  restaurantId: string;
  lines: Array<{ menuItemId: string; quantity: number; modifierOptionIds?: string[] }>;
  note?: string;
  token?: string | null;
}) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (params.token) headers.Authorization = `Bearer ${params.token}`;
  return jsonFetch<PlaceOrderResponse>(`/orders/place`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      restaurantId: params.restaurantId,
      lines: params.lines,
      note: params.note
    })
  });
}

export async function getPublicOrderTrack(orderId: string) {
  return jsonFetch<{
    ok: boolean;
    error?: string;
    orderId?: string;
    status?: string;
    totalCents?: number;
    restaurantName?: string;
  }>(`/orders/public/${encodeURIComponent(orderId)}`);
}

export type AuthResponse = {
  ok: boolean;
  token?: string;
  user?: { id: string; email?: string | null; role: string };
  error?: string;
};

export async function signupCustomer(params: { email: string; password: string }) {
  return jsonFetch<AuthResponse>(`/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...params, role: "CUSTOMER" })
  });
}

export async function loginCustomer(params: { email: string; password: string }) {
  return jsonFetch<AuthResponse>(`/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params)
  });
}
