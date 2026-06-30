import type { FastifyInstance } from "fastify";
import type { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { requireMenuVenueMembership } from "../lib/menu/menuMembership.js";
import {
  canEditPaymentSettings,
  connectPaymentProvider,
  disconnectPaymentProvider,
  getVenuePaymentSettings,
  getVenuePaymentStats,
  updateVenuePaymentSettings,
  type VenuePaymentSettings
} from "../lib/payments/venuePaymentSettingsService.js";

export function registerVenuePaymentRoutes(app: FastifyInstance, prisma: PrismaClient) {
  app.get("/restaurants/:restaurantId/payment-settings", async (req, reply) => {
    const { restaurantId } = z.object({ restaurantId: z.string().min(1) }).parse(req.params);
    await requireMenuVenueMembership(prisma, req, restaurantId);

    const result = await getVenuePaymentSettings(prisma, restaurantId);
    if (!result.ok) return reply.status(404).send({ ok: false, error: result.error });

    const stats = await getVenuePaymentStats(prisma, restaurantId);
    return { ok: true, settings: result.settings, stats };
  });

  app.patch("/restaurants/:restaurantId/payment-settings", async (req, reply) => {
    const { restaurantId } = z.object({ restaurantId: z.string().min(1) }).parse(req.params);
    const { membership } = await requireMenuVenueMembership(prisma, req, restaurantId);
    if (!canEditPaymentSettings(membership.role, membership.permissions)) {
      return reply.status(403).send({ ok: false, error: "permission_denied" });
    }

    const body = z
      .object({
        methods: z.record(z.boolean()).optional(),
        rules: z.record(z.unknown()).optional(),
        refunds: z.record(z.unknown()).optional(),
        taxes: z.record(z.unknown()).optional(),
        bankAccount: z.record(z.unknown()).optional()
      })
      .parse(req.body ?? {});

    const result = await updateVenuePaymentSettings(prisma, restaurantId, body as Partial<VenuePaymentSettings>);
    if (!result.ok) return reply.status(404).send({ ok: false, error: result.error });
    return { ok: true, settings: result.settings };
  });

  app.post("/restaurants/:restaurantId/payment-settings/connect", async (req, reply) => {
    const { restaurantId } = z.object({ restaurantId: z.string().min(1) }).parse(req.params);
    const body = z
      .object({
        provider: z.enum(["stripe", "swish"]),
        accountId: z.string().max(120).optional(),
        merchantId: z.string().max(120).optional(),
        displayName: z.string().max(80).optional()
      })
      .parse(req.body);
    const { membership } = await requireMenuVenueMembership(prisma, req, restaurantId);
    if (!canEditPaymentSettings(membership.role, membership.permissions)) {
      return reply.status(403).send({ ok: false, error: "permission_denied" });
    }

    const result = await connectPaymentProvider(prisma, restaurantId, body.provider, body);
    if (!result.ok) return reply.status(404).send({ ok: false, error: result.error });
    return { ok: true, settings: result.settings };
  });

  app.post("/restaurants/:restaurantId/payment-settings/disconnect", async (req, reply) => {
    const { restaurantId } = z.object({ restaurantId: z.string().min(1) }).parse(req.params);
    const body = z.object({ provider: z.enum(["stripe", "swish"]) }).parse(req.body);
    const { membership } = await requireMenuVenueMembership(prisma, req, restaurantId);
    if (!canEditPaymentSettings(membership.role, membership.permissions)) {
      return reply.status(403).send({ ok: false, error: "permission_denied" });
    }

    const result = await disconnectPaymentProvider(prisma, restaurantId, body.provider);
    if (!result.ok) return reply.status(404).send({ ok: false, error: result.error });
    return { ok: true, settings: result.settings };
  });
}
