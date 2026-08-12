import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { describe, it, beforeEach } from "node:test";
import {
  ACTIVE_PAYMENT_ATTEMPT_STATUSES,
  METHOD_DISABLE_POLICY,
  assertMoneyMinor,
  assertPaymentTransition,
  assertRefundWithinCaptured,
  assertSameRestaurant,
  buildPaymentReconnectQuery,
  classifyPaymentOrderRace,
  clearPaymentRiskSignals,
  clearRememberedProviderEvents,
  derivePaymentObligation,
  emitPaymentRiskSignal,
  hasPaymentPermission,
  mapLifecycleToUiHealth,
  mapProviderEventToStatus,
  rememberProviderEvent,
  shouldApplyProviderEvent,
  verifyPaymentWebhookSignature,
  redactPaymentPayload
} from "./index.js";

describe("payment attempt state machine", () => {
  it("allows CREATED → REQUIRES_ACTION → PROCESSING → SUCCEEDED", () => {
    assert.equal(assertPaymentTransition("CREATED", "REQUIRES_ACTION").ok, true);
    assert.equal(assertPaymentTransition("REQUIRES_ACTION", "PROCESSING").ok, true);
    assert.equal(assertPaymentTransition("PROCESSING", "SUCCEEDED").ok, true);
  });

  it("blocks CANCELLED → SUCCEEDED (must use mismatch path)", () => {
    const r = assertPaymentTransition("CANCELLED", "SUCCEEDED");
    assert.equal(r.ok, false);
  });

  it("allows CANCELLED → PAYMENT_ORDER_MISMATCH for late provider success", () => {
    assert.equal(assertPaymentTransition("CANCELLED", "PAYMENT_ORDER_MISMATCH").ok, true);
  });

  it("maps provider events and ignores stale versions after terminal", () => {
    assert.equal(mapProviderEventToStatus("payment.succeeded"), "SUCCEEDED");
    assert.equal(mapProviderEventToStatus("payment_processing"), "PROCESSING");
    const stale = shouldApplyProviderEvent({
      currentStatus: "SUCCEEDED",
      incomingStatus: "PROCESSING",
      lastEventVersion: "2",
      incomingEventVersion: "1"
    });
    assert.equal(stale.apply, false);
  });

  it("treats duplicate terminal success as idempotent replay", () => {
    const r = shouldApplyProviderEvent({
      currentStatus: "SUCCEEDED",
      incomingStatus: "SUCCEEDED"
    });
    assert.equal(r.apply, false);
    assert.equal(r.reason, "idempotent_replay");
  });
});

describe("webhook security + chaos", () => {
  beforeEach(() => clearRememberedProviderEvents());

  it("rejects missing signature when secret configured", () => {
    const r = verifyPaymentWebhookSignature({
      provider: "stripe",
      rawBody: "{}",
      secret: "whsec_test",
      signatureHeader: null
    });
    assert.equal(r.ok, false);
  });

  it("accepts HMAC body signature", () => {
    const secret = "whsec_test";
    const rawBody = JSON.stringify({ ok: true });
    const sig = createHmac("sha256", secret).update(rawBody).digest("hex");
    const r = verifyPaymentWebhookSignature({
      provider: "stripe",
      rawBody,
      secret,
      signatureHeader: sig
    });
    assert.equal(r.ok, true);
  });

  it("deduplicates provider events", () => {
    const a = rememberProviderEvent({
      provider: "swish",
      providerEventId: "evt_1",
      eventType: "payment_succeeded",
      receivedAt: new Date().toISOString(),
      payloadHash: "abc",
      signatureValid: true,
      processingResult: "ok"
    });
    const b = rememberProviderEvent({
      provider: "swish",
      providerEventId: "evt_1",
      eventType: "payment_succeeded",
      receivedAt: new Date().toISOString(),
      payloadHash: "abc",
      signatureValid: true
    });
    assert.equal(a.duplicate, false);
    assert.equal(b.duplicate, true);
  });

  it("redacts secrets from payloads", () => {
    const redacted = redactPaymentPayload({ apiSecret: "x", amount: 100 }) as Record<string, unknown>;
    assert.equal(redacted.apiSecret, "[redacted]");
    assert.equal(redacted.amount, 100);
  });
});

describe("money integrity", () => {
  it("rejects floats", () => {
    assert.throws(() => assertMoneyMinor(12.5));
  });

  it("blocks refunds above captured", () => {
    assert.throws(() => assertRefundWithinCaptured(10000, 8000, 3000));
    assert.doesNotThrow(() => assertRefundWithinCaptured(10000, 8000, 2000));
  });
});

describe("order/payment races", () => {
  it("flags payment success on cancelled order", () => {
    const m = classifyPaymentOrderRace({
      orderId: "o1",
      restaurantId: "r1",
      orderStatus: "CANCELLED",
      orderPaymentStatus: "UNPAID",
      attemptStatus: "SUCCEEDED",
      amountCents: 50000,
      orderVersionAtAttempt: 1,
      currentOrderVersion: 2,
      currentOrderTotalCents: 50000,
      attemptAmountCents: 50000
    });
    assert.ok(m);
    assert.equal(m!.code, "PAYMENT_ORDER_MISMATCH");
    assert.equal(m!.recommendedAction, "AUTO_REFUND");
  });

  it("flags amount/version drift after success", () => {
    const m = classifyPaymentOrderRace({
      orderId: "o1",
      restaurantId: "r1",
      orderStatus: "PENDING_PAYMENT",
      orderPaymentStatus: "UNPAID",
      attemptStatus: "SUCCEEDED",
      amountCents: 50000,
      orderVersionAtAttempt: 1,
      currentOrderVersion: 2,
      currentOrderTotalCents: 40000,
      attemptAmountCents: 50000
    });
    assert.ok(m);
    assert.equal(m!.recommendedAction, "MANUAL_REVIEW");
  });
});

describe("pay-at-venue obligation", () => {
  it("does not treat accepted unpaid order as paid", () => {
    const o = derivePaymentObligation({
      orderId: "o1",
      restaurantId: "r1",
      currency: "SEK",
      totalCents: 45000,
      capturedAttempts: [],
      payAtVenue: true
    });
    assert.equal(o.collectionStatus, "UNPAID");
    assert.equal(o.outstandingCents, 45000);
    assert.equal(o.mode, "PAY_AT_VENUE");
  });

  it("supports split captures", () => {
    const o = derivePaymentObligation({
      orderId: "o1",
      restaurantId: "r1",
      currency: "SEK",
      totalCents: 100000,
      capturedAttempts: [
        { amountCents: 50000, status: "SUCCEEDED" },
        { amountCents: 50000, status: "SUCCEEDED" }
      ]
    });
    assert.equal(o.collectionStatus, "PAID");
    assert.equal(o.outstandingCents, 0);
  });
});

describe("disable / permissions / tenant / realtime", () => {
  it("disable policy blocks new attempts only", () => {
    assert.equal(METHOD_DISABLE_POLICY.blockNewAttempts, true);
    assert.equal(METHOD_DISABLE_POLICY.preserveWebhooks, true);
    assert.ok(ACTIVE_PAYMENT_ATTEMPT_STATUSES.has("PROCESSING"));
  });

  it("payment.view does not grant refund", () => {
    assert.equal(hasPaymentPermission("staff", "payment.view"), true);
    assert.equal(hasPaymentPermission("staff", "payment.refund"), false);
    assert.equal(hasPaymentPermission("owner", "payment.rotate_credentials"), true);
  });

  it("blocks cross-tenant access", () => {
    assert.throws(() => assertSameRestaurant("r1", "r2"));
    assert.doesNotThrow(() => assertSameRestaurant("r1", "r1"));
  });

  it("realtime reconnect requires authoritative fetch", () => {
    const q = buildPaymentReconnectQuery("ord_1");
    assert.match(q.path, /ord_1/);
    assert.equal(q.reason, "realtime_reconnect");
  });

  it("UI badges remain projections of lifecycle", () => {
    assert.equal(mapLifecycleToUiHealth("READY", false).statusLabel, "Ready to enable");
    assert.equal(mapLifecycleToUiHealth("REVOKED", false).statusLabel, "Disconnected");
  });

  it("emits risk signals without storing secrets", () => {
    clearPaymentRiskSignals();
    const s = emitPaymentRiskSignal({
      type: "excessive_retries",
      restaurantId: "r1",
      severity: "warning",
      metadata: { apiSecret: "nope" }
    });
    assert.equal(s.type, "excessive_retries");
  });
});
