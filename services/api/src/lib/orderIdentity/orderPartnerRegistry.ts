import type { Prisma, PrismaClient } from "@prisma/client";
import { logIdentityAssignment } from "./orderIdentityAudit.js";

export async function registerPartnerOrderIdentity(
  prisma: PrismaClient,
  input: {
    orderId: string;
    restaurantId: string;
    partnerId: string;
    externalOrderId: string;
    metadata?: Record<string, unknown>;
  }
) {
  const existing = await prisma.orderPartnerIdentity.findUnique({
    where: { partnerId_externalOrderId: { partnerId: input.partnerId, externalOrderId: input.externalOrderId } }
  });

  if (existing && existing.orderId !== input.orderId) {
    throw Object.assign(new Error("partner_identity_conflict"), { statusCode: 409 });
  }

  if (existing) return existing;

  const row = await prisma.orderPartnerIdentity.create({
    data: {
      orderId: input.orderId,
      restaurantId: input.restaurantId,
      partnerId: input.partnerId,
      externalOrderId: input.externalOrderId,
      metadata: input.metadata as Prisma.InputJsonValue
    }
  });

  await logIdentityAssignment(prisma, {
    orderId: input.orderId,
    restaurantId: input.restaurantId,
    action: "identity.payment_linked",
    metadata: {
      partnerId: input.partnerId,
      externalOrderId: input.externalOrderId,
      partnerIdentityId: row.id,
      type: "partner_registry"
    }
  });

  return row;
}

export async function resolveOrderByPartnerIdentity(
  prisma: PrismaClient,
  partnerId: string,
  externalOrderId: string
) {
  const row = await prisma.orderPartnerIdentity.findUnique({
    where: { partnerId_externalOrderId: { partnerId, externalOrderId } },
    include: { order: true }
  });
  if (!row?.order) throw Object.assign(new Error("order_not_found"), { statusCode: 404 });
  return row;
}

export const PARTNER_IDENTITY_REGISTRY_POLICY = {
  uniqueConstraint: "partnerId + externalOrderId",
  multiplePartnersPerOrder: true,
  collisionBehavior: "reject_with_409"
} as const;
