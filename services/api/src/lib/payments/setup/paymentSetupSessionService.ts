import { randomUUID } from "node:crypto";
import { getCatalogEntry } from "../catalog/paymentMethodCatalog.js";
import { getSetupStepsForMethod, type PaymentSetupStepId } from "../catalog/paymentMethodRequirements.js";
import { resolveAdapterConnection } from "../providers/providerCapabilityResolver.js";
import { paymentProviderAdapters } from "../providers/providerAdapter.js";
import { emptyConnection, type ProviderConnectionId } from "../providers/providerConnectionTypes.js";
import {
  evaluatePaymentMethodReadiness,
  assertMethodCanEnable
} from "../venue/paymentMethodReadiness.js";
import {
  getPaymentProviderEnvReady,
  updateVenuePaymentSettings,
  type VenuePaymentSettings
} from "../venue/venuePaymentSettingsService.js";
import type { PrismaClient } from "@prisma/client";

export type PaymentSetupFieldType = "text" | "secret" | "file" | "select" | "multiselect" | "checkbox";

export type PaymentSetupField = {
  key: string;
  label: string;
  help?: string;
  required: boolean;
  secret: boolean;
  type: PaymentSetupFieldType;
  options?: Array<{ value: string; label: string }>;
  placeholder?: string;
  configured?: boolean;
};

export type PaymentSetupSessionStepStatus = "REQUIRED" | "CURRENT" | "DONE" | "LOCKED" | "FAILED" | "SKIPPED";

export type PaymentSetupSessionStep = {
  id: PaymentSetupStepId | "BUSINESS_DETAILS" | "PAYMENT_CONTEXTS" | "REVIEW";
  label: string;
  description: string;
  status: PaymentSetupSessionStepStatus;
  fields?: PaymentSetupField[];
};

export type PaymentSetupSession = {
  id: string;
  restaurantId: string;
  methodKey: string;
  provider: ProviderConnectionId | "native";
  status: "IN_PROGRESS" | "READY_TO_ENABLE" | "ENABLED" | "FAILED" | "EXPIRED";
  currentStep: string;
  steps: PaymentSetupSessionStep[];
  version: number;
  createdBy?: string;
  updatedBy?: string;
  startedAt: string;
  updatedAt: string;
  expiresAt: string;
  reasonCode?: string | null;
  requiredAction?: string | null;
  retryAllowed?: boolean;
  checklist: Array<{ id: string; label: string; done: boolean }>;
};

function adapterSurface(methodKey: string): ProviderConnectionId | "native" {
  const entry = getCatalogEntry(methodKey);
  if (!entry || entry.requiredAdapter === "native") return "native";
  if (entry.requiredAdapter === "swish") return "swish";
  if (entry.requiredAdapter === "terminal") return "terminals";
  return "stripe";
}

function fieldsForProvider(provider: ProviderConnectionId | "native", settings: VenuePaymentSettings): PaymentSetupField[] {
  if (provider === "native") return [];
  const conn =
    provider === "swish"
      ? settings.providerConnections?.swish
      : provider === "terminals"
        ? settings.providerConnections?.terminals
        : settings.providerConnections?.stripe;
  if (provider === "swish") {
    return [
      {
        key: "merchantId",
        label: "Swish merchant / payee alias",
        help: "From your Swish business agreement / Merchant Portal.",
        required: true,
        secret: false,
        type: "text",
        placeholder: "123xxxxxxx",
        configured: Boolean(conn?.publicMerchantId || settings.providers.swish.merchantId)
      },
      {
        key: "certificatePem",
        label: "Client certificate (PEM)",
        help: "Upload or paste the certificate issued for your Swish Commerce agreement.",
        required: true,
        secret: true,
        type: "file",
        configured: Boolean(conn?.hasCertificate)
      },
      {
        key: "apiSecret",
        label: "Certificate / key password",
        help: "Never shown again after save. Encrypted at rest.",
        required: true,
        secret: true,
        type: "secret",
        configured: Boolean(conn?.hasApiSecret)
      },
      {
        key: "webhookSecret",
        label: "Webhook signing secret (optional)",
        required: false,
        secret: true,
        type: "secret",
        configured: Boolean(conn?.hasWebhookSecret)
      }
    ];
  }
  return [
    {
      key: "accountId",
      label: provider === "terminals" ? "Terminal merchant account ID" : "Stripe account ID",
      required: true,
      secret: false,
      type: "text",
      placeholder: "acct_…",
      configured: Boolean(conn?.publicAccountId || settings.providers.stripe.accountId)
    },
    {
      key: "apiSecret",
      label: "API secret / restricted key",
      help: "Stored encrypted. Never returned after submission.",
      required: true,
      secret: true,
      type: "secret",
      configured: Boolean(conn?.hasApiSecret)
    },
    {
      key: "webhookSecret",
      label: "Webhook signing secret",
      required: false,
      secret: true,
      type: "secret",
      configured: Boolean(conn?.hasWebhookSecret)
    }
  ];
}

function buildSteps(
  methodKey: string,
  settings: VenuePaymentSettings,
  provider: ProviderConnectionId | "native"
): PaymentSetupSessionStep[] {
  const entry = getCatalogEntry(methodKey);
  const envReady = getPaymentProviderEnvReady();
  const readiness = evaluatePaymentMethodReadiness(settings, envReady, methodKey);
  const adapter = entry ? resolveAdapterConnection(settings, envReady, entry.requiredAdapter) : null;
  const config = settings.methodConfig?.[methodKey as keyof typeof settings.methodConfig];
  const hasSources = Boolean(config?.supportedOrderSources?.length);
  const base = getSetupStepsForMethod(methodKey);

  const enriched: PaymentSetupSessionStep[] = [
    {
      id: "BUSINESS_DETAILS",
      label: "Business details",
      description: "Confirm the legal entity and venue this payment method will serve.",
      status: "DONE",
      fields: [
        {
          key: "useExistingMerchant",
          label: "Use this venue’s payment account",
          required: true,
          secret: false,
          type: "checkbox"
        }
      ]
    },
    ...base.map((step): PaymentSetupSessionStep => {
      let status: PaymentSetupSessionStepStatus = "LOCKED";
      if (step.id === "CONNECT_ADAPTER" || step.id === "PROVIDE_CREDENTIALS") {
        status = adapter?.connected ? "DONE" : "REQUIRED";
      } else if (step.id === "VERIFY_CONNECTION") {
        status = adapter?.verified ? "DONE" : adapter?.connected ? "REQUIRED" : "LOCKED";
      } else if (step.id === "CONFIGURE_CHANNELS") {
        status = hasSources ? "DONE" : adapter?.verified || provider === "native" ? "REQUIRED" : "LOCKED";
      } else if (step.id === "CONFIGURE_PAYMENT_RULES") {
        status = hasSources || provider === "native" ? "DONE" : "LOCKED";
      } else if (step.id === "TEST_PAYMENT") {
        status =
          readiness.status === "READY" || readiness.status === "ENABLED"
            ? "DONE"
            : adapter?.verified || provider === "native"
              ? "REQUIRED"
              : "LOCKED";
      } else if (step.id === "ACTIVATE") {
        status = readiness.status === "ENABLED" ? "DONE" : readiness.canEnable ? "REQUIRED" : "LOCKED";
      }
      return {
        id: step.id,
        label: step.label,
        description: step.description,
        status,
        fields:
          step.id === "PROVIDE_CREDENTIALS" || step.id === "CONNECT_ADAPTER"
            ? fieldsForProvider(provider, settings)
            : step.id === "CONFIGURE_CHANNELS"
              ? [
                  {
                    key: "supportedOrderSources",
                    label: "Order sources",
                    required: true,
                    secret: false,
                    type: "multiselect",
                    options: [
                      { value: "qr_orders", label: "QR orders" },
                      { value: "in_app", label: "In-app" },
                      { value: "walk_ins", label: "Walk-ins" },
                      { value: "staff_created", label: "Staff-created" },
                      { value: "delivery", label: "Delivery" },
                      { value: "catering", label: "Catering" },
                      { value: "b2b", label: "B2B" }
                    ]
                  }
                ]
              : undefined
      };
    }),
    {
      id: "REVIEW",
      label: "Review",
      description: "Confirm readiness before enabling for checkout.",
      status: readiness.canEnable || readiness.status === "ENABLED" ? "REQUIRED" : "LOCKED"
    }
  ];

  const firstOpen = enriched.find((s) => s.status === "REQUIRED" || s.status === "FAILED");
  return enriched.map((s) =>
    firstOpen && s.id === firstOpen.id && s.status === "REQUIRED" ? { ...s, status: "CURRENT" } : s
  );
}

function checklistFor(methodKey: string, settings: VenuePaymentSettings, provider: ProviderConnectionId | "native") {
  const envReady = getPaymentProviderEnvReady();
  const readiness = evaluatePaymentMethodReadiness(settings, envReady, methodKey);
  const entry = getCatalogEntry(methodKey);
  const adapter = entry ? resolveAdapterConnection(settings, envReady, entry.requiredAdapter) : null;
  const config = settings.methodConfig?.[methodKey as keyof typeof settings.methodConfig];
  return [
    { id: "venue", label: "Venue selected", done: true },
    {
      id: "agreement",
      label: provider === "swish" ? "Active Swish business agreement" : "Provider merchant account",
      done: Boolean(adapter?.connected)
    },
    {
      id: "credentials",
      label: "Merchant credentials / certificates",
      done: Boolean(adapter?.connected && (provider === "native" || adapter?.accountOrMerchantId))
    },
    { id: "verified", label: "ServeOS connection verified", done: Boolean(adapter?.verified) },
    {
      id: "channels",
      label: "Payment contexts configured",
      done: Boolean(config?.supportedOrderSources?.length)
    },
    {
      id: "ready",
      label: "Ready to enable",
      done: readiness.canEnable || readiness.status === "ENABLED" || readiness.status === "READY"
    },
    { id: "enabled", label: "Method enabled", done: readiness.status === "ENABLED" }
  ];
}

export function getStoredSetupSession(
  settings: VenuePaymentSettings,
  methodKey: string
): PaymentSetupSession | null {
  const raw = settings.setupSessions?.[methodKey];
  if (!raw || typeof raw !== "object") return null;
  return raw as PaymentSetupSession;
}

export function materializeSetupSession(
  settings: VenuePaymentSettings,
  restaurantId: string,
  methodKey: string,
  actorUserId?: string
): PaymentSetupSession {
  const entry = getCatalogEntry(methodKey);
  if (!entry) throw Object.assign(new Error("method_not_found"), { statusCode: 404 });

  const provider = adapterSurface(methodKey);
  const existing = getStoredSetupSession(settings, methodKey);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const steps = buildSteps(methodKey, settings, provider);
  const current = steps.find((s) => s.status === "CURRENT") ?? steps.find((s) => s.status === "REQUIRED");
  const envReady = getPaymentProviderEnvReady();
  const readiness = evaluatePaymentMethodReadiness(settings, envReady, methodKey);

  const session: PaymentSetupSession = {
    id: existing?.id ?? `pss_${randomUUID().replace(/-/g, "").slice(0, 16)}`,
    restaurantId,
    methodKey,
    provider,
    status:
      readiness.status === "ENABLED"
        ? "ENABLED"
        : readiness.canEnable || readiness.status === "READY"
          ? "READY_TO_ENABLE"
          : existing?.status === "FAILED"
            ? "FAILED"
            : "IN_PROGRESS",
    currentStep: current?.id ?? "REVIEW",
    steps,
    version: (existing?.version ?? 0) + 1,
    createdBy: existing?.createdBy ?? actorUserId,
    updatedBy: actorUserId,
    startedAt: existing?.startedAt ?? now.toISOString(),
    updatedAt: now.toISOString(),
    expiresAt: existing?.expiresAt ?? expiresAt,
    reasonCode: readiness.status === "SETUP_REQUIRED" ? "ADAPTER_CONNECTION_REQUIRED" : null,
    requiredAction: readiness.nextAction,
    retryAllowed: true,
    checklist: checklistFor(methodKey, settings, provider)
  };
  return session;
}

export async function startOrResumePaymentSetupSession(
  prisma: PrismaClient,
  restaurantId: string,
  methodKey: string,
  audit?: { actorUserId?: string; actorRole?: string }
) {
  const { getVenuePaymentSettings } = await import("../venue/venuePaymentSettingsService.js");
  const current = await getVenuePaymentSettings(prisma, restaurantId);
  if (!current.ok) return current;
  if (!getCatalogEntry(methodKey)) return { ok: false as const, error: "method_not_found" };

  const session = materializeSetupSession(current.settings, restaurantId, methodKey, audit?.actorUserId);
  const result = await updateVenuePaymentSettings(
    prisma,
    restaurantId,
    {
      setupSessions: {
        ...(current.settings.setupSessions ?? {}),
        [methodKey]: session
      }
    } as Partial<VenuePaymentSettings>,
    {
      ...audit,
      action: "payment.method_setup_started",
      path: `setupSessions.${methodKey}`
    }
  );
  if (!result.ok) return result;
  return { ok: true as const, session, settings: result.settings };
}

export async function submitPaymentSetupSessionStep(
  prisma: PrismaClient,
  restaurantId: string,
  methodKey: string,
  input: {
    step: string;
    expectedVersion?: number;
    values?: Record<string, unknown>;
  },
  audit?: { actorUserId?: string; actorRole?: string }
) {
  const { getVenuePaymentSettings } = await import("../venue/venuePaymentSettingsService.js");
  const current = await getVenuePaymentSettings(prisma, restaurantId);
  if (!current.ok) return current;

  let settings = current.settings;
  let session = materializeSetupSession(settings, restaurantId, methodKey, audit?.actorUserId);
  if (input.expectedVersion != null && session.version !== input.expectedVersion + 1 && getStoredSetupSession(settings, methodKey)) {
    const stored = getStoredSetupSession(settings, methodKey)!;
    if (input.expectedVersion !== stored.version) {
      return {
        ok: false as const,
        error: "setup_version_conflict",
        message: "Another admin updated this setup. Reload before continuing.",
        session: materializeSetupSession(settings, restaurantId, methodKey, audit?.actorUserId)
      };
    }
  }

  const provider = session.provider;
  const values = input.values ?? {};

  if (
    (input.step === "CONNECT_ADAPTER" || input.step === "PROVIDE_CREDENTIALS" || input.step === "CREDENTIALS") &&
    provider !== "native"
  ) {
    const envReady = getPaymentProviderEnvReady();
    const adapter = paymentProviderAdapters[provider];
    const existing = settings.providerConnections?.[provider] ?? emptyConnection(provider);
    const started = await adapter.startSetup({ restaurantId, envReady, connection: existing });
    const submitted = await adapter.submitSetup(
      { restaurantId, envReady, connection: started.connection },
      {
        accountId: typeof values.accountId === "string" ? values.accountId : undefined,
        merchantId: typeof values.merchantId === "string" ? values.merchantId : undefined,
        displayName: typeof values.displayName === "string" ? values.displayName : undefined,
        apiSecret: typeof values.apiSecret === "string" ? values.apiSecret : undefined,
        certificatePem: typeof values.certificatePem === "string" ? values.certificatePem : undefined,
        webhookSecret: typeof values.webhookSecret === "string" ? values.webhookSecret : undefined
      }
    );
    const verified = await adapter.verifyConnection({
      restaurantId,
      envReady,
      connection: submitted.connection
    });

    const patchProviders =
      provider === "swish"
        ? {
            swish: {
              connected: verified.connection.connected,
              merchantId: verified.connection.publicMerchantId,
              connectedAt: verified.connection.connectedAt ?? undefined,
              displayName: verified.connection.displayName,
              environment: verified.connection.environment,
              verificationStatus: verified.connection.verificationStatus,
              verifiedAt: verified.connection.verifiedAt,
              health: verified.connection.health
            },
            stripe: settings.providers.stripe
          }
        : {
            stripe: {
              connected: verified.connection.connected,
              accountId: verified.connection.publicAccountId,
              connectedAt: verified.connection.connectedAt ?? undefined,
              displayName: verified.connection.displayName,
              environment: verified.connection.environment,
              verificationStatus: verified.connection.verificationStatus,
              verifiedAt: verified.connection.verifiedAt,
              health: verified.connection.health
            },
            swish: settings.providers.swish
          };

    const saved = await updateVenuePaymentSettings(
      prisma,
      restaurantId,
      {
        providers: patchProviders,
        providerConnections: {
          ...(settings.providerConnections ?? {}),
          [provider]: verified.connection
        }
      } as Partial<VenuePaymentSettings>,
      {
        ...audit,
        action: verified.ok ? "payment.provider_connected" : "payment.method_verification_failed",
        path: `providerConnections.${provider}`
      }
    );
    if (!saved.ok) return saved;
    settings = saved.settings;
    if (!verified.ok) {
      session = materializeSetupSession(settings, restaurantId, methodKey, audit?.actorUserId);
      session.status = "FAILED";
      session.reasonCode = verified.failureCode ?? "PROVIDER_VERIFICATION_FAILED";
      session.requiredAction = "UPLOAD_VALID_CERTIFICATE";
      await updateVenuePaymentSettings(
        prisma,
        restaurantId,
        { setupSessions: { ...(settings.setupSessions ?? {}), [methodKey]: session } } as Partial<VenuePaymentSettings>,
        { ...audit, action: "payment.method_verification_failed", path: `setupSessions.${methodKey}` }
      );
      return {
        ok: false as const,
        error: "verification_failed",
        message: verified.message,
        reasonCode: session.reasonCode,
        requiredAction: session.requiredAction,
        retryAllowed: true,
        session
      };
    }
  }

  if (input.step === "VERIFY_CONNECTION" && provider !== "native") {
    const { verifyAndPersistProviderConnection } = await import("./paymentVerification.js");
    const verified = await verifyAndPersistProviderConnection(prisma, restaurantId, provider, audit);
    if (!verified.ok) return verified;
    settings = verified.settings;
  }

  if (input.step === "CONFIGURE_CHANNELS" || input.step === "PAYMENT_CONTEXTS") {
    const sources = Array.isArray(values.supportedOrderSources)
      ? (values.supportedOrderSources as string[])
      : null;
    if (sources) {
      const prev = settings.methodConfig[methodKey as keyof typeof settings.methodConfig];
      const saved = await updateVenuePaymentSettings(
        prisma,
        restaurantId,
        {
          methodConfig: {
            [methodKey]: {
              ...(prev as object),
              supportedOrderSources: sources,
              enabled: Boolean(prev?.enabled)
            }
          }
        } as Partial<VenuePaymentSettings>,
        { ...audit, action: "payment_method_updated", path: `methods.${methodKey}.channels` }
      );
      if (!saved.ok) return saved;
      settings = saved.settings;
    }
  }

  if (input.step === "BUSINESS_DETAILS") {
    // Confirm-only step; progress is derived from backend readiness on rematerialize.
  }

  if (input.step === "TEST_PAYMENT") {
    // Backend-owned: mark test acknowledged only when adapter is verified (no client self-attest).
    const envReady = getPaymentProviderEnvReady();
    const readiness = evaluatePaymentMethodReadiness(settings, envReady, methodKey);
    if (!readiness.adapterVerified && provider !== "native") {
      return {
        ok: false as const,
        error: "test_not_available",
        message: "Verify the provider connection before running a test payment.",
        session: materializeSetupSession(settings, restaurantId, methodKey, audit?.actorUserId)
      };
    }
  }

  if (input.step === "ACTIVATE" || input.step === "ENABLE" || input.step === "REVIEW") {
    // REVIEW without explicit enable intent only rematerializes; ACTIVATE/ENABLE perform fresh check.
    if (input.step === "REVIEW" && values.confirmEnable !== true) {
      session = materializeSetupSession(settings, restaurantId, methodKey, audit?.actorUserId);
      const persistReview = await updateVenuePaymentSettings(
        prisma,
        restaurantId,
        { setupSessions: { ...(settings.setupSessions ?? {}), [methodKey]: session } } as Partial<VenuePaymentSettings>,
        { ...audit, action: "payment_settings_updated", path: `setupSessions.${methodKey}` }
      );
      if (!persistReview.ok) return persistReview;
      return { ok: true as const, session, settings: persistReview.settings };
    }
    const envReady = getPaymentProviderEnvReady();
    const check = assertMethodCanEnable(settings, envReady, methodKey);
    if (!check.ok) {
      return {
        ok: false as const,
        error: "method_not_ready",
        message: check.error,
        session: materializeSetupSession(settings, restaurantId, methodKey, audit?.actorUserId)
      };
    }
    const prev = settings.methodConfig[methodKey as keyof typeof settings.methodConfig];
    const saved = await updateVenuePaymentSettings(
      prisma,
      restaurantId,
      {
        methods: { [methodKey]: true },
        methodConfig: {
          [methodKey]: {
            ...(prev as object),
            enabled: true
          }
        }
      } as Partial<VenuePaymentSettings>,
      { ...audit, action: "payment.method_enabled", path: `methods.${methodKey}` }
    );
    if (!saved.ok) return saved;
    settings = saved.settings;
  }

  session = materializeSetupSession(settings, restaurantId, methodKey, audit?.actorUserId);
  const persist = await updateVenuePaymentSettings(
    prisma,
    restaurantId,
    { setupSessions: { ...(settings.setupSessions ?? {}), [methodKey]: session } } as Partial<VenuePaymentSettings>,
    { ...audit, action: "payment_settings_updated", path: `setupSessions.${methodKey}` }
  );
  if (!persist.ok) return persist;
  return { ok: true as const, session, settings: persist.settings };
}
