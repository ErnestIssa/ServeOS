import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  METHOD_DISABLE_POLICY,
  assertMethodCanEnable,
  assertMethodEligibleForCharge,
  encryptPaymentSecret,
  evaluatePaymentFeatureGates,
  evaluatePaymentMethodReadiness,
  mapLifecycleToUiHealth,
  mergeSettings,
  resolveEligiblePaymentMethods,
  resolvePaymentPreferencePolicy,
  toPublicConnection,
  toPublicVenuePaymentSettings,
  type PaymentProviderEnvReady,
  type VenuePaymentSettings
} from "./index.js";
import { emptyConnection } from "./providers/providerConnectionTypes.js";
import { paymentProviderAdapters } from "./providers/providerAdapter.js";

const envReady: PaymentProviderEnvReady = {
  stripe: true,
  swish: true,
  webhook: true,
  demoLedger: true
};

function baseSettings(patch: Record<string, unknown> = {}): VenuePaymentSettings {
  return mergeSettings({
    methods: { cash: true, swish: false, card: false },
    methodConfig: {
      cash: {
        enabled: true,
        isDefault: true,
        supportedOrderSources: ["qr_orders", "walk_ins", "staff_created"],
        currencies: ["SEK"],
        minCents: 0,
        maxCents: null
      }
    },
    defaultPaymentMethodKey: "cash",
    ...patch
  });
}

describe("payment capability hardening", () => {
  it("maps internal lifecycle to admin badges without using UI labels as SSOT", () => {
    assert.equal(mapLifecycleToUiHealth("NOT_CONFIGURED", false).statusLabel, "Set up");
    assert.equal(mapLifecycleToUiHealth("READY", false).statusLabel, "Ready to enable");
    assert.equal(mapLifecycleToUiHealth("ENABLED", true).statusLabel, "Default");
    assert.equal(mapLifecycleToUiHealth("DEGRADED", false).statusLabel, "Issue");
    assert.equal(mapLifecycleToUiHealth("REVOKED", false).statusLabel, "Disconnected");
  });

  it("cash is ready/enableable without provider connection", () => {
    const settings = baseSettings();
    const readiness = evaluatePaymentMethodReadiness(settings, envReady, "cash");
    assert.equal(readiness.status, "ENABLED");
    const enable = assertMethodCanEnable(settings, envReady, "cash");
    assert.equal(enable.ok, true);
  });

  it("swish requires setup before enable", () => {
    const settings = baseSettings();
    const readiness = evaluatePaymentMethodReadiness(settings, envReady, "swish");
    assert.equal(readiness.status, "SETUP_REQUIRED");
    const enable = assertMethodCanEnable(settings, envReady, "swish");
    assert.equal(enable.ok, false);
  });

  it("masks secrets in public connection projection", async () => {
    process.env.PAYMENT_CREDENTIALS_KEY = "test-payment-credentials-key";
    const started = await paymentProviderAdapters.swish.startSetup({
      restaurantId: "r1",
      envReady,
      connection: emptyConnection("swish")
    });
    const submitted = await paymentProviderAdapters.swish.submitSetup(
      { restaurantId: "r1", envReady, connection: started.connection },
      { merchantId: "1234567890", apiSecret: "super-secret-value", certificatePem: "CERT" }
    );
    const pub = toPublicConnection(submitted.connection);
    assert.equal(pub.merchantId, "1234567890");
    assert.equal(pub.apiSecret, "Configured");
    assert.equal(pub.certificate, "Configured");
    assert.notEqual(String(pub.apiSecret), "super-secret-value");

    const settings = baseSettings({
      providerConnections: { swish: submitted.connection }
    });
    const publicSettings = toPublicVenuePaymentSettings(settings);
    assert.equal(publicSettings.providerConnections?.swish?.encryptedApiSecret, null);
    assert.equal(publicSettings.providerConnections?.swish?.hasApiSecret, true);
  });

  it("disabling a method blocks new eligibility but keeps disable policy non-destructive", () => {
    const settings = baseSettings({
      methods: { cash: true, swish: true },
      methodConfig: {
        cash: {
          enabled: true,
          supportedOrderSources: ["qr_orders"],
          currencies: ["SEK"],
          minCents: 0
        },
        swish: {
          enabled: false,
          supportedOrderSources: ["qr_orders"],
          currencies: ["SEK"],
          minCents: 100
        }
      },
      providers: {
        swish: {
          connected: true,
          merchantId: "m1",
          environment: "production",
          verificationStatus: "verified",
          health: "healthy"
        }
      },
      providerConnections: {
        swish: {
          ...emptyConnection("swish"),
          connected: true,
          publicMerchantId: "m1",
          verificationStatus: "verified",
          verifiedAt: new Date().toISOString(),
          health: "healthy",
          environment: "production",
          hasApiSecret: true
        }
      }
    });

    const list = resolveEligiblePaymentMethods(settings, envReady, {
      restaurantId: "r1",
      source: "QR_ORDER",
      amountCents: 45000,
      currency: "SEK"
    });
    const swish = list.find((m) => m.methodId === "swish");
    assert.ok(swish);
    assert.equal(swish!.eligible, false);
    assert.equal(swish!.reasonCode, "NOT_ENABLED");
    assert.equal(METHOD_DISABLE_POLICY.blockNewAttempts, true);
    assert.equal(METHOD_DISABLE_POLICY.preservePendingIntents, true);
    assert.equal(METHOD_DISABLE_POLICY.preserveWebhooks, true);
  });

  it("rejects forged payment methods", () => {
    const settings = baseSettings();
    const forged = assertMethodEligibleForCharge(settings, envReady, {
      restaurantId: "r1",
      methodId: "bitcoin_lightning_fake",
      source: "qr_orders",
      amountCents: 10000,
      currency: "SEK"
    });
    assert.equal(forged.ok, false);
    assert.equal(forged.eligibility.reasonCode, "FORGED_METHOD");
  });

  it("marks method ineligible when provider is unavailable", () => {
    const settings = baseSettings({
      methods: { swish: true, cash: true },
      methodConfig: {
        swish: {
          enabled: true,
          supportedOrderSources: ["qr_orders"],
          currencies: ["SEK"],
          minCents: 100
        }
      },
      providers: {
        swish: {
          connected: true,
          merchantId: "m1",
          environment: "production",
          verificationStatus: "verified",
          health: "unavailable"
        }
      },
      providerConnections: {
        swish: {
          ...emptyConnection("swish"),
          connected: true,
          publicMerchantId: "m1",
          verificationStatus: "verified",
          verifiedAt: new Date().toISOString(),
          health: "unavailable",
          environment: "production",
          hasApiSecret: true
        }
      }
    });
    const readiness = evaluatePaymentMethodReadiness(settings, envReady, "swish");
    assert.equal(readiness.status, "DEGRADED");
    const charge = assertMethodEligibleForCharge(settings, envReady, {
      restaurantId: "r1",
      methodId: "swish",
      source: "qr_orders",
      amountCents: 45000,
      currency: "SEK"
    });
    assert.equal(charge.ok, false);
    assert.equal(charge.eligibility.reasonCode, "PROVIDER_UNHEALTHY");
  });

  it("uses contextual preference defaults", () => {
    const settings = baseSettings();
    const qr = resolvePaymentPreferencePolicy(settings, "QR_ORDER");
    const b2b = resolvePaymentPreferencePolicy(settings, "B2B");
    assert.equal(qr.preferPayAtVenue, true);
    assert.equal(b2b.preferredMethodKey === "invoice" || b2b.preferredMethodKey === "cash", true);
  });

  it("feature gates include reasonCode and requiredAction", () => {
    const settings = baseSettings({ methods: { cash: false, swish: false, card: false } });
    // force all off
    for (const key of Object.keys(settings.methods) as Array<keyof typeof settings.methods>) {
      settings.methods[key] = false;
      if (settings.methodConfig[key]) settings.methodConfig[key]!.enabled = false;
    }
    const gates = evaluatePaymentFeatureGates(settings, envReady);
    assert.equal(gates.transactions.available, false);
    assert.equal(gates.transactions.reasonCode, "NO_ENABLED_METHODS");
    assert.equal(gates.transactions.requiredAction.type, "OPEN_PAYMENT_METHODS");
    assert.equal(gates.payouts.available, false);
    assert.ok(gates.payouts.requiredAction.type);
  });

  it("encrypts credential material", () => {
    process.env.PAYMENT_CREDENTIALS_KEY = "test-payment-credentials-key";
    const enc = encryptPaymentSecret("rotate-me-now");
    assert.ok(enc);
    assert.ok(enc!.ciphertext);
    assert.notEqual(enc!.ciphertext, "rotate-me-now");
  });

  it("ready-but-ineligible when amount below min", () => {
    const settings = baseSettings({
      methods: { swish: true },
      methodConfig: {
        swish: {
          enabled: true,
          supportedOrderSources: ["qr_orders"],
          currencies: ["SEK"],
          minCents: 50000,
          maxCents: 100000
        }
      },
      providers: {
        swish: {
          connected: true,
          merchantId: "m1",
          environment: "production",
          verificationStatus: "verified",
          health: "healthy"
        }
      },
      providerConnections: {
        swish: {
          ...emptyConnection("swish"),
          connected: true,
          publicMerchantId: "m1",
          verificationStatus: "verified",
          verifiedAt: new Date().toISOString(),
          health: "healthy",
          environment: "production",
          hasApiSecret: true
        }
      }
    });
    const low = assertMethodEligibleForCharge(settings, envReady, {
      restaurantId: "r1",
      methodId: "swish",
      source: "qr_orders",
      amountCents: 1000,
      currency: "SEK"
    });
    assert.equal(low.ok, false);
    assert.equal(low.eligibility.reasonCode, "AMOUNT_TOO_LOW");
  });
});
