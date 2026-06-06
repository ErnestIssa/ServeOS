import type { OrderStatus, PrismaClient } from "@prisma/client";
import type { MobileAuthContext } from "./mobileAuthContext.js";
import { assertPermission, requireVenueMembership } from "./mobileAuthContext.js";
import { userHasPermission } from "./mobileExperience.js";
import { VENUE_PERMISSION as P } from "./venuePermissions.js";
import {
  createChatTextMessage,
  serializeMessage,
  type SerializedChatMessage
} from "./chatMessageService.js";
import {
  buildOrderTimeline,
  ensureCustomerChatRoom,
  syncOrderRoomSystemMessage
} from "./customerChatHub.js";
import { markCustomerMessagesDeliveredForOrder, markRestaurantReadInRoom } from "./chatReceipts.js";
import { notifyChatMessage } from "../notifications/integrations/chat.js";
import { notifyOclUpdated } from "../notifications/integrations/ocl.js";
import { notifyOrderUpdated } from "../notifications/integrations/orders.js";
import type { EventEmitter } from "node:events";
import { formatMoneyCentsPlain } from "./formatMoney.js";

export type OclTimelineEvent = {
  id: string;
  kind: "system";
  at: string;
  title: string;
  detail?: string;
  status?: string;
};

export type OclAction = {
  id: string;
  label: string;
  nextStatus: string;
  variant: "primary" | "secondary";
};

const NEXT_STATUS: Record<string, OrderStatus> = {
  PENDING: "CONFIRMED",
  CONFIRMED: "PREPARING",
  PREPARING: "READY",
  READY: "COMPLETED"
};

const STATUS_LABEL: Record<string, string> = {
  PENDING: "New",
  CONFIRMED: "Accepted",
  PREPARING: "Preparing",
  READY: "Ready",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled"
};

const STAFF_STATUS_ANNOUNCE: Partial<Record<OrderStatus, string>> = {
  CONFIRMED: "Order accepted by the kitchen",
  PREPARING: "Cooking started",
  READY: "Order is ready for handoff",
  COMPLETED: "Order completed"
};

export function isStatusMarkerContent(raw: string): boolean {
  const marker = raw.split("|")[0] ?? "";
  return /^status:[A-Z_]+$/.test(marker) || /^reservation:[A-Z_]+$/.test(marker);
}

export function parseStatusMarkerContent(raw: string): { status: string; text: string } | null {
  if (!isStatusMarkerContent(raw)) return null;
  const [marker, ...rest] = raw.split("|");
  const text = rest.join("|").trim() || marker;
  if (marker.startsWith("status:")) {
    return { status: marker.replace("status:", ""), text };
  }
  return { status: marker.replace("reservation:", ""), text };
}

export function splitRoomMessagesForOcl(
  rows: Array<{
    id: string;
    content: string;
    type: string;
    senderRole: string;
    senderUserId: string | null;
    createdAt: Date;
  }>
): { timeline: OclTimelineEvent[]; humanIds: Set<string> } {
  const timeline: OclTimelineEvent[] = [];
  const humanIds = new Set<string>();

  for (const row of rows) {
    const parsed = parseStatusMarkerContent(row.content);
    if (parsed) {
      timeline.push({
        id: row.id,
        kind: "system",
        at: row.createdAt.toISOString(),
        title: parsed.text,
        status: parsed.status
      });
      continue;
    }
    if (row.type === "SYSTEM") {
      timeline.push({
        id: row.id,
        kind: "system",
        at: row.createdAt.toISOString(),
        title: row.content
      });
      continue;
    }
    humanIds.add(row.id);
  }

  return { timeline, humanIds };
}

function minutesSince(d: Date) {
  return Math.floor((Date.now() - d.getTime()) / 60_000);
}

export async function loadOrderOclThread(
  prisma: PrismaClient,
  ctx: MobileAuthContext,
  orderId: string
) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      lines: true,
      restaurant: { select: { id: true, name: true } },
      customer: { select: { id: true, email: true } },
      chatRoom: true
    }
  });
  if (!order) throw Object.assign(new Error("order_not_found"), { statusCode: 404 });
  await requireVenueMembership(prisma, ctx, order.restaurantId);

  const canUpdate =
    userHasPermission(ctx.experience, P.ordersUpdateStatus) ||
    userHasPermission(ctx.experience, P.ordersView);

  let chatRoomId = order.chatRoom?.id ?? null;
  if (!chatRoomId && order.customerUserId) {
    chatRoomId = await ensureCustomerChatRoom(prisma, {
      scene: "active_order",
      restaurantId: order.restaurantId,
      customerUserId: order.customerUserId,
      orderId: order.id
    });
  }

  const allMessages = chatRoomId
    ? await prisma.chatMessage.findMany({
        where: { chatRoomId },
        orderBy: { createdAt: "asc" },
        take: 200
      })
    : [];

  const { timeline: markerTimeline, humanIds } = splitRoomMessagesForOcl(allMessages);

  const timeline: OclTimelineEvent[] = [
    {
      id: `created:${order.id}`,
      kind: "system",
      at: order.createdAt.toISOString(),
      title: "Order received",
      detail: `${order.lines.length} items · ${formatMoneyCentsPlain(order.totalCents)}`
    },
    ...markerTimeline
  ];

  const viewerRole =
    ctx.experience.roleType === "CUSTOMER" ? ("CUSTOMER" as const) : ("STAFF" as const);

  const room = chatRoomId
    ? await prisma.chatRoom.findUnique({ where: { id: chatRoomId } })
    : null;

  const messages: SerializedChatMessage[] = allMessages
    .filter((m) => humanIds.has(m.id))
    .map((m) =>
      serializeMessage(m, { userId: ctx.userId, role: viewerRole }, {
        restaurantLastReadAt: room?.restaurantLastReadAt ?? null,
        customerLastReadAt: room?.customerLastReadAt ?? null
      })
    );

  const next = NEXT_STATUS[order.status];
  const actions: OclAction[] = [];
  if (canUpdate && next) {
    actions.push({
      id: `advance:${next}`,
      label: `Mark ${STATUS_LABEL[next] ?? next}`,
      nextStatus: next,
      variant: "primary"
    });
  }
  if (canUpdate && order.status !== "CANCELLED" && order.status !== "COMPLETED") {
    actions.push({
      id: "cancel",
      label: "Cancel order",
      nextStatus: "CANCELLED",
      variant: "secondary"
    });
  }

  return {
    entityType: "order" as const,
    orderId: order.id,
    chatRoomId,
    restaurantId: order.restaurantId,
    header: {
      orderId: order.id,
      shortId: order.id.slice(-6).toUpperCase(),
      status: order.status,
      statusLabel: STATUS_LABEL[order.status] ?? order.status,
      serviceLabel: "Pickup",
      tableLabel: null as string | null,
      totalCents: order.totalCents,
      elapsedMinutes: minutesSince(order.createdAt),
      prepMinutes: order.status === "PREPARING" ? minutesSince(order.updatedAt) : 0,
      customerLabel: order.customer?.email ?? "Guest",
      restaurantName: order.restaurant.name,
      note: order.note
    },
    lines: order.lines.map((l) => ({
      id: l.id,
      name: l.nameSnapshot,
      quantity: l.quantity,
      lineTotalCents: l.lineTotalCents
    })),
    timeline,
    messages,
    actions,
    canSendMessage: !!chatRoomId,
    canUpdateStatus: canUpdate
  };
}

async function publishOrderStatusChatMessage(
  prisma: PrismaClient,
  domainEventBus: EventEmitter | undefined,
  input: {
    order: { id: string; restaurantId: string; customerUserId: string | null; restaurant: { name: string } };
    chatRoomId: string;
    status: OrderStatus;
    actorUserId: string;
  }
) {
  if (!domainEventBus || !input.order.customerUserId) return;
  const seeded = await syncOrderRoomSystemMessage(
    prisma,
    input.chatRoomId,
    input.status,
    input.order.restaurant.name
  );
  if (!seeded) return;
  const room = await prisma.chatRoom.findUnique({ where: { id: input.chatRoomId } });
  const message = serializeMessage(
    seeded,
    { userId: input.order.customerUserId, role: "CUSTOMER" },
    {
      restaurantLastReadAt: room?.restaurantLastReadAt ?? null,
      customerLastReadAt: room?.customerLastReadAt ?? null
    }
  );
  await notifyChatMessage(domainEventBus, {
    chatRoomId: input.chatRoomId,
    restaurantId: input.order.restaurantId,
    customerUserId: input.order.customerUserId,
    actorUserId: input.actorUserId,
    preview: message.content ?? "Order update",
    wsPayload: { type: "new_message", message }
  });
}

/** SSOT order status change — used by legacy PATCH and workspace OCL actions. */
export async function applyOrderStatusOcl(
  prisma: PrismaClient,
  input: { orderId: string; status: OrderStatus; actorUserId: string },
  buses?: { chatBus?: EventEmitter; domainEventBus?: EventEmitter }
) {
  const existing = await prisma.order.findUnique({
    where: { id: input.orderId },
    include: { restaurant: { select: { name: true } }, chatRoom: true }
  });
  if (!existing) throw Object.assign(new Error("order_not_found"), { statusCode: 404 });

  const order = await prisma.order.update({
    where: { id: input.orderId },
    data: { status: input.status },
    include: { restaurant: { select: { name: true } }, chatRoom: true }
  });

  if (
    existing.status === "PENDING" &&
    input.status !== "PENDING" &&
    input.status !== "CANCELLED" &&
    buses?.chatBus
  ) {
    await markCustomerMessagesDeliveredForOrder(prisma, buses.chatBus, order.id);
  }

  let chatRoomId = order.chatRoom?.id ?? null;
  if (!chatRoomId && order.customerUserId) {
    chatRoomId = await ensureCustomerChatRoom(prisma, {
      scene: "active_order",
      restaurantId: order.restaurantId,
      customerUserId: order.customerUserId,
      orderId: order.id
    });
  }

  if (chatRoomId) {
    await publishOrderStatusChatMessage(prisma, buses?.domainEventBus, {
      order,
      chatRoomId,
      status: input.status,
      actorUserId: input.actorUserId
    });
    if (buses?.chatBus) {
      await markRestaurantReadInRoom(prisma, buses.chatBus, chatRoomId);
    }
  }

  if (buses?.domainEventBus) {
    await notifyOrderUpdated(buses.domainEventBus, {
      orderId: order.id,
      restaurantId: order.restaurantId,
      status: order.status,
      totalCents: order.totalCents,
      customerUserId: order.customerUserId
    });
    await notifyOclUpdated(buses.domainEventBus, {
      entityType: "order",
      entityId: order.id,
      orderId: order.id,
      restaurantId: order.restaurantId,
      customerUserId: order.customerUserId,
      actorUserId: input.actorUserId
    });
  }

  return order;
}

/** Customer Orders tab — timeline + header (no staff actions). */
export async function loadCustomerOrderOcl(prisma: PrismaClient, customerUserId: string, orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      lines: true,
      restaurant: { select: { id: true, name: true } },
      chatRoom: true
    }
  });
  if (!order || order.customerUserId !== customerUserId) {
    throw Object.assign(new Error("order_not_found"), { statusCode: 404 });
  }

  let chatRoomId = order.chatRoom?.id ?? null;
  if (!chatRoomId) {
    chatRoomId = await ensureCustomerChatRoom(prisma, {
      scene: "active_order",
      restaurantId: order.restaurantId,
      customerUserId,
      orderId: order.id
    });
  }

  const rawRows = chatRoomId
    ? await prisma.chatMessage.findMany({ where: { chatRoomId }, orderBy: { createdAt: "asc" }, take: 120 })
    : [];
  const { timeline: markerTimeline } = splitRoomMessagesForOcl(rawRows);
  const timeline: OclTimelineEvent[] = [
    {
      id: `created:${order.id}`,
      kind: "system",
      at: order.createdAt.toISOString(),
      title: "Order received",
      detail: `${order.lines.length} items · ${formatMoneyCentsPlain(order.totalCents)}`
    },
    ...markerTimeline
  ];

  return {
    entityType: "order" as const,
    orderId: order.id,
    header: {
      orderId: order.id,
      shortId: order.id.slice(-6).toUpperCase(),
      status: order.status,
      statusLabel: STATUS_LABEL[order.status] ?? order.status,
      restaurantName: order.restaurant.name,
      totalCents: order.totalCents,
      elapsedMinutes: minutesSince(order.createdAt)
    },
    timeline
  };
}

export async function performOclStatusAction(
  prisma: PrismaClient,
  ctx: MobileAuthContext,
  orderId: string,
  nextStatus: OrderStatus,
  opts?: { announceInChat?: boolean; note?: string },
  chatBus?: EventEmitter,
  domainEventBus?: EventEmitter
) {
  assertPermission(ctx, P.ordersUpdateStatus);
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { restaurant: { select: { name: true } }, chatRoom: true }
  });
  if (!order) throw Object.assign(new Error("order_not_found"), { statusCode: 404 });
  await requireVenueMembership(prisma, ctx, order.restaurantId);

  const announce = opts?.announceInChat !== false;
  if (announce) {
    await applyOrderStatusOcl(
      prisma,
      { orderId, status: nextStatus, actorUserId: ctx.userId },
      { chatBus, domainEventBus }
    );
  } else {
    await prisma.order.update({ where: { id: orderId }, data: { status: nextStatus } });
    if (domainEventBus) {
      await notifyOrderUpdated(domainEventBus, {
        orderId: order.id,
        restaurantId: order.restaurantId,
        status: nextStatus,
        totalCents: order.totalCents,
        customerUserId: order.customerUserId
      });
      await notifyOclUpdated(domainEventBus, {
        entityType: "order",
        entityId: order.id,
        orderId: order.id,
        restaurantId: order.restaurantId,
        customerUserId: order.customerUserId,
        actorUserId: ctx.userId
      });
    }
  }

  if (opts?.note?.trim()) {
    let chatRoomId = order.chatRoom?.id ?? null;
    if (!chatRoomId && order.customerUserId) {
      chatRoomId = await ensureCustomerChatRoom(prisma, {
        scene: "active_order",
        restaurantId: order.restaurantId,
        customerUserId: order.customerUserId,
        orderId: order.id
      });
    }
    if (chatRoomId) {
      const membership = ctx.memberships.find((m) => m.restaurantId === order.restaurantId);
      const noteRow = await createChatTextMessage(prisma, {
        chatRoomId,
        senderUserId: ctx.userId,
        senderRole: membership?.role ?? "STAFF",
        content: opts.note.trim()
      });
      if (domainEventBus && order.customerUserId) {
        const room = await prisma.chatRoom.findUnique({ where: { id: chatRoomId } });
        const message = serializeMessage(
          noteRow,
          { userId: order.customerUserId, role: "CUSTOMER" },
          {
            restaurantLastReadAt: room?.restaurantLastReadAt ?? null,
            customerLastReadAt: room?.customerLastReadAt ?? null
          }
        );
        await notifyChatMessage(domainEventBus, {
          chatRoomId,
          restaurantId: order.restaurantId,
          customerUserId: order.customerUserId,
          actorUserId: ctx.userId,
          preview: message.content ?? opts.note.trim(),
          wsPayload: { type: "new_message", message }
        });
        await notifyOclUpdated(domainEventBus, {
          entityType: "order",
          entityId: order.id,
          orderId: order.id,
          restaurantId: order.restaurantId,
          customerUserId: order.customerUserId,
          actorUserId: ctx.userId
        });
      }
    }
  }

  return loadOrderOclThread(prisma, ctx, orderId);
}

export async function sendOclHumanMessage(
  prisma: PrismaClient,
  ctx: MobileAuthContext,
  orderId: string,
  content: string,
  domainEventBus?: EventEmitter
) {
  const thread = await loadOrderOclThread(prisma, ctx, orderId);
  if (!thread.chatRoomId) throw Object.assign(new Error("no_chat_room"), { statusCode: 400 });
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { restaurant: { select: { name: true } } }
  });
  if (!order) throw Object.assign(new Error("order_not_found"), { statusCode: 404 });
  if (ctx.experience.roleType === "CUSTOMER") {
    if (order.customerUserId !== ctx.userId) throw Object.assign(new Error("forbidden"), { statusCode: 403 });
  } else {
    await requireVenueMembership(prisma, ctx, order.restaurantId);
  }
  const membership = ctx.memberships.find((m) => m.restaurantId === order.restaurantId);
  const noteRow = await createChatTextMessage(prisma, {
    chatRoomId: thread.chatRoomId,
    senderUserId: ctx.userId,
    senderRole: membership?.role ?? (ctx.experience.roleType === "CUSTOMER" ? "CUSTOMER" : "STAFF"),
    content
  });
  if (domainEventBus && order.customerUserId) {
    const room = await prisma.chatRoom.findUnique({ where: { id: thread.chatRoomId } });
    const message = serializeMessage(
      noteRow,
      { userId: order.customerUserId, role: "CUSTOMER" },
      {
        restaurantLastReadAt: room?.restaurantLastReadAt ?? null,
        customerLastReadAt: room?.customerLastReadAt ?? null
      }
    );
    await notifyChatMessage(domainEventBus, {
      chatRoomId: thread.chatRoomId,
      restaurantId: order.restaurantId,
      customerUserId: order.customerUserId,
      actorUserId: ctx.userId,
      preview: message.content ?? content,
      wsPayload: { type: "new_message", message }
    });
    await notifyOclUpdated(domainEventBus, {
      entityType: "order",
      entityId: order.id,
      orderId: order.id,
      restaurantId: order.restaurantId,
      customerUserId: order.customerUserId,
      actorUserId: ctx.userId
    });
  }
  return loadOrderOclThread(prisma, ctx, orderId);
}

/** Customer-facing timeline rows for chat hub (no staff-only actions). */
export function buildCustomerHubTimeline(
  status: OrderStatus,
  restaurantName: string,
  markerMessages: Array<{ id: string; content: string; createdAt: Date }>
): Array<{ key: string; content: string; kind: string; at: string }> {
  const { timeline } = splitRoomMessagesForOcl(
    markerMessages.map((m) => ({
      id: m.id,
      content: m.content,
      type: "TEXT",
      senderRole: "STAFF",
      senderUserId: null,
      createdAt: m.createdAt
    }))
  );
  const fromStatus = buildOrderTimeline(status, restaurantName).map((r) => ({
    key: r.key,
    content: r.content,
    kind: "system",
    at: new Date().toISOString()
  }));
  if (timeline.length) {
    return timeline.map((t) => ({
      key: t.id,
      content: t.title,
      kind: "system",
      at: t.at
    }));
  }
  return fromStatus;
}
