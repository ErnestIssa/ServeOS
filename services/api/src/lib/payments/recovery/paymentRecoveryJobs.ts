import type { PrismaClient } from "@prisma/client";
import { emitPaymentRiskSignal } from "../risk/paymentRiskSignals.js";

export type PaymentRecoveryAction =
  | "query_provider_for_processing"
  | "query_provider_for_refund_pending"
  | "retry_webhook_processing"
  | "reconcile_unknown_outcome"
  | "provider_health_recheck";

/**
 * Identify stuck payment attempts that need safe, idempotent recovery.
 * Does not auto-retry charges when outcome is UNKNOWN.
 */
export async function listPaymentRecoveryCandidates(
  prisma: PrismaClient,
  restaurantId: string,
  opts?: { processingOlderThanMs?: number }
) {
  const olderThan = opts?.processingOlderThanMs ?? 15 * 60 * 1000;
  const cutoff = new Date(Date.now() - olderThan);
  const rows = await prisma.orderPaymentReference.findMany({
    where: {
      restaurantId,
      status: { in: ["PROCESSING", "REQUIRES_ACTION", "UNKNOWN", "REQUIRES_RECONCILIATION", "CAPTURE_PENDING"] },
      updatedAt: { lt: cutoff }
    },
    take: 100,
    orderBy: { updatedAt: "asc" }
  });

  return rows.map((row) => {
    let action: PaymentRecoveryAction = "query_provider_for_processing";
    if (row.status === "UNKNOWN" || row.status === "REQUIRES_RECONCILIATION") {
      action = "reconcile_unknown_outcome";
      emitPaymentRiskSignal({
        type: "unknown_outcome",
        restaurantId,
        orderId: row.orderId,
        severity: "high",
        metadata: { attemptId: row.id, status: row.status }
      });
    }
    return {
      attemptId: row.id,
      orderId: row.orderId,
      status: row.status,
      action,
      /** Never create a new charge from recovery — only query/reconcile. */
      allowNewCharge: false as const
    };
  });
}

export async function runPaymentRecoveryPass(prisma: PrismaClient, restaurantId: string) {
  const candidates = await listPaymentRecoveryCandidates(prisma, restaurantId);
  // Persist markers via OrderRecoveryLog when available.
  for (const c of candidates) {
    await prisma.orderRecoveryLog
      .create({
        data: {
          orderId: c.orderId,
          restaurantId,
          action: c.action,
          reason: `payment_recovery:${c.status}`,
          metadata: { attemptId: c.attemptId, allowNewCharge: false }
        }
      })
      .catch(() => undefined);
  }
  return { scanned: candidates.length, candidates };
}
