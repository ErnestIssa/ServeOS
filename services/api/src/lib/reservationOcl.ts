import type { CustomerReservationStatus, PrismaClient } from "@prisma/client";
import type { MobileAuthContext } from "./mobileAuthContext.js";
import { assertPermission, requireVenueMembership } from "./mobileAuthContext.js";
import { userHasPermission } from "./mobileExperience.js";
import { VENUE_PERMISSION as P } from "./venuePermissions.js";
import {
  createChatTextMessage,
  serializeMessage,
  serializeMessages,
  type SerializedChatMessage
} from "./chatMessageService.js";
import { splitRoomMessagesForOcl, type OclAction, type OclTimelineEvent } from "./orderOcl.js";
import { markRestaurantReadInRoom } from "./chatReceipts.js";
import { notifyChatMessage } from "../notifications/integrations/chat.js";
import { notifyOclUpdated } from "../notifications/integrations/ocl.js";
import type { EventEmitter } from "node:events";

const STATUS_LABEL: Record<CustomerReservationStatus, string> = {
  CONFIRMED: "Confirmed",
  CANCELLED: "Cancelled",
  COMPLETED: "Completed"
};

const NEXT_STATUS: Partial<Record<CustomerReservationStatus, CustomerReservationStatus>> = {
  CONFIRMED: "COMPLETED"
};

export async function ensureReservationChatRoom(
  prisma: PrismaClient,
  input: { reservationId: string; restaurantId: string; customerUserId: string }
): Promise<string> {
  const existing = await prisma.chatRoom.findUnique({ where: { reservationId: input.reservationId } });
  if (existing) return existing.id;
  const created = await prisma.chatRoom.create({
    data: {
      type: "RESERVATION",
      restaurantId: input.restaurantId,
      reservationId: input.reservationId,
      customerUserId: input.customerUserId
    }
  });
  return created.id;
}

async function seedReservationTimelineMessage(
  prisma: PrismaClient,
  chatRoomId: string,
  marker: string,
  text: string
) {
  const stored = `${marker}|${text}`;
  const recent = await prisma.chatMessage.findMany({
    where: { chatRoomId },
    orderBy: { createdAt: "desc" },
    take: 8
  });
  if (recent.some((m) => m.content === stored || m.content.startsWith(`${marker}|`))) return null;
  const preview = text.length > 120 ? `${text.slice(0, 117)}…` : text;
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

async function publishReservationChatMessage(
  prisma: PrismaClient,
  domainEventBus: EventEmitter | undefined,
  input: {
    chatRoomId: string;
    restaurantId: string;
    customerUserId: string;
    actorUserId: string;
    message: { id: string; chatRoomId: string; senderUserId: string | null; senderRole: string; content: string; type: "TEXT"; createdAt: Date; deliveredToVenueAt: Date | null };
  }
) {
  if (!domainEventBus) return;
  const room = await prisma.chatRoom.findUnique({ where: { id: input.chatRoomId } });
  const serialized = await serializeMessage(input.message, { userId: input.customerUserId, role: "CUSTOMER" }, {
    restaurantLastReadAt: room?.restaurantLastReadAt ?? null,
    customerLastReadAt: room?.customerLastReadAt ?? null
  });
  await notifyChatMessage(domainEventBus, {
    chatRoomId: input.chatRoomId,
    restaurantId: input.restaurantId,
    customerUserId: input.customerUserId,
    actorUserId: input.actorUserId,
    preview: serialized.content ?? "Reservation update",
    wsPayload: { type: "new_message", message: serialized }
  });
}

export async function loadReservationOclThread(
  prisma: PrismaClient,
  ctx: MobileAuthContext,
  reservationId: string
) {
  const row = await prisma.customerReservation.findUnique({
    where: { id: reservationId },
    include: {
      restaurant: { select: { id: true, name: true } },
      user: { select: { id: true, email: true } },
      chatRoom: true
    }
  });
  if (!row) throw Object.assign(new Error("reservation_not_found"), { statusCode: 404 });

  const isCustomer = ctx.experience.roleType === "CUSTOMER";
  if (isCustomer) {
    if (row.userId !== ctx.userId) throw Object.assign(new Error("forbidden"), { statusCode: 403 });
  } else {
    await requireVenueMembership(prisma, ctx, row.restaurantId);
  }

  const canUpdate = !isCustomer && userHasPermission(ctx.experience, P.ordersUpdateStatus);

  let chatRoomId = row.chatRoom?.id ?? null;
  if (!chatRoomId) {
    chatRoomId = await ensureReservationChatRoom(prisma, {
      reservationId: row.id,
      restaurantId: row.restaurantId,
      customerUserId: row.userId
    });
  }

  const allMessages = await prisma.chatMessage.findMany({
    where: { chatRoomId },
    orderBy: { createdAt: "asc" },
    take: 120
  });
  const { timeline: markerTimeline, humanIds } = splitRoomMessagesForOcl(allMessages);
  const timeline: OclTimelineEvent[] = [
    {
      id: `created:${row.id}`,
      kind: "system",
      at: row.createdAt.toISOString(),
      title: "Reservation confirmed",
      detail: `${row.confirmationCode} · ${row.startsAt.toISOString()}`
    },
    ...markerTimeline
  ];

  const room = await prisma.chatRoom.findUnique({ where: { id: chatRoomId } });
  const viewerRole = isCustomer ? ("CUSTOMER" as const) : ("STAFF" as const);
  const messages: SerializedChatMessage[] = await serializeMessages(
    allMessages.filter((m) => humanIds.has(m.id)),
    { userId: ctx.userId, role: viewerRole },
    {
      restaurantLastReadAt: room?.restaurantLastReadAt ?? null,
      customerLastReadAt: room?.customerLastReadAt ?? null
    }
  );

  const next = NEXT_STATUS[row.status];
  const actions: OclAction[] = [];
  if (canUpdate && next) {
    actions.push({
      id: `advance:${next}`,
      label: `Mark ${STATUS_LABEL[next]}`,
      nextStatus: next,
      variant: "primary"
    });
  }
  if (canUpdate && row.status === "CONFIRMED") {
    actions.push({
      id: "cancel",
      label: "Cancel reservation",
      nextStatus: "CANCELLED",
      variant: "secondary"
    });
  }

  const draft = row.draft as { partySize?: number; guestName?: string } | null;

  return {
    entityType: "reservation" as const,
    reservationId: row.id,
    orderId: null as string | null,
    chatRoomId,
    restaurantId: row.restaurantId,
    header: {
      reservationId: row.id,
      shortId: row.confirmationCode,
      status: row.status,
      statusLabel: STATUS_LABEL[row.status],
      serviceLabel: "Table reservation",
      tableLabel: null as string | null,
      startsAt: row.startsAt.toISOString(),
      partySize: typeof draft?.partySize === "number" ? draft.partySize : null,
      customerLabel: row.user.email ?? "Guest",
      restaurantName: row.restaurant.name
    },
    lines: [] as Array<{ id: string; name: string; quantity: number; lineTotalCents: number }>,
    timeline,
    messages,
    actions,
    canSendMessage: !!chatRoomId,
    canUpdateStatus: canUpdate
  };
}

export async function performReservationOclStatusAction(
  prisma: PrismaClient,
  ctx: MobileAuthContext,
  reservationId: string,
  nextStatus: CustomerReservationStatus,
  opts?: { note?: string },
  chatBus?: EventEmitter,
  domainEventBus?: EventEmitter
) {
  assertPermission(ctx, P.ordersUpdateStatus);
  const before = await prisma.customerReservation.findUnique({
    where: { id: reservationId },
    include: { restaurant: { select: { name: true } }, chatRoom: true }
  });
  if (!before) throw Object.assign(new Error("reservation_not_found"), { statusCode: 404 });
  await requireVenueMembership(prisma, ctx, before.restaurantId);

  await prisma.customerReservation.update({
    where: { id: reservationId },
    data: { status: nextStatus }
  });

  let chatRoomId = before.chatRoom?.id ?? null;
  if (!chatRoomId) {
    chatRoomId = await ensureReservationChatRoom(prisma, {
      reservationId: before.id,
      restaurantId: before.restaurantId,
      customerUserId: before.userId
    });
  }

  const label =
    nextStatus === "CANCELLED"
      ? "Reservation cancelled"
      : nextStatus === "COMPLETED"
        ? "Visit completed"
        : "Reservation updated";
  const seeded = await seedReservationTimelineMessage(prisma, chatRoomId, `reservation:${nextStatus}`, label);
  if (seeded && before.userId && domainEventBus) {
    await publishReservationChatMessage(prisma, domainEventBus, {
      chatRoomId,
      restaurantId: before.restaurantId,
      customerUserId: before.userId,
      actorUserId: ctx.userId,
      message: seeded
    });
  }

  if (opts?.note?.trim()) {
    const membership = ctx.memberships.find((m) => m.restaurantId === before.restaurantId);
    const noteRow = await createChatTextMessage(prisma, {
      chatRoomId,
      senderUserId: ctx.userId,
      senderRole: membership?.role ?? "STAFF",
      content: opts.note.trim()
    });
    if (before.userId && domainEventBus) {
      await publishReservationChatMessage(prisma, domainEventBus, {
        chatRoomId,
        restaurantId: before.restaurantId,
        customerUserId: before.userId,
        actorUserId: ctx.userId,
        message: noteRow
      });
    }
  }

  if (chatBus && chatRoomId) {
    await markRestaurantReadInRoom(prisma, chatBus, chatRoomId);
  }

  if (domainEventBus) {
    await notifyOclUpdated(domainEventBus, {
      entityType: "reservation",
      entityId: reservationId,
      reservationId,
      restaurantId: before.restaurantId,
      customerUserId: before.userId,
      actorUserId: ctx.userId
    });
  }

  return loadReservationOclThread(prisma, ctx, reservationId);
}

export async function sendReservationOclHumanMessage(
  prisma: PrismaClient,
  ctx: MobileAuthContext,
  reservationId: string,
  content: string,
  domainEventBus?: EventEmitter
) {
  const thread = await loadReservationOclThread(prisma, ctx, reservationId);
  if (!thread.chatRoomId) throw Object.assign(new Error("no_chat_room"), { statusCode: 400 });
  const row = await prisma.customerReservation.findUnique({ where: { id: reservationId } });
  if (!row) throw Object.assign(new Error("reservation_not_found"), { statusCode: 404 });
  if (ctx.experience.roleType === "CUSTOMER" && row.userId !== ctx.userId) {
    throw Object.assign(new Error("forbidden"), { statusCode: 403 });
  }
  if (ctx.experience.roleType !== "CUSTOMER") {
    await requireVenueMembership(prisma, ctx, row.restaurantId);
  }
  const membership = ctx.memberships.find((m) => m.restaurantId === row.restaurantId);
  const senderRole =
    ctx.experience.roleType === "CUSTOMER" ? "CUSTOMER" : (membership?.role ?? "STAFF");
  const noteRow = await createChatTextMessage(prisma, {
    chatRoomId: thread.chatRoomId,
    senderUserId: ctx.userId,
    senderRole,
    content
  });
  if (domainEventBus && row.userId) {
    await publishReservationChatMessage(prisma, domainEventBus, {
      chatRoomId: thread.chatRoomId,
      restaurantId: row.restaurantId,
      customerUserId: row.userId,
      actorUserId: ctx.userId,
      message: noteRow
    });
    await notifyOclUpdated(domainEventBus, {
      entityType: "reservation",
      entityId: reservationId,
      reservationId,
      restaurantId: row.restaurantId,
      customerUserId: row.userId,
      actorUserId: ctx.userId
    });
  }
  return loadReservationOclThread(prisma, ctx, reservationId);
}

/** Customer-facing reservation timeline (backend SSOT). */
export async function loadCustomerReservationOcl(
  prisma: PrismaClient,
  customerUserId: string,
  reservationId: string
) {
  const row = await prisma.customerReservation.findUnique({
    where: { id: reservationId },
    include: { restaurant: { select: { name: true } }, chatRoom: true }
  });
  if (!row || row.userId !== customerUserId) {
    throw Object.assign(new Error("reservation_not_found"), { statusCode: 404 });
  }
  let chatRoomId = row.chatRoom?.id ?? null;
  if (!chatRoomId) {
    chatRoomId = await ensureReservationChatRoom(prisma, {
      reservationId: row.id,
      restaurantId: row.restaurantId,
      customerUserId: row.userId
    });
  }
  const rawRows = await prisma.chatMessage.findMany({
    where: { chatRoomId },
    orderBy: { createdAt: "asc" },
    take: 120
  });
  const { timeline: markerTimeline } = splitRoomMessagesForOcl(rawRows);
  const timeline: OclTimelineEvent[] = [
    {
      id: `created:${row.id}`,
      kind: "system",
      at: row.createdAt.toISOString(),
      title: "Reservation confirmed",
      detail: `${row.confirmationCode} · ${row.startsAt.toLocaleString()}`
    },
    ...markerTimeline
  ];
  return {
    entityType: "reservation" as const,
    reservationId: row.id,
    header: {
      reservationId: row.id,
      shortId: row.confirmationCode,
      status: row.status,
      statusLabel: STATUS_LABEL[row.status],
      restaurantName: row.restaurant.name,
      startsAt: row.startsAt.toISOString()
    },
    timeline
  };
}
