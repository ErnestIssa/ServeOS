const fromEnv = import.meta.env.VITE_API_URL?.trim();
const PROD_DEFAULT = "https://serveos-api.onrender.com";
export const API_URL = fromEnv || (import.meta.env.DEV ? "" : PROD_DEFAULT);

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

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } as const;
}

export type AuthResponse = {
  ok: boolean;
  token?: string;
  user?: { id: string; email?: string | null; phone?: string | null; role: string };
  error?: string;
};

export async function signup(params: { email: string; password: string; role: "OWNER" | "STAFF" | "CUSTOMER" }) {
  return jsonFetch<AuthResponse>(`/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params)
  });
}

export async function login(params: { email: string; password: string }) {
  return jsonFetch<AuthResponse>(`/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params)
  });
}

export async function listRestaurants(token: string) {
  return jsonFetch<{ ok: boolean; restaurants?: Array<{ id: string; name: string; role: string }>; error?: string }>(
    `/restaurants/restaurants`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
}

export async function createRestaurant(token: string, params: { name: string }) {
  return jsonFetch<{ ok: boolean; restaurant?: { id: string; name: string }; error?: string }>(`/restaurants/restaurants`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(params)
  });
}

export type MenuTree = {
  restaurant: { id: string; name: string };
  categories: Array<{
    id: string;
    name: string;
    sortOrder: number;
    isActive: boolean;
    items: Array<{
      id: string;
      name: string;
      description: string | null;
      priceCents: number;
      sortOrder: number;
      isActive: boolean;
      modifierGroups: Array<{
        id: string;
        name: string;
        minSelect: number;
        maxSelect: number;
        sortOrder: number;
        options: Array<{
          id: string;
          name: string;
          priceDeltaCents: number;
          sortOrder: number;
          isActive: boolean;
        }>;
      }>;
    }>;
  }>;
};

export async function getMenuAdmin(token: string, restaurantId: string) {
  return jsonFetch<{ ok: boolean; error?: string } & Partial<MenuTree>>(`/restaurants/${encodeURIComponent(restaurantId)}/menu`, {
    headers: { Authorization: `Bearer ${token}` }
  });
}

export async function createCategory(token: string, restaurantId: string, body: { name: string; sortOrder?: number }) {
  return jsonFetch<{ ok: boolean; error?: string; category?: { id: string } }>(
    `/restaurants/${encodeURIComponent(restaurantId)}/menu/categories`,
    { method: "POST", headers: authHeaders(token), body: JSON.stringify(body) }
  );
}

export async function createMenuItem(
  token: string,
  restaurantId: string,
  body: { categoryId: string; name: string; description?: string; priceCents: number; sortOrder?: number }
) {
  return jsonFetch<{ ok: boolean; error?: string; item?: { id: string } }>(
    `/restaurants/${encodeURIComponent(restaurantId)}/menu/items`,
    { method: "POST", headers: authHeaders(token), body: JSON.stringify(body) }
  );
}

export async function createModifierGroup(
  token: string,
  restaurantId: string,
  itemId: string,
  body: { name: string; minSelect?: number; maxSelect?: number }
) {
  return jsonFetch<{ ok: boolean; error?: string; group?: { id: string } }>(
    `/restaurants/${encodeURIComponent(restaurantId)}/menu/items/${encodeURIComponent(itemId)}/modifier-groups`,
    { method: "POST", headers: authHeaders(token), body: JSON.stringify(body) }
  );
}

export async function createModifierOption(
  token: string,
  restaurantId: string,
  groupId: string,
  body: { name: string; priceDeltaCents?: number }
) {
  return jsonFetch<{ ok: boolean; error?: string; option?: { id: string } }>(
    `/restaurants/${encodeURIComponent(restaurantId)}/menu/modifier-groups/${encodeURIComponent(groupId)}/options`,
    { method: "POST", headers: authHeaders(token), body: JSON.stringify(body) }
  );
}

export type OrderRow = {
  id: string;
  status: string;
  totalCents: number;
  customerUserId: string | null;
  createdAt: string;
  lines: Array<{ name: string; quantity: number; lineTotalCents: number }>;
};

export async function listRestaurantOrders(token: string, restaurantId: string) {
  return jsonFetch<{ ok: boolean; error?: string; orders?: OrderRow[] }>(
    `/orders/restaurant/${encodeURIComponent(restaurantId)}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
}

export async function patchOrderStatus(token: string, orderId: string, status: OrderRow["status"]) {
  return jsonFetch<{ ok: boolean; error?: string }>(`/orders/${encodeURIComponent(orderId)}/status`, {
    method: "PATCH",
    headers: authHeaders(token),
    body: JSON.stringify({ status })
  });
}
