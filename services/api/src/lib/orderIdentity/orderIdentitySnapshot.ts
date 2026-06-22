import type { Order } from "@prisma/client";
import type { OrderIdentitySnapshot } from "./orderIdentityTypes.js";
import { loadRestaurantIdentityPolicy } from "./orderIdentityPolicy.js";
import { formatTenantDisplayNumber } from "./orderTenantDisplay.js";
import { deriveTrackingCode } from "./orderTrackingCode.js";
import { receiptLookupCode } from "./orderReceiptHash.js";

type OrderIdentityFields = Pick<
  Order,
  | "id"
  | "restaurantId"
  | "displaySeq"
  | "displayPeriodKey"
  | "sourceSessionId"
  | "sourceSessionType"
  | "internalIdSchema"
  | "gs1Identifier"
  | "receiptSearchHash"
  | "federationId"
>;

export function buildOrderIdentitySnapshot(
  order: OrderIdentityFields,
  policy?: { trackingCodePrefix: string }
): OrderIdentitySnapshot {
  const trackingPolicy = policy ?? { trackingCodePrefix: "ORD" };
  const displayNumber = formatTenantDisplayNumber(order.displaySeq, order.displayPeriodKey);

  return {
    internalOrderId: order.id,
    internalIdSchema: order.internalIdSchema,
    restaurantId: order.restaurantId,
    displayNumber,
    displaySeq: order.displaySeq,
    displayPeriodKey: order.displayPeriodKey,
    trackingCode: deriveTrackingCode({
      displaySeq: order.displaySeq,
      displayPeriodKey: order.displayPeriodKey,
      internalOrderId: order.id,
      policy: trackingPolicy
    }),
    gs1Identifier: order.gs1Identifier,
    receiptSearchHash: order.receiptSearchHash,
    receiptLookupCode: order.receiptSearchHash ? receiptLookupCode(order.receiptSearchHash) : null,
    federationId: order.federationId,
    sourceSessionId: order.sourceSessionId,
    sourceSessionType: order.sourceSessionType
  };
}

export async function buildOrderIdentitySnapshotForRestaurant(
  prisma: { restaurant: { findUnique: Function } },
  order: OrderIdentityFields
): Promise<OrderIdentitySnapshot> {
  const policy = await loadRestaurantIdentityPolicy(prisma as never, order.restaurantId);
  return buildOrderIdentitySnapshot(order, policy);
}
