import type { ChatMessageType, OrderStatus, PrismaClient } from "@prisma/client";

const ACTIVE_STATUSES: OrderStatus[] = ["PENDING", "CONFIRMED", "PREPARING", "READY"];

export type CustomerChatScene = "new" | "cart" | "active_order" | "completed_only";

export type CustomerChatQuickActionId =
  | "view_menu"
  | "popular_items"
  | "opening_hours"
  | "call_staff"
  | "ask_ingredients"
  | "request_customization"
  | "open_cart"
  | "place_order"
  | "reorder"
  | "browse_menu"
  | "contact_support";

type OrderRow = {
  id: string;
  restaurantId: string;
  status: OrderStatus;
  totalCents: number;
  createdAt: Date;
  updatedAt: Date;
  note: string | null;
  restaurant: { id: string; name: string };
  lines: Array<{
    menuItemId: string;
    nameSnapshot: string;
    quantity: number;
    lineTotalCents: number;
  }>;
};

function isActiveStatus(status: OrderStatus): boolean {
  return ACTIVE_STATUSES.includes(status);
}

export function pickActiveOrderForVenue(orders: OrderRow[], venueId: string): OrderRow | null {
  const active = orders.filter((o) => isActiveStatus(o.status));
  if (!active.length) return null;
  const vid = venueId.trim();
  if (vid) {
    const atVenue = active.find((o) => o.restaurantId === vid);
    if (atVenue) return atVenue;
  }
  return active[0] ?? null;
}

function shortOrderLabel(id: string): string {
  const t = id.replace(/\s/g, "");
  if (t.length <= 6) return t.toUpperCase();
  return t.slice(-6).toUpperCase();
}

export function orderStatusCustomerLabel(status: OrderStatus): { label: string; emoji: string } {
  switch (status) {
    case "PENDING":
      return { label: "Received", emoji: "📋" };
    case "CONFIRMED":
      return { label: "Confirmed", emoji: "✓" };
    case "PREPARING":
      return { label: "Preparing", emoji: "🍳" };
    case "READY":
      return { label: "Ready for pickup", emoji: "✅" };
    case "COMPLETED":
      return { label: "Completed", emoji: "✓" };
    case "CANCELLED":
      return { label: "Cancelled", emoji: "—" };
    default:
      return { label: String(status), emoji: "" };
  }
}

/** Rough ETA minutes shown on the live assistance header (backend-owned). */
export function estimateOrderMinutesRemaining(
  status: OrderStatus,
  createdAt: Date,
  updatedAt: Date
): number | null {
  if (status === "READY") return 5;
  if (status === "COMPLETED" || status === "CANCELLED") return null;
  const createdMs = createdAt.getTime();
  const updatedMs = updatedAt.getTime();
  const elapsedMin = Math.max(0, Math.floor((Date.now() - createdMs) / 60000));
  if (status === "PREPARING") return Math.max(8, 18 - elapsedMin);
  if (status === "CONFIRMED") return Math.max(10, 22 - elapsedMin);
  if (status === "PENDING") return Math.max(12, 25 - elapsedMin);
  void updatedMs;
  return 15;
}

export function buildOrderTimeline(status: OrderStatus, restaurantName: string): Array<{ key: string; content: string }> {
  const venue = restaurantName.trim() || "the restaurant";
  const rows: Array<{ key: string; content: string }> = [];
  switch (status) {
    case "PENDING":
      rows.push({ key: "sent", content: "Your order was sent to the kitchen" });
      rows.push({ key: "prep", content: `${venue} will start preparing shortly` });
      break;
    case "CONFIRMED":
      rows.push({ key: "accepted", content: "Kitchen accepted your order" });
      rows.push({ key: "prep_soon", content: "Cooking will start shortly" });
      break;
    case "PREPARING":
      rows.push({ key: "cooking", content: "Your order is now being prepared" });
      rows.push({ key: "notify", content: "We will let you know when it is ready" });
      break;
    case "READY":
      rows.push({ key: "ready", content: "Your order is ready for pickup" });
      rows.push({ key: "pickup", content: "Head to the pickup area when you arrive" });
      break;
    default:
      rows.push({ key: "thanks", content: "Thanks for ordering with ServeOS" });
  }
  return rows;
}

export function resolveCustomerChatScene(input: {
  cartLineCount: number;
  activeOrder: OrderRow | null;
  hasCompletedOrders: boolean;
}): CustomerChatScene {
  if (input.activeOrder) return "active_order";
  if (input.cartLineCount > 0) return "cart";
  if (input.hasCompletedOrders) return "completed_only";
  return "new";
}

export function hubCopyForScene(scene: CustomerChatScene): { headline: string; subheadline: string } {
  switch (scene) {
    case "new":
      return {
        headline: "Need help with your order?",
        subheadline: "Ask the restaurant anything here."
      };
    case "cart":
      return {
        headline: "You're almost ready to order 👋",
        subheadline: "Need changes or special requests?"
      };
    case "active_order":
      return {
        headline: "Live order assistance",
        subheadline: "Status updates and messages stay tied to your current order."
      };
    case "completed_only":
      return {
        headline: "No active orders right now",
        subheadline: "Need help or want to order again?"
      };
  }
}

export function quickActionsForScene(scene: CustomerChatScene): Array<{ id: CustomerChatQuickActionId; label: string }> {
  switch (scene) {
    case "new":
      return [
        { id: "view_menu", label: "View Menu" },
        { id: "popular_items", label: "Popular Items" },
        { id: "opening_hours", label: "Opening Hours" },
        { id: "call_staff", label: "Call Staff" }
      ];
    case "cart":
      return [
        { id: "ask_ingredients", label: "Ask about ingredients" },
        { id: "request_customization", label: "Request customization" },
        { id: "open_cart", label: "Review cart" },
        { id: "place_order", label: "Place order" },
        { id: "opening_hours", label: "Opening Hours" }
      ];
    case "active_order":
      return [
        { id: "call_staff", label: "Call Staff" },
        { id: "opening_hours", label: "Opening Hours" },
        { id: "view_menu", label: "Add items" }
      ];
    case "completed_only":
      return [
        { id: "reorder", label: "Order again" },
        { id: "browse_menu", label: "View Menu" },
        { id: "contact_support", label: "Message restaurant" },
        { id: "opening_hours", label: "Opening Hours" }
      ];
  }
}

export async function ensureCustomerChatRoom(
  prisma: PrismaClient,
  input: { scene: CustomerChatScene; restaurantId: string; customerUserId: string; orderId?: string }
): Promise<string> {
  if (input.scene === "active_order" && input.orderId) {
    const existing = await prisma.chatRoom.findUnique({ where: { orderId: input.orderId } });
    if (existing) return existing.id;
    const created = await prisma.chatRoom.create({
      data: {
        type: "ORDER",
        restaurantId: input.restaurantId,
        orderId: input.orderId
      }
    });
    return created.id;
  }

  const existingVenue = await prisma.chatRoom.findFirst({
    where: {
      type: "VENUE",
      restaurantId: input.restaurantId,
      customerUserId: input.customerUserId
    }
  });
  if (existingVenue) return existingVenue.id;

  const created = await prisma.chatRoom.create({
    data: {
      type: "VENUE",
      restaurantId: input.restaurantId,
      customerUserId: input.customerUserId
    }
  });
  return created.id;
}

/** Seed order-status copy as a restaurant (staff) chat message — idempotent per status. */
export async function syncOrderRoomSystemMessage(
  prisma: PrismaClient,
  chatRoomId: string,
  status: OrderStatus,
  restaurantName: string
): Promise<{ id: string; content: string; createdAt: Date } | null> {
  const timeline = buildOrderTimeline(status, restaurantName);
  const primary = timeline[0]?.content ?? "Order update";
  const marker = `status:${status}`;
  const stored = `${marker}|${primary}`;
  const recent = await prisma.chatMessage.findMany({
    where: { chatRoomId },
    orderBy: { createdAt: "desc" },
    take: 12
  });
  if (recent.some((m) => m.content === stored || m.content.startsWith(`${marker}|`))) return null;

  const preview = primary.length > 120 ? `${primary.slice(0, 117)}…` : primary;
  const now = new Date();

  return prisma.$transaction(async (tx) => {
    const msg = await tx.chatMessage.create({
      data: {
        chatRoomId,
        senderRole: "STAFF",
        senderUserId: null,
        content: stored,
        type: "TEXT"
      }
    });
    await tx.chatRoom.update({
      where: { id: chatRoomId },
      data: {
        lastMessageAt: now,
        lastMessagePreview: preview,
        lastMessageSenderRole: "STAFF",
        updatedAt: now
      }
    });
    return msg;
  });
}

export type ThreadFeedItem =
  | { kind: "system"; id: string; content: string; at: string }
  | {
      kind: "message";
      id: string;
      chatRoomId: string;
      senderUserId: string | null;
      senderRole: string;
      content: string;
      type: ChatMessageType;
      createdAt: string;
      deliveryStatus?: "sent" | "delivered" | "read";
      isMine?: boolean;
    };

/** Thread is chat messages only (no inline system timeline). */
export function buildThreadFeed(messages: ThreadFeedItem[]): ThreadFeedItem[] {
  return messages.filter((m): m is Extract<ThreadFeedItem, { kind: "message" }> => m.kind === "message");
}
