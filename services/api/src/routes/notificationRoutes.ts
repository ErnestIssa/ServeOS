import type { EventEmitter } from "node:events";
import type { FastifyInstance } from "fastify";
import type { Prisma, PrismaClient } from "@prisma/client";
import { z } from "zod";
import { requireMobileAuth } from "../lib/mobileAuthContext.js";
import { registerUserDeviceToken, revokeUserDeviceToken } from "../lib/deviceTokenService.js";
import { isPushProviderConfigured } from "../lib/integrations/pushProvider.js";
import { randomUUID } from "node:crypto";
import { publishDomainEvent } from "../notifications/eventBus.js";
import type { DomainEvent } from "../notifications/types.js";

const ingestSchema = z.object({
  type: z.string().min(1),
  restaurantId: z.string().optional(),
  actorUserId: z.string().optional(),
  payload: z.record(z.unknown())
});

export function registerNotificationRoutes(
  app: FastifyInstance,
  prisma: PrismaClient,
  domainEventBus: EventEmitter
) {
  /** Internal event ingestion — same path used by in-process publishers. */
  app.post("/notifications/events", async (req, reply) => {
    const secret = process.env.NOTIFICATION_INGEST_SECRET?.trim();
    if (secret) {
      const hdr = String(req.headers["x-notification-secret"] ?? "");
      if (hdr !== secret) return reply.status(403).send({ ok: false, error: "forbidden" });
    }

    const body = ingestSchema.parse(req.body);
    const event: DomainEvent = {
      id: randomUUID(),
      type: body.type as DomainEvent["type"],
      occurredAt: new Date().toISOString(),
      restaurantId: body.restaurantId ?? null,
      actorUserId: body.actorUserId ?? null,
      payload: body.payload
    };
    await publishDomainEvent(domainEventBus, event);
    return { ok: true, eventId: event.id, queued: true };
  });

  app.get("/notifications", async (req, reply) => {
    const ctx = await requireMobileAuth(req, app, prisma);
    const q = req.query as { limit?: string; unreadOnly?: string };
    const limit = Math.min(50, Math.max(1, Number(q.limit) || 30));
    const rows = await prisma.notification.findMany({
      where: {
        userId: ctx.userId,
        ...(q.unreadOnly === "true" ? { readAt: null } : {})
      },
      orderBy: { createdAt: "desc" },
      take: limit
    });
    return {
      ok: true,
      notifications: rows.map((n) => ({
        id: n.id,
        category: n.category,
        eventKey: n.eventKey,
        title: n.title,
        body: n.body,
        payload: n.payload,
        priority: n.priority,
        channels: n.channels,
        readAt: n.readAt?.toISOString() ?? null,
        createdAt: n.createdAt.toISOString(),
        restaurantId: n.restaurantId
      }))
    };
  });

  app.get("/notifications/unread-count", async (req) => {
    const ctx = await requireMobileAuth(req, app, prisma);
    const count = await prisma.notification.count({
      where: { userId: ctx.userId, readAt: null }
    });
    return { ok: true, count };
  });

  app.patch("/notifications/:id/read", async (req, reply) => {
    const ctx = await requireMobileAuth(req, app, prisma);
    const id = String((req.params as { id: string }).id);
    const row = await prisma.notification.findFirst({
      where: { id, userId: ctx.userId }
    });
    if (!row) return reply.status(404).send({ ok: false, error: "not_found" });
    await prisma.notification.update({
      where: { id },
      data: { readAt: new Date() }
    });
    return { ok: true };
  });

  app.patch("/notifications/read-all", async (req) => {
    const ctx = await requireMobileAuth(req, app, prisma);
    await prisma.notification.updateMany({
      where: { userId: ctx.userId, readAt: null },
      data: { readAt: new Date() }
    });
    return { ok: true };
  });

  app.get("/notifications/preferences", async (req) => {
    const ctx = await requireMobileAuth(req, app, prisma);
    const row = await prisma.userNotificationPreference.findUnique({
      where: { userId: ctx.userId }
    });
    return {
      ok: true,
      preferences: row ?? {
        pushEnabled: true,
        emailEnabled: true,
        smsEnabled: false,
        whatsappEnabled: false,
        quietHours: null,
        categoryFlags: null
      }
    };
  });

  app.patch("/notifications/preferences", async (req) => {
    const ctx = await requireMobileAuth(req, app, prisma);
    const body = z
      .object({
        pushEnabled: z.boolean().optional(),
        emailEnabled: z.boolean().optional(),
        smsEnabled: z.boolean().optional(),
        whatsappEnabled: z.boolean().optional(),
        quietHours: z.record(z.unknown()).nullable().optional(),
        categoryFlags: z.record(z.boolean()).optional()
      })
      .parse(req.body);
    const row = await prisma.userNotificationPreference.upsert({
      where: { userId: ctx.userId },
      create: {
        userId: ctx.userId,
        pushEnabled: body.pushEnabled ?? true,
        emailEnabled: body.emailEnabled ?? true,
        smsEnabled: body.smsEnabled ?? false,
        whatsappEnabled: body.whatsappEnabled ?? false,
        quietHours: (body.quietHours ?? null) as Prisma.InputJsonValue,
        categoryFlags: (body.categoryFlags ?? null) as Prisma.InputJsonValue
      },
      update: {
        ...(body.pushEnabled !== undefined ? { pushEnabled: body.pushEnabled } : {}),
        ...(body.emailEnabled !== undefined ? { emailEnabled: body.emailEnabled } : {}),
        ...(body.smsEnabled !== undefined ? { smsEnabled: body.smsEnabled } : {}),
        ...(body.whatsappEnabled !== undefined ? { whatsappEnabled: body.whatsappEnabled } : {}),
        ...(body.quietHours !== undefined ? { quietHours: body.quietHours as Prisma.InputJsonValue } : {}),
        ...(body.categoryFlags !== undefined ? { categoryFlags: body.categoryFlags as Prisma.InputJsonValue } : {})
      }
    });
    return { ok: true, preferences: row };
  });

  app.post("/notifications/device-tokens", async (req, reply) => {
    const ctx = await requireMobileAuth(req, app, prisma);
    const body = z
      .object({
        token: z.string().min(16),
        platform: z.string().max(32).optional(),
        deviceName: z.string().max(120).optional()
      })
      .parse(req.body);

    const result = await registerUserDeviceToken(prisma, {
      userId: ctx.userId,
      token: body.token,
      platform: body.platform,
      deviceName: body.deviceName
    });
    if (!result.ok) return reply.status(400).send(result);
    return { ok: true, deviceTokenId: result.deviceToken.id, pushConfigured: isPushProviderConfigured() };
  });

  app.delete("/notifications/device-tokens", async (req, reply) => {
    const ctx = await requireMobileAuth(req, app, prisma);
    const body = z.object({ token: z.string().min(16) }).parse(req.body);
    const result = await revokeUserDeviceToken(prisma, ctx.userId, body.token);
    if (!result.ok) return reply.status(404).send(result);
    return { ok: true };
  });
}
