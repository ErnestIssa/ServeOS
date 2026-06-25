import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { PrismaClient } from "@prisma/client";
import { getSourceContract, ORDER_SOURCE_CONTRACTS } from "./orderSourceContracts.js";
import {
  buildPlacementSourceContext,
  buildSourceIdentifier,
  inferCanonicalSourceFromPlacement,
  normalizeToCanonicalSource
} from "./orderSourceResolution.js";
import { validateOrderSourcePlacement } from "./orderSourceValidation.js";
import { resolveEffectiveSourceContract, mergeTenantSourcePolicy } from "./orderSourcePolicy.js";
import {
  buildSourceAttributionSnapshot,
  buildOrderSourceMetadata,
  SOURCE_ANALYTICS_DIMENSIONS
} from "./orderSourceAttribution.js";
import { buildSourceNotificationPlan } from "./orderSourceNotifications.js";
import {
  derivePlacementDefaultsFromSource,
  assertSourcePaymentGate
} from "./orderSourcePayment.js";
import { PHASE_1_ORDER_SOURCES, FUTURE_ORDER_SOURCES } from "./orderSourceTypes.js";
import type { PlaceOrderInput } from "../orders/orderTypes.js";

const baseInput = (overrides: Partial<PlaceOrderInput> = {}): PlaceOrderInput => ({
  restaurantId: "rest_1",
  lines: [{ menuItemId: "item_1", quantity: 1 }],
  ...overrides
});

function staffPrisma(role = "STAFF"): PrismaClient {
  return {
    membership: {
      findUnique: async () => ({ role })
    }
  } as unknown as PrismaClient;
}

function forbiddenPrisma(): PrismaClient {
  return {
    membership: {
      findUnique: async () => null
    }
  } as unknown as PrismaClient;
}

describe("source resolution", () => {
  it("normalizes legacy RESERVATION to RESERVATION_ORDER", () => {
    assert.equal(normalizeToCanonicalSource("RESERVATION"), "RESERVATION_ORDER");
  });

  it("rejects future sources", () => {
    assert.throws(() => normalizeToCanonicalSource("KIOSK_ORDER"), /source_not_implemented/);
  });

  it("infers source from placement hints", () => {
    assert.equal(inferCanonicalSourceFromPlacement(baseInput({ reservationId: "res_1" })), "RESERVATION_ORDER");
    assert.equal(
      inferCanonicalSourceFromPlacement(
        baseInput({ partnerId: "uber", externalPartnerOrderId: "ext_1" })
      ),
      "DELIVERY_PARTNER"
    );
    assert.equal(
      inferCanonicalSourceFromPlacement(baseInput({ createdByContext: "STAFF", createdByUserId: "u1" })),
      "STAFF_CREATED"
    );
  });

  it("builds stable source identifiers", () => {
    const ctx = buildPlacementSourceContext(
      baseInput({ partnerId: "deliveroo", externalPartnerOrderId: "D-99", source: "DELIVERY_PARTNER" })
    );
    assert.equal(buildSourceIdentifier(ctx), "deliveroo:D-99");
  });
});

describe("QR_ORDER source", () => {
  const contract = getSourceContract("QR_ORDER");

  it("valid path with customer account", async () => {
    const ctx = buildPlacementSourceContext(baseInput({ customerUserId: "cust_1", source: "QR_ORDER" }));
    await assert.doesNotReject(() => validateOrderSourcePlacement(staffPrisma(), contract, ctx));
    assert.equal(derivePlacementDefaultsFromSource(contract).initialStatus, "PENDING_PAYMENT");
  });

  it("invalid without customer or session", async () => {
    const ctx = buildPlacementSourceContext(baseInput({ source: "QR_ORDER" }));
    await assert.rejects(
      () => validateOrderSourcePlacement(staffPrisma(), contract, ctx),
      /source_customer_or_session_required/
    );
  });
});

describe("WALK_IN source", () => {
  const contract = getSourceContract("WALK_IN");

  it("valid without customer account", async () => {
    const ctx = buildPlacementSourceContext(baseInput({ source: "WALK_IN", createdByContext: "STAFF" }));
    await assert.doesNotReject(() => validateOrderSourcePlacement(staffPrisma(), contract, ctx));
    assert.equal(contract.payment.payLaterAllowed, true);
  });

  it("invalid without lines", async () => {
    const ctx = buildPlacementSourceContext(baseInput({ source: "WALK_IN", lines: [] }));
    await assert.rejects(
      () => validateOrderSourcePlacement(staffPrisma(), contract, ctx),
      /source_lines_required/
    );
  });
});

describe("STAFF_CREATED source", () => {
  const contract = getSourceContract("STAFF_CREATED");

  it("valid with staff creator", async () => {
    const ctx = buildPlacementSourceContext(
      baseInput({ source: "STAFF_CREATED", createdByUserId: "staff_1", createdByContext: "STAFF" })
    );
    await assert.doesNotReject(() => validateOrderSourcePlacement(staffPrisma(), contract, ctx));
  });

  it("invalid without staff creator", async () => {
    const ctx = buildPlacementSourceContext(baseInput({ source: "STAFF_CREATED" }));
    await assert.rejects(
      () => validateOrderSourcePlacement(staffPrisma(), contract, ctx),
      /source_staff_creator_required/
    );
  });

  it("forbidden when creator not venue staff", async () => {
    const ctx = buildPlacementSourceContext(
      baseInput({ source: "STAFF_CREATED", createdByUserId: "x", createdByContext: "STAFF" })
    );
    await assert.rejects(
      () => validateOrderSourcePlacement(forbiddenPrisma(), contract, ctx),
      /source_staff_creator_forbidden/
    );
  });
});

describe("PHONE_ORDER source", () => {
  const contract = getSourceContract("PHONE_ORDER");

  it("requires staff creator like staff-created", async () => {
    const ctx = buildPlacementSourceContext(
      baseInput({ source: "PHONE_ORDER", createdByUserId: "staff_1", createdByContext: "STAFF" })
    );
    await assert.doesNotReject(() => validateOrderSourcePlacement(staffPrisma(), contract, ctx));
    assert.equal(buildSourceNotificationPlan(contract).channels.includes("SMS"), true);
  });
});

describe("RESERVATION_ORDER source", () => {
  const contract = getSourceContract("RESERVATION_ORDER");

  it("valid with reservation link", async () => {
    const ctx = buildPlacementSourceContext(baseInput({ source: "RESERVATION_ORDER", reservationId: "res_1" }));
    await assert.doesNotReject(() => validateOrderSourcePlacement(staffPrisma(), contract, ctx));
  });

  it("invalid without reservation", async () => {
    const ctx = buildPlacementSourceContext(baseInput({ source: "RESERVATION_ORDER" }));
    await assert.rejects(
      () => validateOrderSourcePlacement(staffPrisma(), contract, ctx),
      /source_reservation_required/
    );
  });
});

describe("DELIVERY_PARTNER source", () => {
  const contract = getSourceContract("DELIVERY_PARTNER");

  it("valid with partner reference", async () => {
    const ctx = buildPlacementSourceContext(
      baseInput({
        source: "DELIVERY_PARTNER",
        partnerId: "uber",
        externalPartnerOrderId: "UE-123"
      })
    );
    await assert.doesNotReject(() => validateOrderSourcePlacement(staffPrisma(), contract, ctx));
    assert.equal(contract.payment.externalPaymentOwned, true);
    assert.equal(derivePlacementDefaultsFromSource(contract).paymentStatus, "PAID");
  });

  it("invalid without partner reference", async () => {
    const ctx = buildPlacementSourceContext(baseInput({ source: "DELIVERY_PARTNER" }));
    await assert.rejects(
      () => validateOrderSourcePlacement(staffPrisma(), contract, ctx),
      /source_partner_reference_required/
    );
  });
});

describe("tenant source policy overrides", () => {
  it("merges payment overrides without removing validation gates", () => {
    const tenant = mergeTenantSourcePolicy({
      sources: { WALK_IN: { payment: { payLaterAllowed: false } } }
    });
    const effective = resolveEffectiveSourceContract("WALK_IN", tenant);
    assert.equal(effective.payment.payLaterAllowed, false);
    assert.equal(effective.validation.requiresRestaurantContext, true);
  });
});

describe("source attribution and audit metadata", () => {
  it("builds immutable attribution snapshot", () => {
    const contract = getSourceContract("QR_ORDER");
    const ctx = buildPlacementSourceContext(
      baseInput({ customerUserId: "c1", sourceSessionId: "sess_1", source: "QR_ORDER" })
    );
    const snap = buildSourceAttributionSnapshot(contract, ctx);
    assert.equal(snap.source, "QR_ORDER");
    assert.equal(snap.validationPassed, true);
    assert.equal(snap.attribution.channel, "qr_digital");
    const meta = buildOrderSourceMetadata(contract, ctx) as { immutable: boolean };
    assert.equal(meta.immutable, true);
  });

  it("defines analytics dimensions", () => {
    assert.ok(SOURCE_ANALYTICS_DIMENSIONS.includes("source"));
    assert.ok(SOURCE_ANALYTICS_DIMENSIONS.includes("revenueBucket"));
  });
});

describe("source payment gates", () => {
  it("blocks acceptance when QR payment required but unpaid", () => {
    const contract = getSourceContract("QR_ORDER");
    assert.throws(
      () => assertSourcePaymentGate(contract, "ACCEPTED", "UNPAID"),
      /source_payment_required_before_acceptance/
    );
  });

  it("allows walk-in pay-later acceptance", () => {
    const contract = getSourceContract("WALK_IN");
    assert.doesNotThrow(() => assertSourcePaymentGate(contract, "ACCEPTED", "UNPAID"));
  });
});

describe("phase 1 contract coverage", () => {
  it("defines all phase 1 sources", () => {
    for (const s of PHASE_1_ORDER_SOURCES) {
      assert.ok(ORDER_SOURCE_CONTRACTS[s]);
    }
    assert.equal(PHASE_1_ORDER_SOURCES.length, 6);
    assert.equal(FUTURE_ORDER_SOURCES.length, 4);
  });
});
