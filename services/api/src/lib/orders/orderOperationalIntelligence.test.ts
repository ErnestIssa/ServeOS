import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mergeOrderEnginePolicy, DEFAULT_ORDER_ENGINE_POLICY } from "./orderTenantPolicies.js";
import {
  parseOrderEventEnvelopeAny,
  canConsumerProcessVersion,
  EVENT_EVOLUTION_POLICY
} from "./orderEventVersioning.js";
import { buildOrderEventEnvelope } from "./orderIdempotencyService.js";
import { ORDER_READ_MODEL_POLICY, isStaleRead } from "./orderReadModelPolicy.js";
import {
  ORDER_DEGRADATION_POLICY,
  evaluateDegradationState,
  shouldBlockOrderMutation
} from "./orderDegradationPolicy.js";
import { evaluateOrderSla, ORDER_SLA_POLICY } from "./orderSlaPolicies.js";

describe("tenant order engine policy", () => {
  it("merges partial overrides onto defaults", () => {
    const policy = mergeOrderEnginePolicy({
      autoAcceptOnPayment: true,
      sla: { preparingDelayWarningMs: 10 * 60 * 1000 }
    });
    assert.equal(policy.autoAcceptOnPayment, true);
    assert.equal(policy.cancelAfterAccepted, DEFAULT_ORDER_ENGINE_POLICY.cancelAfterAccepted);
    assert.equal(policy.sla.preparingDelayWarningMs, 10 * 60 * 1000);
    assert.equal(policy.sla.maxActiveAgeMs, DEFAULT_ORDER_ENGINE_POLICY.sla.maxActiveAgeMs);
  });

  it("uses tenant SLA thresholds in evaluateOrderSla", () => {
    const started = new Date(Date.now() - 11 * 60 * 1000);
    assert.equal(
      evaluateOrderSla({
        status: "PREPARING",
        createdAt: started,
        kitchenStartedAt: started,
        completedAt: null,
        updatedAt: started,
        sla: { ...ORDER_SLA_POLICY, preparingDelayWarningMs: 10 * 60 * 1000 }
      }),
      "preparing_delayed"
    );
  });
});

describe("event versioning", () => {
  it("parses v1 envelopes", () => {
    const v1 = buildOrderEventEnvelope({
      type: "order.created",
      orderId: "o1",
      restaurantId: "r1",
      sequence: 1,
      status: "CREATED",
      totalCents: 5000,
      customerUserId: null,
      displaySeq: 7
    });
    const parsed = parseOrderEventEnvelopeAny(v1);
    assert.equal(parsed.schemaVersion, 1);
    assert.equal(parsed.payload.displayNumber, "#7");
  });

  it("normalizes v2 to v1 shape for consumers", () => {
    const v1 = buildOrderEventEnvelope({
      type: "order.accepted",
      orderId: "o2",
      restaurantId: "r1",
      sequence: 2,
      status: "ACCEPTED",
      totalCents: 5000,
      customerUserId: "u1",
      displaySeq: 8
    });
    const v2 = {
      ...v1,
      schemaVersion: 2,
      payload: { ...v1.payload, slaSignal: "accepted_stalled", tenantPolicyVersion: 3 }
    };
    const parsed = parseOrderEventEnvelopeAny(v2);
    assert.equal(parsed.schemaVersion, 1);
    assert.equal(parsed.payload.status, "ACCEPTED");
    assert.equal("slaSignal" in parsed.payload, false);
  });

  it("documents evolution policy", () => {
    assert.equal(EVENT_EVOLUTION_POLICY.strategy, "additive-only");
    assert.equal(canConsumerProcessVersion(1, 1), true);
  });
});

describe("read model consistency", () => {
  it("defines per-surface freshness guarantees", () => {
    assert.equal(ORDER_READ_MODEL_POLICY.adminOrderDetail.consistency, "strong");
    assert.equal(ORDER_READ_MODEL_POLICY.adminOrderList.consistency, "eventual");
  });

  it("detects stale eventual reads", () => {
    const old = new Date(Date.now() - 10_000);
    assert.equal(isStaleRead("adminOrderList", old), true);
    assert.equal(isStaleRead("adminOrderDetail", old), false);
  });
});

describe("graceful degradation", () => {
  it("never blocks order mutations", () => {
    assert.equal(shouldBlockOrderMutation("critical"), false);
    assert.equal(ORDER_DEGRADATION_POLICY.acceptOrdersWhenRealtimeDown, true);
  });

  it("escalates degradation by outbox backlog", () => {
    assert.equal(evaluateDegradationState(100), "healthy");
    assert.equal(evaluateDegradationState(600), "degraded");
    assert.equal(evaluateDegradationState(2500), "critical");
  });
});
