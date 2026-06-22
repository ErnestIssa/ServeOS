import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildOrderEventEnvelope, hashIdempotencyPayload } from "./orderIdempotencyService.js";
import { parseOrderEventEnvelope, ORDER_EVENT_SCHEMA_VERSION } from "./orderEventSchema.js";
import { shouldApplyOrderEvent, ORDER_EVENT_DELIVERY } from "./orderConsumerContracts.js";
import { evaluateOrderSla, ORDER_SLA_POLICY } from "./orderSlaPolicies.js";
import { classifyPaymentWebhook } from "./orderPaymentEdgeCases.js";

describe("order event schema", () => {
  it("builds and parses v1 envelope", () => {
    const envelope = buildOrderEventEnvelope({
      type: "order.created",
      orderId: "ord_1",
      restaurantId: "rest_1",
      sequence: 1,
      status: "CREATED",
      totalCents: 12000,
      customerUserId: "user_1",
      displaySeq: 42
    });

    assert.equal(envelope.schemaVersion, ORDER_EVENT_SCHEMA_VERSION);
    assert.equal(envelope.sequence, 1);
    const parsed = parseOrderEventEnvelope(envelope);
    assert.equal(parsed.payload.displayNumber, "#42");
  });
});

describe("idempotency hash", () => {
  it("is stable for same payload", () => {
    const a = hashIdempotencyPayload({ restaurantId: "r1", lines: [{ menuItemId: "m1", quantity: 2 }] });
    const b = hashIdempotencyPayload({ restaurantId: "r1", lines: [{ menuItemId: "m1", quantity: 2 }] });
    assert.equal(a, b);
  });
});

describe("consumer contracts", () => {
  it("defines at-least-once delivery", () => {
    assert.equal(ORDER_EVENT_DELIVERY.guarantee, "at-least-once");
    assert.equal(ORDER_EVENT_DELIVERY.idempotentConsumerRequired, true);
  });

  it("applies events only when sequence advances", () => {
    assert.equal(shouldApplyOrderEvent(3, 4), true);
    assert.equal(shouldApplyOrderEvent(4, 4), false);
    assert.equal(shouldApplyOrderEvent(null, 1), true);
  });
});

describe("order SLA", () => {
  it("flags stale active orders", () => {
    const old = new Date(Date.now() - ORDER_SLA_POLICY.maxActiveAgeMs - 1000);
    assert.equal(
      evaluateOrderSla({ status: "PREPARING", createdAt: old, kitchenStartedAt: old, completedAt: null, updatedAt: old }),
      "stale_active"
    );
  });

  it("flags preparing delay", () => {
    const started = new Date(Date.now() - ORDER_SLA_POLICY.preparingDelayWarningMs - 1000);
    assert.equal(
      evaluateOrderSla({
        status: "PREPARING",
        createdAt: started,
        kitchenStartedAt: started,
        completedAt: null,
        updatedAt: started
      }),
      "preparing_delayed"
    );
  });
});

describe("payment edge cases", () => {
  it("requests retry when order missing", () => {
    assert.equal(classifyPaymentWebhook({ order: null, amountCents: 100 }), "order_not_found_retry");
  });

  it("detects already paid replay", () => {
    assert.equal(
      classifyPaymentWebhook({
        order: { id: "o1", status: "PAID", paymentStatus: "PAID", totalCents: 100 },
        amountCents: 100
      }),
      "already_paid_replay"
    );
  });
});
