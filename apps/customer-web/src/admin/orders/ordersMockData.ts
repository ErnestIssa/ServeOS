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

export type MockOrder = {
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

const today = new Date();
const isoToday = (h: number, m: number) => {
  const d = new Date(today);
  d.setHours(h, m, 0, 0);
  return d.toISOString();
};

const yesterday = new Date(today);
yesterday.setDate(yesterday.getDate() - 1);

export const MOCK_ORDERS: MockOrder[] = [
  {
    id: "ord-1042",
    displayNumber: "#1042",
    status: "PREPARING",
    customerName: "Anna Bergström",
    customerPhone: "+46 70 123 45 67",
    customerEmail: "anna.b@example.com",
    source: "QR_ORDER",
    items: [
      { id: "li-1", name: "Margherita pizza", qty: 1, unitPrice: 145, modifiers: ["Extra basil"] },
      { id: "li-2", name: "Sparkling water", qty: 2, unitPrice: 35 }
    ],
    itemCount: 3,
    itemsSummary: "Margherita pizza, 2× Sparkling water",
    total: 215,
    createdAt: isoToday(12, 4),
    assignedStaff: "Erik Lind",
    tableNumber: "T12",
    paymentStatus: "PAID",
    paymentMethod: "Card",
    waitingMinutes: 8,
    kitchenStatus: "PREPARING",
    priority: "normal",
    timeline: [
      { at: isoToday(12, 4), label: "Created", actor: "Customer" },
      { at: isoToday(12, 5), label: "Paid", actor: "Stripe" },
      { at: isoToday(12, 6), label: "Accepted", actor: "Erik Lind" },
      { at: isoToday(12, 8), label: "Preparing", actor: "Kitchen" }
    ],
    auditLog: [
      { at: isoToday(12, 6), action: "Status → Accepted", actor: "Erik Lind" },
      { at: isoToday(12, 8), action: "Status → Preparing", actor: "Kitchen display" }
    ]
  },
  {
    id: "ord-1041",
    displayNumber: "#1041",
    status: "READY",
    customerName: "Walk-in guest",
    source: "WALK_IN",
    items: [{ id: "li-3", name: "Caesar salad", qty: 1, unitPrice: 125 }],
    itemCount: 1,
    itemsSummary: "Caesar salad",
    total: 125,
    createdAt: isoToday(11, 52),
    assignedStaff: "Sara Holm",
    tableNumber: "Bar 3",
    paymentStatus: "PAID",
    paymentMethod: "Cash",
    waitingMinutes: 22,
    kitchenStatus: "READY",
    priority: "normal",
    timeline: [
      { at: isoToday(11, 52), label: "Created", actor: "Sara Holm" },
      { at: isoToday(11, 54), label: "Accepted", actor: "Kitchen" },
      { at: isoToday(12, 8), label: "Ready", actor: "Kitchen" }
    ]
  },
  {
    id: "ord-1040",
    displayNumber: "#1040",
    status: "ACCEPTED",
    customerName: "James Okafor",
    customerPhone: "+46 73 987 65 43",
    source: "RESERVATION",
    items: [
      { id: "li-4", name: "Grilled salmon", qty: 2, unitPrice: 245, modifiers: ["No dill sauce"] },
      { id: "li-5", name: "House white wine", qty: 1, unitPrice: 95 }
    ],
    itemCount: 3,
    itemsSummary: "2× Grilled salmon, House white wine",
    total: 585,
    createdAt: isoToday(11, 38),
    assignedStaff: "Erik Lind",
    tableNumber: "T8",
    paymentStatus: "PAID",
    paymentMethod: "Card",
    waitingMinutes: 38,
    kitchenStatus: "ACCEPTED",
    priority: "high",
    isProblem: true,
    problemReason: "Stuck — accepted 38 min, not started",
    timeline: [
      { at: isoToday(11, 38), label: "Created", actor: "Reservation link" },
      { at: isoToday(11, 40), label: "Paid", actor: "Stripe" },
      { at: isoToday(11, 42), label: "Accepted", actor: "Erik Lind" }
    ]
  },
  {
    id: "ord-1039",
    displayNumber: "#1039",
    status: "CREATED",
    customerName: "Lina Persson",
    source: "PHONE_ORDER",
    items: [{ id: "li-6", name: "Pasta carbonara", qty: 1, unitPrice: 165 }],
    itemCount: 1,
    itemsSummary: "Pasta carbonara",
    total: 165,
    createdAt: isoToday(12, 14),
    paymentStatus: "PENDING",
    paymentMethod: "Pay at pickup",
    waitingMinutes: 2,
    kitchenStatus: "NEW",
    priority: "rush",
    notes: "Pickup in 20 min — no onions",
    timeline: [{ at: isoToday(12, 14), label: "Created", actor: "Sara Holm" }]
  },
  {
    id: "ord-1038",
    displayNumber: "#1038",
    status: "PREPARING",
    customerName: "Delivery — Foodora",
    source: "DELIVERY_PARTNER",
    items: [
      { id: "li-7", name: "Burger combo", qty: 2, unitPrice: 189 },
      { id: "li-8", name: "Sweet potato fries", qty: 1, unitPrice: 55 }
    ],
    itemCount: 3,
    itemsSummary: "2× Burger combo, Sweet potato fries",
    total: 433,
    createdAt: isoToday(11, 28),
    assignedStaff: "Kitchen main",
    paymentStatus: "PAID",
    paymentMethod: "Partner",
    waitingMinutes: 48,
    kitchenStatus: "PREPARING",
    priority: "high",
    isProblem: true,
    problemReason: "Delayed — preparing 48 min",
    timeline: [
      { at: isoToday(11, 28), label: "Created", actor: "Foodora" },
      { at: isoToday(11, 30), label: "Accepted", actor: "Auto-accept" },
      { at: isoToday(11, 32), label: "Preparing", actor: "Kitchen" }
    ]
  },
  {
    id: "ord-1037",
    displayNumber: "#1037",
    status: "COMPLETED",
    customerName: "Marcus Johansson",
    customerEmail: "marcus.j@example.com",
    source: "QR_ORDER",
    items: [{ id: "li-9", name: "Ribeye steak", qty: 1, unitPrice: 395, modifiers: ["Medium rare"] }],
    itemCount: 1,
    itemsSummary: "Ribeye steak",
    total: 395,
    createdAt: isoToday(10, 15),
    completedAt: isoToday(10, 42),
    assignedStaff: "Erik Lind",
    tableNumber: "T4",
    paymentStatus: "PAID",
    paymentMethod: "Card",
    waitingMinutes: 27,
    kitchenStatus: "READY",
    priority: "normal",
    timeline: [
      { at: isoToday(10, 15), label: "Created" },
      { at: isoToday(10, 16), label: "Paid" },
      { at: isoToday(10, 18), label: "Accepted" },
      { at: isoToday(10, 22), label: "Preparing" },
      { at: isoToday(10, 38), label: "Ready" },
      { at: isoToday(10, 42), label: "Completed" }
    ]
  },
  {
    id: "ord-1036",
    displayNumber: "#1036",
    status: "COMPLETED",
    customerName: "Corporate lunch — Acme AB",
    source: "STAFF_CREATED",
    items: [
      { id: "li-10", name: "Lunch buffet", qty: 8, unitPrice: 149 },
      { id: "li-11", name: "Coffee", qty: 8, unitPrice: 25 }
    ],
    itemCount: 16,
    itemsSummary: "8× Lunch buffet, 8× Coffee",
    total: 1392,
    createdAt: isoToday(11, 0),
    completedAt: isoToday(11, 45),
    assignedStaff: "Sara Holm",
    tableNumber: "Private room",
    paymentStatus: "PAID",
    paymentMethod: "Invoice",
    waitingMinutes: 45,
    kitchenStatus: "READY",
    priority: "normal",
    timeline: [
      { at: isoToday(11, 0), label: "Created", actor: "Sara Holm" },
      { at: isoToday(11, 45), label: "Completed", actor: "Sara Holm" }
    ]
  },
  {
    id: "ord-1035",
    displayNumber: "#1035",
    status: "CANCELLED",
    customerName: "Eva Nilsson",
    source: "QR_ORDER",
    items: [{ id: "li-12", name: "Tiramisu", qty: 1, unitPrice: 85 }],
    itemCount: 1,
    itemsSummary: "Tiramisu",
    total: 85,
    createdAt: isoToday(9, 22),
    assignedStaff: "Erik Lind",
    tableNumber: "T2",
    paymentStatus: "REFUNDED",
    paymentMethod: "Card",
    waitingMinutes: 5,
    kitchenStatus: "NEW",
    priority: "normal",
    isProblem: true,
    problemReason: "Cancelled by customer",
    timeline: [
      { at: isoToday(9, 22), label: "Created" },
      { at: isoToday(9, 25), label: "Cancelled", actor: "Customer" }
    ],
    refunds: [{ amount: 85, reason: "Customer cancelled before prep", at: isoToday(9, 26) }]
  },
  {
    id: "ord-1034",
    displayNumber: "#1034",
    status: "REFUND_REQUESTED",
    customerName: "Tommy Wu",
    source: "DELIVERY_PARTNER",
    items: [{ id: "li-13", name: "Pad thai", qty: 1, unitPrice: 155 }],
    itemCount: 1,
    itemsSummary: "Pad thai",
    total: 155,
    createdAt: isoToday(8, 45),
    assignedStaff: "Manager review",
    paymentStatus: "PAID",
    paymentMethod: "Partner",
    waitingMinutes: 0,
    kitchenStatus: "READY",
    priority: "normal",
    isProblem: true,
    problemReason: "Wrong items delivered",
    notes: "Customer reported missing protein topping",
    timeline: [
      { at: isoToday(8, 45), label: "Created" },
      { at: isoToday(9, 10), label: "Completed" },
      { at: isoToday(9, 35), label: "Refund requested", actor: "Customer" }
    ]
  },
  {
    id: "ord-1033",
    displayNumber: "#1033",
    status: "DISPUTED",
    customerName: "Klara Svensson",
    source: "QR_ORDER",
    items: [{ id: "li-14", name: "Wine flight", qty: 1, unitPrice: 295 }],
    itemCount: 1,
    itemsSummary: "Wine flight",
    total: 295,
    createdAt: yesterday.toISOString(),
    completedAt: yesterday.toISOString(),
    assignedStaff: "Owner",
    tableNumber: "T6",
    paymentStatus: "PAID",
    paymentMethod: "Card",
    waitingMinutes: 0,
    kitchenStatus: "READY",
    priority: "normal",
    isProblem: true,
    problemReason: "Chargeback dispute open",
    timeline: [
      { at: yesterday.toISOString(), label: "Completed" },
      { at: yesterday.toISOString(), label: "Dispute opened", actor: "Stripe" }
    ]
  },
  {
    id: "ord-1032",
    displayNumber: "#1032",
    status: "PAYMENT_FAILED",
    customerName: "Guest checkout",
    source: "QR_ORDER",
    items: [{ id: "li-15", name: "Espresso", qty: 2, unitPrice: 35 }],
    itemCount: 2,
    itemsSummary: "2× Espresso",
    total: 70,
    createdAt: isoToday(12, 10),
    paymentStatus: "FAILED",
    paymentMethod: "Card",
    waitingMinutes: 6,
    kitchenStatus: "NEW",
    priority: "normal",
    isProblem: true,
    problemReason: "Card declined at checkout",
    timeline: [
      { at: isoToday(12, 10), label: "Created" },
      { at: isoToday(12, 11), label: "Payment failed", actor: "Stripe" }
    ]
  },
  {
    id: "ord-1031",
    displayNumber: "#1031",
    status: "DRAFT",
    customerName: "Phone — pending payment",
    source: "PHONE_ORDER",
    items: [{ id: "li-16", name: "Family platter", qty: 1, unitPrice: 549 }],
    itemCount: 1,
    itemsSummary: "Family platter",
    total: 549,
    createdAt: isoToday(12, 12),
    assignedStaff: "Sara Holm",
    paymentStatus: "PENDING",
    waitingMinutes: 0,
    kitchenStatus: "NEW",
    priority: "normal",
    notes: "Awaiting customer callback to confirm",
    timeline: [{ at: isoToday(12, 12), label: "Draft saved", actor: "Sara Holm" }]
  },
  {
    id: "ord-1030",
    displayNumber: "#1030",
    status: "ARCHIVED",
    customerName: "Weekend brunch guest",
    source: "WALK_IN",
    items: [{ id: "li-17", name: "Avocado toast", qty: 1, unitPrice: 115 }],
    itemCount: 1,
    itemsSummary: "Avocado toast",
    total: 115,
    createdAt: new Date(yesterday.getTime() - 86400000).toISOString(),
    completedAt: new Date(yesterday.getTime() - 86400000).toISOString(),
    paymentStatus: "PAID",
    paymentMethod: "Card",
    waitingMinutes: 18,
    kitchenStatus: "READY",
    priority: "normal",
    timeline: [{ at: new Date(yesterday.getTime() - 86400000).toISOString(), label: "Completed" }]
  },
  {
    id: "ord-1029",
    displayNumber: "#1029",
    status: "REFUNDED",
    customerName: "Nina Karlsson",
    source: "STAFF_CREATED",
    items: [{ id: "li-18", name: "Soup of the day", qty: 1, unitPrice: 95 }],
    itemCount: 1,
    itemsSummary: "Soup of the day",
    total: 95,
    createdAt: isoToday(7, 30),
    assignedStaff: "Erik Lind",
    paymentStatus: "REFUNDED",
    paymentMethod: "Cash",
    waitingMinutes: 0,
    kitchenStatus: "NEW",
    priority: "normal",
    isProblem: true,
    problemReason: "Full refund issued",
    timeline: [
      { at: isoToday(7, 30), label: "Created" },
      { at: isoToday(7, 45), label: "Refunded", actor: "Erik Lind" }
    ],
    refunds: [{ amount: 95, reason: "Order error — wrong soup", at: isoToday(7, 45) }]
  },
  {
    id: "ord-1028",
    displayNumber: "#1028",
    status: "ACCEPTED",
    customerName: "Bar order",
    source: "WALK_IN",
    items: [{ id: "li-19", name: "Old fashioned", qty: 2, unitPrice: 125 }],
    itemCount: 2,
    itemsSummary: "2× Old fashioned",
    total: 250,
    createdAt: isoToday(12, 13),
    assignedStaff: "Bar team",
    tableNumber: "Bar 1",
    paymentStatus: "PAID",
    paymentMethod: "Card",
    waitingMinutes: 5,
    kitchenStatus: "ACCEPTED",
    priority: "normal",
    timeline: [
      { at: isoToday(12, 13), label: "Created" },
      { at: isoToday(12, 14), label: "Accepted", actor: "Bar" }
    ]
  }
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

export function isProblemOrder(order: MockOrder): boolean {
  if (order.isProblem) return true;
  if (PROBLEM_STATUSES.includes(order.status)) return true;
  if (order.status === "PREPARING" && order.waitingMinutes >= 30) return true;
  if (order.status === "ACCEPTED" && order.waitingMinutes >= 25) return true;
  if (order.paymentStatus === "FAILED") return true;
  return false;
}

export function problemLabel(order: MockOrder): string {
  if (order.problemReason) return order.problemReason;
  if (order.status === "PAYMENT_FAILED" || order.paymentStatus === "FAILED") return "Payment failed";
  if (order.waitingMinutes >= 30 && ACTIVE_STATUSES.includes(order.status)) return `Delayed ${order.waitingMinutes} min`;
  return ORDER_STATUS_LABELS[order.status];
}

export function filterOrders(orders: MockOrder[], filters: OrderFilters): MockOrder[] {
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

export function ordersForPreset(preset: OrderViewPreset, orders: MockOrder[], filters: OrderFilters): MockOrder[] {
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

export function orderStats(orders: MockOrder[]) {
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

export const MOCK_STAFF_OPTIONS = ["All staff", "Erik Lind", "Sara Holm", "Kitchen main", "Bar team"];
