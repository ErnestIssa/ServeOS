import { readApiMessage } from "./bootstrap/clientConfig";
import { captureClientApiError } from "./sentry";

/** Deployment wiring only — all service setup (Sentry, URLs, capabilities) comes from `GET /config/client`. */
const API_BASE =
  (import.meta.env.VITE_API_URL as string | undefined)?.trim() || "https://serveos-api.onrender.com";

export function getApiBaseUrl(): string {
  return API_BASE.replace(/\/$/, "");
}

export type AuthUser = {
  id: string;
  email?: string | null;
  phone?: string | null;
  role: string;
  displayName?: string;
  fullName?: string;
  signupProfile?: unknown | null;
  preferredRestaurantId?: string | null;
};

export type WorkspaceAuthSummary = {
  state: "none" | "active" | "pending_approval" | "suspended";
  requiresWorkspaceSelection: boolean;
  activeWorkspaceCount: number;
  pendingWorkspaceCount: number;
};

export type AuthResponse = {
  ok: boolean;
  token?: string;
  user?: AuthUser;
  workspaceAuth?: WorkspaceAuthSummary;
  error?: string;
  message?: string;
};

export type CompanyLookupResponse =
  | {
      success: true;
      found: true;
      data: {
        companyName?: string;
        address?: string;
        postalCode?: string;
        city?: string;
        legalForm?: string;
        status?: string;
      };
    }
  | { success: true; found: false }
  | { success: false; message: string };

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  try {
    const res = await fetch(`${getApiBaseUrl()}${path}`, init);
    const text = await res.text();
    if (!res.ok && res.status >= 500) {
      captureClientApiError(path, res.status, text.slice(0, 200) || undefined);
    }
    try {
      const data = JSON.parse(text) as T & { ok?: boolean; error?: string; message?: string };
      if (data && typeof data === "object" && "ok" in data) {
        if (!res.ok && data.ok !== false) {
          return { ...data, ok: false, error: data.error ?? `http_error_${res.status}` } as T;
        }
        return data as T;
      }
      return { ok: res.ok, ...(data as object) } as T;
    } catch {
      return { ok: false, error: text ? "bad_response" : "empty_response" } as T;
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "request_failed";
    if (/network|failed to fetch|timed out|timeout/i.test(msg)) {
      return { ok: false, error: "Couldn't reach the server. Check your connection and try again." } as T;
    }
    return { ok: false, error: msg } as T;
  }
}

export async function authSignup(params: {
  email: string;
  password: string;
  role: "OWNER" | "CUSTOMER";
  phone?: string;
  registrationProfile?: Record<string, unknown>;
}): Promise<AuthResponse> {
  return apiFetch<AuthResponse>("/auth/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: params.email,
      password: params.password,
      role: params.role,
      ...(params.phone ? { phone: params.phone } : {}),
      ...(params.registrationProfile ? { registrationProfile: params.registrationProfile } : {})
    })
  });
}

export async function lookupCompany(orgNumber: string): Promise<CompanyLookupResponse> {
  return apiFetch<CompanyLookupResponse>("/api/business/lookup-company", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ orgNumber })
  });
}

export function mapApiErrorToMessage(res?: { message?: string; error?: string } | string | null): string {
  if (!res) return "Request failed";
  if (typeof res === "string") return res;
  return readApiMessage(res);
}

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } as const;
}

export function orderEventsWebSocketUrl(params: {
  orderId?: string;
  restaurantId?: string;
  mine?: boolean;
  token?: string;
}) {
  const httpBase = getApiBaseUrl() || (typeof window !== "undefined" ? window.location.origin : "");
  const u = new URL(httpBase.startsWith("http") ? httpBase : `http://${httpBase}`);
  const wsProto = u.protocol === "https:" ? "wss:" : "ws:";
  const sp = new URLSearchParams();
  if (params.orderId) sp.set("orderId", params.orderId);
  if (params.restaurantId) sp.set("restaurantId", params.restaurantId);
  if (params.mine) sp.set("mine", "1");
  if (params.token) sp.set("token", params.token);
  return `${wsProto}//${u.host}/orders/events?${sp.toString()}`;
}

export async function login(params: { email: string; password: string }): Promise<AuthResponse> {
  return apiFetch<AuthResponse>("/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params)
  });
}

export type ProvisionBusinessResponse = AuthResponse & {
  restaurantId?: string;
  companyId?: string;
  membershipId?: string;
};

/** Attach a new OWNER workspace to the signed-in identity (no duplicate user). */
export async function provisionBusinessWorkspace(
  token: string,
  registrationProfile: Record<string, unknown>
): Promise<ProvisionBusinessResponse> {
  return apiFetch<ProvisionBusinessResponse>("/workspaces/provision-business", {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ registrationProfile })
  });
}

export async function requestPasswordReset(
  email: string,
  returnTo?: string | null
): Promise<{ ok: boolean; error?: string }> {
  return apiFetch<{ ok: boolean; error?: string }>("/auth/password-reset/request", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: email.trim(),
      ...(returnTo ? { returnTo } : {})
    })
  });
}

export async function confirmPasswordReset(params: {
  token: string;
  newPassword: string;
  confirmPassword: string;
}): Promise<{ ok: boolean; error?: string }> {
  return apiFetch<{ ok: boolean; error?: string }>("/auth/password-reset/confirm", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params)
  });
}

export function mapPasswordResetError(res?: { message?: string; error?: string }): string {
  return mapApiErrorToMessage(res);
}

export async function fetchMe(token: string): Promise<AuthResponse> {
  return apiFetch<AuthResponse>("/auth/me", {
    headers: { Authorization: `Bearer ${token}` }
  });
}

export async function logout(token: string): Promise<{ ok: boolean; error?: string }> {
  return apiFetch<{ ok: boolean; error?: string }>("/auth/logout", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` }
  });
}

export async function signup(params: { email: string; password: string; role: "OWNER" | "STAFF" | "CUSTOMER" }) {
  return apiFetch<AuthResponse>("/auth/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params)
  });
}

export async function listRestaurants(token: string) {
  return apiFetch<{
    ok: boolean;
    restaurants?: Array<{
      id: string;
      name: string;
      role: string;
      status?: string;
      companyId?: string | null;
    }>;
    error?: string;
  }>("/restaurants/restaurants", { headers: { Authorization: `Bearer ${token}` } });
}

export async function createRestaurant(token: string, params: { name: string; companyId?: string }) {
  return apiFetch<{ ok: boolean; restaurant?: { id: string; name: string }; error?: string }>("/restaurants/restaurants", {
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
  return apiFetch<{ ok: boolean; error?: string } & Partial<MenuTree>>(
    `/restaurants/${encodeURIComponent(restaurantId)}/menu`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
}

export async function createCategory(token: string, restaurantId: string, body: { name: string; sortOrder?: number }) {
  return apiFetch<{ ok: boolean; error?: string; category?: { id: string } }>(
    `/restaurants/${encodeURIComponent(restaurantId)}/menu/categories`,
    { method: "POST", headers: authHeaders(token), body: JSON.stringify(body) }
  );
}

export async function createMenuItem(
  token: string,
  restaurantId: string,
  body: { categoryId: string; name: string; description?: string; priceCents: number; sortOrder?: number }
) {
  return apiFetch<{ ok: boolean; error?: string; item?: { id: string } }>(
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
  return apiFetch<{ ok: boolean; error?: string; group?: { id: string } }>(
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
  return apiFetch<{ ok: boolean; error?: string; option?: { id: string } }>(
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
  return apiFetch<{ ok: boolean; error?: string; orders?: OrderRow[] }>(
    `/orders/restaurant/${encodeURIComponent(restaurantId)}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
}

export async function patchOrderStatus(token: string, orderId: string, status: OrderRow["status"]) {
  return apiFetch<{ ok: boolean; error?: string }>(`/orders/${encodeURIComponent(orderId)}/status`, {
    method: "PATCH",
    headers: authHeaders(token),
    body: JSON.stringify({ status })
  });
}

export async function setActiveRestaurant(token: string, restaurantId: string) {
  return apiFetch<{ ok: boolean; activeRestaurantId?: string | null; error?: string }>(
    "/workspace/active-restaurant",
    {
      method: "PATCH",
      headers: authHeaders(token),
      body: JSON.stringify({ restaurantId })
    }
  );
}
