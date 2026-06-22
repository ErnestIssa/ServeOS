import type { Prisma, PrismaClient } from "@prisma/client";
import type { OrderTransitionActor } from "./orderTypes.js";
import { resolveMembershipPermissions } from "../venuePermissions.js";
import { isVenueMembershipRole } from "../membershipAccess.js";

/**
 * Resolve staff actor permissions inside the order engine — never trust caller-supplied roles alone.
 */
export async function resolveOrderEngineActor(
  prisma: PrismaClient,
  restaurantId: string,
  actor: OrderTransitionActor
): Promise<OrderTransitionActor> {
  if (actor.source !== "STAFF" && actor.source !== "ADMIN") return actor;
  if (!actor.userId) {
    throw Object.assign(new Error("actor_user_required"), { statusCode: 400 });
  }

  const membership = await prisma.membership.findUnique({
    where: { userId_restaurantId: { userId: actor.userId, restaurantId } },
    select: { role: true, status: true, permissions: true }
  });

  if (!membership || membership.status !== "ACTIVE" || !isVenueMembershipRole(membership.role)) {
    throw Object.assign(new Error("forbidden"), { statusCode: 403 });
  }

  return {
    ...actor,
    membershipRole: membership.role,
    permissions: resolveMembershipPermissions(membership.role, membership.permissions)
  };
}

export async function assertOrderTenantScope(
  prisma: PrismaClient,
  orderId: string,
  restaurantId: string
): Promise<void> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { restaurantId: true }
  });
  if (!order) throw Object.assign(new Error("order_not_found"), { statusCode: 404 });
  if (order.restaurantId !== restaurantId) {
    throw Object.assign(new Error("order_tenant_mismatch"), { statusCode: 403 });
  }
}

export async function optimisticOrderUpdate(
  tx: Prisma.TransactionClient,
  params: {
    orderId: string;
    expectedVersion: number;
    data: Prisma.OrderUpdateInput;
  }
) {
  const result = await tx.order.updateMany({
    where: { id: params.orderId, version: params.expectedVersion },
    data: {
      ...params.data,
      version: { increment: 1 }
    }
  });

  if (result.count === 0) {
    throw Object.assign(new Error("order_version_conflict"), { statusCode: 409 });
  }

  return tx.order.findUniqueOrThrow({
    where: { id: params.orderId },
    include: { restaurant: { select: { name: true } }, chatRoom: true }
  });
}
