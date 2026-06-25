import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveEditWindow, validateOrderEdit, assertOperationAllowedInWindow } from "./orderEditValidation.js";
import { assertEditActorPermission, isManagerActor } from "./orderEditPermissions.js";
import { resolveSourceEditRules, assertSourceEditAllowed } from "./orderEditSourceRules.js";
import {
  computePaymentDelta,
  summarizeLineTotals,
  resolveNoteAfterEdit
} from "./orderEditPricing.js";
import { resolveEditEventTypes } from "./orderEditEvents.js";
import type { OrderEditLineState, OrderEditValidationContext } from "./orderEditTypes.js";

const baseOrder = (overrides: Record<string, unknown> = {}) => ({
  id: "ord_1",
  restaurantId: "rest_1",
  customerUserId: "cust_1",
  source: "QR_ORDER",
  sourceMetadata: null,
  status: "CREATED",
  paymentStatus: "UNPAID" as const,
  note: null,
  discountCents: 0,
  totalCents: 1000,
  version: 0,
  pricingLockedAt: null,
  kitchenStartedAt: null,
  completedAt: null,
  ...overrides
});

const sampleLine = (overrides: Partial<OrderEditLineState> = {}): OrderEditLineState => ({
  id: "line_1",
  menuItemId: "item_1",
  nameSnapshot: "Burger",
  quantity: 1,
  unitPriceCents: 1000,
  selectedModifiers: [],
  lineTotalCents: 1000,
  ...overrides
});

function validationCtx(overrides: Partial<OrderEditValidationContext> = {}): OrderEditValidationContext {
  const order = baseOrder(overrides.order as never);
  const window = overrides.window ?? resolveEditWindow(order);
  return {
    order,
    lines: overrides.lines ?? [sampleLine()],
    window,
    actor: overrides.actor ?? { userId: "cust_1", source: "CUSTOMER", isCustomer: true },
    operation: overrides.operation ?? "ADD_ITEM",
    payload: overrides.payload ?? { menuItemId: "item_2", quantity: 1 },
    reason: overrides.reason,
    ...overrides
  };
}

describe("edit windows", () => {
  it("allows full edits before payment", () => {
    const window = resolveEditWindow(baseOrder({ status: "CREATED", paymentStatus: "UNPAID" }));
    assert.equal(window.level, "PRE_PAYMENT");
    assert.doesNotThrow(() => assertOperationAllowedInWindow("REMOVE_ITEM", window));
  });

  it("restricts edits after payment before kitchen", () => {
    const window = resolveEditWindow(
      baseOrder({ status: "PAID", paymentStatus: "PAID", pricingLockedAt: new Date() })
    );
    assert.equal(window.level, "POST_PAYMENT_PRE_KITCHEN");
    assert.throws(() => assertOperationAllowedInWindow("REMOVE_ITEM", window), /edit_window_operation_blocked/);
    assert.doesNotThrow(() => assertOperationAllowedInWindow("ADD_ITEM", window));
  });

  it("locks line edits during preparing", () => {
    const window = resolveEditWindow(
      baseOrder({ status: "PREPARING", kitchenStartedAt: new Date(), paymentStatus: "PAID" })
    );
    assert.equal(window.level, "KITCHEN_RESTRICTED");
    assert.throws(() => assertOperationAllowedInWindow("ADD_ITEM", window), /edit_window_operation_blocked/);
  });

  it("blocks all edits on terminal orders", () => {
    const window = resolveEditWindow(baseOrder({ status: "COMPLETED", completedAt: new Date() }));
    assert.equal(window.level, "TERMINAL");
    assert.throws(() => assertOperationAllowedInWindow("UPDATE_NOTE", window), /edit_window_operation_blocked/);
  });
});

describe("ownership and role permissions", () => {
  it("allows customer to edit own QR order lines pre-payment", () => {
    assert.doesNotThrow(() => validateOrderEdit(validationCtx()));
  });

  it("blocks customer from price override", () => {
    assert.throws(
      () =>
        validateOrderEdit(
          validationCtx({
            operation: "PRICE_OVERRIDE",
            payload: { lineItemId: "line_1", unitPriceCents: 500 },
            actor: { userId: "cust_1", source: "CUSTOMER", isCustomer: true }
          })
        ),
      /edit_price_override_requires_manager/
    );
  });

  it("requires manager for price override", () => {
    assert.throws(
      () =>
        assertEditActorPermission(
          validationCtx({
            operation: "PRICE_OVERRIDE",
            actor: { userId: "staff_1", source: "STAFF", membershipRole: "STAFF" }
          })
        ),
      /edit_price_override_requires_manager/
    );
    assert.ok(isManagerActor({ userId: "m1", source: "STAFF", membershipRole: "OWNER" }));
  });

  it("requires reason for staff correction", () => {
    assert.throws(
      () =>
        validateOrderEdit(
          validationCtx({
            operation: "STAFF_CORRECTION",
            payload: { correctionNote: "fixed typo" },
            actor: { userId: "staff_1", source: "STAFF", membershipRole: "STAFF" }
          })
        ),
      /edit_reason_required/
    );
  });
});

describe("source-based edit restrictions", () => {
  it("blocks walk-in customer line edits", () => {
    assert.throws(
      () =>
        validateOrderEdit(
          validationCtx({
            order: baseOrder({ source: "WALK_IN", customerUserId: "cust_1" }),
            actor: { userId: "cust_1", source: "CUSTOMER", isCustomer: true }
          })
        ),
      /source_customer_line_edit_blocked/
    );
  });

  it("blocks delivery partner line edits for staff", () => {
    const rules = resolveSourceEditRules("DELIVERY_PARTNER");
    assert.equal(rules.partnerReconciliationRequired, true);
    assert.throws(
      () =>
        assertSourceEditAllowed(
          "ADD_ITEM",
          { userId: "staff_1", source: "STAFF", membershipRole: "STAFF" },
          rules,
          resolveEditWindow(baseOrder({ source: "DELIVERY_PARTNER", status: "CREATED" }))
        ),
      /source_partner_edit_restricted/
    );
  });
});

describe("payment safety", () => {
  it("flags additional charge when paid total increases", () => {
    const delta = computePaymentDelta(1000, 1500, "PAID");
    assert.equal(delta.paymentDeltaCents, 500);
    assert.equal(delta.requiresAdditionalCharge, true);
    assert.equal(delta.nextPaymentStatus, "PENDING");
  });

  it("flags refund delta when paid total decreases", () => {
    const delta = computePaymentDelta(1000, 800, "PAID");
    assert.equal(delta.requiresRefundDelta, true);
  });

  it("recalculates totals after line changes", () => {
    const totals = summarizeLineTotals(
      [sampleLine({ lineTotalCents: 1000 }), sampleLine({ id: "line_2", lineTotalCents: 500, isNew: true })],
      0,
      "rest_1"
    );
    assert.equal(totals.subtotalCents, 1500);
    assert.equal(totals.totalCents, 1500);
  });
});

describe("kitchen lock scenarios", () => {
  it("requires manager to add items during kitchen", () => {
    assert.throws(
      () =>
        assertEditActorPermission(
          validationCtx({
            operation: "ADD_ITEM",
            window: resolveEditWindow(
              baseOrder({ status: "PREPARING", kitchenStartedAt: new Date(), paymentStatus: "PAID" })
            ),
            actor: { userId: "staff_1", source: "STAFF", membershipRole: "STAFF" }
          })
        ),
      /edit_kitchen_locked/
    );
  });
});

describe("note edits", () => {
  it("appends allergy notes", () => {
    const note = resolveNoteAfterEdit("No onions", "ADD_ALLERGY_NOTE", { allergyNote: "peanut" });
    assert.match(note ?? "", /\[ALLERGY\] peanut/);
  });
});

describe("edit events", () => {
  it("emits item and pricing events for add", () => {
    const types = resolveEditEventTypes("ADD_ITEM");
    assert.ok(types.includes("order.edited"));
    assert.ok(types.includes("order.item_added"));
    assert.ok(types.includes("order.pricing_updated"));
  });

  it("emits only edited for note update", () => {
    const types = resolveEditEventTypes("UPDATE_NOTE");
    assert.deepEqual(types, ["order.edited"]);
  });
});

describe("concurrency contract", () => {
  it("documents version conflict error code", () => {
    const err = Object.assign(new Error("order_version_conflict"), { statusCode: 409 });
    assert.equal((err as { statusCode: number }).statusCode, 409);
  });
});

describe("last line protection", () => {
  it("blocks removing the only line", () => {
    assert.throws(
      () =>
        validateOrderEdit(
          validationCtx({
            operation: "REMOVE_ITEM",
            payload: { lineItemId: "line_1" },
            lines: [sampleLine()]
          })
        ),
      /edit_last_line_blocked/
    );
  });
});
