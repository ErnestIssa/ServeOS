import { apiFetch } from "../api";

export type SessionCartLine = {
  id: string;
  menuItemId: string;
  name: string;
  quantity: number;
  unitPriceCents: number;
  lineTotalCents: number;
  modifierOptionIds: string[];
};

export async function fetchSessionCart(sessionId: string) {
  return apiFetch<{
    ok: boolean;
    lines?: SessionCartLine[];
    subtotalCents?: number;
    totalQuantity?: number;
    orderNote?: string;
    error?: string;
  }>(`/ordering-sessions/${encodeURIComponent(sessionId)}/cart`);
}

export async function addSessionCartItem(
  sessionId: string,
  body: { menuItemId: string; quantity?: number; modifierOptionIds?: string[] }
) {
  return apiFetch<{
    ok: boolean;
    lines?: SessionCartLine[];
    subtotalCents?: number;
    totalQuantity?: number;
    error?: string;
  }>(`/ordering-sessions/${encodeURIComponent(sessionId)}/cart/items`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
}

export async function placeOrderFromSessionCart(body: {
  restaurantId: string;
  sourceSessionId: string;
  note?: string;
}) {
  return apiFetch<{
    ok: boolean;
    order?: { id: string; status: string; paymentStatus: string; totalCents: number };
    error?: string;
  }>("/orders/place", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...body, fromSessionCart: true })
  });
}

export async function startOrderCheckout(orderId: string, provider: "stripe" | "swish" | "cash") {
  return apiFetch<{
    ok: boolean;
    checkout?: { instructions?: string; swishDeepLink?: string; clientSecret?: string };
    error?: string;
  }>(`/orders/${encodeURIComponent(orderId)}/checkout`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ provider })
  });
}

export async function completeOrderCheckout(orderId: string, provider: string) {
  return apiFetch<{ ok: boolean; error?: string }>(`/orders/${encodeURIComponent(orderId)}/checkout/complete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ provider })
  });
}
