import type { PrismaClient } from "@prisma/client";
import { assertValidInternalOrderId } from "./orderInternalId.js";
import { buildOrderIdentitySnapshot } from "./orderIdentitySnapshot.js";
import { receiptLookupCode } from "./orderReceiptHash.js";

export async function resolveOrderByInternalId(prisma: PrismaClient, orderId: string) {
  assertValidInternalOrderId(orderId);
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw Object.assign(new Error("order_not_found"), { statusCode: 404 });
  return buildOrderIdentitySnapshot(order);
}

/**
 * Resolves tenant display number — historical-safe across policy changes.
 * When displayPeriodKey is omitted, searches all periods and disambiguates by newest if needed.
 */
export async function resolveOrderByTenantNumber(
  prisma: PrismaClient,
  restaurantId: string,
  displaySeq: number,
  displayPeriodKey?: string
) {
  if (!Number.isInteger(displaySeq) || displaySeq <= 0) {
    throw Object.assign(new Error("invalid_tenant_order_number"), { statusCode: 400 });
  }

  if (displayPeriodKey) {
    const order = await prisma.order.findFirst({
      where: { restaurantId, displaySeq, displayPeriodKey }
    });
    if (!order) throw Object.assign(new Error("order_not_found"), { statusCode: 404 });
    return buildOrderIdentitySnapshot(order);
  }

  const matches = await prisma.order.findMany({
    where: { restaurantId, displaySeq },
    orderBy: { createdAt: "desc" },
    take: 5
  });

  if (matches.length === 0) {
    throw Object.assign(new Error("order_not_found"), { statusCode: 404 });
  }

  if (matches.length > 1) {
    return {
      ambiguous: true as const,
      candidates: matches.map((o) => buildOrderIdentitySnapshot(o))
    };
  }

  return buildOrderIdentitySnapshot(matches[0]!);
}

export async function resolveOrderByPaymentReference(
  prisma: PrismaClient,
  provider: string,
  externalId: string
) {
  const ref = await prisma.orderPaymentReference.findUnique({
    where: { provider_externalId: { provider, externalId } },
    include: { order: true }
  });
  if (!ref?.order) throw Object.assign(new Error("order_not_found"), { statusCode: 404 });
  return {
    ...buildOrderIdentitySnapshot(ref.order),
    paymentReference: {
      id: ref.id,
      provider: ref.provider,
      externalId: ref.externalId,
      status: ref.status,
      amountCents: ref.amountCents
    }
  };
}

export async function resolveOrderByReceiptHash(prisma: PrismaClient, hash: string) {
  const normalized = hash.trim().toLowerCase();
  const orders = await prisma.order.findMany({
    where: {
      OR: [
        { receiptSearchHash: normalized },
        { receiptSearchHash: { startsWith: normalized } }
      ]
    },
    take: 5,
    orderBy: { createdAt: "desc" }
  });

  const exact = orders.filter((o) => o.receiptSearchHash === normalized);
  const prefix = orders.filter(
    (o) => o.receiptSearchHash && receiptLookupCode(o.receiptSearchHash) === normalized.toUpperCase()
  );
  const match = exact[0] ?? prefix[0];
  if (!match) throw Object.assign(new Error("order_not_found"), { statusCode: 404 });
  return buildOrderIdentitySnapshot(match);
}

export async function resolveOrderByGs1Identifier(prisma: PrismaClient, gs1Identifier: string) {
  const order = await prisma.order.findUnique({ where: { gs1Identifier } });
  if (!order) throw Object.assign(new Error("order_not_found"), { statusCode: 404 });
  return buildOrderIdentitySnapshot(order);
}

export async function resolveOrderByFederationId(prisma: PrismaClient, federationId: string) {
  const order = await prisma.order.findUnique({ where: { federationId } });
  if (!order) throw Object.assign(new Error("order_not_found"), { statusCode: 404 });
  return buildOrderIdentitySnapshot(order);
}

export async function listOrdersBySessionId(prisma: PrismaClient, sessionId: string, limit = 50) {
  const orders = await prisma.order.findMany({
    where: { sourceSessionId: sessionId },
    orderBy: { createdAt: "desc" },
    take: Math.min(100, limit)
  });
  return orders.map((o) => buildOrderIdentitySnapshot(o));
}

/** Resolve order from audit log entry — audit always stores internalOrderId. */
export async function resolveOrderFromAuditLog(prisma: PrismaClient, auditLogId: string) {
  const log = await prisma.orderAuditLog.findUnique({ where: { id: auditLogId } });
  if (!log) throw Object.assign(new Error("audit_log_not_found"), { statusCode: 404 });
  return resolveOrderByInternalId(prisma, log.orderId);
}
