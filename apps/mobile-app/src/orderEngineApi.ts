import { apiFetch } from "./api";

export type OrderEditOperation =
  | "ADD_ITEM"
  | "REMOVE_ITEM"
  | "UPDATE_QUANTITY"
  | "MODIFY_MODIFIERS"
  | "UPDATE_NOTE"
  | "ADD_ALLERGY_NOTE"
  | "STAFF_CORRECTION";

function auth(jwt: string) {
  return { Authorization: `Bearer ${jwt}`, "Content-Type": "application/json" };
}

export async function applyOrderEdit(
  jwt: string,
  orderId: string,
  body: {
    expectedVersion: number;
    operation: OrderEditOperation;
    payload: Record<string, unknown>;
    reason?: string;
  }
) {
  return apiFetch<{
    ok: boolean;
    error?: string;
    version?: number;
    pricing?: {
      totalCents: number;
      requiresAdditionalCharge: boolean;
      requiresRefundDelta: boolean;
    };
  }>(`/orders/${encodeURIComponent(orderId)}/edit`, {
    method: "POST",
    headers: auth(jwt),
    body: JSON.stringify({ ...body, requestSource: "UI" })
  });
}

export async function recordSourceInterpretation(
  jwt: string,
  orderId: string,
  interpretation: string,
  note?: string
) {
  return apiFetch<{ ok: boolean; error?: string }>(`/orders/${encodeURIComponent(orderId)}/source-interpretation`, {
    method: "POST",
    headers: auth(jwt),
    body: JSON.stringify({ interpretation, note })
  });
}

export async function fetchOrderDetail(jwt: string, orderId: string) {
  return apiFetch<{
    ok: boolean;
    error?: string;
    order?: {
      id: string;
      status: string;
      source: string;
      paymentStatus: string;
      version: number;
      totalCents: number;
      note: string | null;
      lines: Array<{ id: string; menuItemId: string; nameSnapshot: string; quantity: number; lineTotalCents: number }>;
    };
  }>(`/orders/${encodeURIComponent(orderId)}`, { headers: { Authorization: `Bearer ${jwt}` } });
}

export function customerCanEditOrder(order: {
  status: string;
  paymentStatus?: string;
}): boolean {
  const s = order.status.toUpperCase();
  const ps = (order.paymentStatus ?? "UNPAID").toUpperCase();
  const unpaid = ps === "UNPAID" || ps === "PENDING" || ps === "FAILED";
  return (
    unpaid &&
    (s === "CREATED" ||
      s === "PENDING_PAYMENT" ||
      s === "PENDING" ||
      s === "CONFIRMED" ||
      s === "ACCEPTED")
  );
}
