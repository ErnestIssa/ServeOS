import type { FastifyInstance } from "fastify";
import type { PrismaClient } from "@prisma/client";
import { z } from "zod";
import {
  loadMobileAuthContext,
  requireMobileAuth,
  setActiveRestaurantForUser
} from "../lib/mobileAuthContext.js";
import {
  buildWorkspaceContext,
  loadWorkspaceScreenData,
  assertUserMayOpenScreen
} from "../lib/mobileWorkspaceService.js";
import {
  loadWorkspaceTabData,
  clockInShift,
  clockOutShift,
  toggleBreakShift
} from "../lib/workspaceTabService.js";
import { dismissTask } from "../lib/staffTasksBuilder.js";
import {
  listVenueRoomMessages,
  sendVenueStaffMessage
} from "../lib/staffVenueChat.js";
import { markRestaurantReadInRoom } from "../lib/chatReceipts.js";
import { loadOrderOclThread, performOclStatusAction, sendOclHumanMessage } from "../lib/orderOcl.js";
import {
  loadReservationOclThread,
  performReservationOclStatusAction,
  sendReservationOclHumanMessage
} from "../lib/reservationOcl.js";
import type { EventEmitter } from "node:events";

export function registerMobileWorkspaceRoutes(
  app: FastifyInstance,
  prisma: PrismaClient,
  chatBus?: EventEmitter,
  domainEventBus?: EventEmitter
) {
  app.get("/workspace/context", async (req, reply) => {
    const ctx = await requireMobileAuth(req, app, prisma);
    if (ctx.experience.roleType === "CUSTOMER") {
      return reply.status(403).send({ ok: false, error: "customer_use_customer_routes" });
    }
    if (ctx.venueAccessState !== "active") {
      return reply.status(403).send({ ok: false, error: "pending_approval" });
    }
    return { ok: true, context: await buildWorkspaceContext(prisma, ctx) };
  });

  app.patch("/workspace/active-restaurant", async (req, reply) => {
    const ctx = await requireMobileAuth(req, app, prisma);
    const body = z.object({ restaurantId: z.string().min(1) }).parse(req.body);
    if (ctx.experience.roleType === "CUSTOMER") {
      return reply.status(403).send({ ok: false, error: "customer_use_customer_routes" });
    }
    if (ctx.venueAccessState !== "active") {
      return reply.status(403).send({ ok: false, error: "pending_approval" });
    }
    const m = ctx.memberships.find((x) => x.restaurantId === body.restaurantId.trim());
    if (!m) return reply.status(403).send({ ok: false, error: "venue_access_denied" });
    await setActiveRestaurantForUser(prisma, ctx.userId, body.restaurantId);
    const fresh = await loadMobileAuthContext(prisma, ctx.userId);
    if (!fresh) return reply.status(404).send({ ok: false, error: "user_not_found" });
    return {
      ok: true,
      activeRestaurantId: fresh.activeRestaurantId,
      context: await buildWorkspaceContext(prisma, fresh)
    };
  });

  app.get<{ Params: { orderId: string } }>("/workspace/orders/:orderId/ocl", async (req, reply) => {
    const ctx = await requireMobileAuth(req, app, prisma);
    if (ctx.experience.roleType === "CUSTOMER") {
      return reply.status(403).send({ ok: false, error: "customer_use_customer_routes" });
    }
    if (ctx.venueAccessState !== "active") {
      return reply.status(403).send({ ok: false, error: "pending_approval" });
    }
    try {
      const thread = await loadOrderOclThread(prisma, ctx, req.params.orderId);
      if (thread.chatRoomId && chatBus) {
        await markRestaurantReadInRoom(prisma, chatBus, thread.chatRoomId);
      }
      return { ok: true, thread };
    } catch (e) {
      const err = e as { statusCode?: number; message?: string };
      return reply.status(err.statusCode ?? 500).send({ ok: false, error: err.message ?? "error" });
    }
  });

  app.post<{ Params: { orderId: string } }>("/workspace/orders/:orderId/ocl/status", async (req, reply) => {
    const ctx = await requireMobileAuth(req, app, prisma);
    if (ctx.venueAccessState !== "active") {
      return reply.status(403).send({ ok: false, error: "pending_approval" });
    }
    const body = z
      .object({
        status: z.enum(["PENDING", "CONFIRMED", "PREPARING", "READY", "COMPLETED", "CANCELLED"]),
        announceInChat: z.boolean().optional(),
        note: z.string().max(500).optional()
      })
      .parse(req.body);
    try {
      const thread = await performOclStatusAction(
        prisma,
        ctx,
        req.params.orderId,
        body.status,
        { announceInChat: body.announceInChat, note: body.note },
        chatBus,
        domainEventBus
      );
      return { ok: true, thread };
    } catch (e) {
      const err = e as { statusCode?: number; message?: string };
      return reply.status(err.statusCode ?? 500).send({ ok: false, error: err.message ?? "error" });
    }
  });

  app.post<{ Params: { orderId: string } }>("/workspace/orders/:orderId/ocl/message", async (req, reply) => {
    const ctx = await requireMobileAuth(req, app, prisma);
    if (ctx.venueAccessState !== "active") {
      return reply.status(403).send({ ok: false, error: "pending_approval" });
    }
    const body = z.object({ content: z.string().min(1).max(2000) }).parse(req.body);
    try {
      const thread = await sendOclHumanMessage(
        prisma,
        ctx,
        req.params.orderId,
        body.content,
        domainEventBus
      );
      return { ok: true, thread };
    } catch (e) {
      const err = e as { statusCode?: number; message?: string };
      return reply.status(err.statusCode ?? 500).send({ ok: false, error: err.message ?? "error" });
    }
  });

  app.get<{ Params: { reservationId: string } }>(
    "/workspace/reservations/:reservationId/ocl",
    async (req, reply) => {
      const ctx = await requireMobileAuth(req, app, prisma);
      if (ctx.experience.roleType === "CUSTOMER") {
        return reply.status(403).send({ ok: false, error: "customer_use_customer_routes" });
      }
      if (ctx.venueAccessState !== "active") {
        return reply.status(403).send({ ok: false, error: "pending_approval" });
      }
      try {
        const thread = await loadReservationOclThread(prisma, ctx, req.params.reservationId);
        if (thread.chatRoomId && chatBus) {
          await markRestaurantReadInRoom(prisma, chatBus, thread.chatRoomId);
        }
        return { ok: true, thread };
      } catch (e) {
        const err = e as { statusCode?: number; message?: string };
        return reply.status(err.statusCode ?? 500).send({ ok: false, error: err.message ?? "error" });
      }
    }
  );

  app.post<{ Params: { reservationId: string } }>(
    "/workspace/reservations/:reservationId/ocl/status",
    async (req, reply) => {
      const ctx = await requireMobileAuth(req, app, prisma);
      if (ctx.venueAccessState !== "active") {
        return reply.status(403).send({ ok: false, error: "pending_approval" });
      }
      const body = z
        .object({
          status: z.enum(["CONFIRMED", "CANCELLED", "COMPLETED"]),
          note: z.string().max(500).optional()
        })
        .parse(req.body);
      try {
        const thread = await performReservationOclStatusAction(
          prisma,
          ctx,
          req.params.reservationId,
          body.status,
          { note: body.note },
          chatBus,
          domainEventBus
        );
        return { ok: true, thread };
      } catch (e) {
        const err = e as { statusCode?: number; message?: string };
        return reply.status(err.statusCode ?? 500).send({ ok: false, error: err.message ?? "error" });
      }
    }
  );

  app.post<{ Params: { reservationId: string } }>(
    "/workspace/reservations/:reservationId/ocl/message",
    async (req, reply) => {
      const ctx = await requireMobileAuth(req, app, prisma);
      if (ctx.venueAccessState !== "active") {
        return reply.status(403).send({ ok: false, error: "pending_approval" });
      }
      const body = z.object({ content: z.string().min(1).max(2000) }).parse(req.body);
      try {
        const thread = await sendReservationOclHumanMessage(
          prisma,
          ctx,
          req.params.reservationId,
          body.content,
          domainEventBus
        );
        return { ok: true, thread };
      } catch (e) {
        const err = e as { statusCode?: number; message?: string };
        return reply.status(err.statusCode ?? 500).send({ ok: false, error: err.message ?? "error" });
      }
    }
  );

  app.get<{ Params: { tabKey: string } }>("/workspace/tabs/:tabKey", async (req, reply) => {
    const ctx = await requireMobileAuth(req, app, prisma);
    if (ctx.experience.roleType === "CUSTOMER") {
      return reply.status(403).send({ ok: false, error: "customer_use_customer_routes" });
    }
    if (ctx.venueAccessState !== "active") {
      return reply.status(403).send({ ok: false, error: "pending_approval" });
    }
    const q = req.query as { restaurantId?: string; filter?: string; queueMode?: string };
    try {
      const data = await loadWorkspaceTabData(prisma, ctx, req.params.tabKey, {
        restaurantId: typeof q.restaurantId === "string" ? q.restaurantId : undefined,
        filter: typeof q.filter === "string" ? q.filter : undefined,
        queueMode: typeof q.queueMode === "string" ? q.queueMode : undefined
      });
      return { ok: true, ...data };
    } catch (e) {
      const err = e as { statusCode?: number; message?: string };
      return reply.status(err.statusCode ?? 500).send({ ok: false, error: err.message ?? "error" });
    }
  });

  app.post("/workspace/shift/clock-in", async (req, reply) => {
    const ctx = await requireMobileAuth(req, app, prisma);
    const body = z.object({ restaurantId: z.string().min(1) }).parse(req.body ?? {});
    if (ctx.venueAccessState !== "active") {
      return reply.status(403).send({ ok: false, error: "pending_approval" });
    }
    const state = await clockInShift(ctx.userId, body.restaurantId.trim());
    return { ok: true, shift: state };
  });

  app.post("/workspace/shift/clock-out", async (req, reply) => {
    const ctx = await requireMobileAuth(req, app, prisma);
    const body = z.object({ restaurantId: z.string().min(1) }).parse(req.body ?? {});
    const state = await clockOutShift(ctx.userId, body.restaurantId.trim());
    return { ok: true, shift: state };
  });

  app.post("/workspace/shift/break-toggle", async (req, reply) => {
    const ctx = await requireMobileAuth(req, app, prisma);
    const body = z.object({ restaurantId: z.string().min(1) }).parse(req.body ?? {});
    try {
      const state = await toggleBreakShift(ctx.userId, body.restaurantId.trim());
      return { ok: true, shift: state };
    } catch (e) {
      const err = e as { statusCode?: number; message?: string };
      return reply.status(err.statusCode ?? 400).send({ ok: false, error: err.message ?? "error" });
    }
  });

  app.post("/workspace/tasks/dismiss", async (req, reply) => {
    const ctx = await requireMobileAuth(req, app, prisma);
    const body = z.object({ restaurantId: z.string().min(1), taskId: z.string().min(1) }).parse(req.body);
    await dismissTask(ctx.userId, body.restaurantId.trim(), body.taskId.trim());
    return { ok: true };
  });

  app.get<{ Params: { screenKey: string } }>("/workspace/screens/:screenKey", async (req, reply) => {
    const ctx = await requireMobileAuth(req, app, prisma);
    const { screenKey } = req.params;
    if (!assertUserMayOpenScreen(ctx, screenKey)) {
      return reply.status(403).send({ ok: false, error: "screen_not_allowed" });
    }
    const q = req.query as { restaurantId?: string };
    try {
      const data = await loadWorkspaceScreenData(
        prisma,
        ctx,
        screenKey,
        typeof q.restaurantId === "string" ? q.restaurantId : undefined
      );
      return { ok: true, ...data };
    } catch (e) {
      const err = e as { statusCode?: number; message?: string };
      return reply.status(err.statusCode ?? 500).send({ ok: false, error: err.message ?? "error" });
    }
  });

  app.get("/restaurants/:restaurantId/chat/rooms/:chatRoomId/messages", async (req, reply) => {
    const ctx = await requireMobileAuth(req, app, prisma);
    const { restaurantId, chatRoomId } = req.params as { restaurantId: string; chatRoomId: string };
    if (ctx.venueAccessState !== "active") {
      return reply.status(403).send({ ok: false, error: "pending_approval" });
    }
    try {
      const messages = await listVenueRoomMessages(prisma, restaurantId, chatRoomId);
      if (chatBus) {
        await markRestaurantReadInRoom(prisma, chatBus, chatRoomId);
      }
      return { ok: true, messages };
    } catch (e) {
      const err = e as { statusCode?: number; message?: string };
      return reply.status(err.statusCode ?? 500).send({ ok: false, error: err.message ?? "error" });
    }
  });

  app.post("/restaurants/:restaurantId/chat/rooms/:chatRoomId/messages", async (req, reply) => {
    const ctx = await requireMobileAuth(req, app, prisma);
    const { restaurantId, chatRoomId } = req.params as { restaurantId: string; chatRoomId: string };
    const body = z.object({ content: z.string().min(1).max(2000) }).parse(req.body);
    try {
      const message = await sendVenueStaffMessage(prisma, ctx, restaurantId, chatRoomId, body.content);
      return { ok: true, message };
    } catch (e) {
      const err = e as { statusCode?: number; message?: string };
      return reply.status(err.statusCode ?? 500).send({ ok: false, error: err.message ?? "error" });
    }
  });
}
