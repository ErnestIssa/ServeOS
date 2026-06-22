import type { KitchenStatus, MockOrder, OrderPriority, OrderSource } from "./ordersMockData";

export type KitchenColumnId = "new" | "preparing" | "ready";

export type KitchenTicket = MockOrder & {
  kitchenColumn: KitchenColumnId;
  /** Once bumped to Ready, ticket cannot be dragged back. */
  readyLocked: boolean;
};

const ITEM_NAMES = [
  "Margherita pizza",
  "Grilled salmon",
  "Caesar salad",
  "Burger combo",
  "Pasta carbonara",
  "Pad thai",
  "Avocado toast",
  "Ribeye steak",
  "Soup of the day",
  "Fish & chips",
  "Chicken wings",
  "Tiramisu",
  "Espresso",
  "House wine",
  "Sweet potato fries"
];

const CUSTOMERS = [
  "Table guest",
  "Walk-in",
  "Anna B.",
  "James O.",
  "Delivery",
  "Phone order",
  "Bar seat",
  "Reservation party"
];

const SOURCES: OrderSource[] = ["QR_ORDER", "WALK_IN", "RESERVATION", "STAFF_CREATED", "PHONE_ORDER", "DELIVERY_PARTNER"];

const TABLES = ["T2", "T4", "T8", "T12", "Bar 1", "Bar 3", "Patio 2", undefined];

function columnKitchenStatus(col: KitchenColumnId): KitchenStatus {
  if (col === "preparing") return "PREPARING";
  if (col === "ready") return "READY";
  return "NEW";
}

function columnOrderStatus(col: KitchenColumnId): MockOrder["status"] {
  if (col === "preparing") return "PREPARING";
  if (col === "ready") return "READY";
  return "CREATED";
}

function makeTicket(num: number, column: KitchenColumnId, index: number): KitchenTicket {
  const item = ITEM_NAMES[(num + index) % ITEM_NAMES.length]!;
  const qty = 1 + ((num + index) % 3);
  const unitPrice = 85 + ((num * 17 + index * 13) % 320);
  const total = unitPrice * qty;
  const waitingMinutes = column === "new" ? 2 + (index % 12) : column === "preparing" ? 8 + (index % 25) : 3 + (index % 8);
  const priority: OrderPriority = index % 11 === 0 ? "rush" : index % 5 === 0 ? "high" : "normal";
  const table = TABLES[(num + index) % TABLES.length];
  const created = new Date();
  created.setMinutes(created.getMinutes() - waitingMinutes);

  return {
    id: `kds-${column}-${num}`,
    displayNumber: `#${num}`,
    status: columnOrderStatus(column),
    customerName: CUSTOMERS[(num + index) % CUSTOMERS.length]!,
    source: SOURCES[(num + index) % SOURCES.length]!,
    items: [{ id: `kli-${num}`, name: item, qty, unitPrice }],
    itemCount: qty,
    itemsSummary: qty > 1 ? `${qty}× ${item}` : item,
    total,
    createdAt: created.toISOString(),
    tableNumber: table,
    paymentStatus: "PAID",
    paymentMethod: "Card",
    waitingMinutes,
    kitchenStatus: columnKitchenStatus(column),
    priority,
    kitchenColumn: column,
    readyLocked: column === "ready",
    timeline: [{ at: created.toISOString(), label: "Kitchen ticket" }]
  };
}

/** 20 tickets per column (60 total) for kitchen display. */
export function createKitchenBoard(perColumn = 20): KitchenTicket[] {
  const tickets: KitchenTicket[] = [];
  let num = 2000;
  for (const column of ["new", "preparing", "ready"] as KitchenColumnId[]) {
    for (let i = 0; i < perColumn; i++) {
      num += 1;
      tickets.push(makeTicket(num, column, i));
    }
  }
  return tickets;
}

export function ticketTraceStyle(id: string): Record<string, string> {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  const abs = Math.abs(hash);
  const duration = (2.4 + (abs % 280) / 100).toFixed(2);
  const delay = (-(abs % 620) / 100).toFixed(2);
  return {
    "--kds-trace-duration": `${duration}s`,
    "--kds-trace-delay": `${delay}s`
  };
}
