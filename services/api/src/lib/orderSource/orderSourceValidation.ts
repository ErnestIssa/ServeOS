import type { PrismaClient } from "@prisma/client";
import { isVenueMembershipRole } from "../membershipAccess.js";
import type { OrderSourceContract, OrderSourcePlacementContext } from "./orderSourceTypes.js";
import { resolveEffectiveSourceContract, loadRestaurantSourcePolicy } from "./orderSourcePolicy.js";
import { reconcilePartnerPlacement } from "./orderPartnerReconciliation.js";

function sourceError(code: string, statusCode: number): Error {
  return Object.assign(new Error(code), { statusCode });
}

function hasGuestOrCustomer(ctx: OrderSourcePlacementContext): boolean {
  return Boolean(ctx.customerUserId) || Boolean(ctx.sourceSessionId);
}

async function assertStaffCreator(
  prisma: PrismaClient,
  ctx: OrderSourcePlacementContext
): Promise<void> {
  if (!ctx.createdByUserId) throw sourceError("source_staff_creator_required", 400);

  const membership = await prisma.membership.findUnique({
    where: {
      userId_restaurantId: { userId: ctx.createdByUserId, restaurantId: ctx.restaurantId }
    }
  });

  if (!membership || !isVenueMembershipRole(membership.role)) {
    throw sourceError("source_staff_creator_forbidden", 403);
  }
}

/**
 * Source validation — runs BEFORE order creation.
 * All source gates flow through here; no scattered if-checks in routes.
 */
export async function validateOrderSourcePlacement(
  prisma: PrismaClient,
  contract: OrderSourceContract,
  ctx: OrderSourcePlacementContext
): Promise<void> {
  const v = contract.validation;

  if (!ctx.restaurantId) throw sourceError("source_restaurant_required", 400);

  if (v.requiresMenuLines && ctx.lineCount < 1) {
    throw sourceError("source_lines_required", 400);
  }

  if (v.requiresCustomerOrGuest && !hasGuestOrCustomer(ctx)) {
    throw sourceError("source_customer_or_session_required", 400);
  }

  if (v.requiresSourceSession && !ctx.sourceSessionId?.trim() && !ctx.customerUserId) {
    throw sourceError("source_session_required", 400);
  }

  if (v.requiresTableContext && !ctx.tableLabel?.trim()) {
    throw sourceError("source_table_context_required", 400);
  }

  if (v.requiresReservationLink && !ctx.reservationId?.trim()) {
    throw sourceError("source_reservation_required", 400);
  }

  if (v.requiresPartnerReference && (!ctx.partnerId?.trim() || !ctx.externalPartnerOrderId?.trim())) {
    throw sourceError("source_partner_reference_required", 400);
  }

  if (v.requiresStaffCreator) {
    await assertStaffCreator(prisma, ctx);
  }
}

export async function validateAndResolveSourceContract(
  prisma: PrismaClient,
  ctx: OrderSourcePlacementContext
): Promise<OrderSourceContract> {
  const tenant = await loadRestaurantSourcePolicy(prisma, ctx.restaurantId);
  const contract = resolveEffectiveSourceContract(ctx.canonicalSource, tenant);
  await validateOrderSourcePlacement(prisma, contract, ctx);
  await reconcilePartnerPlacement(prisma, ctx);
  return contract;
}
