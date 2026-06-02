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
