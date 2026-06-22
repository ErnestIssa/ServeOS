import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { deriveGuestKey, resolveOwnershipType, ORDER_OWNERSHIP_RULES } from "./orderOwnershipPolicy.js";
import { ORDER_OWNERSHIP_IMMUTABILITY, type OrderOwnershipType } from "./orderOwnershipTypes.js";
import { ORDER_OWNERSHIP_PERMISSION_MATRIX } from "./orderOwnershipPermissions.js";

describe("order ownership types", () => {
  it("classifies customer account orders", () => {
    assert.equal(
      resolveOwnershipType({
        customerUserId: "user_1",
        createdByContext: "CUSTOMER",
        source: "QR_ORDER"
      }),
      "CUSTOMER_ACCOUNT"
    );
  });

  it("classifies guest orders", () => {
    assert.equal(
      resolveOwnershipType({
        customerUserId: null,
        createdByContext: "CUSTOMER",
        source: "QR_ORDER"
      }),
      "GUEST"
    );
  });

  it("classifies staff-created orders", () => {
    assert.equal(
      resolveOwnershipType({
        customerUserId: null,
        createdByContext: "STAFF",
        source: "STAFF_CREATED"
      }),
      "STAFF_CREATED"
    );
  });

  it("classifies partner-sourced orders", () => {
    assert.equal(
      resolveOwnershipType({
        customerUserId: null,
        createdByContext: "STAFF",
        source: "DELIVERY_PARTNER"
      }),
      "PARTNER_SOURCED"
    );
  });
});

describe("guest ownership key", () => {
  it("hashes contact info for guest traceability", () => {
    const a = deriveGuestKey({ customerEmail: "guest@example.com" });
    const b = deriveGuestKey({ customerEmail: "guest@example.com" });
    assert.equal(a, b);
    assert.equal(a?.length, 32);
  });

  it("returns null when no contact", () => {
    assert.equal(deriveGuestKey({}), null);
  });
});

describe("ownership immutability and permissions", () => {
  it("locks ownership snapshot at placement", () => {
    assert.equal(ORDER_OWNERSHIP_IMMUTABILITY.snapshotLockedAtPlacement, true);
    assert.equal(ORDER_OWNERSHIP_IMMUTABILITY.customerUserIdFrozen, true);
  });

  it("documents permission matrix", () => {
    assert.ok(ORDER_OWNERSHIP_PERMISSION_MATRIX.manager.includes("refund"));
    assert.ok(ORDER_OWNERSHIP_RULES.restaurantAccountability.includes("restaurantId"));
  });
});

describe("ownership type union", () => {
  it("covers all ownership categories", () => {
    const types: OrderOwnershipType[] = [
      "CUSTOMER_ACCOUNT",
      "GUEST",
      "STAFF_CREATED",
      "RESTAURANT_ACCOUNTABLE",
      "PARTNER_SOURCED"
    ];
    assert.equal(types.length, 5);
  });
});
