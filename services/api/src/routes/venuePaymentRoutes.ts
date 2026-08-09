import type { FastifyInstance } from "fastify";
import type { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { requireMenuVenueMembership } from "../lib/menu/menuMembership.js";
import {
  canEditPaymentSettings,
  connectPaymentProvider,
  disconnectPaymentProvider,
  getPaymentProviderEnvReady,
  getVenuePaymentSettings,
  getVenuePaymentStats,
  updateVenuePaymentSettings,
  type VenuePaymentSettings
} from "../lib/payments/venuePaymentSettingsService.js";
import { getPaymentHealthSnapshot } from "../lib/payments/paymentHealthService.js";
import { getTodaysPayments } from "../lib/payments/todaysPaymentsService.js";
import {
  getPaymentActivity,
  getPaymentOverview,
  getPaymentReconciliation,
  getPaymentTransactionDetail,
  getPaymentWebhookHealth,
  listPaymentLogs,
  listPaymentPayouts,
  listPaymentRefunds,
  listPaymentTransactions
} from "../lib/payments/venuePaymentWorkspaceService.js";

export function registerVenuePaymentRoutes(app: FastifyInstance, prisma: PrismaClient) {
  app.get("/restaurants/:restaurantId/payment-settings", async (req, reply) => {
    const { restaurantId } = z.object({ restaurantId: z.string().min(1) }).parse(req.params);
    await requireMenuVenueMembership(prisma, req, restaurantId);

    const result = await getVenuePaymentSettings(prisma, restaurantId);
    if (!result.ok) return reply.status(404).send({ ok: false, error: result.error });

    const stats = await getVenuePaymentStats(prisma, restaurantId);
    return { ok: true, settings: result.settings, stats, envReady: getPaymentProviderEnvReady() };
  });

  app.patch("/restaurants/:restaurantId/payment-settings", async (req, reply) => {
    const { restaurantId } = z.object({ restaurantId: z.string().min(1) }).parse(req.params);
    const { membership, userId } = await requireMenuVenueMembership(prisma, req, restaurantId);
    if (!canEditPaymentSettings(membership.role, membership.permissions)) {
      return reply.status(403).send({ ok: false, error: "permission_denied" });
    }

    const body = z
      .object({
        methods: z.record(z.boolean()).optional(),
        methodConfig: z.record(z.unknown()).optional(),
        rules: z.record(z.unknown()).optional(),
        payAtVenue: z.record(z.unknown()).optional(),
        qrPolicy: z.record(z.unknown()).optional(),
        splits: z.record(z.unknown()).optional(),
        tips: z.record(z.unknown()).optional(),
        failedPayment: z.record(z.unknown()).optional(),
        refunds: z.record(z.unknown()).optional(),
        refundLimits: z.record(z.unknown()).optional(),
        taxes: z.record(z.unknown()).optional(),
        taxDisplay: z.record(z.unknown()).optional(),
        bankAccount: z.record(z.unknown()).optional()
      })
      .parse(req.body ?? {});

    const result = await updateVenuePaymentSettings(prisma, restaurantId, body as Partial<VenuePaymentSettings>, {
      actorUserId: userId,
      actorRole: membership.role,
      action: "payment_settings_updated",
      path: "settings"
    });
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
    const { membership, userId } = await requireMenuVenueMembership(prisma, req, restaurantId);
    if (!canEditPaymentSettings(membership.role, membership.permissions)) {
      return reply.status(403).send({ ok: false, error: "permission_denied" });
    }

    const result = await connectPaymentProvider(prisma, restaurantId, body.provider, body, {
      actorUserId: userId,
      actorRole: membership.role
    });
    if (!result.ok) return reply.status(404).send({ ok: false, error: result.error });
    return {
      ok: true,
      settings: result.settings,
      needsEnv: "needsEnv" in result ? result.needsEnv : false,
      envReady: getPaymentProviderEnvReady()
    };
  });

  app.post("/restaurants/:restaurantId/payment-settings/disconnect", async (req, reply) => {
    const { restaurantId } = z.object({ restaurantId: z.string().min(1) }).parse(req.params);
    const body = z.object({ provider: z.enum(["stripe", "swish"]) }).parse(req.body);
    const { membership, userId } = await requireMenuVenueMembership(prisma, req, restaurantId);
    if (!canEditPaymentSettings(membership.role, membership.permissions)) {
      return reply.status(403).send({ ok: false, error: "permission_denied" });
    }

    const result = await disconnectPaymentProvider(prisma, restaurantId, body.provider, {
      actorUserId: userId,
      actorRole: membership.role
    });
    if (!result.ok) return reply.status(404).send({ ok: false, error: result.error });
    return { ok: true, settings: result.settings };
  });

  app.get("/restaurants/:restaurantId/payments/overview", async (req, reply) => {
    const { restaurantId } = z.object({ restaurantId: z.string().min(1) }).parse(req.params);
    await requireMenuVenueMembership(prisma, req, restaurantId);
    try {
      const overview = await getPaymentOverview(prisma, restaurantId);
      return { ok: true, overview };
    } catch {
      return reply.status(404).send({ ok: false, error: "restaurant_not_found" });
    }
  });

  app.get("/restaurants/:restaurantId/payments/today", async (req, reply) => {
    const { restaurantId } = z.object({ restaurantId: z.string().min(1) }).parse(req.params);
    await requireMenuVenueMembership(prisma, req, restaurantId);
    try {
      const today = await getTodaysPayments(prisma, restaurantId);
      return { ok: true, today };
    } catch {
      return reply.status(404).send({ ok: false, error: "restaurant_not_found" });
    }
  });

  app.get("/restaurants/:restaurantId/payments/health", async (req, reply) => {
    const { restaurantId } = z.object({ restaurantId: z.string().min(1) }).parse(req.params);
    const query = z
      .object({ refresh: z.enum(["1", "true"]).optional() })
      .parse(req.query ?? {});
    await requireMenuVenueMembership(prisma, req, restaurantId);
    try {
      const health = await getPaymentHealthSnapshot(prisma, restaurantId, {
        forceRefresh: query.refresh === "1" || query.refresh === "true"
      });
      return { ok: true, health };
    } catch {
      return reply.status(404).send({ ok: false, error: "restaurant_not_found" });
    }
  });

  app.get("/restaurants/:restaurantId/payments/activity", async (req, reply) => {
    const { restaurantId } = z.object({ restaurantId: z.string().min(1) }).parse(req.params);
    const query = z
      .object({ range: z.enum(["7d", "30d", "90d"]).optional() })
      .parse(req.query ?? {});
    await requireMenuVenueMembership(prisma, req, restaurantId);
    const activity = await getPaymentActivity(prisma, restaurantId, query.range ?? "30d");
    return { ok: true, activity };
  });

  app.get("/restaurants/:restaurantId/payments/transactions", async (req, reply) => {
    const { restaurantId } = z.object({ restaurantId: z.string().min(1) }).parse(req.params);
    const query = z.object({ limit: z.coerce.number().int().min(1).max(200).optional() }).parse(req.query ?? {});
    await requireMenuVenueMembership(prisma, req, restaurantId);
    const result = await listPaymentTransactions(prisma, restaurantId, { limit: query.limit });
    return { ok: true, ...result };
  });

  app.get("/restaurants/:restaurantId/payments/transactions/:transactionId", async (req, reply) => {
    const { restaurantId, transactionId } = z
      .object({ restaurantId: z.string().min(1), transactionId: z.string().min(1) })
      .parse(req.params);
    await requireMenuVenueMembership(prisma, req, restaurantId);
    const transaction = await getPaymentTransactionDetail(prisma, restaurantId, transactionId);
    if (!transaction) return reply.status(404).send({ ok: false, error: "not_found" });
    return { ok: true, transaction };
  });

  app.get("/restaurants/:restaurantId/payments/refunds", async (req, reply) => {
    const { restaurantId } = z.object({ restaurantId: z.string().min(1) }).parse(req.params);
    await requireMenuVenueMembership(prisma, req, restaurantId);
    const result = await listPaymentRefunds(prisma, restaurantId);
    return { ok: true, ...result };
  });

  app.get("/restaurants/:restaurantId/payments/reconciliation", async (req, reply) => {
    const { restaurantId } = z.object({ restaurantId: z.string().min(1) }).parse(req.params);
    await requireMenuVenueMembership(prisma, req, restaurantId);
    const reconciliation = await getPaymentReconciliation(prisma, restaurantId);
    return { ok: true, reconciliation };
  });

  app.get("/restaurants/:restaurantId/payments/payouts", async (req, reply) => {
    const { restaurantId } = z.object({ restaurantId: z.string().min(1) }).parse(req.params);
    await requireMenuVenueMembership(prisma, req, restaurantId);
    const result = await listPaymentPayouts(prisma, restaurantId);
    return { ok: true, ...result };
  });

  app.get("/restaurants/:restaurantId/payments/webhooks/health", async (req, reply) => {
    const { restaurantId } = z.object({ restaurantId: z.string().min(1) }).parse(req.params);
    await requireMenuVenueMembership(prisma, req, restaurantId);
    const health = await getPaymentWebhookHealth(prisma, restaurantId);
    return { ok: true, health };
  });

  app.get("/restaurants/:restaurantId/payments/logs", async (req, reply) => {
    const { restaurantId } = z.object({ restaurantId: z.string().min(1) }).parse(req.params);
    await requireMenuVenueMembership(prisma, req, restaurantId);
    const result = await listPaymentLogs(prisma, restaurantId);
    return { ok: true, ...result };
  });
}
