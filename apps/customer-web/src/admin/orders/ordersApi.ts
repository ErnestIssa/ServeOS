import { getApiBaseUrl, listRestaurantOrders, patchOrderStatus } from "../../api.js";
import { getMenuAdmin, type MenuTree } from "../../api.js";

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } as const;
}

async function ordersFetch<T>(token: string, path: string, init?: RequestInit): Promise<T> {
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

export type ApiAdminOrderRow = {
  id: string;
  displayNumber: string;
  status: string;
  rawStatus?: string;
  source: string;
  paymentStatus: string;
  customerName: string;
  customerUserId: string | null;
  tableLabel: string | null;
  assignedStaffUserId: string | null;
  itemCount: number;
  itemsSummary: string;
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
  waitingMinutes: number;
  kitchenStatus: string;
  slaSignal?: string;
  isProblem?: boolean;
  note: string | null;
  createdAt: string;
  completedAt: string | null;
  lines: Array<{ id: string; name: string; quantity: number; lineTotalCents: number }>;
  version?: number;
};

export type ApiAdminOrderDetail = ApiAdminOrderRow & {
  statusHistory?: Array<{
    id: string;
    fromStatus: string | null;
    toStatus: string;
    actorUserId: string | null;
    actorSource: string;
    reason: string | null;
    at: string;
  }>;
  auditLog?: Array<{
    id: string;
    action: string;
    actorUserId: string | null;
    actorSource: string;
    at: string;
  }>;
};

export type OrderEditOperation =
  | "ADD_ITEM"
  | "REMOVE_ITEM"
  | "UPDATE_QUANTITY"
  | "MODIFY_MODIFIERS"
  | "UPDATE_NOTE"
  | "ADD_ALLERGY_NOTE"
  | "STAFF_CORRECTION"
  | "PRICE_OVERRIDE";

export type SourceInterpretation =
  | "STAFF_ASSISTED"
  | "CONVERTED_TO_RESERVATION"
  | "PARTNER_REASSIGNED_INTERNAL"
  | "SOURCE_CORRECTION_LOGGED"
  | "HYBRID_STAFF_LINE_ADDITION";

export async function fetchAdminOrders(
  token: string,
  restaurantId: string,
  query: {
    page?: number;
    pageSize?: number;
    preset?: string;
    status?: string;
    source?: string;
    paymentStatus?: string;
    search?: string;
    staff?: string;
  }
) {
  const sp = new URLSearchParams();
  if (query.page) sp.set("page", String(query.page));
  if (query.pageSize) sp.set("pageSize", String(query.pageSize));
  if (query.preset) sp.set("preset", query.preset);
  if (query.status && query.status !== "all") sp.set("status", query.status);
  if (query.source && query.source !== "all") sp.set("source", query.source);
  if (query.paymentStatus && query.paymentStatus !== "all") sp.set("paymentStatus", query.paymentStatus);
  if (query.search?.trim()) sp.set("search", query.search.trim());
  if (query.staff?.trim()) sp.set("staff", query.staff.trim());
  const qs = sp.toString();
  return ordersFetch<{
    ok: boolean;
    error?: string;
    orders?: ApiAdminOrderRow[];
    page?: number;
    pageSize?: number;
    total?: number;
    totalPages?: number;
  }>(token, `/orders/restaurant/${encodeURIComponent(restaurantId)}${qs ? `?${qs}` : ""}`);
}

export async function fetchAdminOrderStats(token: string, restaurantId: string) {
  return ordersFetch<{
    ok: boolean;
    error?: string;
    stats?: { open: number; completedToday: number; problems: number; avgWait: number };
  }>(token, `/orders/restaurant/${encodeURIComponent(restaurantId)}/stats`);
}

export async function fetchAdminOrderDetail(token: string, restaurantId: string, orderId: string) {
  return ordersFetch<{ ok: boolean; error?: string; order?: ApiAdminOrderDetail }>(
    token,
    `/orders/restaurant/${encodeURIComponent(restaurantId)}/${encodeURIComponent(orderId)}/admin`
  );
}

export async function fetchOrderOwnership(token: string, orderId: string) {
  return ordersFetch<{
    ok: boolean;
    error?: string;
    ownership?: {
      ownershipType: string;
      customerUserId: string | null;
      createdByContext: string;
      source: string;
    };
  }>(token, `/orders/${encodeURIComponent(orderId)}/ownership`);
}

export async function fetchSourcePolicy(token: string, restaurantId: string) {
  return ordersFetch<{
    ok: boolean;
    error?: string;
    contracts?: Array<{ source: string; label: string }>;
    phase1Sources?: string[];
  }>(token, `/orders/restaurant/${encodeURIComponent(restaurantId)}/source-policy`);
}

export async function applyOrderEdit(
  token: string,
  orderId: string,
  body: {
    expectedVersion: number;
    operation: OrderEditOperation;
    payload: Record<string, unknown>;
    reason?: string;
    requestSource?: "UI" | "STAFF_POS";
    idempotencyKey?: string;
  }
) {
  return ordersFetch<{
    ok: boolean;
    error?: string;
    version?: number;
    pricing?: {
      totalCents: number;
      paymentDeltaCents: number;
      requiresAdditionalCharge: boolean;
      requiresRefundDelta: boolean;
    };
    kdsNotifyRequired?: boolean;
  }>(token, `/orders/${encodeURIComponent(orderId)}/edit`, {
    method: "POST",
    body: JSON.stringify(body)
  });
}

export async function recordSourceInterpretation(
  token: string,
  orderId: string,
  body: { interpretation: SourceInterpretation; note?: string }
) {
  return ordersFetch<{ ok: boolean; error?: string }>(
    token,
    `/orders/${encodeURIComponent(orderId)}/source-interpretation`,
    { method: "POST", body: JSON.stringify(body) }
  );
}

export async function fetchOrderById(token: string, orderId: string) {
  return ordersFetch<{
    ok: boolean;
    error?: string;
    order?: {
      id: string;
      version: number;
      status: string;
      paymentStatus: string;
      source: string;
      sourceMetadata?: unknown;
      totalCents: number;
      note: string | null;
      lines: Array<{
        id: string;
        menuItemId: string;
        nameSnapshot: string;
        quantity: number;
        unitPriceCents: number;
        lineTotalCents: number;
      }>;
    };
  }>(token, `/orders/${encodeURIComponent(orderId)}`);
}

export async function placeStaffOrder(
  token: string,
  body: {
    restaurantId: string;
    note?: string;
    source?: string;
    lines: Array<{ menuItemId: string; quantity: number; modifierOptionIds?: string[] }>;
  }
) {
  return ordersFetch<{
    ok: boolean;
    error?: string;
    order?: { id: string; displaySeq?: number; totalCents?: number };
  }>(token, "/orders/place", {
    method: "POST",
    body: JSON.stringify({
      ...body,
      createdByContext: "STAFF",
      source: body.source ?? "STAFF_CREATED"
    })
  });
}

export { listRestaurantOrders, patchOrderStatus, getMenuAdmin, type MenuTree };

export const applyOrderEditApi = applyOrderEdit;
export const recordSourceInterpretationApi = recordSourceInterpretation;
export async function patchOrderStatusApi(token: string, orderId: string, status: string) {
  return patchOrderStatus(token, orderId, status);
}
