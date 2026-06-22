import type { PrismaClient } from "@prisma/client";
import { logIdentityAssignment } from "./orderIdentityAudit.js";

export type LinkPaymentReferenceInput = {
  orderId: string;
  restaurantId: string;
  provider: string;
  externalId: string;
  amountCents: number;
  currency?: string;
  status: string;
  idempotencyKey?: string;
};

/**
 * Links external payment identity to internal order — idempotent on (provider, externalId).
 * Throws on cross-order collision (identity conflict at backend).
 */
export async function linkPaymentReferenceIdentity(
  prisma: PrismaClient,
  input: LinkPaymentReferenceInput
) {
  const existing = await prisma.orderPaymentReference.findUnique({
    where: { provider_externalId: { provider: input.provider, externalId: input.externalId } }
  });

  if (existing && existing.orderId !== input.orderId) {
    throw Object.assign(new Error("payment_reference_identity_conflict"), { statusCode: 409 });
  }

  const ref = await prisma.orderPaymentReference.upsert({
    where: { provider_externalId: { provider: input.provider, externalId: input.externalId } },
    create: {
      orderId: input.orderId,
      restaurantId: input.restaurantId,
      provider: input.provider,
      externalId: input.externalId,
      amountCents: input.amountCents,
      currency: input.currency ?? "SEK",
      status: input.status,
      idempotencyKey: input.idempotencyKey
    },
    update: {
      status: input.status,
      amountCents: input.amountCents,
      idempotencyKey: input.idempotencyKey
    }
  });

  if (!existing) {
    await logIdentityAssignment(prisma, {
      orderId: input.orderId,
      restaurantId: input.restaurantId,
      action: "identity.payment_linked",
      metadata: {
        provider: input.provider,
        externalId: input.externalId,
        paymentReferenceId: ref.id
      }
    });
  }

  return ref;
}
