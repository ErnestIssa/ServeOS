import type { EventEmitter } from "node:events";
import type { FastifyInstance } from "fastify";
import type { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { requireMobileAuth, requireVenueMembership } from "../lib/auth/mobileAuthContext.js";
import { markRestaurantReadInRoom } from "../lib/chat/chatReceipts.js";
import { staffRoleForVenue, assertCanAccessCommsRoom } from "../lib/chat/chatAccess.js";
import { limitChatMessages } from "../lib/chat/chatRateLimit.js";
import {
  getCommsThreadContext,
  listCommsCatchUp,
  listCommsRoomMessages,
  listCommsThreads,
  sendVenueStaffMessage,
  type CommsView
} from "../lib/chat/venueCommsHub.js";

const viewSchema = z.enum(["order", "customer", "staff", "system"]);

export function registerVenueCommsRoutes(
  app: FastifyInstance,
  prisma: PrismaClient,
  chatBus: EventEmitter,
  domainEventBus: EventEmitter
) {
  app.get("/restaurants/:restaurantId/comms/threads", async (req) => {
    const ctx = await requireMobileAuth(req, app, prisma);
    const { restaurantId } = req.params as { restaurantId: string };
    await requireVenueMembership(prisma, ctx, restaurantId);
    const q = req.query as {
      view?: string;
      q?: string;
      unread?: string;
      lifecycle?: string;
      cursor?: string;
      limit?: string;
    };
    const parsed = viewSchema.safeParse(q.view ?? "order");
    const view: CommsView = parsed.success ? parsed.data : "order";
    const role = staffRoleForVenue(ctx, restaurantId);
    const lifecycle = q.lifecycle === "OPEN" || q.lifecycle === "RESOLVED" ? q.lifecycle : undefined;
    const { threads, nextCursor } = await listCommsThreads(prisma, restaurantId, view, role, {
      q: q.q,
      unread: q.unread === "true",
      lifecycle,
      cursor: q.cursor,
      limit: q.limit ? Number(q.limit) : undefined
    });
    return { ok: true, view, threads, nextCursor };
  });

  app.get("/restaurants/:restaurantId/comms/catch-up", async (req, reply) => {
    const ctx = await requireMobileAuth(req, app, prisma);
    const { restaurantId } = req.params as { restaurantId: string };
    await requireVenueMembership(prisma, ctx, restaurantId);
    const q = req.query as { since?: string };
    const since = q.since ? new Date(q.since) : new Date(Date.now() - 60_000);
    if (Number.isNaN(since.getTime())) return reply.status(400).send({ ok: false, error: "invalid_since" });
    const role = staffRoleForVenue(ctx, restaurantId) ?? "STAFF";
    const messages = await listCommsCatchUp(prisma, restaurantId, since, role);
    return { ok: true, messages, since: since.toISOString() };
  });

  app.get("/restaurants/:restaurantId/comms/threads/:chatRoomId", async (req, reply) => {
    const ctx = await requireMobileAuth(req, app, prisma);
    const { restaurantId, chatRoomId } = req.params as { restaurantId: string; chatRoomId: string };
    await requireVenueMembership(prisma, ctx, restaurantId);
    try {
      const role = staffRoleForVenue(ctx, restaurantId) ?? "STAFF";
      const q = req.query as { before?: string; after?: string; limit?: string };
      const result = await listCommsRoomMessages(prisma, restaurantId, chatRoomId, {
        userId: ctx.userId,
        role
      }, {
        before: q.before,
        after: q.after,
        limit: q.limit ? Number(q.limit) : undefined
      });
      await markRestaurantReadInRoom(prisma, chatBus, chatRoomId);
      return { ok: true, ...result };
    } catch (e) {
      const err = e as { statusCode?: number; message?: string };
      return reply.status(err.statusCode ?? 500).send({ ok: false, error: err.message ?? "error" });
    }
  });

  app.get("/restaurants/:restaurantId/comms/threads/:chatRoomId/context", async (req, reply) => {
    const ctx = await requireMobileAuth(req, app, prisma);
    const { restaurantId, chatRoomId } = req.params as { restaurantId: string; chatRoomId: string };
    await requireVenueMembership(prisma, ctx, restaurantId);
    try {
      const room = await prisma.chatRoom.findFirst({
        where: { id: chatRoomId, restaurantId },
        select: { type: true, channelKey: true, restaurantId: true }
      });
      if (!room) return reply.status(404).send({ ok: false, error: "room_not_found" });
      assertCanAccessCommsRoom(staffRoleForVenue(ctx, restaurantId), room);
      const context = await getCommsThreadContext(prisma, restaurantId, chatRoomId);
      return { ok: true, context };
    } catch (e) {
      const err = e as { statusCode?: number; message?: string };
      return reply.status(err.statusCode ?? 500).send({ ok: false, error: err.message ?? "error" });
    }
  });

  app.post("/restaurants/:restaurantId/comms/threads/:chatRoomId/messages", async (req, reply) => {
    const ctx = await requireMobileAuth(req, app, prisma);
    const { restaurantId, chatRoomId } = req.params as { restaurantId: string; chatRoomId: string };
    const limited = await limitChatMessages(ctx.userId);
    if (!limited.ok) return reply.status(429).send({ ok: false, error: "rate_limited", retryAfterSec: limited.retryAfterSec });
    const body = z
      .object({
        content: z.string().min(1).max(2000),
        clientMessageId: z.string().uuid().optional()
      })
      .parse(req.body);
    try {
      const message = await sendVenueStaffMessage(
        prisma,
        ctx,
        restaurantId,
        chatRoomId,
        body.content,
        domainEventBus,
        body.clientMessageId
      );
      return { ok: true, message };
    } catch (e) {
      const err = e as { statusCode?: number; message?: string };
      return reply.status(err.statusCode ?? 500).send({ ok: false, error: err.message ?? "error" });
    }
  });

  app.get("/restaurants/:restaurantId/comms/audit", async (req) => {
    const ctx = await requireMobileAuth(req, app, prisma);
    const { restaurantId } = req.params as { restaurantId: string };
    await requireVenueMembership(prisma, ctx, restaurantId);
    const { threads } = await listCommsThreads(prisma, restaurantId, "system");
    return { ok: true, events: threads };
  });
}
