import type { ApiAdminOrderDetail, ApiAdminOrderRow } from "./ordersApi";
import type { AdminOrder, KitchenStatus, OrderSource, OrderStatus, PaymentStatus } from "./ordersTypes";

const SOURCE_MAP: Record<string, OrderSource> = {
  QR_ORDER: "QR_ORDER",
  WALK_IN: "WALK_IN",
  RESERVATION_ORDER: "RESERVATION",
  RESERVATION: "RESERVATION",
  STAFF_CREATED: "STAFF_CREATED",
  PHONE_ORDER: "PHONE_ORDER",
  DELIVERY_PARTNER: "DELIVERY_PARTNER"
};

function mapStatus(status: string): OrderStatus {
  const s = status.toUpperCase();
  if (s === "PENDING_PAYMENT" || s === "PAID" || s === "PENDING" || s === "CONFIRMED") return "CREATED";
  if (s === "REJECTED" || s === "PARTIALLY_REFUNDED") return "CANCELLED";
  if (
    ["CREATED", "ACCEPTED", "PREPARING", "READY", "COMPLETED", "CANCELLED", "REFUNDED", "ARCHIVED"].includes(s)
  ) {
    return s as OrderStatus;
  }
  return "CREATED";
}

function mapPayment(ps: string): PaymentStatus {
  if (ps === "PARTIAL_REFUND") return "PARTIAL_REFUND";
  if (["PAID", "PENDING", "FAILED", "REFUNDED"].includes(ps)) return ps as PaymentStatus;
  return "PENDING";
}

function mapKitchen(ks: string): KitchenStatus {
  if (ks === "PREPARING" || ks === "READY" || ks === "ACCEPTED") return ks as KitchenStatus;
  return "NEW";
}

export type AdminOrderVm = AdminOrder & { version: number; restaurantId?: string };

export function mapApiOrderRow(row: ApiAdminOrderRow): AdminOrderVm {
  return {
    id: row.id,
    displayNumber: row.displayNumber,
    status: mapStatus(row.status),
    customerName: row.customerName,
    source: SOURCE_MAP[row.source] ?? "QR_ORDER",
    items: row.lines.map((l) => ({
      id: l.id,
      name: l.name,
      qty: l.quantity,
      unitPrice: Math.round(l.lineTotalCents / Math.max(1, l.quantity))
    })),
    itemCount: row.itemCount,
    itemsSummary: row.itemsSummary,
    total: row.totalCents / 100,
    createdAt: row.createdAt,
    completedAt: row.completedAt ?? undefined,
    tableNumber: row.tableLabel ?? undefined,
    paymentStatus: mapPayment(row.paymentStatus),
    waitingMinutes: row.waitingMinutes,
    kitchenStatus: mapKitchen(row.kitchenStatus),
    priority: "normal",
    isProblem: row.isProblem,
    problemReason: row.isProblem ? row.slaSignal ?? "Needs attention" : undefined,
    notes: row.note ?? undefined,
    timeline: [],
    auditLog: [],
    version: row.version ?? 0,
    apiStatus: row.status,
    apiSource: row.source,
    apiPaymentStatus: row.paymentStatus
  };
}

export function enrichOrderDetail(base: AdminOrderVm, detail: ApiAdminOrderDetail): AdminOrderVm {
  return {
    ...base,
    timeline: (detail.statusHistory ?? []).map((h) => ({
      at: h.at,
      label: `${h.fromStatus ?? "—"} → ${h.toStatus}`,
      actor: h.actorUserId ?? h.actorSource
    })),
    auditLog: (detail.auditLog ?? []).map((a) => ({
      at: a.at,
      action: a.action,
      actor: a.actorUserId ?? a.actorSource
    }))
  };
}

export function presetToApiQuery(preset: string): Record<string, string | undefined> {
  switch (preset) {
    case "active-orders":
      return { preset: "active" };
    case "completed-orders":
      return { preset: "completed" };
    case "problem-orders":
      return { preset: "problem" };
    case "kitchen-view":
      return { preset: "active" };
    default:
      return {};
  }
}
