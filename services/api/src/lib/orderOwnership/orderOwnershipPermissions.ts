import type { PrismaClient } from "@prisma/client";
import type { OrderOwnershipActor } from "./orderOwnershipTypes.js";
import { getOrderOwnership } from "./orderOwnershipCapture.js";
import { isVenueMembershipRole } from "../membershipAccess.js";

export type OwnershipPermission = "view" | "act" | "refund" | "reassign_staff";

export async function assertOrderOwnershipAccess(
  prisma: PrismaClient,
  orderId: string,
  actor: OrderOwnershipActor,
  permission: OwnershipPermission
) {
  const ownership = await getOrderOwnership(prisma, orderId);

  if (actor.isCustomer && ownership.customerUserId === actor.userId) {
    if (permission === "view" || permission === "act") return ownership;
    throw Object.assign(new Error("customer_ownership_forbidden"), { statusCode: 403 });
  }

  const membership = await prisma.membership.findUnique({
    where: { userId_restaurantId: { userId: actor.userId, restaurantId: ownership.restaurantId } }
  });

  if (!membership || !isVenueMembershipRole(membership.role)) {
    throw Object.assign(new Error("ownership_forbidden"), { statusCode: 403 });
  }

  const isManager = membership.role === "OWNER" || membership.role === "MANAGER";

  if (permission === "refund" && !isManager) {
    throw Object.assign(new Error("refund_requires_manager"), { statusCode: 403 });
  }

  if (permission === "reassign_staff" && !isManager && ownership.assignedStaffUserId !== actor.userId) {
    throw Object.assign(new Error("staff_reassign_forbidden"), { statusCode: 403 });
  }

  return ownership;
}

export async function canActorViewOrder(
  prisma: PrismaClient,
  orderId: string,
  actor: OrderOwnershipActor
): Promise<boolean> {
  try {
    await assertOrderOwnershipAccess(prisma, orderId, actor, "view");
    return true;
  } catch {
    return false;
  }
}

export const ORDER_OWNERSHIP_PERMISSION_MATRIX = {
  customerAccount: ["view_own_order", "cancel_before_accepted"],
  guest: ["view_via_receipt_hash_or_session"],
  staff: ["view_restaurant_orders", "act_on_assigned_or_all"],
  manager: ["view", "act", "refund", "reassign_staff"],
  restaurant: ["always_accountable_entity"],
  partner: ["view_via_partner_identity_registry"]
} as const;
