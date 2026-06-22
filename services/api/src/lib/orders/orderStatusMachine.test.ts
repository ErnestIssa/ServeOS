import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ALLOWED_TRANSITIONS,
  deriveLockFlags,
  getKitchenAdvanceTarget,
  isTransitionAllowed,
  validateTransition
} from "./orderStatusMachine.js";
import { normalizeOrderStatus } from "./orderTypes.js";

describe("order status machine", () => {
  it("normalizes legacy statuses", () => {
    assert.equal(normalizeOrderStatus("PENDING"), "CREATED");
    assert.equal(normalizeOrderStatus("CONFIRMED"), "ACCEPTED");
    assert.equal(normalizeOrderStatus("PREPARING"), "PREPARING");
  });

  it("allows kitchen happy path", () => {
    assert.equal(isTransitionAllowed("CREATED", "ACCEPTED"), true);
    assert.equal(isTransitionAllowed("ACCEPTED", "PREPARING"), true);
    assert.equal(isTransitionAllowed("PREPARING", "READY"), true);
    assert.equal(isTransitionAllowed("READY", "COMPLETED"), true);
  });

  it("rejects invalid transitions", () => {
    assert.equal(isTransitionAllowed("COMPLETED", "PREPARING"), false);
    assert.equal(isTransitionAllowed("ARCHIVED", "CREATED"), false);
    assert.equal(isTransitionAllowed("CREATED", "READY"), false);
  });

  it("maps legacy pending to created advance", () => {
    assert.equal(getKitchenAdvanceTarget("PENDING"), "ACCEPTED");
    assert.equal(getKitchenAdvanceTarget("CONFIRMED"), "PREPARING");
  });

  it("derives lock flags after payment", () => {
    const flags = deriveLockFlags({
      status: "PAID",
      pricingLockedAt: new Date(),
      kitchenStartedAt: null,
      completedAt: null
    });
    assert.equal(flags.pricingLocked, true);
    assert.equal(flags.kitchenStarted, false);
  });

  it("enforces manager for refund from completed", () => {
    assert.throws(
      () =>
        validateTransition(
          "COMPLETED",
          "REFUNDED",
          { source: "STAFF", userId: "u1", membershipRole: "STAFF" },
          deriveLockFlags({
            status: "COMPLETED",
            pricingLockedAt: new Date(),
            kitchenStartedAt: new Date(),
            completedAt: new Date()
          })
        ),
      (err: Error) => err.message === "refund_requires_manager"
    );
  });

  it("terminal states have no outbound transitions", () => {
    assert.deepEqual(ALLOWED_TRANSITIONS.REJECTED, []);
    assert.deepEqual(ALLOWED_TRANSITIONS.ARCHIVED, []);
  });
});
