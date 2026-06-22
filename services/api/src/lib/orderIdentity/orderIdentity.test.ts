import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  computeDisplayPeriodKey,
  DEFAULT_ORDER_IDENTITY_POLICY,
  mergeOrderIdentityPolicy
} from "./orderIdentityPolicy.js";
import { assertValidInternalOrderId } from "./orderInternalId.js";
import { formatTenantDisplayNumber, formatDisplayNumber } from "./orderTenantDisplay.js";
import { deriveTrackingCode } from "./orderTrackingCode.js";
import { buildOrderIdentitySnapshot } from "./orderIdentitySnapshot.js";
import {
  ORDER_IDENTITY_CROSS_SERVICE_RULES,
  ORDER_IDENTITY_IMMUTABILITY
} from "./index.js";

describe("order identity policy", () => {
  it("defaults to never reset display numbers", () => {
    assert.equal(DEFAULT_ORDER_IDENTITY_POLICY.displayNumberReset, "never");
    assert.equal(computeDisplayPeriodKey("never"), "all");
  });

  it("computes yearly and monthly period keys", () => {
    const d = new Date("2026-06-15T12:00:00Z");
    assert.equal(computeDisplayPeriodKey("yearly", d), "2026");
    assert.equal(computeDisplayPeriodKey("monthly", d), "2026-06");
  });

  it("merges tenant identity overrides", () => {
    const p = mergeOrderIdentityPolicy({ displayNumberReset: "yearly", trackingCodePrefix: "pm" });
    assert.equal(p.displayNumberReset, "yearly");
    assert.equal(p.trackingCodePrefix, "PM");
  });
});

describe("tenant display formatting", () => {
  it("formats plain and period-scoped numbers", () => {
    assert.equal(formatTenantDisplayNumber(1024, "all"), "#1024");
    assert.equal(formatTenantDisplayNumber(42, "2026"), "#2026-42");
  });

  it("falls back to order id suffix when no display seq", () => {
    assert.match(formatDisplayNumber(null, "clxyz1234567890abcdef"), /^#/);
  });
});

describe("tracking code derivation", () => {
  it("builds stable tracking codes from backend fields", () => {
    const code = deriveTrackingCode({
      displaySeq: 1024,
      displayPeriodKey: "all",
      internalOrderId: "clxyz1234567890abcdef",
      policy: { trackingCodePrefix: "ORD" }
    });
    assert.equal(code, "ORD-1024-CDEF");
  });

  it("includes period in tracking code when reset policy active", () => {
    const code = deriveTrackingCode({
      displaySeq: 7,
      displayPeriodKey: "2026-06",
      internalOrderId: "clxyz1234567890abcdef",
      policy: { trackingCodePrefix: "ORD" }
    });
    assert.equal(code, "ORD-2026-06-7-CDEF");
  });
});

describe("identity snapshot", () => {
  it("bundles all identity layers for cross-service use", () => {
    const snap = buildOrderIdentitySnapshot(
      {
        id: "clxyz1234567890abcdef",
        restaurantId: "rest_1",
        displaySeq: 99,
        displayPeriodKey: "all",
        sourceSessionId: "qr_sess_1",
        sourceSessionType: "QR",
        internalIdSchema: "cuid",
        gs1Identifier: "SRVOS.ABCD1234.0000.000099.FFFF",
        receiptSearchHash: "abc123",
        federationId: "serveos-global:deadbeef"
      },
      { trackingCodePrefix: "ORD" }
    );
    assert.equal(snap.internalOrderId, "clxyz1234567890abcdef");
    assert.equal(snap.displayNumber, "#99");
    assert.equal(snap.gs1Identifier, "SRVOS.ABCD1234.0000.000099.FFFF");
    assert.equal(snap.federationId, "serveos-global:deadbeef");
    assert.match(snap.trackingCode, /^ORD-99-/);
    assert.equal(snap.sourceSessionId, "qr_sess_1");
  });
});

describe("internal order id validation", () => {
  it("accepts cuid-shaped ids", () => {
    assert.doesNotThrow(() => assertValidInternalOrderId("clxyz1234567890abcdefghij"));
  });

  it("rejects empty ids", () => {
    assert.throws(() => assertValidInternalOrderId(""), /invalid_internal_order_id/);
  });
});

describe("cross-service identity rules", () => {
  it("documents immutability and service references", () => {
    assert.equal(ORDER_IDENTITY_IMMUTABILITY.internalOrderId, true);
    assert.equal(ORDER_IDENTITY_CROSS_SERVICE_RULES.kds, "internalOrderId");
    assert.equal(ORDER_IDENTITY_CROSS_SERVICE_RULES.paymentService, "provider_externalId → internalOrderId");
  });
});
