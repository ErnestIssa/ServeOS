import type { InternalIdSchema } from "./orderIdentityTypes.js";
import { deriveGs1StyleIdentifier } from "./orderGs1Identifier.js";
import { deriveFederationId } from "./orderFederation.js";
import { computeReceiptSearchHash } from "./orderReceiptHash.js";

export function buildExtendedIdentityFields(input: {
  orderId: string;
  restaurantId: string;
  displaySeq: number;
  displayPeriodKey: string;
  totalCents: number;
  createdAt: Date;
  internalIdSchema: InternalIdSchema;
}) {
  const gs1Identifier = deriveGs1StyleIdentifier({
    restaurantId: input.restaurantId,
    displayPeriodKey: input.displayPeriodKey,
    displaySeq: input.displaySeq,
    internalOrderId: input.orderId
  });

  const receiptSearchHash = computeReceiptSearchHash({
    orderId: input.orderId,
    restaurantId: input.restaurantId,
    displaySeq: input.displaySeq,
    displayPeriodKey: input.displayPeriodKey,
    totalCents: input.totalCents,
    createdAt: input.createdAt
  });

  const federationId = deriveFederationId({
    restaurantId: input.restaurantId,
    internalOrderId: input.orderId,
    createdAt: input.createdAt
  });

  return {
    internalIdSchema: input.internalIdSchema,
    gs1Identifier,
    receiptSearchHash,
    federationId
  };
}
