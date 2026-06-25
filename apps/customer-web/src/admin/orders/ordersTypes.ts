export type OrderStatus =
  | "CREATED"
  | "ACCEPTED"
  | "PREPARING"
  | "READY"
  | "COMPLETED"
  | "CANCELLED"
  | "REFUND_REQUESTED"
  | "REFUNDED"
  | "DISPUTED"
  | "PAYMENT_FAILED"
  | "DRAFT"
  | "ARCHIVED";

export type OrderSource =
  | "QR_ORDER"
  | "WALK_IN"
  | "RESERVATION"
  | "STAFF_CREATED"
  | "PHONE_ORDER"
  | "DELIVERY_PARTNER";

export type PaymentStatus = "PAID" | "PENDING" | "FAILED" | "REFUNDED" | "PARTIAL_REFUND";

export type KitchenStatus = "NEW" | "ACCEPTED" | "PREPARING" | "READY";

export type OrderPriority = "normal" | "high" | "rush";

export type OrderViewPreset =
  | "all-orders"
  | "active-orders"
  | "kitchen-view"
  | "problem-orders"
  | "completed-orders"
  | "order-history";

export type TimelineEvent = {
  at: string;
  label: string;
  actor?: string;
};

export type OrderLineItem = {
  id: string;
  name: string;
  qty: number;
  unitPrice: number;
  modifiers?: string[];
  notes?: string;
};

export type AdminOrder = {
  id: string;
  displayNumber: string;
  status: OrderStatus;
  customerName: string;
  customerPhone?: string;
  customerEmail?: string;
  source: OrderSource;
  items: OrderLineItem[];
  itemCount: number;
  itemsSummary: string;
  total: number;
  createdAt: string;
  completedAt?: string;
  assignedStaff?: string;
  tableNumber?: string;
  paymentStatus: PaymentStatus;
  paymentMethod?: string;
  waitingMinutes: number;
  kitchenStatus: KitchenStatus;
  priority: OrderPriority;
  isProblem?: boolean;
  problemReason?: string;
  notes?: string;
  timeline: TimelineEvent[];
  refunds?: Array<{ amount: number; reason: string; at: string }>;
  auditLog?: Array<{ at: string; action: string; actor: string }>;
  version?: number;
  apiStatus?: string;
  apiSource?: string;
  apiPaymentStatus?: string;
};

export const ORDER_SOURCE_LABELS: Record<OrderSource, string> = {
  QR_ORDER: "QR order",
  WALK_IN: "Walk-in",
  RESERVATION: "Reservation",
  STAFF_CREATED: "Staff created",
  PHONE_ORDER: "Phone order",
  DELIVERY_PARTNER: "Delivery partner"
};

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  CREATED: "Created",
  ACCEPTED: "Accepted",
  PREPARING: "Preparing",
  READY: "Ready",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  REFUND_REQUESTED: "Refund requested",
  REFUNDED: "Refunded",
  DISPUTED: "Disputed",
  PAYMENT_FAILED: "Payment failed",
  DRAFT: "Draft",
  ARCHIVED: "Archived"
};

export const ACTIVE_STATUSES: OrderStatus[] = ["CREATED", "ACCEPTED", "PREPARING", "READY"];

export const PROBLEM_STATUSES: OrderStatus[] = [
  "CANCELLED",
  "REFUND_REQUESTED",
  "REFUNDED",
  "DISPUTED",
  "PAYMENT_FAILED"
];

export type OrderFilters = {
  search: string;
  date: "today" | "yesterday" | "7d" | "30d" | "all";
  status: OrderStatus | "all";
  source: OrderSource | "all";
  paymentStatus: PaymentStatus | "all";
  staff: string;
  table: string;
  customer: string;
};

export const DEFAULT_FILTERS: OrderFilters = {
  search: "",
  date: "today",
  status: "all",
  source: "all",
  paymentStatus: "all",
  staff: "",
  table: "",
  customer: ""
};

const today = new Date();
const yesterday = new Date(today);
yesterday.setDate(yesterday.getDate() - 1);

function isToday(iso: string): boolean {
  const d = new Date(iso);
  return d.toDateString() === today.toDateString();
}

function isYesterday(iso: string): boolean {
  const d = new Date(iso);
  return d.toDateString() === yesterday.toDateString();
}

function matchesDate(iso: string, date: OrderFilters["date"]): boolean {
  if (date === "all") return true;
  if (date === "today") return isToday(iso);
  if (date === "yesterday") return isYesterday(iso);
  const d = new Date(iso);
  const days = date === "7d" ? 7 : 30;
  const cutoff = new Date(today);
  cutoff.setDate(cutoff.getDate() - days);
  return d >= cutoff;
}

export function isProblemOrder(order: AdminOrder): boolean {
  if (order.isProblem) return true;
  if (PROBLEM_STATUSES.includes(order.status)) return true;
  if (order.status === "PREPARING" && order.waitingMinutes >= 30) return true;
  if (order.status === "ACCEPTED" && order.waitingMinutes >= 25) return true;
  if (order.paymentStatus === "FAILED") return true;
  return false;
}

export function problemLabel(order: AdminOrder): string {
  if (order.problemReason) return order.problemReason;
  if (order.status === "PAYMENT_FAILED" || order.paymentStatus === "FAILED") return "Payment failed";
  if (order.waitingMinutes >= 30 && ACTIVE_STATUSES.includes(order.status)) return `Delayed ${order.waitingMinutes} min`;
  return ORDER_STATUS_LABELS[order.status];
}

export function filterOrders(orders: AdminOrder[], filters: OrderFilters): AdminOrder[] {
  const q = filters.search.trim().toLowerCase();
  return orders.filter((o) => {
    if (q) {
      const hay = [o.displayNumber, o.id, o.customerName, o.itemsSummary, o.tableNumber ?? ""]
        .join(" ")
        .toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (filters.status !== "all" && o.status !== filters.status) return false;
    if (filters.source !== "all" && o.source !== filters.source) return false;
    if (filters.paymentStatus !== "all" && o.paymentStatus !== filters.paymentStatus) return false;
    if (filters.staff && !(o.assignedStaff ?? "").toLowerCase().includes(filters.staff.toLowerCase())) return false;
    if (filters.table && !(o.tableNumber ?? "").toLowerCase().includes(filters.table.toLowerCase())) return false;
    if (filters.customer && !o.customerName.toLowerCase().includes(filters.customer.toLowerCase())) return false;
    if (!matchesDate(o.createdAt, filters.date)) return false;
    return true;
  });
}

export function ordersForPreset(preset: OrderViewPreset, orders: AdminOrder[], filters: OrderFilters): AdminOrder[] {
  let base = [...orders];
  switch (preset) {
    case "all-orders":
      base = base.filter((o) => matchesDate(o.createdAt, filters.date === "all" ? "today" : filters.date));
      break;
    case "active-orders":
      base = base.filter((o) => ACTIVE_STATUSES.includes(o.status));
      break;
    case "kitchen-view":
      base = base.filter((o) => ["CREATED", "ACCEPTED", "PREPARING", "READY"].includes(o.status));
      break;
    case "problem-orders":
      base = base.filter(isProblemOrder);
      break;
    case "completed-orders":
      base = base.filter((o) => o.status === "COMPLETED" && isToday(o.createdAt));
      break;
    case "order-history":
      break;
    default:
      break;
  }
  return filterOrders(base, filters);
}

export function waitingTone(minutes: number): "normal" | "warning" | "critical" {
  if (minutes >= 30) return "critical";
  if (minutes >= 15) return "warning";
  return "normal";
}

export function formatCurrency(amount: number): string {
  return `${amount.toLocaleString("sv-SE")} kr`;
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" });
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("sv-SE", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

export function orderStats(orders: AdminOrder[]) {
  const active = orders.filter((o) => ACTIVE_STATUSES.includes(o.status));
  const problems = orders.filter(isProblemOrder);
  const completedToday = orders.filter((o) => o.status === "COMPLETED" && isToday(o.createdAt));
  const avgWait =
    active.length > 0 ? Math.round(active.reduce((s, o) => s + o.waitingMinutes, 0) / active.length) : 0;
  return {
    open: active.length,
    avgWait,
    problems: problems.length,
    completedToday: completedToday.length
  };
}
