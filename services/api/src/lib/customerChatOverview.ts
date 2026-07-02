import type { OrderStatus, PrismaClient } from "@prisma/client";
import { autoTerminateStaleActiveOrdersForCustomer } from "./autoTerminateStaleActiveOrders.js";
import { countCustomerChatUnread, countRoomUnreadForCustomer } from "./chatUnread.js";
import { orderStatusCustomerLabel, pickActiveOrderForVenue } from "./customerChatHub.js";

const ACTIVE_STATUSES: OrderStatus[] = ["PENDING", "CONFIRMED", "PREPARING", "READY"];

function isActiveStatus(status: OrderStatus): boolean {
  return ACTIVE_STATUSES.includes(status);
}

function shortOrderLabel(id: string): string {
  const t = id.replace(/\s/g, "");
  if (t.length <= 6) return t.toUpperCase();
  return t.slice(-6).toUpperCase();
}

function formatMessagePreview(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  const trimmed = raw.trim();
  const pipe = trimmed.indexOf("|");
  if (trimmed.startsWith("status:") && pipe > 0) {
    return trimmed.slice(pipe + 1).trim() || trimmed;
  }
  return trimmed;
}

export type CustomerChatOverviewThread = {
  chatRoomId: string | null;
  restaurantId: string;
  restaurantName: string;
  threadKind: "venue" | "order" | "reservation" | "staff" | "support";
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  lastMessageSenderRole: string | null;
  unreadCount: number;
  hasUnread: boolean;
  activeOrder: {
    id: string;
    shortLabel: string;
    status: string;
    statusLabel: string;
    statusEmoji: string;
  } | null;
};

export type CustomerChatActivityItem = {
  id: string;
  kind: "order_update" | "message" | "system";
  restaurantId: string;
  restaurantName: string;
  title: string;
  subtitle?: string;
  at: string;
  chatRoomId?: string | null;
  orderId?: string | null;
  hasUnread?: boolean;
};

export async function buildCustomerChatOverview(prisma: PrismaClient, customerUserId: string) {
  await autoTerminateStaleActiveOrdersForCustomer(prisma, customerUserId, new Date());

  const [rooms, orders] = await Promise.all([
    prisma.chatRoom.findMany({
      where: {
        OR: [{ customerUserId }, { order: { customerUserId } }, { reservation: { userId: customerUserId } }]
      },
      include: {
        restaurant: { select: { id: true, name: true } },
        order: { select: { id: true, status: true, updatedAt: true } },
        reservation: { select: { id: true, status: true, updatedAt: true } }
      },
      orderBy: [{ lastMessageAt: "desc" }, { updatedAt: "desc" }]
    }),
    prisma.order.findMany({
      where: { customerUserId },
      orderBy: { updatedAt: "desc" },
      take: 40,
      include: { restaurant: { select: { id: true, name: true } } }
    })
  ]);

  const orderRows = orders.map((o) => ({
    id: o.id,
    restaurantId: o.restaurantId,
    status: o.status,
    totalCents: o.totalCents,
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
    note: o.note ?? null,
    restaurant: o.restaurant,
    lines: []
  }));

  const activeOrders = orders.filter((o) => isActiveStatus(o.status));
  const roomsByRestaurant = new Map<string, typeof rooms>();
  for (const room of rooms) {
    const list = roomsByRestaurant.get(room.restaurantId) ?? [];
    list.push(room);
    roomsByRestaurant.set(room.restaurantId, list);
  }

  const restaurantIds = new Set<string>([
    ...rooms.map((r) => r.restaurantId),
    ...activeOrders.map((o) => o.restaurantId)
  ]);

  const threads: CustomerChatOverviewThread[] = [];

  for (const restaurantId of restaurantIds) {
    const venueRooms = roomsByRestaurant.get(restaurantId) ?? [];
    const activeAtVenue = pickActiveOrderForVenue(orderRows, restaurantId);
    const orderRoom =
      activeAtVenue != null ? venueRooms.find((r) => r.orderId === activeAtVenue.id) : undefined;
    const venueRoom = venueRooms.find((r) => r.type === "VENUE");
    const primary = orderRoom ?? venueRoom ?? venueRooms[0];
    const restaurant = primary?.restaurant ?? activeAtVenue?.restaurant ?? orders.find((o) => o.restaurantId === restaurantId)?.restaurant;
    if (!restaurant) continue;

    let unreadCount = 0;
    if (primary) {
      unreadCount = await countRoomUnreadForCustomer(prisma, primary.id, customerUserId);
    }

    const statusPack = activeAtVenue ? orderStatusCustomerLabel(activeAtVenue.status) : null;
    const fallbackPreview = statusPack
      ? `${statusPack.emoji} ${statusPack.label} · Order #${shortOrderLabel(activeAtVenue!.id)}`
      : null;

    const preview = formatMessagePreview(primary?.lastMessagePreview) ?? fallbackPreview;
    const lastAt =
      primary?.lastMessageAt?.toISOString() ??
      activeAtVenue?.updatedAt.toISOString() ??
      venueRooms[0]?.updatedAt.toISOString() ??
      null;

    threads.push({
      chatRoomId: primary?.id ?? null,
      restaurantId: restaurant.id,
      restaurantName: restaurant.name,
      threadKind: (primary?.type?.toLowerCase() ?? (activeAtVenue ? "order" : "venue")) as CustomerChatOverviewThread["threadKind"],
      lastMessageAt: lastAt,
      lastMessagePreview: preview,
      lastMessageSenderRole: primary?.lastMessageSenderRole ?? (activeAtVenue ? "SYSTEM" : null),
      unreadCount,
      hasUnread: unreadCount > 0,
      activeOrder: activeAtVenue
        ? {
            id: activeAtVenue.id,
            shortLabel: shortOrderLabel(activeAtVenue.id),
            status: activeAtVenue.status,
            statusLabel: statusPack!.label,
            statusEmoji: statusPack!.emoji
          }
        : null
    });
  }

  threads.sort((a, b) => {
    const ta = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
    const tb = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
    return tb - ta;
  });

  const activity: CustomerChatActivityItem[] = [];

  for (const order of orders.slice(0, 12)) {
    const { label, emoji } = orderStatusCustomerLabel(order.status);
    const room = rooms.find((r) => r.orderId === order.id);
    let hasUnread = false;
    if (room) {
      const n = await countRoomUnreadForCustomer(prisma, room.id, customerUserId);
      hasUnread = n > 0;
    }
    activity.push({
      id: `order:${order.id}:${order.status}`,
      kind: "order_update",
      restaurantId: order.restaurantId,
      restaurantName: order.restaurant.name,
      title: `${emoji} ${label}`,
      subtitle: `Order #${shortOrderLabel(order.id)}`,
      at: order.updatedAt.toISOString(),
      orderId: order.id,
      chatRoomId: room?.id ?? null,
      hasUnread
    });
  }

  for (const room of rooms) {
    if (!room.lastMessageAt) continue;
    const unread = await countRoomUnreadForCustomer(prisma, room.id, customerUserId);
    const preview = formatMessagePreview(room.lastMessagePreview);
    if (!preview) continue;
    activity.push({
      id: `room:${room.id}:${room.lastMessageAt.toISOString()}`,
      kind: room.lastMessageSenderRole === "CUSTOMER" ? "message" : "system",
      restaurantId: room.restaurantId,
      restaurantName: room.restaurant.name,
      title: room.restaurant.name,
      subtitle: preview,
      at: room.lastMessageAt.toISOString(),
      chatRoomId: room.id,
      hasUnread: unread > 0
    });
  }

  activity.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  const seenActivity = new Set<string>();
  const activityDeduped = activity.filter((row) => {
    const key = `${row.kind}:${row.restaurantId}:${row.title}:${row.subtitle ?? ""}`;
    if (seenActivity.has(key)) return false;
    seenActivity.add(key);
    return true;
  }).slice(0, 24);

  const totalUnread = await countCustomerChatUnread(prisma, customerUserId);

  return { threads, activity: activityDeduped, totalUnread };
}
