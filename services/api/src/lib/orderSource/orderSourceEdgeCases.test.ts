import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { PrismaClient } from "@prisma/client";
import { getSourceContract } from "./orderSourceContracts.js";
import {
  SOURCE_OWNERSHIP_MATRIX,
  resolveOwnershipHintsFromSource
} from "./orderSourceOwnershipBridge.js";
import {
  canApplySourceInterpretation,
  appendAttributionModifier
} from "./orderSourceLifecycle.js";
import {
  buildInitialCompositionalAttribution,
  resolveAnalyticsAttributionView
} from "./orderSourceComposableAnalytics.js";
import {
  freezeSourcePolicySnapshot,
  resolveFrozenContractFromMetadata,
  describeTenantPolicyChangeImpact
} from "./orderSourcePolicyVersioning.js";
import {
  assertSourcePaymentEvolution,
  resolvePaymentRulesForOrder
} from "./orderSourcePaymentEvolution.js";
import {
  buildSourceStateNotificationPlan,
  buildSourceStateNotificationPlanFromMetadata
} from "./orderSourceNotificationState.js";
import {
  reconcilePartnerPlacement,
  assertPartnerCancellationAllowed,
  assertPartnerPartialFulfillment
} from "./orderPartnerReconciliation.js";
import { buildOrderSourceMetadata } from "./orderSourceAttribution.js";
import { buildPlacementSourceContext } from "./orderSourceResolution.js";
import { mergeTenantSourcePolicy } from "./orderSourcePolicy.js";
import type { PlaceOrderInput } from "../orders/orderTypes.js";

const baseInput = (overrides: Partial<PlaceOrderInput> = {}): PlaceOrderInput => ({
  restaurantId: "rest_1",
  lines: [{ menuItemId: "item_1", quantity: 1 }],
  ...overrides
});

function partnerPrisma(existing = false, restaurantExists = true): PrismaClient {
  return {
    restaurant: {
      findUnique: async () => (restaurantExists ? { id: "rest_1" } : null)
    },
    orderPartnerIdentity: {
      findUnique: async () => (existing ? { orderId: "ord_existing" } : null)
    }
  } as unknown as PrismaClient;
}

describe("source ownership bridge", () => {
  it("defines matrix for all phase-1 sources", () => {
    for (const source of Object.keys(SOURCE_OWNERSHIP_MATRIX)) {
      assert.ok(SOURCE_OWNERSHIP_MATRIX[source as keyof typeof SOURCE_OWNERSHIP_MATRIX]);
    }
  });

  it("QR source overrides ownership to customer", () => {
    const contract = getSourceContract("QR_ORDER");
    const ctx = buildPlacementSourceContext(baseInput({ sourceSessionId: "sess_1" }));
    const hints = resolveOwnershipHintsFromSource(contract, ctx);
    assert.equal(hints.createdByContext, "CUSTOMER");
    assert.equal(hints.expectation.creationOwner, "customer");
  });

  it("delivery partner has shared fulfillment", () => {
    const contract = getSourceContract("DELIVERY_PARTNER");
    const hints = resolveOwnershipHintsFromSource(
      contract,
      buildPlacementSourceContext(
        baseInput({ source: "DELIVERY_PARTNER", partnerId: "p1", externalPartnerOrderId: "e1" })
      )
    );
    assert.equal(hints.expectation.fulfillmentOwner, "shared");
  });
});

describe("source lifecycle interpretations", () => {
  it("allows QR staff assist overlay", () => {
    assert.doesNotThrow(() => canApplySourceInterpretation("QR_ORDER", "STAFF_ASSISTED", true));
  });

  it("blocks invalid reinterpretation", () => {
    assert.throws(
      () => canApplySourceInterpretation("DELIVERY_PARTNER", "CONVERTED_TO_RESERVATION", true),
      /source_interpretation_not_allowed/
    );
  });

  it("appends compositional modifiers", () => {
    const base = buildInitialCompositionalAttribution("QR_ORDER", getSourceContract("QR_ORDER").analytics);
    const next = appendAttributionModifier(base, {
      type: "STAFF_ASSISTED",
      actorUserId: "staff_1"
    });
    assert.equal(next.modifiers.length, 1);
    assert.equal(next.modifiers[0]!.type, "STAFF_ASSISTED");
  });
});

describe("source policy versioning", () => {
  it("freezes policy at placement", () => {
    const contract = getSourceContract("WALK_IN");
    const frozen = freezeSourcePolicySnapshot(contract);
    assert.equal(frozen.source, "WALK_IN");
    assert.ok(frozen.frozenAt);
    assert.equal(frozen.payment.payLaterAllowed, true);
  });

  it("resolves frozen policy from metadata", () => {
    const contract = getSourceContract("QR_ORDER");
    const ctx = buildPlacementSourceContext(baseInput({ sourceSessionId: "s1", customerUserId: "c1" }));
    const meta = buildOrderSourceMetadata(contract, ctx);
    const frozen = resolveFrozenContractFromMetadata(meta);
    assert.equal(frozen?.source, "QR_ORDER");
  });

  it("tenant policy changes do not affect existing orders", () => {
    const impact = describeTenantPolicyChangeImpact(mergeTenantSourcePolicy({}), mergeTenantSourcePolicy({}));
    assert.equal(impact.affectsExistingOrders, false);
    assert.equal(impact.affectsNewPlacements, true);
  });
});

describe("payment evolution policy", () => {
  it("blocks staff line addition on partner orders", () => {
    const frozen = freezeSourcePolicySnapshot(getSourceContract("DELIVERY_PARTNER"));
    assert.throws(
      () =>
        assertSourcePaymentEvolution("staff_line_added", {
          frozenPolicy: frozen,
          paymentStatus: "PAID"
        }),
      /source_hybrid_line_addition_blocked/
    );
  });

  it("requires repayment gate for QR hybrid additions when paid", () => {
    const frozen = freezeSourcePolicySnapshot(getSourceContract("QR_ORDER"));
    assert.throws(
      () =>
        assertSourcePaymentEvolution("staff_line_added", {
          frozenPolicy: frozen,
          paymentStatus: "PAID"
        }),
      /source_repayment_required_after_line_addition/
    );
  });

  it("blocks partner refunds when restricted", () => {
    const frozen = freezeSourcePolicySnapshot(getSourceContract("DELIVERY_PARTNER"));
    assert.throws(
      () =>
        assertSourcePaymentEvolution("refund_requested", {
          frozenPolicy: frozen,
          paymentStatus: "PAID"
        }),
      /source_refund_restricted/
    );
  });

  it("resolves payment rules from order metadata", () => {
    const contract = getSourceContract("WALK_IN");
    const meta = buildOrderSourceMetadata(
      contract,
      buildPlacementSourceContext(baseInput({ createdByContext: "STAFF", createdByUserId: "u1" }))
    );
    const rules = resolvePaymentRulesForOrder(meta);
    assert.equal(rules?.splitPaymentAllowed, true);
  });
});

describe("state-bound notifications", () => {
  it("includes status-specific customer events for QR", () => {
    const plan = buildSourceStateNotificationPlan(getSourceContract("QR_ORDER"), "READY");
    assert.ok(plan.onStatus.READY?.includes("order.ready.customer"));
  });

  it("adds exceptional events for cancelled-after-accepted partner orders", () => {
    const plan = buildSourceStateNotificationPlan(getSourceContract("DELIVERY_PARTNER"), "CANCELLED", {
      cancelledAfterAccepted: true
    });
    assert.ok(plan.exceptional.includes("order.cancelled_after_acceptance.partner_callback"));
  });

  it("builds from frozen metadata", () => {
    const contract = getSourceContract("QR_ORDER");
    const meta = buildOrderSourceMetadata(
      contract,
      buildPlacementSourceContext(baseInput({ sourceSessionId: "s1", customerUserId: "c1" }))
    );
    const plan = buildSourceStateNotificationPlanFromMetadata(meta, "ACCEPTED", { delayed: true });
    assert.ok(plan?.exceptional.includes("order.delayed.customer"));
  });
});

describe("composable analytics attribution", () => {
  it("tracks creation vs modification sources", () => {
    const contract = getSourceContract("QR_ORDER");
    const comp = buildInitialCompositionalAttribution("QR_ORDER", contract.analytics);
    const withMod = appendAttributionModifier(comp, { type: "HYBRID_STAFF_LINE_ADDITION", actorUserId: "s1" });
    const view = resolveAnalyticsAttributionView("QR_ORDER", contract.analytics, withMod);
    assert.equal(view.creationSource, "QR_ORDER");
    assert.equal(view.hybridStaffModified, true);
  });
});

describe("partner reconciliation", () => {
  it("rejects duplicate partner callback", async () => {
    await assert.rejects(
      () =>
        reconcilePartnerPlacement(
          partnerPrisma(true),
          buildPlacementSourceContext(
            baseInput({
              source: "DELIVERY_PARTNER",
              partnerId: "uber",
              externalPartnerOrderId: "X-1",
              partnerTotalCents: 1000,
              internalTotalCents: 1000
            } as PlaceOrderInput & { internalTotalCents?: number }),
            { internalTotalCents: 1000 }
          )
        ),
      /partner_duplicate_callback/
    );
  });

  it("rejects total mismatch beyond tolerance", async () => {
    await assert.rejects(
      () =>
        reconcilePartnerPlacement(
          partnerPrisma(false),
          buildPlacementSourceContext(
            baseInput({
              source: "DELIVERY_PARTNER",
              partnerId: "uber",
              externalPartnerOrderId: "X-2",
              partnerTotalCents: 5000
            }),
            { internalTotalCents: 1000 }
          )
        ),
      /partner_total_mismatch/
    );
  });

  it("blocks partner cancel after acceptance", () => {
    assert.throws(
      () => assertPartnerCancellationAllowed("PREPARING", "partner"),
      /partner_cancel_after_acceptance_blocked/
    );
  });

  it("detects partial fulfillment mismatch", () => {
    assert.throws(
      () => assertPartnerPartialFulfillment(3, 2),
      /partner_partial_fulfillment_mismatch/
    );
  });
});
