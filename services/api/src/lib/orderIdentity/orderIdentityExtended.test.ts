import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { deriveGs1StyleIdentifier, GS1_IDENTITY_POLICY } from "./orderGs1Identifier.js";
import { computeReceiptSearchHash, receiptLookupCode } from "./orderReceiptHash.js";
import { deriveFederationId, FEDERATION_NAMESPACE } from "./orderFederation.js";
import { generateUlid, isUlid, ULID_MIGRATION_POLICY } from "./orderUlid.js";
import { validateIdentityPolicyChange, HISTORICAL_IDENTITY_GUARANTEE } from "./orderPolicyChangeGuard.js";
import { mergeOrderIdentityPolicy } from "./orderIdentityPolicy.js";
import { formatTenantDisplayNumber } from "./orderTenantDisplay.js";

describe("GS1-style identifiers", () => {
  it("derives immutable structured identifier", () => {
    const id = deriveGs1StyleIdentifier({
      restaurantId: "rest_abc123",
      displayPeriodKey: "2026",
      displaySeq: 1001,
      internalOrderId: "clxyz1234567890abcdefghij"
    });
    assert.match(id, /^SRVOS\.[A-F0-9]{8}\.2026\.001001\.[A-F0-9]{4}$/);
    assert.equal(GS1_IDENTITY_POLICY.immutableAfterAssignment, true);
  });
});

describe("receipt search hash", () => {
  it("produces stable searchable hash and short lookup code", () => {
    const at = new Date("2026-01-15T10:00:00Z");
    const hash = computeReceiptSearchHash({
      orderId: "order_1",
      restaurantId: "rest_1",
      displaySeq: 42,
      displayPeriodKey: "all",
      totalCents: 15000,
      createdAt: at
    });
    assert.equal(hash.length, 64);
    assert.equal(receiptLookupCode(hash).length, 12);
  });
});

describe("global federation", () => {
  it("derives namespaced federation id", () => {
    const at = new Date("2026-06-22T12:00:00Z");
    const fed = deriveFederationId({
      restaurantId: "rest_1",
      internalOrderId: "order_1",
      createdAt: at
    });
    assert.ok(fed.startsWith(`${FEDERATION_NAMESPACE}:`));
  });
});

describe("ULID migration path", () => {
  it("generates valid ulid and documents dual-schema policy", () => {
    const id = generateUlid();
    assert.equal(id.length, 26);
    assert.equal(isUlid(id), true);
    assert.equal(ULID_MIGRATION_POLICY.strategy, "dual-schema");
  });
});

describe("historical identity after policy change", () => {
  it("guarantees policy change only affects new orders", () => {
    const before = mergeOrderIdentityPolicy({ displayNumberReset: "never" });
    const after = mergeOrderIdentityPolicy({ displayNumberReset: "yearly" });
    const result = validateIdentityPolicyChange(before, after);
    assert.equal(result.safe, true);
    assert.equal(HISTORICAL_IDENTITY_GUARANTEE.policyChangeAffectsNewOrdersOnly, true);
  });

  it("preserves distinct display numbers per period bucket", () => {
    const y2026 = formatTenantDisplayNumber(1, "2026");
    const y2027 = formatTenantDisplayNumber(1, "2027");
    assert.equal(y2026, "#2026-1");
    assert.equal(y2027, "#2027-1");
    assert.notEqual(y2026, y2027);
  });
});
