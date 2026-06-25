import type { OrderCreatedContext } from "@prisma/client";
import type { OrderSourceContract, OrderSourcePlacementContext } from "./orderSourceTypes.js";
import type { CanonicalOrderSource } from "./orderSourceTypes.js";

export type SourceOwnershipExpectation = {
  creationOwner: "customer" | "staff" | "partner" | "unknown";
  consumptionOwner: "customer" | "guest" | "staff" | "partner";
  fulfillmentOwner: "internal" | "partner" | "shared";
  sourceOverridesOwnership: boolean;
};

/** Interaction matrix — source contract wins over implicit ownership when flagged. */
export const SOURCE_OWNERSHIP_MATRIX: Record<CanonicalOrderSource, SourceOwnershipExpectation> = {
  QR_ORDER: {
    creationOwner: "customer",
    consumptionOwner: "customer",
    fulfillmentOwner: "internal",
    sourceOverridesOwnership: true
  },
  WALK_IN: {
    creationOwner: "unknown",
    consumptionOwner: "guest",
    fulfillmentOwner: "internal",
    sourceOverridesOwnership: false
  },
  STAFF_CREATED: {
    creationOwner: "staff",
    consumptionOwner: "customer",
    fulfillmentOwner: "internal",
    sourceOverridesOwnership: true
  },
  PHONE_ORDER: {
    creationOwner: "staff",
    consumptionOwner: "customer",
    fulfillmentOwner: "internal",
    sourceOverridesOwnership: true
  },
  RESERVATION_ORDER: {
    creationOwner: "customer",
    consumptionOwner: "customer",
    fulfillmentOwner: "internal",
    sourceOverridesOwnership: true
  },
  DELIVERY_PARTNER: {
    creationOwner: "partner",
    consumptionOwner: "customer",
    fulfillmentOwner: "shared",
    sourceOverridesOwnership: true
  }
};

export function resolveOwnershipHintsFromSource(
  contract: OrderSourceContract,
  ctx: OrderSourcePlacementContext
): {
  createdByContext: OrderCreatedContext;
  expectation: SourceOwnershipExpectation;
} {
  const expectation = SOURCE_OWNERSHIP_MATRIX[contract.source];
  const fromContract = contract.ownership.defaultCreatedByContext;

  if (expectation.sourceOverridesOwnership) {
    return { createdByContext: fromContract, expectation };
  }

  return {
    createdByContext: ctx.createdByContext ?? fromContract,
    expectation
  };
}

export const SOURCE_OWNERSHIP_BRIDGE_RULES = {
  precedence: "when sourceOverridesOwnership=true, contract.ownership.defaultCreatedByContext wins",
  immutability: "Order.source and ownership record remain immutable — matrix guides placement only"
} as const;
