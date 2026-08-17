import type { CommsContext, CommsMessage, CommsThread, CommsView } from "./commsApi";

const DEMO_PREFIX = "demo:";

export function isDemoCommsId(id: string) {
  return id.startsWith(DEMO_PREFIX);
}

function minutesAgo(mins: number) {
  return new Date(Date.now() - mins * 60_000).toISOString();
}

function thread(
  partial: Omit<CommsThread, "href"> & { href?: string }
): CommsThread {
  return {
    ...partial,
    href: partial.href ?? `#ws-comms/order-chats?roomId=${encodeURIComponent(partial.id)}`
  };
}

const ORDER_THREADS: CommsThread[] = [
  thread({
    id: `${DEMO_PREFIX}order-1042`,
    kind: "room",
    type: "ORDER",
    name: "Order #1042",
    preview: "Can you skip the onions on the burger?",
    lastMessageAt: minutesAgo(2),
    unread: true,
    orderId: `${DEMO_PREFIX}ord-1042`,
    reservationId: null,
    orderStatus: "PREPARING",
    customerLabel: "Anna Berg",
    channelKey: null
  }),
  thread({
    id: `${DEMO_PREFIX}order-1048`,
    kind: "room",
    type: "ORDER",
    name: "Order #1048",
    preview: "Table 4 asked for extra ketchup.",
    lastMessageAt: minutesAgo(8),
    unread: true,
    orderId: `${DEMO_PREFIX}ord-1048`,
    reservationId: null,
    orderStatus: "ACCEPTED",
    customerLabel: "Oscar Lind",
    channelKey: null
  }),
  thread({
    id: `${DEMO_PREFIX}res-8821`,
    kind: "room",
    type: "RESERVATION",
    name: "Reservation RSV-8821",
    preview: "We are running 10 minutes late — still hold the table?",
    lastMessageAt: minutesAgo(14),
    unread: false,
    orderId: null,
    reservationId: `${DEMO_PREFIX}res-8821`,
    orderStatus: "CONFIRMED",
    customerLabel: "Fatima Ali",
    channelKey: null,
    href: `#ws-comms/order-chats?roomId=${encodeURIComponent(`${DEMO_PREFIX}res-8821`)}`
  }),
  thread({
    id: `${DEMO_PREFIX}order-1038`,
    kind: "room",
    type: "ORDER",
    name: "Order #1038",
    preview: "Food is on the way to table 12.",
    lastMessageAt: minutesAgo(28),
    unread: false,
    orderId: `${DEMO_PREFIX}ord-1038`,
    reservationId: null,
    orderStatus: "READY",
    customerLabel: "Hugo Ek",
    channelKey: null
  }),
  thread({
    id: `${DEMO_PREFIX}order-1031`,
    kind: "room",
    type: "ORDER",
    name: "Order #1031",
    preview: "Thanks — order completed.",
    lastMessageAt: minutesAgo(95),
    unread: false,
    orderId: `${DEMO_PREFIX}ord-1031`,
    reservationId: null,
    orderStatus: "COMPLETED",
    customerLabel: "Nora Holm",
    channelKey: null
  })
];

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

const MESSAGES: Record<string, CommsMessage[]> = {
  [`${DEMO_PREFIX}order-1042`]: [
    msg("demo:order-1042", "1042-1", "SYSTEM", "Order #1042 placed · Table 12", 22, true),
    msg("demo:order-1042", "1042-2", "CUSTOMER", "Extra spicy, no onions on the burger please.", 20),
    msg("demo:order-1042", "1042-3", "STAFF", "Noted — kitchen has the allergy flag on the ticket.", 16),
    msg("demo:order-1042", "1042-4", "SYSTEM", "Status · PREPARING", 9, true),
    msg("demo:order-1042", "1042-5", "CUSTOMER", "Can you skip the onions on the burger?", 2)
  ],
  [`${DEMO_PREFIX}order-1048`]: [
    msg("demo:order-1048", "1048-1", "SYSTEM", "Order #1048 placed · Table 4", 16, true),
    msg("demo:order-1048", "1048-2", "STAFF", "Order accepted. About 12 minutes.", 12),
    msg("demo:order-1048", "1048-3", "CUSTOMER", "Table 4 asked for extra ketchup.", 8)
  ],
  [`${DEMO_PREFIX}res-8821`]: [
    msg("demo:res-8821", "8821-1", "SYSTEM", "Reservation RSV-8821 confirmed · 19:30 · 4 guests", 80, true),
    msg("demo:res-8821", "8821-2", "CUSTOMER", "We are running 10 minutes late — still hold the table?", 14),
    msg("demo:res-8821", "8821-3", "STAFF", "Yes, we will hold it until 19:45.", 12)
  ],
  [`${DEMO_PREFIX}order-1038`]: [
    msg("demo:order-1038", "1038-1", "SYSTEM", "Order #1038 paid", 40, true),
    msg("demo:order-1038", "1038-2", "CUSTOMER", "Where should we pick this up?", 32),
    msg("demo:order-1038", "1038-3", "STAFF", "Food is on the way to table 12.", 28)
  ],
  [`${DEMO_PREFIX}order-1031`]: [
    msg("demo:order-1031", "1031-1", "SYSTEM", "Order #1031 completed", 100, true),
    msg("demo:order-1031", "1031-2", "CUSTOMER", "Thanks — everything was great.", 96),
    msg("demo:order-1031", "1031-3", "STAFF", "Glad to hear it. See you next time.", 95)
  ],
  [`${DEMO_PREFIX}staff-kitchen`]: [
    msg("demo:staff-kitchen", "k-1", "STAFF", "Expo: 86 the mushroom soup for 20 minutes.", 40),
    msg("demo:staff-kitchen", "k-2", "STAFF", "Hold #1042 — allergy note on the ticket.", 4)
  ],
  [`${DEMO_PREFIX}staff-foh`]: [
    msg("demo:staff-foh", "f-1", "STAFF", "Walk-in of 3 waiting at the door.", 25),
    msg("demo:staff-foh", "f-2", "STAFF", "Table 12 needs water and extra napkins.", 11)
  ],
  [`${DEMO_PREFIX}staff-managers`]: [
    msg("demo:staff-managers", "m-1", "STAFF", "Shift coverage looks thin after 21:00.", 90),
    msg("demo:staff-managers", "m-2", "STAFF", "Receipt printer on floor 1 is offline.", 36)
  ]
};

const CONTEXTS: Record<string, CommsContext> = {
  [`${DEMO_PREFIX}order-1042`]: {
    roomId: `${DEMO_PREFIX}order-1042`,
    type: "ORDER",
    order: {
      id: `${DEMO_PREFIX}ord-1042`,
      displayNumber: "#1042",
      status: "PREPARING",
      paymentStatus: "PAID",
      customerName: "Anna Berg",
      tableLabel: "Table 12",
      totalCents: 24800,
      note: "No onions. Extra spicy.",
      items: [
        { id: "i1", name: "Smash burger", quantity: 1, lineTotalCents: 16500 },
        { id: "i2", name: "Fries", quantity: 1, lineTotalCents: 4500 },
        { id: "i3", name: "Sparkling water", quantity: 1, lineTotalCents: 3800 }
      ]
    },
    reservation: null
  },
  [`${DEMO_PREFIX}order-1048`]: {
    roomId: `${DEMO_PREFIX}order-1048`,
    type: "ORDER",
    order: {
      id: `${DEMO_PREFIX}ord-1048`,
      displayNumber: "#1048",
      status: "ACCEPTED",
      paymentStatus: "PAID",
      customerName: "Oscar Lind",
      tableLabel: "Table 4",
      totalCents: 18900,
      note: null,
      items: [
        { id: "i4", name: "Caesar salad", quantity: 1, lineTotalCents: 12900 },
        { id: "i5", name: "Ketchup", quantity: 1, lineTotalCents: 0 },
        { id: "i6", name: "Cola", quantity: 1, lineTotalCents: 6000 }
      ]
    },
    reservation: null
  },
  [`${DEMO_PREFIX}order-1038`]: {
    roomId: `${DEMO_PREFIX}order-1038`,
    type: "ORDER",
    order: {
      id: `${DEMO_PREFIX}ord-1038`,
      displayNumber: "#1038",
      status: "READY",
      paymentStatus: "PAID",
      customerName: "Hugo Ek",
      tableLabel: "Table 12",
      totalCents: 31200,
      note: null,
      items: [
        { id: "i7", name: "Pasta carbonara", quantity: 2, lineTotalCents: 27800 },
        { id: "i8", name: "Espresso", quantity: 1, lineTotalCents: 3400 }
      ]
    },
    reservation: null
  },
  [`${DEMO_PREFIX}order-1031`]: {
    roomId: `${DEMO_PREFIX}order-1031`,
    type: "ORDER",
    order: {
      id: `${DEMO_PREFIX}ord-1031`,
      displayNumber: "#1031",
      status: "COMPLETED",
      paymentStatus: "PAID",
      customerName: "Nora Holm",
      tableLabel: "Takeaway",
      totalCents: 15600,
      note: null,
      items: [{ id: "i9", name: "Chicken wrap", quantity: 2, lineTotalCents: 15600 }]
    },
    reservation: null
  },
  [`${DEMO_PREFIX}res-8821`]: {
    roomId: `${DEMO_PREFIX}res-8821`,
    type: "RESERVATION",
    order: null,
    reservation: {
      id: `${DEMO_PREFIX}res-8821`,
      confirmationCode: "RSV-8821",
      status: "CONFIRMED",
      startsAt: minutesAgo(-18)
    }
  }
};

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
