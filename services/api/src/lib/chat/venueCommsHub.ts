import type { ChatRoomType, PrismaClient } from "@prisma/client";
import {
  commsCustomerInboxHref,
  commsOrderChatHref,
  commsStaffChatHref
} from "../../notifications/deepLinks.js";
import {
  createChatTextMessage,
  serializeMessage,
  serializeMessages,
  type SerializedChatMessage
} from "./chatMessageService.js";
import type { MobileAuthContext } from "../auth/mobileAuthContext.js";
import { requireVenueMembership } from "../auth/mobileAuthContext.js";
import { notifyChatMessage } from "../../notifications/integrations/chat.js";
import type { EventEmitter } from "node:events";
import { assertCanAccessCommsRoom, canAccessCommsRoom, canAccessStaffChannel } from "./chatAccess.js";

export type CommsView = "order" | "customer" | "staff" | "system";

export type CommsThread = {
  id: string;
  kind: "room" | "event";
  type: ChatRoomType | "SYSTEM";
  name: string;
  preview: string;
  lastMessageAt: string;
  unread: boolean;
  orderId: string | null;
  reservationId: string | null;
  orderStatus: string | null;
  customerLabel: string | null;
  channelKey: string | null;
  lifecycle?: string;
  tableLabel?: string | null;
  href: string;
  eventKey?: string;
  entityType?: string;
  entityId?: string | null;
};

const OPEN_ORDER_STATUSES = [
  "CREATED",
  "PENDING_PAYMENT",
  "PAID",
  "ACCEPTED",
  "PREPARING",
  "READY",
  "PENDING",
  "CONFIRMED"
] as const;

const DEFAULT_STAFF_CHANNELS = [
  { channelKey: "kitchen", name: "Kitchen" },
  { channelKey: "foh", name: "Front of house" },
  { channelKey: "managers", name: "Managers" },
  { channelKey: "all", name: "All staff" }
] as const;

function roomHref(type: ChatRoomType, id: string) {
  if (type === "STAFF") return commsStaffChatHref(id);
  return commsOrderChatHref(id);
}

export async function ensureDefaultStaffChannels(prisma: PrismaClient, restaurantId: string) {
  for (const ch of DEFAULT_STAFF_CHANNELS) {
    const existing = await prisma.chatRoom.findFirst({
      where: { restaurantId, channelKey: ch.channelKey }
    });
    if (existing) {
      if (!existing.isSystemChannel) {
        await prisma.chatRoom.update({ where: { id: existing.id }, data: { isSystemChannel: true } });
      }
      continue;
    }
    try {
      await prisma.chatRoom.create({
        data: {
          type: "STAFF",
          restaurantId,
          name: ch.name,
          channelKey: ch.channelKey,
          isSystemChannel: true
        }
      });
    } catch {
      /* unique (restaurantId, channelKey) race */
    }
  }
}

function mapRoomThread(r: {
  id: string;
  type: ChatRoomType;
  name: string | null;
  channelKey: string | null;
  orderId: string | null;
  reservationId: string | null;
  lastMessagePreview: string | null;
  lastMessageAt: Date | null;
  lastMessageSenderRole: string | null;
  restaurantLastReadAt: Date | null;
  createdAt: Date;
  lifecycle?: string;
  tableLabel?: string | null;
  order: { id: string; status: string; displaySeq: number | null; customerName: string | null } | null;
  reservation: { id: string; confirmationCode: string; status: string } | null;
  customer: { email: string | null } | null;
}): CommsThread {
  const unread =
    !!r.lastMessageAt &&
    (!r.restaurantLastReadAt || r.lastMessageAt > r.restaurantLastReadAt) &&
    r.lastMessageSenderRole === "CUSTOMER";
  const orderLabel = r.order
    ? `Order #${r.order.displaySeq ?? r.order.id.slice(-4)}`
    : r.reservation
      ? `Reservation ${r.reservation.confirmationCode}`
      : r.tableLabel
        ? r.lifecycle === "RESOLVED"
          ? `Table ${r.tableLabel} (left)`
          : `Table ${r.tableLabel}`
        : r.name ?? (r.type === "VENUE" ? "Venue chat" : r.type === "STAFF" ? r.channelKey ?? "Staff" : "Thread");
  return {
    id: r.id,
    kind: "room",
    type: r.type,
    name: orderLabel,
    preview: r.lastMessagePreview ?? "No messages yet",
    lastMessageAt: r.lastMessageAt?.toISOString() ?? r.createdAt.toISOString(),
    unread,
    orderId: r.orderId,
    reservationId: r.reservationId,
    orderStatus: r.order?.status ?? r.reservation?.status ?? null,
    customerLabel: r.order?.customerName ?? r.customer?.email ?? (r.type === "STAFF" ? "Staff" : "Guest"),
    channelKey: r.channelKey,
    lifecycle: r.lifecycle,
    tableLabel: r.tableLabel ?? null,
    href: r.type === "STAFF" ? commsStaffChatHref(r.id) : unread ? commsCustomerInboxHref(r.id) : roomHref(r.type, r.id)
  };
}

const roomInclude = {
  order: { select: { id: true, status: true, displaySeq: true, customerName: true } },
  reservation: { select: { id: true, confirmationCode: true, status: true } },
  customer: { select: { email: true } }
} as const;

export type CommsThreadQuery = {
  unread?: boolean;
  lifecycle?: "OPEN" | "RESOLVED";
  q?: string;
  cursor?: string;
  limit?: number;
};

export async function listCommsThreads(
  prisma: PrismaClient,
  restaurantId: string,
  view: CommsView,
  role?: string | null,
  query?: CommsThreadQuery
): Promise<{ threads: CommsThread[]; nextCursor: string | null }> {
  if (view === "system") {
    const threads = await listSystemTimeline(prisma, restaurantId, query);
    return { threads, nextCursor: null };
  }

  await ensureDefaultStaffChannels(prisma, restaurantId);

  const typeFilter: ChatRoomType[] | undefined =
    view === "staff"
      ? ["STAFF"]
      : ["ORDER", "VENUE", "RESERVATION", "TABLE"];

  const limit = Math.min(80, Math.max(1, query?.limit ?? 50));
  const fetchTake = view === "customer" ? Math.min(200, Math.max(limit + 1, 80)) : limit + 1;
  let cursorAt: Date | undefined;
  if (query?.cursor) {
    const cursorRoom = await prisma.chatRoom.findFirst({
      where: { id: query.cursor, restaurantId },
      select: { lastMessageAt: true, createdAt: true }
    });
    cursorAt = cursorRoom?.lastMessageAt ?? cursorRoom?.createdAt;
  }

  const q = query?.q?.trim();
  const rooms = await prisma.chatRoom.findMany({
    where: {
      restaurantId,
      type: { in: typeFilter },
      lifecycle: query?.lifecycle ?? { not: "ARCHIVED" },
      ...(cursorAt ? { lastMessageAt: { lt: cursorAt } } : {}),
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { lastMessagePreview: { contains: q, mode: "insensitive" } },
              { tableLabel: { contains: q, mode: "insensitive" } },
              { order: { customerName: { contains: q, mode: "insensitive" } } },
              { reservation: { confirmationCode: { contains: q, mode: "insensitive" } } }
            ]
          }
        : {})
    },
    orderBy: { lastMessageAt: "desc" },
    take: fetchTake,
    include: roomInclude
  });

  const mapped = rooms.map(mapRoomThread);

  let filtered: CommsThread[];
  if (view === "staff") {
    filtered = mapped.filter((t) => !role || canAccessStaffChannel(role, t.channelKey));
  } else if (view === "customer") {
    filtered = mapped.filter((t) => t.unread);
  } else {
    const open = new Set<string>(OPEN_ORDER_STATUSES);
    filtered = [...mapped].sort((a, b) => {
      const aLife = a.lifecycle === "OPEN" ? 0 : 1;
      const bLife = b.lifecycle === "OPEN" ? 0 : 1;
      if (aLife !== bLife) return aLife - bLife;
      const aOpen = a.orderStatus && open.has(a.orderStatus) ? 0 : 1;
      const bOpen = b.orderStatus && open.has(b.orderStatus) ? 0 : 1;
      if (aOpen !== bOpen) return aOpen - bOpen;
      if (a.unread !== b.unread) return a.unread ? -1 : 1;
      return b.lastMessageAt.localeCompare(a.lastMessageAt);
    });
  }

  if (query?.unread) {
    filtered = filtered.filter((t) => t.unread);
  }

  const page = filtered.slice(0, limit);
  return {
    threads: page,
    nextCursor: filtered.length > limit ? page[page.length - 1]?.id ?? null : null
  };
}

async function listSystemTimeline(
  prisma: PrismaClient,
  restaurantId: string,
  query?: CommsThreadQuery
): Promise<CommsThread[]> {
  const [audits, staffLogs, notes] = await Promise.all([
    prisma.orderAuditLog.findMany({
      where: { restaurantId },
      orderBy: { createdAt: "desc" },
      take: 40,
      select: { id: true, action: true, orderId: true, createdAt: true, actorSource: true }
    }),
    prisma.staffAuditLog.findMany({
      where: { restaurantId },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { id: true, action: true, createdAt: true, targetUserId: true }
    }),
    prisma.notification.findMany({
      where: { restaurantId, category: { in: ["SYSTEM", "ORDER", "PAYMENT"] } },
      orderBy: { createdAt: "desc" },
      take: 30,
      select: { id: true, title: true, body: true, eventKey: true, createdAt: true, payload: true }
    })
  ]);

  const events: CommsThread[] = [
    ...audits.map((a) => ({
      id: `audit:${a.id}`,
      kind: "event" as const,
      type: "SYSTEM" as const,
      name: a.action.replace(/_/g, " "),
      preview: `Order ${a.orderId.slice(0, 8)} · ${a.actorSource}`,
      lastMessageAt: a.createdAt.toISOString(),
      unread: false,
      orderId: a.orderId,
      reservationId: null,
      orderStatus: null,
      customerLabel: null,
      channelKey: null,
      href: `#ws-comms/system-messages`,
      eventKey: a.action,
      entityType: "ORDER",
      entityId: a.orderId
    })),
    ...staffLogs.map((s) => ({
      id: `staff-audit:${s.id}`,
      kind: "event" as const,
      type: "SYSTEM" as const,
      name: String(s.action).replace(/_/g, " "),
      preview: "Staff activity",
      lastMessageAt: s.createdAt.toISOString(),
      unread: false,
      orderId: null,
      reservationId: null,
      orderStatus: null,
      customerLabel: null,
      channelKey: null,
      href: `#top-add-staff`,
      eventKey: String(s.action),
      entityType: "STAFF",
      entityId: s.targetUserId
    })),
    ...notes.map((n) => {
      const payload = (n.payload ?? {}) as Record<string, unknown>;
      return {
        id: `notif:${n.id}`,
        kind: "event" as const,
        type: "SYSTEM" as const,
        name: n.title,
        preview: n.body,
        lastMessageAt: n.createdAt.toISOString(),
        unread: false,
        orderId: typeof payload.orderId === "string" ? payload.orderId : null,
        reservationId: null,
        orderStatus: null,
        customerLabel: null,
        channelKey: null,
        href: typeof payload.href === "string" ? payload.href : `#ws-comms/system-messages`,
        eventKey: n.eventKey,
        entityType: typeof payload.entityType === "string" ? payload.entityType : "SYSTEM",
        entityId: typeof payload.entityId === "string" ? payload.entityId : n.id
      };
    })
  ];

  const q = query?.q?.trim().toLowerCase();
  const sorted = events.sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt));
  const filtered = q
    ? sorted.filter(
        (e) =>
          e.name.toLowerCase().includes(q) ||
          e.preview.toLowerCase().includes(q) ||
          (e.eventKey ?? "").toLowerCase().includes(q)
      )
    : sorted;
  return filtered.slice(0, query?.limit ?? 60);
}

export async function listCommsRoomMessages(
  prisma: PrismaClient,
  restaurantId: string,
  chatRoomId: string,
  viewer: { userId: string; role: "STAFF" | "OWNER" | string },
  page?: { before?: string; after?: string; limit?: number }
): Promise<{ room: CommsThread; messages: SerializedChatMessage[]; nextBefore: string | null }> {
  const room = await prisma.chatRoom.findFirst({
    where: { id: chatRoomId, restaurantId },
    include: roomInclude
  });
  if (!room) throw Object.assign(new Error("room_not_found"), { statusCode: 404 });
  assertCanAccessCommsRoom(viewer.role, room);

  const limit = Math.min(80, Math.max(1, page?.limit ?? 50));
  let createdAtFilter: { gt?: Date; lt?: Date } | undefined;
  if (page?.before || page?.after) {
    const cursorId = page.after ?? page.before!;
    const cursor = await prisma.chatMessage.findFirst({
      where: { id: cursorId, chatRoomId },
      select: { createdAt: true }
    });
    if (cursor) {
      createdAtFilter = page.after ? { gt: cursor.createdAt } : { lt: cursor.createdAt };
    }
  }
  const rows = await prisma.chatMessage.findMany({
    where: {
      chatRoomId,
      ...(createdAtFilter ? { createdAt: createdAtFilter } : {})
    },
    orderBy: { createdAt: page?.after ? "asc" : "desc" },
    take: limit
  });
  const chronological = page?.after ? rows : [...rows].reverse();
  const serializeRole = viewer.role === "OWNER" ? "OWNER" : "STAFF";
  const messages = await serializeMessages(chronological, { userId: viewer.userId, role: serializeRole }, {
    restaurantLastReadAt: room.restaurantLastReadAt,
    customerLastReadAt: room.customerLastReadAt
  });

  return {
    room: mapRoomThread(room),
    messages,
    nextBefore: chronological[0]?.id ?? null
  };
}

export async function getCommsThreadContext(prisma: PrismaClient, restaurantId: string, chatRoomId: string) {
  const room = await prisma.chatRoom.findFirst({
    where: { id: chatRoomId, restaurantId },
    include: {
      order: {
        select: {
          id: true,
          status: true,
          paymentStatus: true,
          displaySeq: true,
          customerName: true,
          tableLabel: true,
          totalCents: true,
          note: true,
          lines: { select: { id: true, nameSnapshot: true, quantity: true, lineTotalCents: true } }
        }
      },
      reservation: {
        select: { id: true, confirmationCode: true, status: true, startsAt: true }
      }
    }
  });
  if (!room) throw Object.assign(new Error("room_not_found"), { statusCode: 404 });

  const order = room.order
    ? {
        id: room.order.id,
        displayNumber: room.order.displaySeq != null ? `#${room.order.displaySeq}` : `#${room.order.id.slice(-4)}`,
        status: room.order.status,
        paymentStatus: room.order.paymentStatus,
        customerName: room.order.customerName ?? "Guest",
        tableLabel: room.order.tableLabel,
        totalCents: room.order.totalCents,
        note: room.order.note,
        items: room.order.lines.map((l) => ({
          id: l.id,
          name: l.nameSnapshot,
          quantity: l.quantity,
          lineTotalCents: l.lineTotalCents
        }))
      }
    : null;

  return {
    roomId: room.id,
    type: room.type,
    table: room.tableId
      ? { tableId: room.tableId, tableLabel: room.tableLabel, sourceSessionId: room.sourceSessionId }
      : null,
    order,
    reservation: room.reservation
      ? {
          id: room.reservation.id,
          confirmationCode: room.reservation.confirmationCode,
          status: room.reservation.status,
          startsAt: room.reservation.startsAt.toISOString()
        }
      : null
  };
}

export async function sendVenueStaffMessage(
  prisma: PrismaClient,
  ctx: MobileAuthContext,
  restaurantId: string,
  chatRoomId: string,
  content: string,
  domainEventBus?: EventEmitter,
  clientMessageId?: string | null
) {
  await requireVenueMembership(prisma, ctx, restaurantId);
  const room = await prisma.chatRoom.findFirst({
    where: { id: chatRoomId, restaurantId }
  });
  if (!room) throw Object.assign(new Error("room_not_found"), { statusCode: 404 });
  if (room.lifecycle === "ARCHIVED" && !room.isSystemChannel) {
    throw Object.assign(new Error("room_archived"), { statusCode: 409 });
  }

  const membership = ctx.memberships.find((m) => m.restaurantId === restaurantId);
  const role = membership?.role ?? "STAFF";
  assertCanAccessCommsRoom(role, room);

  const row = await createChatTextMessage(prisma, {
    chatRoomId,
    senderUserId: ctx.userId,
    senderRole: role,
    content: content.trim(),
    clientMessageId
  });

  const serialized = await serializeMessage(row, { userId: ctx.userId, role: role === "OWNER" ? "OWNER" : "STAFF" }, {
    restaurantLastReadAt: new Date(),
    customerLastReadAt: room.customerLastReadAt
  });

  if (domainEventBus) {
    const href = room.type === "STAFF" ? commsStaffChatHref(chatRoomId) : commsOrderChatHref(chatRoomId);
    await notifyChatMessage(domainEventBus, {
      chatRoomId,
      restaurantId,
      customerUserId: room.customerUserId,
      actorUserId: ctx.userId,
      preview: serialized.content.slice(0, 120),
      href,
      roomType: room.type,
      channelKey: room.channelKey,
      wsPayload: { type: "new_message", message: serialized }
    });
  }

  return serialized;
}

export async function listCommsCatchUp(
  prisma: PrismaClient,
  restaurantId: string,
  since: Date,
  role: string
) {
  const rooms = await prisma.chatRoom.findMany({
    where: { restaurantId, lifecycle: { not: "ARCHIVED" } },
    select: { id: true, type: true, channelKey: true, restaurantId: true }
  });
  const allowed = rooms.filter((r) => canAccessCommsRoom(role, r));
  if (!allowed.length) return [];
  const messages = await prisma.chatMessage.findMany({
    where: { chatRoomId: { in: allowed.map((r) => r.id) }, createdAt: { gt: since } },
    orderBy: { createdAt: "asc" },
    take: 200,
    select: { id: true, chatRoomId: true, createdAt: true, type: true, content: true, senderRole: true }
  });
  return messages.map((m) => ({
    id: m.id,
    chatRoomId: m.chatRoomId,
    createdAt: m.createdAt.toISOString(),
    type: m.type,
    content: m.content,
    senderRole: m.senderRole
  }));
}

export async function listVenueChatThreads(prisma: PrismaClient, restaurantId: string) {
  const { threads } = await listCommsThreads(prisma, restaurantId, "order");
  return threads.map((t) => ({
    id: t.id,
    type: t.type,
    orderId: t.orderId,
    reservationId: t.reservationId,
    orderStatus: t.orderStatus,
    customerLabel: t.customerLabel ?? "Guest",
    preview: t.preview,
    lastMessageAt: t.lastMessageAt,
    unreadForVenue: t.unread
  }));
}

export async function listVenueRoomMessages(
  prisma: PrismaClient,
  restaurantId: string,
  chatRoomId: string,
  viewer?: { userId: string; role: string }
) {
  const { messages } = await listCommsRoomMessages(prisma, restaurantId, chatRoomId, {
    userId: viewer?.userId ?? "",
    role: viewer?.role ?? "STAFF"
  });
  return messages;
}
