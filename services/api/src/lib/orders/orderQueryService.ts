import type { OrderStatus, Prisma, PrismaClient } from "@prisma/client";
import { evaluateOrderSla, type OrderSlaThresholds } from "./orderSlaPolicies.js";
import { loadRestaurantOrderPolicy } from "./orderTenantPolicies.js";
import { formatDisplayNumber, normalizeOrderStatus } from "./orderTypes.js";

export type AdminOrderListQuery = {
  restaurantId: string;
  page?: number;
  pageSize?: number;
  status?: OrderStatus | OrderStatus[] | "active" | "completed" | "problem";
  source?: string;
  paymentStatus?: string;
  search?: string;
  dateFrom?: Date;
  dateTo?: Date;
  assignedStaffUserId?: string;
};

const ACTIVE_STATUSES: OrderStatus[] = [
  "CREATED",
  "PENDING_PAYMENT",
  "PAID",
  "ACCEPTED",
  "PREPARING",
  "READY",
  "PENDING",
  "CONFIRMED"
];

const COMPLETED_STATUSES: OrderStatus[] = ["COMPLETED", "ARCHIVED"];

function resolveStatusFilter(
  status: AdminOrderListQuery["status"]
): Prisma.OrderWhereInput["status"] | undefined {
  if (!status) return undefined;
  if (status === "active") return { in: ACTIVE_STATUSES };
  if (status === "completed") return { in: COMPLETED_STATUSES };
  if (status === "problem") {
    return { in: ["CANCELLED", "REFUNDED", "PARTIALLY_REFUNDED", "REJECTED"] };
  }
  if (Array.isArray(status)) return { in: status };
  return status;
}

function mapOrderRow(
  o: {
    id: string;
    displaySeq: number | null;
    displayPeriodKey: string;
    status: OrderStatus;
    source: string;
    paymentStatus: string;
    subtotalCents: number;
    taxCents: number;
    totalCents: number;
    customerUserId: string | null;
    customerName: string | null;
    tableLabel: string | null;
    assignedStaffUserId: string | null;
    createdAt: Date;
    updatedAt: Date;
    completedAt: Date | null;
    kitchenStartedAt: Date | null;
    note: string | null;
    version: number;
    lines: Array<{ id: string; nameSnapshot: string; quantity: number; lineTotalCents: number }>;
    customer?: { email: string | null } | null;
  },
  now = new Date(),
  sla?: OrderSlaThresholds
) {
  const waitingMinutes = Math.floor((now.getTime() - o.createdAt.getTime()) / 60_000);
  const itemsSummary = o.lines.map((l) => (l.quantity > 1 ? `${l.quantity}× ${l.nameSnapshot}` : l.nameSnapshot)).join(", ");
  const slaSignal = evaluateOrderSla({
    status: o.status,
    createdAt: o.createdAt,
    kitchenStartedAt: o.kitchenStartedAt,
    completedAt: o.completedAt,
    updatedAt: o.updatedAt,
    now,
    sla
  });

  const canon = normalizeOrderStatus(o.status);
  const kitchenStatus =
    canon === "PREPARING" ? "PREPARING" : canon === "READY" ? "READY" : canon === "ACCEPTED" ? "ACCEPTED" : "NEW";

  return {
    id: o.id,
    displayNumber: formatDisplayNumber(o.displaySeq, o.id, o.displayPeriodKey),
    status: canon,
    rawStatus: o.status,
    source: o.source,
    paymentStatus: o.paymentStatus,
    customerName: o.customerName ?? o.customer?.email ?? "Guest",
    customerUserId: o.customerUserId,
    tableLabel: o.tableLabel,
    assignedStaffUserId: o.assignedStaffUserId,
    itemCount: o.lines.reduce((s, l) => s + l.quantity, 0),
    itemsSummary,
    subtotalCents: o.subtotalCents,
    taxCents: o.taxCents,
    totalCents: o.totalCents,
    waitingMinutes,
    kitchenStatus,
    slaSignal,
    isProblem: slaSignal !== "none" || ["CANCELLED", "REFUNDED", "REJECTED"].includes(canon),
    note: o.note,
    version: o.version,
    createdAt: o.createdAt.toISOString(),
    completedAt: o.completedAt?.toISOString() ?? null,
    lines: o.lines.map((l) => ({
      id: l.id,
      name: l.nameSnapshot,
      quantity: l.quantity,
      lineTotalCents: l.lineTotalCents
    }))
  };
}

/**
 * Admin read model — paginated, filterable order list (direct DB projection).
 * Materialized views (ActiveOrdersView, KitchenQueueView) can replace this later at scale.
 */
export async function listAdminOrders(prisma: PrismaClient, query: AdminOrderListQuery) {
  const page = Math.max(1, query.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 25));
  const skip = (page - 1) * pageSize;

  const where: Prisma.OrderWhereInput = {
    restaurantId: query.restaurantId,
    ...(query.source ? { source: query.source as never } : {}),
    ...(query.paymentStatus ? { paymentStatus: query.paymentStatus as never } : {}),
    ...(query.assignedStaffUserId ? { assignedStaffUserId: query.assignedStaffUserId } : {}),
    ...(resolveStatusFilter(query.status) ? { status: resolveStatusFilter(query.status) } : {}),
    ...(query.dateFrom || query.dateTo
      ? {
          createdAt: {
            ...(query.dateFrom ? { gte: query.dateFrom } : {}),
            ...(query.dateTo ? { lte: query.dateTo } : {})
          }
        }
      : {}),
    ...(query.search?.trim()
      ? {
          OR: [
            { customerName: { contains: query.search.trim(), mode: "insensitive" } },
            { tableLabel: { contains: query.search.trim(), mode: "insensitive" } },
            { id: { contains: query.search.trim() } }
          ]
        }
      : {})
  };

  const [total, rows, tenantPolicy] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
      include: {
        lines: true,
        customer: { select: { email: true } }
      }
    }),
    loadRestaurantOrderPolicy(prisma, query.restaurantId)
  ]);

  return {
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    orders: rows.map((o) => mapOrderRow(o, new Date(), tenantPolicy.sla))
  };
}

export async function getAdminOrderDetail(prisma: PrismaClient, restaurantId: string, orderId: string) {
  const order = await prisma.order.findFirst({
    where: { id: orderId, restaurantId },
    include: {
      lines: true,
      customer: { select: { email: true, id: true } },
      statusHistory: { orderBy: { createdAt: "asc" }, take: 100 },
      auditLogs: { orderBy: { createdAt: "desc" }, take: 50 }
    }
  });
  if (!order) throw Object.assign(new Error("order_not_found"), { statusCode: 404 });

  const tenantPolicy = await loadRestaurantOrderPolicy(prisma, restaurantId);

  return {
    ...mapOrderRow(order, new Date(), tenantPolicy.sla),
    statusHistory: order.statusHistory.map((h) => ({
      id: h.id,
      fromStatus: h.fromStatus,
      toStatus: h.toStatus,
      actorUserId: h.actorUserId,
      actorSource: h.actorSource,
      reason: h.reason,
      at: h.createdAt.toISOString()
    })),
    auditLog: order.auditLogs.map((a) => ({
      id: a.id,
      action: a.action,
      actorUserId: a.actorUserId,
      actorSource: a.actorSource,
      at: a.createdAt.toISOString()
    }))
  };
}

export async function getAdminOrderStats(prisma: PrismaClient, restaurantId: string) {
  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);

  const [open, completedToday, problem] = await Promise.all([
    prisma.order.count({
      where: { restaurantId, status: { in: ACTIVE_STATUSES } }
    }),
    prisma.order.count({
      where: { restaurantId, status: "COMPLETED", completedAt: { gte: startOfDay } }
    }),
    prisma.order.count({
      where: {
        restaurantId,
        status: { in: ["CANCELLED", "REFUNDED", "REJECTED", "PARTIALLY_REFUNDED"] },
        updatedAt: { gte: startOfDay }
      }
    })
  ]);

  const activeRows = await prisma.order.findMany({
    where: { restaurantId, status: { in: ACTIVE_STATUSES } },
    select: { createdAt: true }
  });
  const avgWait =
    activeRows.length === 0
      ? 0
      : Math.round(
          activeRows.reduce((s, o) => s + (now.getTime() - o.createdAt.getTime()) / 60_000, 0) / activeRows.length
        );

  return { open, completedToday, problems: problem, avgWait };
}
