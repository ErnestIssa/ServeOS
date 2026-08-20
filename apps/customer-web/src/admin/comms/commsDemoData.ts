import type { CommsContext, CommsMessage, CommsThread, CommsView } from "./commsApi";

const DEMO_PREFIX = "demo:";

export function isDemoCommsId(id: string) {
  return id.startsWith(DEMO_PREFIX);
}

function minutesAgo(mins: number) {
  return new Date(Date.now() - mins * 60_000).toISOString();
}

function thread(partial: Omit<CommsThread, "href"> & { href?: string }): CommsThread {
  return {
    ...partial,
    href: partial.href ?? `#ws-comms/order-chats?roomId=${encodeURIComponent(partial.id)}`
  };
}

type OrderThreadDef = {
  slug: string;
  kind: "ORDER" | "RESERVATION" | "TABLE";
  label: string;
  preview: string;
  mins: number;
  unread: boolean;
  status: string;
  customer: string;
  table?: string | null;
  paymentStatus?: string;
  note?: string | null;
  items?: Array<{ name: string; qty: number; cents: number }>;
};

const ORDER_THREAD_DEFS: OrderThreadDef[] = [
  {
    slug: "order-1042",
    kind: "ORDER",
    label: "Order #1042",
    preview: "Can you skip the onions on the burger?",
    mins: 2,
    unread: true,
    status: "PREPARING",
    customer: "Anna Berg",
    table: "Table 12",
    note: "No onions. Extra spicy.",
    items: [
      { name: "Smash burger", qty: 1, cents: 16500 },
      { name: "Fries", qty: 1, cents: 4500 },
      { name: "Sparkling water", qty: 1, cents: 3800 }
    ]
  },
  {
    slug: "order-1048",
    kind: "ORDER",
    label: "Order #1048",
    preview: "Table 4 asked for extra ketchup.",
    mins: 8,
    unread: true,
    status: "ACCEPTED",
    customer: "Oscar Lind",
    table: "Table 4",
    items: [
      { name: "Caesar salad", qty: 1, cents: 12900 },
      { name: "Cola", qty: 1, cents: 6000 }
    ]
  },
  {
    slug: "res-8821",
    kind: "RESERVATION",
    label: "Reservation RSV-8821",
    preview: "We are running 10 minutes late — still hold the table?",
    mins: 14,
    unread: false,
    status: "CONFIRMED",
    customer: "Fatima Ali"
  },
  {
    slug: "order-1038",
    kind: "ORDER",
    label: "Order #1038",
    preview: "Food is on the way to table 12.",
    mins: 28,
    unread: false,
    status: "READY",
    customer: "Hugo Ek",
    table: "Table 12",
    items: [
      { name: "Pasta carbonara", qty: 2, cents: 27800 },
      { name: "Espresso", qty: 1, cents: 3400 }
    ]
  },
  {
    slug: "order-1031",
    kind: "ORDER",
    label: "Order #1031",
    preview: "Thanks — order completed.",
    mins: 95,
    unread: false,
    status: "COMPLETED",
    customer: "Nora Holm",
    table: "Takeaway",
    items: [{ name: "Chicken wrap", qty: 2, cents: 15600 }]
  },
  {
    slug: "order-1055",
    kind: "ORDER",
    label: "Order #1055",
    preview: "Payment failed — can I try Swish again?",
    mins: 5,
    unread: true,
    status: "PAYMENT_FAILED",
    customer: "Erik Johansson",
    table: "Table 8",
    paymentStatus: "FAILED",
    items: [{ name: "Fish & chips", qty: 1, cents: 18900 }]
  },
  {
    slug: "table-7",
    kind: "TABLE",
    label: "Table 7 · QR chat",
    preview: "Do you have any vegan mains tonight?",
    mins: 11,
    unread: true,
    status: "OPEN",
    customer: "Guest at Table 7",
    table: "Table 7"
  },
  {
    slug: "order-1051",
    kind: "ORDER",
    label: "Order #1051",
    preview: "Kitchen delay — is it still coming?",
    mins: 18,
    unread: true,
    status: "DELAYED",
    customer: "Sara Nilsson",
    table: "Table 2",
    items: [{ name: "Ribeye steak", qty: 1, cents: 32900 }]
  },
  {
    slug: "order-1044",
    kind: "ORDER",
    label: "Order #1044",
    preview: "I'd like a refund for the soup — it was cold.",
    mins: 22,
    unread: false,
    status: "REFUND_REQUESTED",
    customer: "Jonas Wik",
    table: "Table 15",
    items: [{ name: "Tomato soup", qty: 1, cents: 8900 }]
  },
  {
    slug: "order-1058",
    kind: "ORDER",
    label: "Order #1058",
    preview: "I was charged twice on my card.",
    mins: 31,
    unread: true,
    status: "DISPUTED",
    customer: "Maria Santos",
    table: "Bar 3",
    paymentStatus: "DISPUTED",
    items: [{ name: "Negroni", qty: 2, cents: 24000 }]
  },
  {
    slug: "res-9012",
    kind: "RESERVATION",
    label: "Reservation RSV-9012",
    preview: "Can we move from 18:00 to 19:00?",
    mins: 35,
    unread: true,
    status: "PENDING",
    customer: "Lina Forsberg"
  },
  {
    slug: "order-1062",
    kind: "ORDER",
    label: "Order #1062",
    preview: "Waiting at the bar — order accepted?",
    mins: 42,
    unread: false,
    status: "PENDING",
    customer: "Peter Alm",
    table: "Bar 1",
    paymentStatus: "PENDING",
    items: [{ name: "Margherita pizza", qty: 1, cents: 14500 }]
  },
  {
    slug: "order-1035",
    kind: "ORDER",
    label: "Order #1035",
    preview: "Pickup in 5 min — bag it separately please.",
    mins: 48,
    unread: false,
    status: "PREPARING",
    customer: "Klara Holm",
    table: "Takeaway",
    items: [
      { name: "Buddha bowl", qty: 1, cents: 13900 },
      { name: "Iced tea", qty: 1, cents: 4500 }
    ]
  },
  {
    slug: "order-1040",
    kind: "ORDER",
    label: "Order #1040",
    preview: "Driver is at the door — buzzer 4B.",
    mins: 52,
    unread: false,
    status: "OUT_FOR_DELIVERY",
    customer: "Daniel Cho",
    table: "Delivery",
    items: [{ name: "Sushi combo", qty: 1, cents: 28900 }]
  },
  {
    slug: "table-3",
    kind: "TABLE",
    label: "Table 3 · QR chat",
    preview: "What's the soup of the day?",
    mins: 58,
    unread: false,
    status: "OPEN",
    customer: "Guest at Table 3",
    table: "Table 3"
  },
  {
    slug: "order-1068",
    kind: "ORDER",
    label: "Order #1068",
    preview: "Party of 8 — can starters come out first?",
    mins: 63,
    unread: true,
    status: "ACCEPTED",
    customer: "Henrik & co.",
    table: "Table 20",
    note: "Birthday — 8 guests.",
    items: [
      { name: "Sharing platter", qty: 2, cents: 45800 },
      { name: "Prosecco", qty: 2, cents: 32000 }
    ]
  },
  {
    slug: "order-1070",
    kind: "ORDER",
    label: "Order #1070",
    preview: "Can we split the bill three ways?",
    mins: 71,
    unread: false,
    status: "PREPARING",
    customer: "Emma Lund",
    table: "Table 9",
    items: [{ name: "Tasting menu", qty: 3, cents: 89700 }]
  },
  {
    slug: "order-1072",
    kind: "ORDER",
    label: "Order #1072",
    preview: "Wrong dish — we ordered salmon, got chicken.",
    mins: 76,
    unread: true,
    status: "PREPARING",
    customer: "Ahmed Hassan",
    table: "Table 6",
    items: [{ name: "Grilled salmon", qty: 2, cents: 37800 }]
  },
  {
    slug: "order-1075",
    kind: "ORDER",
    label: "Order #1075",
    preview: "It's my partner's birthday — any dessert surprise?",
    mins: 84,
    unread: false,
    status: "ACCEPTED",
    customer: "Sofia Bergman",
    table: "Table 11",
    note: "Birthday dessert surprise requested.",
    items: [{ name: "Dinner for two", qty: 1, cents: 54900 }]
  },
  {
    slug: "order-1078",
    kind: "ORDER",
    label: "Order #1078",
    preview: "Gluten-free pasta — is the kitchen aware?",
    mins: 91,
    unread: true,
    status: "PREPARING",
    customer: "Ingrid Larsson",
    table: "Table 5",
    note: "Celiac — strict gluten free.",
    items: [{ name: "GF pasta arrabbiata", qty: 1, cents: 16900 }]
  }
];

const ORDER_THREADS: CommsThread[] = ORDER_THREAD_DEFS.map((def) => {
  const id = `${DEMO_PREFIX}${def.slug}`;
  const orderNum = def.label.match(/#(\d+)/)?.[1] ?? def.slug;
  return thread({
    id,
    kind: "room",
    type: def.kind,
    name: def.label,
    preview: def.preview,
    lastMessageAt: minutesAgo(def.mins),
    unread: def.unread,
    orderId: def.kind === "ORDER" ? `${DEMO_PREFIX}ord-${orderNum}` : null,
    reservationId: def.kind === "RESERVATION" ? id : null,
    orderStatus: def.status,
    customerLabel: def.customer,
    channelKey: null,
    tableLabel: def.table ?? null
  });
});

const STAFF_THREADS: CommsThread[] = [
  thread({
    id: `${DEMO_PREFIX}staff-kitchen`,
    kind: "room",
    type: "STAFF",
    name: "Kitchen",
    preview: "Hold #1042 — allergy note on the ticket.",
    lastMessageAt: minutesAgo(4),
    unread: true,
    orderId: null,
    reservationId: null,
    orderStatus: null,
    customerLabel: "Staff",
    channelKey: "kitchen",
    href: `#ws-comms/staff-internal-chat?roomId=${encodeURIComponent(`${DEMO_PREFIX}staff-kitchen`)}`
  }),
  thread({
    id: `${DEMO_PREFIX}staff-foh`,
    kind: "room",
    type: "STAFF",
    name: "Front of house",
    preview: "Table 12 needs water and extra napkins.",
    lastMessageAt: minutesAgo(11),
    unread: false,
    orderId: null,
    reservationId: null,
    orderStatus: null,
    customerLabel: "Staff",
    channelKey: "foh",
    href: `#ws-comms/staff-internal-chat?roomId=${encodeURIComponent(`${DEMO_PREFIX}staff-foh`)}`
  }),
  thread({
    id: `${DEMO_PREFIX}staff-managers`,
    kind: "room",
    type: "STAFF",
    name: "Managers",
    preview: "Receipt printer on floor 1 is offline.",
    lastMessageAt: minutesAgo(36),
    unread: false,
    orderId: null,
    reservationId: null,
    orderStatus: null,
    customerLabel: "Staff",
    channelKey: "managers",
    href: `#ws-comms/staff-internal-chat?roomId=${encodeURIComponent(`${DEMO_PREFIX}staff-managers`)}`
  })
];

const SYSTEM_THREADS: CommsThread[] = [
  thread({
    id: `${DEMO_PREFIX}sys-order-accepted`,
    kind: "event",
    type: "SYSTEM",
    name: "Order accepted",
    preview: "Order #1042 · kitchen started ticket",
    lastMessageAt: minutesAgo(6),
    unread: false,
    orderId: `${DEMO_PREFIX}ord-1042`,
    reservationId: null,
    orderStatus: "PREPARING",
    customerLabel: null,
    channelKey: null,
    href: "#ws-comms/system-messages",
    eventKey: "order.updated",
    entityType: "ORDER",
    entityId: `${DEMO_PREFIX}ord-1042`
  }),
  thread({
    id: `${DEMO_PREFIX}sys-payment`,
    kind: "event",
    type: "SYSTEM",
    name: "Payment captured",
    preview: "248 kr · Swish · Order #1042",
    lastMessageAt: minutesAgo(18),
    unread: false,
    orderId: `${DEMO_PREFIX}ord-1042`,
    reservationId: null,
    orderStatus: null,
    customerLabel: null,
    channelKey: null,
    href: "#ws-config/payments?tab=transactions",
    eventKey: "payment.succeeded",
    entityType: "PAYMENT",
    entityId: `${DEMO_PREFIX}pay-1042`
  }),
  thread({
    id: `${DEMO_PREFIX}sys-staff`,
    kind: "event",
    type: "SYSTEM",
    name: "Staff approved",
    preview: "Elias Nyberg joined as waiter",
    lastMessageAt: minutesAgo(52),
    unread: false,
    orderId: null,
    reservationId: null,
    orderStatus: null,
    customerLabel: null,
    channelKey: null,
    href: "#top-add-staff",
    eventKey: "staff.approved",
    entityType: "STAFF",
    entityId: `${DEMO_PREFIX}user-elias`
  }),
  thread({
    id: `${DEMO_PREFIX}sys-device`,
    kind: "event",
    type: "SYSTEM",
    name: "Printer offline",
    preview: "Kitchen printer · last seen 12 min ago",
    lastMessageAt: minutesAgo(64),
    unread: false,
    orderId: null,
    reservationId: null,
    orderStatus: null,
    customerLabel: null,
    channelKey: null,
    href: "#ws-devices/all-devices",
    eventKey: "device.offline",
    entityType: "DEVICE",
    entityId: `${DEMO_PREFIX}dev-printer-1`
  })
];

function msg(
  chatRoomId: string,
  id: string,
  role: string,
  content: string,
  mins: number,
  isSystem = false
): CommsMessage {
  return {
    id: `${DEMO_PREFIX}msg-${id}`,
    chatRoomId,
    senderUserId: isSystem ? null : `${DEMO_PREFIX}${role.toLowerCase()}`,
    senderRole: role,
    content,
    type: isSystem ? "SYSTEM" : "TEXT",
    createdAt: minutesAgo(mins),
    isSystem,
    deliveryStatus: role !== "CUSTOMER" && !isSystem ? "read" : undefined
  };
}

function messagesForDef(def: OrderThreadDef): CommsMessage[] {
  const roomId = `${DEMO_PREFIX}${def.slug}`;
  const base = def.mins + 12;
  if (def.kind === "TABLE") {
    return [
      msg(roomId, `${def.slug}-1`, "SYSTEM", `${def.table ?? "Table"} · QR session started`, base, true),
      msg(roomId, `${def.slug}-2`, "CUSTOMER", def.preview, def.mins)
    ];
  }
  if (def.kind === "RESERVATION") {
    const code = def.label.replace("Reservation ", "");
    return [
      msg(roomId, `${def.slug}-1`, "SYSTEM", `${code} confirmed`, base + 20, true),
      msg(roomId, `${def.slug}-2`, "CUSTOMER", def.preview, def.mins + 2),
      msg(roomId, `${def.slug}-3`, "STAFF", "Noted — we will update the booking.", def.mins)
    ];
  }
  const orderLabel = def.label;
  const lines: CommsMessage[] = [
    msg(roomId, `${def.slug}-1`, "SYSTEM", `${orderLabel} placed · ${def.table ?? "Pickup"}`, base, true),
    msg(roomId, `${def.slug}-2`, "CUSTOMER", def.preview, def.mins + 4),
    msg(roomId, `${def.slug}-3`, "STAFF", "On it — kitchen has the ticket.", def.mins + 2)
  ];
  if (def.status === "PREPARING" || def.status === "READY" || def.status === "DELAYED") {
    lines.push(msg(roomId, `${def.slug}-4`, "SYSTEM", `Status · ${def.status}`, def.mins + 1, true));
  }
  lines.push(msg(roomId, `${def.slug}-5`, "CUSTOMER", def.preview, def.mins));
  return lines;
}

function contextForDef(def: OrderThreadDef): CommsContext {
  const roomId = `${DEMO_PREFIX}${def.slug}`;
  if (def.kind === "TABLE") {
    return {
      roomId,
      type: "TABLE",
      table: {
        tableId: `${DEMO_PREFIX}tbl-${def.slug}`,
        tableLabel: def.table?.replace("Table ", "") ?? null,
        sourceSessionId: `${DEMO_PREFIX}sess-${def.slug}`
      },
      order: null,
      reservation: null
    };
  }
  if (def.kind === "RESERVATION") {
    const code = def.label.replace("Reservation ", "");
    return {
      roomId,
      type: "RESERVATION",
      order: null,
      reservation: {
        id: roomId,
        confirmationCode: code,
        status: def.status,
        startsAt: minutesAgo(-def.mins)
      }
    };
  }
  const orderNum = def.label.match(/#(\d+)/)?.[1] ?? def.slug;
  const items = (def.items ?? [{ name: "House special", qty: 1, cents: 12000 }]).map((item, i) => ({
    id: `${def.slug}-i${i}`,
    name: item.name,
    quantity: item.qty,
    lineTotalCents: item.cents
  }));
  const totalCents = items.reduce((sum, item) => sum + item.lineTotalCents, 0);
  return {
    roomId,
    type: "ORDER",
    order: {
      id: `${DEMO_PREFIX}ord-${orderNum}`,
      displayNumber: `#${orderNum}`,
      status: def.status,
      paymentStatus: def.paymentStatus ?? (def.status === "PAYMENT_FAILED" ? "FAILED" : "PAID"),
      customerName: def.customer,
      tableLabel: def.table ?? null,
      totalCents,
      note: def.note ?? null,
      items
    },
    reservation: null
  };
}

const MESSAGES: Record<string, CommsMessage[]> = Object.fromEntries(
  ORDER_THREAD_DEFS.map((def) => [`${DEMO_PREFIX}${def.slug}`, messagesForDef(def)])
);

MESSAGES[`${DEMO_PREFIX}staff-kitchen`] = [
  msg("demo:staff-kitchen", "k-1", "STAFF", "Expo: 86 the mushroom soup for 20 minutes.", 40),
  msg("demo:staff-kitchen", "k-2", "STAFF", "Hold #1042 — allergy note on the ticket.", 4)
];
MESSAGES[`${DEMO_PREFIX}staff-foh`] = [
  msg("demo:staff-foh", "f-1", "STAFF", "Walk-in of 3 waiting at the door.", 25),
  msg("demo:staff-foh", "f-2", "STAFF", "Table 12 needs water and extra napkins.", 11)
];
MESSAGES[`${DEMO_PREFIX}staff-managers`] = [
  msg("demo:staff-managers", "m-1", "STAFF", "Shift coverage looks thin after 21:00.", 90),
  msg("demo:staff-managers", "m-2", "STAFF", "Receipt printer on floor 1 is offline.", 36)
];

const CONTEXTS: Record<string, CommsContext> = Object.fromEntries(
  ORDER_THREAD_DEFS.map((def) => [`${DEMO_PREFIX}${def.slug}`, contextForDef(def)])
);

export function filterDemoThreads(threads: CommsThread[], query: string): CommsThread[] {
  const q = query.trim().toLowerCase();
  if (!q) return threads;
  return threads.filter(
    (t) =>
      t.name.toLowerCase().includes(q) ||
      t.preview.toLowerCase().includes(q) ||
      (t.customerLabel?.toLowerCase().includes(q) ?? false) ||
      (t.orderStatus?.toLowerCase().includes(q) ?? false) ||
      (t.tableLabel?.toLowerCase().includes(q) ?? false)
  );
}

export function demoOrderStats(threads: CommsThread[]) {
  const unread = threads.filter((t) => t.unread).length;
  const active = threads.filter((t) => t.orderStatus && !["COMPLETED", "CANCELLED"].includes(t.orderStatus)).length;
  const preparing = threads.filter((t) => t.orderStatus === "PREPARING").length;
  const needsAttention = threads.filter((t) =>
    ["DELAYED", "PAYMENT_FAILED", "DISPUTED", "REFUND_REQUESTED"].includes(t.orderStatus ?? "")
  ).length;
  const reservations = threads.filter((t) => t.type === "RESERVATION").length;
  const tableChats = threads.filter((t) => t.type === "TABLE").length;
  return { total: threads.length, unread, active, preparing, needsAttention, reservations, tableChats };
}

export function demoThreadsForView(view: CommsView): CommsThread[] {
  if (view === "staff") return STAFF_THREADS;
  if (view === "system") return SYSTEM_THREADS;
  if (view === "customer") return ORDER_THREADS.filter((t) => t.unread);
  return ORDER_THREADS;
}

export function demoMessagesForThread(id: string): CommsMessage[] {
  return MESSAGES[id] ?? [];
}

export function demoContextForThread(id: string): CommsContext | null {
  return CONTEXTS[id] ?? null;
}

export function demoStaffReply(chatRoomId: string, content: string): CommsMessage {
  return {
    id: `${DEMO_PREFIX}msg-local-${Date.now()}`,
    chatRoomId,
    senderUserId: `${DEMO_PREFIX}staff`,
    senderRole: "STAFF",
    content,
    type: "TEXT",
    createdAt: new Date().toISOString(),
    isSystem: false,
    deliveryStatus: "sent"
  };
}
