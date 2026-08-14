import type { FastifyInstance } from "fastify";
import type { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { requireMenuVenueMembership } from "../lib/menu/menuMembership.js";
import {
  METHOD_DISABLE_POLICY,
  SERVEOS_PAYMENT_CATALOG_VERSION,
  canEditPaymentSettings,
  connectPaymentProvider,
  disconnectPaymentProvider,
  evaluatePaymentFeatureGates,
  getPaymentActivity,
  getPaymentHealthIssueDetail,
  getPaymentHealthSnapshot,
  getPaymentMethodSetupContract,
  getPaymentOverview,
  getPaymentProviderEnvReady,
  getPaymentReconciliation,
  getPaymentTransactionDetail,
  getPaymentWebhookHealth,
  getTodaysPayments,
  getTodaysPaymentsDetail,
  getVenuePaymentMethodsPayload,
  getVenuePaymentSettings,
  getVenuePaymentStats,
  listPaymentLogs,
  listPaymentPayouts,
  listPaymentRefunds,
  listPaymentTransactions,
  listProviderSurfaces,
  mapOrderSourceToPreferenceContext,
  resolveEligiblePaymentMethods,
  resolvePaymentPreferencePolicy,
  runAndPersistProviderHealthCheck,
  toPublicVenuePaymentSettings,
  publicProviderConnectionLabels,
  updateVenuePaymentSettings,
  startOrResumePaymentSetupSession,
  submitPaymentSetupSessionStep,
  materializeSetupSession,
  getStoredSetupSession,
  verifyAndPersistMethodAdapter,
  verifyAndPersistProviderConnection,
  buildPaymentMethodDangerZone,
  createPaymentMethodDangerChallenge,
  executePaymentMethodDangerAction,
  getVenuePaymentPlatformSnapshot,
  startServeosManagedOnboarding,
  syncVenuePaymentAccountFromProvider,
  refreshServeosManagedOnboardingLink,
  methodsUnlockedByActiveCapabilities,
  type VenuePaymentSettings
} from "../lib/payments/index.js";

export function registerVenuePaymentRoutes(app: FastifyInstance, prisma: PrismaClient) {
  app.get("/restaurants/:restaurantId/payment-settings", async (req, reply) => {
    const { restaurantId } = z.object({ restaurantId: z.string().min(1) }).parse(req.params);
    await requireMenuVenueMembership(prisma, req, restaurantId);

    const result = await getVenuePaymentSettings(prisma, restaurantId);
    if (!result.ok) return reply.status(404).send({ ok: false, error: result.error });

    const envReady = getPaymentProviderEnvReady();
    const stats = await getVenuePaymentStats(prisma, restaurantId);
    const platform = await getVenuePaymentPlatformSnapshot(prisma, restaurantId);
    const unlocked = methodsUnlockedByActiveCapabilities(platform.primaryAccount);
    const methodCapabilities = getVenuePaymentMethodsPayload(result.settings, {
      unlockedMethodKeys: unlocked.size ? unlocked : undefined,
      hasManagedAccount: Boolean(platform.primaryAccount)
    });
    const featureGates = evaluatePaymentFeatureGates(result.settings, envReady);

    return {
      ok: true,
      settings: toPublicVenuePaymentSettings(result.settings),
      stats,
      envReady,
      catalogVersion: SERVEOS_PAYMENT_CATALOG_VERSION,
      methodCapabilities,
      featureGates,
      paymentPlatform: platform,
      disablePolicy: METHOD_DISABLE_POLICY
    };
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
        defaultPaymentMethodKey: z.string().nullable().optional(),
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
        bankAccount: z.record(z.unknown()).optional(),
        preferencePolicies: z.record(z.unknown()).optional()
      })
      .parse(req.body ?? {});

    const result = await updateVenuePaymentSettings(prisma, restaurantId, body as Partial<VenuePaymentSettings>, {
      actorUserId: userId,
      actorRole: membership.role,
      action: "payment_settings_updated",
      path: "settings"
    });
    if (!result.ok) {
      const status = result.error === "method_not_ready" ? 409 : 404;
      return reply.status(status).send({
        ok: false,
        error: result.error,
        message: "message" in result ? result.message : undefined
      });
    }
    return {
      ok: true,
      settings: toPublicVenuePaymentSettings(result.settings),
      methodCapabilities: getVenuePaymentMethodsPayload(result.settings),
      featureGates: evaluatePaymentFeatureGates(result.settings, getPaymentProviderEnvReady()),
      disablePolicy: METHOD_DISABLE_POLICY
    };
  });

  app.get("/restaurants/:restaurantId/payments/platform", async (req, reply) => {
    const { restaurantId } = z.object({ restaurantId: z.string().min(1) }).parse(req.params);
    await requireMenuVenueMembership(prisma, req, restaurantId);
    const platform = await getVenuePaymentPlatformSnapshot(prisma, restaurantId);
    return { ok: true, paymentPlatform: platform, envReady: getPaymentProviderEnvReady() };
  });

  app.post("/restaurants/:restaurantId/payments/onboarding/start", async (req, reply) => {
    const { restaurantId } = z.object({ restaurantId: z.string().min(1) }).parse(req.params);
    const body = z
      .object({
        returnUrl: z.string().url(),
        refreshUrl: z.string().url(),
        country: z.string().length(2).optional(),
        email: z.string().email().optional()
      })
      .parse(req.body ?? {});
    const { membership, userId } = await requireMenuVenueMembership(prisma, req, restaurantId);
    if (!canEditPaymentSettings(membership.role, membership.permissions)) {
      return reply.status(403).send({ ok: false, error: "permission_denied" });
    }
    const started = await startServeosManagedOnboarding(prisma, restaurantId, body, {
      actorUserId: userId,
      actorRole: membership.role
    });
    if (!started.ok) {
      return reply
        .status(started.error === "restaurant_not_found" ? 404 : 400)
        .send({ ok: false, error: started.error, message: "message" in started ? started.message : undefined });
    }
    return {
      ok: true,
      onboardingUrl: started.onboardingUrl,
      session: started.session,
      account: started.account,
      paymentPlatform: started.platform,
      sandbox: started.sandbox
    };
  });

  app.post("/restaurants/:restaurantId/payments/onboarding/refresh", async (req, reply) => {
    const { restaurantId } = z.object({ restaurantId: z.string().min(1) }).parse(req.params);
    const body = z
      .object({
        returnUrl: z.string().url(),
        refreshUrl: z.string().url()
      })
      .parse(req.body ?? {});
    const { membership, userId } = await requireMenuVenueMembership(prisma, req, restaurantId);
    if (!canEditPaymentSettings(membership.role, membership.permissions)) {
      return reply.status(403).send({ ok: false, error: "permission_denied" });
    }
    const refreshed = await refreshServeosManagedOnboardingLink(prisma, restaurantId, body, {
      actorUserId: userId,
      actorRole: membership.role
    });
    if (!refreshed.ok) {
      return reply.status(400).send({
        ok: false,
        error: refreshed.error,
        message: "message" in refreshed ? refreshed.message : undefined
      });
    }
    return {
      ok: true,
      onboardingUrl: refreshed.onboardingUrl,
      session: refreshed.session,
      paymentPlatform: refreshed.platform,
      sandbox: refreshed.sandbox
    };
  });

  app.post("/restaurants/:restaurantId/payments/onboarding/sync", async (req, reply) => {
    const { restaurantId } = z.object({ restaurantId: z.string().min(1) }).parse(req.params);
    const body = z.object({ paymentAccountId: z.string().optional() }).parse(req.body ?? {});
    const { membership, userId } = await requireMenuVenueMembership(prisma, req, restaurantId);
    if (!canEditPaymentSettings(membership.role, membership.permissions)) {
      return reply.status(403).send({ ok: false, error: "permission_denied" });
    }
    const synced = await syncVenuePaymentAccountFromProvider(
      prisma,
      restaurantId,
      body.paymentAccountId,
      { actorUserId: userId, actorRole: membership.role }
    );
    if (!synced.ok) {
      return reply.status(synced.error === "account_not_found" ? 404 : 400).send({
        ok: false,
        error: synced.error,
        message: "message" in synced ? synced.message : undefined
      });
    }
    const settingsRes = await getVenuePaymentSettings(prisma, restaurantId);
    if (!settingsRes.ok) {
      return {
        ok: true,
        account: synced.account,
        paymentPlatform: synced.platform,
        envReady: synced.envReady
      };
    }
    return {
      ok: true,
      account: synced.account,
      paymentPlatform: synced.platform,
      settings: toPublicVenuePaymentSettings(settingsRes.settings),
      methodCapabilities: getVenuePaymentMethodsPayload(settingsRes.settings, {
        unlockedMethodKeys: methodsUnlockedByActiveCapabilities(synced.account),
        hasManagedAccount: true
      }),
      featureGates: evaluatePaymentFeatureGates(settingsRes.settings, synced.envReady),
      envReady: synced.envReady
    };
  });

  app.get("/restaurants/:restaurantId/payment-methods", async (req, reply) => {
    const { restaurantId } = z.object({ restaurantId: z.string().min(1) }).parse(req.params);
    await requireMenuVenueMembership(prisma, req, restaurantId);
    const result = await getVenuePaymentSettings(prisma, restaurantId);
    if (!result.ok) return reply.status(404).send({ ok: false, error: result.error });
    return { ok: true, ...getVenuePaymentMethodsPayload(result.settings) };
  });

  app.get("/restaurants/:restaurantId/payment-methods/:methodKey/setup", async (req, reply) => {
    const { restaurantId, methodKey } = z
      .object({ restaurantId: z.string().min(1), methodKey: z.string().min(1) })
      .parse(req.params);
    await requireMenuVenueMembership(prisma, req, restaurantId);
    const result = await getVenuePaymentSettings(prisma, restaurantId);
    if (!result.ok) return reply.status(404).send({ ok: false, error: result.error });
    const setup = getPaymentMethodSetupContract(result.settings, methodKey);
    if (!setup) return reply.status(404).send({ ok: false, error: "method_not_found" });
    const session =
      getStoredSetupSession(result.settings, methodKey) ??
      materializeSetupSession(result.settings, restaurantId, methodKey);
    return { ok: true, setup, session };
  });

  app.post("/restaurants/:restaurantId/payment-methods/:methodKey/setup", async (req, reply) => {
    const { restaurantId, methodKey } = z
      .object({ restaurantId: z.string().min(1), methodKey: z.string().min(1) })
      .parse(req.params);
    const { membership, userId } = await requireMenuVenueMembership(prisma, req, restaurantId);
    if (!canEditPaymentSettings(membership.role, membership.permissions)) {
      return reply.status(403).send({ ok: false, error: "permission_denied" });
    }
    const started = await startOrResumePaymentSetupSession(prisma, restaurantId, methodKey, {
      actorUserId: userId,
      actorRole: membership.role
    });
    if (!started.ok) {
      return reply.status(started.error === "method_not_found" ? 404 : 400).send({
        ok: false,
        error: started.error
      });
    }
    return {
      ok: true,
      session: started.session,
      setup: getPaymentMethodSetupContract(started.settings, methodKey),
      settings: toPublicVenuePaymentSettings(started.settings),
      methodCapabilities: getVenuePaymentMethodsPayload(started.settings)
    };
  });

  app.post("/restaurants/:restaurantId/payment-methods/:methodKey/setup/:step", async (req, reply) => {
    const { restaurantId, methodKey, step } = z
      .object({
        restaurantId: z.string().min(1),
        methodKey: z.string().min(1),
        step: z.string().min(1)
      })
      .parse(req.params);
    const body = z
      .object({
        expectedVersion: z.number().int().optional(),
        values: z.record(z.unknown()).optional()
      })
      .parse(req.body ?? {});
    const { membership, userId } = await requireMenuVenueMembership(prisma, req, restaurantId);
    if (!canEditPaymentSettings(membership.role, membership.permissions)) {
      return reply.status(403).send({ ok: false, error: "permission_denied" });
    }

    const submitted = await submitPaymentSetupSessionStep(
      prisma,
      restaurantId,
      methodKey,
      { step, expectedVersion: body.expectedVersion, values: body.values },
      { actorUserId: userId, actorRole: membership.role }
    );
    if (!submitted.ok) {
      const status =
        submitted.error === "setup_version_conflict" || submitted.error === "method_not_ready"
          ? 409
          : submitted.error === "method_not_found"
            ? 404
            : 400;
      return reply.status(status).send({
        ok: false,
        error: submitted.error,
        message: "message" in submitted ? submitted.message : undefined,
        reasonCode: "reasonCode" in submitted ? submitted.reasonCode : undefined,
        requiredAction: "requiredAction" in submitted ? submitted.requiredAction : undefined,
        retryAllowed: "retryAllowed" in submitted ? submitted.retryAllowed : undefined,
        session: "session" in submitted ? submitted.session : undefined
      });
    }
    return {
      ok: true,
      session: submitted.session,
      settings: toPublicVenuePaymentSettings(submitted.settings),
      setup: getPaymentMethodSetupContract(submitted.settings, methodKey),
      methodCapabilities: getVenuePaymentMethodsPayload(submitted.settings)
    };
  });

  app.post("/restaurants/:restaurantId/payment-methods/:methodKey/verify", async (req, reply) => {
    const { restaurantId, methodKey } = z
      .object({ restaurantId: z.string().min(1), methodKey: z.string().min(1) })
      .parse(req.params);
    const { membership, userId } = await requireMenuVenueMembership(prisma, req, restaurantId);
    if (!canEditPaymentSettings(membership.role, membership.permissions)) {
      return reply.status(403).send({ ok: false, error: "permission_denied" });
    }
    const verified = await verifyAndPersistMethodAdapter(prisma, restaurantId, methodKey, {
      actorUserId: userId,
      actorRole: membership.role
    });
    if (!verified.ok) {
      return reply.status(verified.error === "method_not_found" ? 404 : 400).send({
        ok: false,
        error: verified.error
      });
    }
    return { ok: true, verification: verified.verification };
  });

  app.get("/restaurants/:restaurantId/payment-methods/:methodKey/danger-zone", async (req, reply) => {
    const { restaurantId, methodKey } = z
      .object({ restaurantId: z.string().min(1), methodKey: z.string().min(1) })
      .parse(req.params);
    await requireMenuVenueMembership(prisma, req, restaurantId);
    const result = await getVenuePaymentSettings(prisma, restaurantId);
    if (!result.ok) return reply.status(404).send({ ok: false, error: result.error });
    const zone = buildPaymentMethodDangerZone(result.settings, methodKey);
    if (!zone) return reply.status(404).send({ ok: false, error: "method_not_found" });
    return { ok: true, dangerZone: zone };
  });

  app.post(
    "/restaurants/:restaurantId/payment-methods/:methodKey/danger-zone/challenge",
    async (req, reply) => {
      const { restaurantId, methodKey } = z
        .object({ restaurantId: z.string().min(1), methodKey: z.string().min(1) })
        .parse(req.params);
      const body = z
        .object({
          actionId: z.enum([
            "DISABLE",
            "CLEAR_DEFAULT",
            "RESET_CONFIGURATION",
            "CLEAR_SETUP_SESSION",
            "DISCONNECT_ADAPTER"
          ])
        })
        .parse(req.body ?? {});
      const { membership, userId } = await requireMenuVenueMembership(prisma, req, restaurantId);
      if (!canEditPaymentSettings(membership.role, membership.permissions)) {
        return reply.status(403).send({ ok: false, error: "permission_denied" });
      }
      const created = await createPaymentMethodDangerChallenge(
        prisma,
        restaurantId,
        methodKey,
        body.actionId,
        { actorUserId: userId, actorRole: membership.role }
      );
      if (!created.ok) {
        const status =
          created.error === "method_not_found" || created.error === "action_not_found"
            ? 404
            : 400;
        return reply.status(status).send({
          ok: false,
          error: created.error,
          message: "message" in created ? created.message : undefined
        });
      }
      return {
        ok: true,
        challenge: created.challenge,
        action: created.action,
        dangerZone: created.zone
      };
    }
  );

  app.post(
    "/restaurants/:restaurantId/payment-methods/:methodKey/danger-zone/execute",
    async (req, reply) => {
      const { restaurantId, methodKey } = z
        .object({ restaurantId: z.string().min(1), methodKey: z.string().min(1) })
        .parse(req.params);
      const body = z
        .object({
          actionId: z.enum([
            "DISABLE",
            "CLEAR_DEFAULT",
            "RESET_CONFIGURATION",
            "CLEAR_SETUP_SESSION",
            "DISCONNECT_ADAPTER"
          ]),
          challengeId: z.string().min(1),
          typedPhrase: z.string().min(1).max(120)
        })
        .parse(req.body ?? {});
      const { membership, userId } = await requireMenuVenueMembership(prisma, req, restaurantId);
      if (!canEditPaymentSettings(membership.role, membership.permissions)) {
        return reply.status(403).send({ ok: false, error: "permission_denied" });
      }
      const executed = await executePaymentMethodDangerAction(
        prisma,
        restaurantId,
        methodKey,
        body,
        { actorUserId: userId, actorRole: membership.role }
      );
      if (!executed.ok) {
        const status =
          executed.error === "method_not_found" || executed.error === "action_not_found"
            ? 404
            : executed.error === "phrase_mismatch" || executed.error === "challenge_expired"
              ? 409
              : 400;
        return reply.status(status).send({
          ok: false,
          error: executed.error,
          message: "message" in executed ? executed.message : undefined
        });
      }
      return {
        ok: true,
        message: executed.message,
        actionId: executed.actionId,
        settings: toPublicVenuePaymentSettings(executed.settings),
        methodCapabilities: getVenuePaymentMethodsPayload(executed.settings),
        featureGates: evaluatePaymentFeatureGates(executed.settings, getPaymentProviderEnvReady()),
        dangerZone: buildPaymentMethodDangerZone(executed.settings, methodKey)
      };
    }
  );

  app.get("/restaurants/:restaurantId/payments/features", async (req, reply) => {
    const { restaurantId } = z.object({ restaurantId: z.string().min(1) }).parse(req.params);
    await requireMenuVenueMembership(prisma, req, restaurantId);
    const result = await getVenuePaymentSettings(prisma, restaurantId);
    if (!result.ok) return reply.status(404).send({ ok: false, error: result.error });
    const envReady = getPaymentProviderEnvReady();
    return {
      ok: true,
      featureGates: evaluatePaymentFeatureGates(result.settings, envReady),
      providers: listProviderSurfaces(result.settings)
    };
  });

  app.post("/restaurants/:restaurantId/payment-settings/connect", async (req, reply) => {
    const { restaurantId } = z.object({ restaurantId: z.string().min(1) }).parse(req.params);
    const body = z
      .object({
        provider: z.enum(["stripe", "swish"]),
        accountId: z.string().max(120).optional(),
        merchantId: z.string().max(120).optional(),
        displayName: z.string().max(80).optional(),
        apiSecret: z.string().max(500).optional(),
        certificatePem: z.string().max(20_000).optional(),
        webhookSecret: z.string().max(500).optional()
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
    if (!result.ok) {
      const status = result.error === "restaurant_not_found" ? 404 : 400;
      return reply.status(status).send({
        ok: false,
        error: result.error,
        message: "message" in result ? result.message : undefined
      });
    }
    return {
      ok: true,
      settings: toPublicVenuePaymentSettings(result.settings),
      needsEnv: "needsEnv" in result ? result.needsEnv : false,
      envReady: getPaymentProviderEnvReady(),
      methodCapabilities: getVenuePaymentMethodsPayload(result.settings),
      featureGates: evaluatePaymentFeatureGates(result.settings, getPaymentProviderEnvReady()),
      verification: "verification" in result ? result.verification : undefined,
      providerConnection:
        result.settings.providerConnections?.[body.provider]
          ? publicProviderConnectionLabels(result.settings.providerConnections[body.provider]!)
          : null
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
    return {
      ok: true,
      settings: toPublicVenuePaymentSettings(result.settings),
      methodCapabilities: getVenuePaymentMethodsPayload(result.settings),
      featureGates: evaluatePaymentFeatureGates(result.settings, getPaymentProviderEnvReady()),
      disablePolicy: METHOD_DISABLE_POLICY
    };
  });

  app.post("/restaurants/:restaurantId/payment-settings/providers/:provider/verify", async (req, reply) => {
    const { restaurantId, provider } = z
      .object({
        restaurantId: z.string().min(1),
        provider: z.enum(["stripe", "swish", "terminals"])
      })
      .parse(req.params);
    const { membership, userId } = await requireMenuVenueMembership(prisma, req, restaurantId);
    if (!canEditPaymentSettings(membership.role, membership.permissions)) {
      return reply.status(403).send({ ok: false, error: "permission_denied" });
    }
    const result = await verifyAndPersistProviderConnection(prisma, restaurantId, provider, {
      actorUserId: userId,
      actorRole: membership.role
    });
    if (!result.ok) return reply.status(404).send({ ok: false, error: result.error });
    return {
      ok: true,
      verification: result.verification,
      settings: toPublicVenuePaymentSettings(result.settings),
      methodCapabilities: getVenuePaymentMethodsPayload(result.settings),
      featureGates: evaluatePaymentFeatureGates(result.settings, getPaymentProviderEnvReady())
    };
  });

  app.post("/restaurants/:restaurantId/payment-settings/providers/:provider/health-check", async (req, reply) => {
    const { restaurantId, provider } = z
      .object({
        restaurantId: z.string().min(1),
        provider: z.enum(["stripe", "swish", "terminals"])
      })
      .parse(req.params);
    const { membership, userId } = await requireMenuVenueMembership(prisma, req, restaurantId);
    if (!canEditPaymentSettings(membership.role, membership.permissions)) {
      return reply.status(403).send({ ok: false, error: "permission_denied" });
    }
    const result = await runAndPersistProviderHealthCheck(prisma, restaurantId, provider, {
      actorUserId: userId,
      actorRole: membership.role
    });
    if (!result.ok) return reply.status(404).send({ ok: false, error: result.error });
    return {
      ok: true,
      health: result.health,
      settings: toPublicVenuePaymentSettings(result.settings)
    };
  });

  app.get("/restaurants/:restaurantId/checkout/payment-options", async (req, reply) => {
    const { restaurantId } = z.object({ restaurantId: z.string().min(1) }).parse(req.params);
    const query = z
      .object({
        source: z
          .enum([
            "qr_orders",
            "in_app",
            "walk_ins",
            "staff_created",
            "delivery",
            "catering",
            "b2b",
            "QR_ORDER",
            "IN_APP",
            "WALK_IN",
            "STAFF_CREATED",
            "DELIVERY",
            "CATERING",
            "B2B"
          ])
          .default("qr_orders"),
        amountCents: z.coerce.number().int().min(0).default(0),
        currency: z.string().min(3).max(3).default("SEK"),
        orderId: z.string().min(1).optional()
      })
      .parse(req.query ?? {});
    await requireMenuVenueMembership(prisma, req, restaurantId);
    const result = await getVenuePaymentSettings(prisma, restaurantId);
    if (!result.ok) return reply.status(404).send({ ok: false, error: result.error });
    const envReady = getPaymentProviderEnvReady();
    const methods = resolveEligiblePaymentMethods(result.settings, envReady, {
      restaurantId,
      orderId: query.orderId,
      source: query.source,
      amountCents: query.amountCents,
      currency: query.currency
    });
    const preferenceSource =
      query.source === "QR_ORDER"
        ? "qr_orders"
        : query.source === "IN_APP"
          ? "in_app"
          : query.source === "WALK_IN"
            ? "walk_ins"
            : query.source === "STAFF_CREATED"
              ? "staff_created"
              : query.source === "DELIVERY"
                ? "delivery"
                : query.source === "CATERING"
                  ? "catering"
                  : query.source === "B2B"
                    ? "b2b"
                    : query.source;
    const prefs = resolvePaymentPreferencePolicy(
      result.settings,
      mapOrderSourceToPreferenceContext(preferenceSource)
    );
    return {
      ok: true,
      methods,
      eligible: methods.filter((m) => m.eligible),
      preferences: prefs
    };
  });

  app.get("/restaurants/:restaurantId/payments/overview", async (req, reply) => {
    const { restaurantId } = z.object({ restaurantId: z.string().min(1) }).parse(req.params);
    await requireMenuVenueMembership(prisma, req, restaurantId);
    try {
      const overview = await getPaymentOverview(prisma, restaurantId);
      const settingsRes = await getVenuePaymentSettings(prisma, restaurantId);
      const featureGates = settingsRes.ok
        ? evaluatePaymentFeatureGates(settingsRes.settings, getPaymentProviderEnvReady())
        : null;
      return { ok: true, overview, featureGates };
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

  app.get("/restaurants/:restaurantId/payments/today/details", async (req, reply) => {
    const { restaurantId } = z.object({ restaurantId: z.string().min(1) }).parse(req.params);
    const query = z
      .object({
        scope: z.enum(["metric", "method", "collected", "payment"]),
        key: z.string().min(1).optional(),
        id: z.string().min(1).optional()
      })
      .parse(req.query ?? {});
    await requireMenuVenueMembership(prisma, req, restaurantId);
    try {
      const detail = await getTodaysPaymentsDetail(prisma, restaurantId, query);
      if (!detail) return reply.status(404).send({ ok: false, error: "detail_not_found" });
      return { ok: true, detail };
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

  app.get("/restaurants/:restaurantId/payments/health/issues/:issueId", async (req, reply) => {
    const { restaurantId, issueId } = z
      .object({ restaurantId: z.string().min(1), issueId: z.string().min(1) })
      .parse(req.params);
    await requireMenuVenueMembership(prisma, req, restaurantId);
    try {
      const detail = await getPaymentHealthIssueDetail(prisma, restaurantId, issueId);
      if (!detail) return reply.status(404).send({ ok: false, error: "issue_not_found" });
      return { ok: true, detail };
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
    const query = z
      .object({
        limit: z.coerce.number().int().min(1).max(200).optional(),
        day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
      })
      .parse(req.query ?? {});
    await requireMenuVenueMembership(prisma, req, restaurantId);

    if (query.day) {
      try {
        const today = await getTodaysPayments(prisma, restaurantId);
        if (query.day === today.dayKey) {
          return {
            ok: true,
            source: today.source,
            day: today.dayKey,
            dayStart: today.dayStart,
            dayEnd: today.dayEnd,
            transactions: today.ledger
          };
        }
      } catch {
        return reply.status(404).send({ ok: false, error: "restaurant_not_found" });
      }
    }

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
