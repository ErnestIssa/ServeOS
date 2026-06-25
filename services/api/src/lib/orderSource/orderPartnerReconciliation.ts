import type { PrismaClient } from "@prisma/client";
import type { OrderSourcePlacementContext } from "./orderSourceTypes.js";
import type { CanonicalOrderStatus } from "../orders/orderTypes.js";

const PARTNER_TOTAL_TOLERANCE_CENTS = 50;

function partnerError(code: string, statusCode: number): Error {
  return Object.assign(new Error(code), { statusCode });
}

/** Partner reconciliation — runs before order creation for DELIVERY_PARTNER. */
export async function reconcilePartnerPlacement(
  prisma: PrismaClient,
  ctx: OrderSourcePlacementContext
): Promise<void> {
  if (ctx.canonicalSource !== "DELIVERY_PARTNER") return;
  if (!ctx.partnerId?.trim() || !ctx.externalPartnerOrderId?.trim()) {
    throw partnerError("source_partner_reference_required", 400);
  }

  const restaurant = await prisma.restaurant.findUnique({
    where: { id: ctx.restaurantId },
    select: { id: true }
  });
  if (!restaurant) throw partnerError("partner_restaurant_not_found", 404);

  const existing = await prisma.orderPartnerIdentity.findUnique({
    where: {
      partnerId_externalOrderId: {
        partnerId: ctx.partnerId,
        externalOrderId: ctx.externalPartnerOrderId
      }
    },
    include: { order: { select: { id: true, restaurantId: true } } }
  });

  if (existing) {
    throw partnerError("partner_duplicate_callback", 409);
  }

  if (
    ctx.partnerTotalCents != null &&
    ctx.internalTotalCents != null &&
    Math.abs(ctx.partnerTotalCents - ctx.internalTotalCents) > PARTNER_TOTAL_TOLERANCE_CENTS
  ) {
    throw partnerError("partner_total_mismatch", 409);
  }
}

export function assertPartnerCancellationAllowed(
  orderStatus: CanonicalOrderStatus,
  cancelledBy: "partner" | "internal"
): void {
  if (cancelledBy === "partner" && ["PREPARING", "READY", "COMPLETED"].includes(orderStatus)) {
    throw Object.assign(new Error("partner_cancel_after_acceptance_blocked"), { statusCode: 409 });
  }
}

export function assertPartnerPartialFulfillment(
  partnerLineCount: number,
  internalLineCount: number
): void {
  if (partnerLineCount > 0 && internalLineCount > 0 && partnerLineCount !== internalLineCount) {
    throw Object.assign(new Error("partner_partial_fulfillment_mismatch"), { statusCode: 409 });
  }
}

export const PARTNER_RECONCILIATION_POLICY = {
  duplicateCallbacks: "reject_with_409_before_create",
  totalToleranceCents: PARTNER_TOTAL_TOLERANCE_CENTS,
  cancellationAfterAcceptance: "partner_blocked_internal_allowed_via_fsm"
} as const;
