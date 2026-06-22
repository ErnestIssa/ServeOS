import type { Prisma } from "@prisma/client";
import type { OrderIdentityAssignmentInput, SourceSessionType } from "./orderIdentityTypes.js";
import { allocateTenantDisplayNumber } from "./orderTenantNumber.js";
import { logIdentityAssignment } from "./orderIdentityAudit.js";
import { deriveTrackingCode } from "./orderTrackingCode.js";
import { loadRestaurantIdentityPolicy } from "./orderIdentityPolicy.js";
import { formatTenantDisplayNumber } from "./orderTenantDisplay.js";

export type PreparedOrderIdentity = {
  displaySeq: number;
  displayPeriodKey: string;
  sourceSessionId: string | null;
  sourceSessionType: string | null;
};

/** Pre-order-create: allocate tenant number + normalize session fields inside transaction. */
export async function prepareOrderIdentityFields(
  tx: Prisma.TransactionClient,
  input: OrderIdentityAssignmentInput
): Promise<PreparedOrderIdentity> {
  const allocation = await allocateTenantDisplayNumber(tx, input.restaurantId);

  return {
    displaySeq: allocation.displaySeq,
    displayPeriodKey: allocation.displayPeriodKey,
    sourceSessionId: input.sourceSessionId?.trim() || null,
    sourceSessionType: input.sourceSessionType ?? null
  };
}

/** Post-order-create: audit identity assignments (internal ID from Prisma + tenant number). */
export async function recordOrderIdentityAssignments(
  tx: Prisma.TransactionClient,
  input: {
    orderId: string;
    restaurantId: string;
    displaySeq: number;
    displayPeriodKey: string;
    sourceSessionId: string | null;
    sourceSessionType: string | null;
    actorUserId?: string | null;
    actorSource?: "CUSTOMER" | "STAFF" | "SYSTEM";
  }
) {
  const policy = await loadRestaurantIdentityPolicy(tx as never, input.restaurantId);
  const displayNumber = formatTenantDisplayNumber(input.displaySeq, input.displayPeriodKey);
  const trackingCode = deriveTrackingCode({
    displaySeq: input.displaySeq,
    displayPeriodKey: input.displayPeriodKey,
    internalOrderId: input.orderId,
    policy
  });

  await logIdentityAssignment(tx, {
    orderId: input.orderId,
    restaurantId: input.restaurantId,
    action: "identity.internal_assigned",
    actorUserId: input.actorUserId,
    actorSource: input.actorSource,
    afterState: { internalOrderId: input.orderId }
  });

  await logIdentityAssignment(tx, {
    orderId: input.orderId,
    restaurantId: input.restaurantId,
    action: "identity.tenant_number_assigned",
    actorUserId: input.actorUserId,
    actorSource: input.actorSource,
    afterState: {
      displaySeq: input.displaySeq,
      displayPeriodKey: input.displayPeriodKey,
      displayNumber
    }
  });

  if (input.sourceSessionId) {
    await logIdentityAssignment(tx, {
      orderId: input.orderId,
      restaurantId: input.restaurantId,
      action: "identity.session_attached",
      actorUserId: input.actorUserId,
      actorSource: input.actorSource,
      metadata: {
        sourceSessionId: input.sourceSessionId,
        sourceSessionType: input.sourceSessionType
      }
    });
  }

  await logIdentityAssignment(tx, {
    orderId: input.orderId,
    restaurantId: input.restaurantId,
    action: "identity.tracking_derived",
    actorUserId: input.actorUserId,
    actorSource: input.actorSource,
    metadata: { trackingCode }
  });

  return { displayNumber, trackingCode };
}

export function normalizeSourceSessionType(raw?: string | null): SourceSessionType | null {
  if (!raw) return null;
  const upper = raw.toUpperCase();
  if (["QR", "STAFF_DEVICE", "WALK_IN", "RESERVATION", "OTHER"].includes(upper)) {
    return upper as SourceSessionType;
  }
  return "OTHER";
}
