import type { EventEmitter } from "node:events";
import type { FastifyBaseLogger } from "fastify";
import type { PrismaClient } from "@prisma/client";
import type { DomainEvent } from "../../notifications/types.js";
import { claimProjection } from "./processedDomainEvent.js";
import { shouldProjectChatTimeline } from "./communicationProjections.js";

/**
 * Events that may appear as SYSTEM lines in a conversation.
 * Order/reservation status lines are written by OCL seeders (status:/reservation: markers).
 * This projector only writes payment lines so those seeds are not duplicated.
 */
export const CHAT_TIMELINE_EVENT_TYPES = new Set<string>([
  "order.created",
  "order.updated",
  "order.delivered",
  "order.refunded",
  "payment.succeeded",
  "payment.failed",
  "reservation.confirmed",
  "reservation.cancelled"
]);

const PROJECT_HERE = new Set(["payment.succeeded", "payment.failed"]);

const STATUS_COPY: Record<string, string> = {
  "payment.succeeded": "Payment confirmed",
  "payment.failed": "Payment failed"
};

function timelineText(event: DomainEvent): string | null {
  if (!shouldProjectChatTimeline(event.type)) return null;
  if (!PROJECT_HERE.has(event.type)) return null;
  return STATUS_COPY[event.type] ?? null;
}

async function resolveRoomId(prisma: PrismaClient, event: DomainEvent): Promise<string | null> {
  const chatRoomId = typeof event.payload.chatRoomId === "string" ? event.payload.chatRoomId : null;
  if (chatRoomId) return chatRoomId;
  const orderId = typeof event.payload.orderId === "string" ? event.payload.orderId : null;
  if (orderId) {
    const room = await prisma.chatRoom.findUnique({ where: { orderId }, select: { id: true } });
    return room?.id ?? null;
  }
  const reservationId = typeof event.payload.reservationId === "string" ? event.payload.reservationId : null;
  if (reservationId) {
    const room = await prisma.chatRoom.findUnique({
      where: { reservationId },
      select: { id: true }
    });
    return room?.id ?? null;
  }
  return null;
}

/** Project a domain event into at most one SYSTEM chat line. Never mutates order/payment state. */
export async function projectChatTimeline(prisma: PrismaClient, event: DomainEvent): Promise<void> {
  const text = timelineText(event);
  if (!text) return;
  const claimed = await claimProjection(prisma, event, "chat_timeline");
  if (!claimed) return;

  const chatRoomId = await resolveRoomId(prisma, event);
  if (!chatRoomId) return;

  const existing = await prisma.chatMessage.findFirst({
    where: { chatRoomId, sourceEventId: event.id }
  });
  if (existing) return;

  const now = new Date();
  try {
    await prisma.$transaction(async (tx) => {
      await tx.chatMessage.create({
        data: {
          chatRoomId,
          senderUserId: null,
          senderRole: "SYSTEM",
          content: text,
          type: "SYSTEM",
          sourceEventId: event.id
        }
      });
      await tx.chatRoom.update({
        where: { id: chatRoomId },
        data: {
          lastMessageAt: now,
          lastMessagePreview: text.slice(0, 120),
          lastMessageSenderRole: "SYSTEM",
          updatedAt: now
        }
      });
    });
  } catch {
    /* unique sourceEventId — already projected */
  }
}

export function startChatTimelineProcessor(
  prisma: PrismaClient,
  bus: EventEmitter,
  log: FastifyBaseLogger
): void {
  bus.on("domain-event", (event: DomainEvent) => {
    void projectChatTimeline(prisma, event).catch((err) => {
      log.error({ err, eventId: event.id, type: event.type }, "chat_timeline_project_failed");
    });
  });
}
