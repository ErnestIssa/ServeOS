import { createHash } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import {
  ACTIVE_PAYMENT_ATTEMPT_STATUSES,
  assertPaymentTransition,
  type PaymentAttemptStatus
} from "./paymentAttemptStateMachine.js";
import { assertMoneyMinor } from "../money/paymentMoney.js";
import { assertMethodEligibleForCharge } from "../venue/paymentMethodEligibility.js";
import {
  getPaymentProviderEnvReady,
  getVenuePaymentSettings
} from "../venue/venuePaymentSettingsService.js";

export type PaymentAttemptSnapshot = {
  orderId: string;
  restaurantId: string;
  orderVersion: number;
  amountCents: number;
  currency: string;
  methodKey: string;
  provider: string;
  pricingSnapshotId?: string | null;
  tipCents?: number;
};

export type PaymentAttemptRecord = PaymentAttemptSnapshot & {
  id: string;
  status: PaymentAttemptStatus;
  externalId: string;
  idempotencyKey: string;
  requestFingerprint: string;
  lastProviderEventVersion?: string | null;
  lastProviderEventAtMs?: number | null;
  createdAt: string;
  updatedAt: string;
};

function fingerprint(input: PaymentAttemptSnapshot & { idempotencyKey: string }): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        orderId: input.orderId,
        restaurantId: input.restaurantId,
        orderVersion: input.orderVersion,
        amountCents: input.amountCents,
        currency: input.currency,
        methodKey: input.methodKey,
        provider: input.provider,
        idempotencyKey: input.idempotencyKey
      })
    )
    .digest("hex");
}

function parseAttemptFromRef(row: {
  id: string;
  orderId: string;
  restaurantId: string;
  provider: string;
  externalId: string;
  amountCents: number;
  currency: string;
  status: string;
  idempotencyKey: string | null;
  createdAt: Date;
  updatedAt: Date;
}): PaymentAttemptRecord | null {
  // Convention: externalId = attempt:<uuid> or provider intent id; status holds canonical state.
  const status = row.status as PaymentAttemptStatus;
  return {
    id: row.id,
    orderId: row.orderId,
    restaurantId: row.restaurantId,
    orderVersion: 0,
    amountCents: row.amountCents,
    currency: row.currency,
    methodKey: row.provider === "cash" ? "cash" : row.provider === "swish" ? "swish" : "card",
    provider: row.provider,
    status,
    externalId: row.externalId,
    idempotencyKey: row.idempotencyKey ?? row.externalId,
    requestFingerprint: "",
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };
}

/**
 * Create or return an existing payment attempt.
 * Enforces: eligibility re-check, single active attempt, idempotency key + fingerprint.
 * Never trusts client "success".
 */
export async function createPaymentAttempt(
  prisma: PrismaClient,
  input: PaymentAttemptSnapshot & {
    idempotencyKey: string;
    allowSplitPayments?: boolean;
    source?: "qr_orders" | "in_app" | "walk_ins" | "staff_created" | "delivery" | "catering" | "b2b";
  }
): Promise<
  | { ok: true; attempt: PaymentAttemptRecord; reused: boolean }
  | { ok: false; error: string; existingAttemptId?: string }
> {
  assertMoneyMinor(input.amountCents, input.currency);
  const fp = fingerprint({ ...input, idempotencyKey: input.idempotencyKey });

  const order = await prisma.order.findUnique({ where: { id: input.orderId } });
  if (!order) return { ok: false, error: "order_not_found" };
  if (order.restaurantId !== input.restaurantId) {
    return { ok: false, error: "cross_tenant_denied" };
  }
  if (order.version !== input.orderVersion) {
    return { ok: false, error: "order_version_mismatch" };
  }
  if (order.totalCents !== input.amountCents) {
    return { ok: false, error: "amount_snapshot_mismatch" };
  }

  // Stale checkout protection: re-check eligibility at attempt creation time.
  const settings = await getVenuePaymentSettings(prisma, input.restaurantId);
  if (!settings.ok) return { ok: false, error: settings.error };
  const envReady = getPaymentProviderEnvReady();
  const eligibility = assertMethodEligibleForCharge(settings.settings, envReady, {
    restaurantId: input.restaurantId,
    orderId: input.orderId,
    methodId: input.methodKey,
    source: input.source ?? "qr_orders",
    amountCents: input.amountCents,
    currency: input.currency,
    requestedMethodIds: [input.methodKey]
  });
  if (!eligibility.ok) {
    return { ok: false, error: `method_not_eligible:${eligibility.eligibility.reasonCode}` };
  }

  // Idempotent replay
  if (input.idempotencyKey) {
    const prior = await prisma.orderPaymentReference.findFirst({
      where: { restaurantId: input.restaurantId, idempotencyKey: input.idempotencyKey }
    });
    if (prior) {
      const attempt = parseAttemptFromRef(prior);
      if (!attempt) return { ok: false, error: "idempotency_conflict" };
      // Same key + different body → reject
      if (prior.amountCents !== input.amountCents || prior.orderId !== input.orderId) {
        return { ok: false, error: "idempotency_key_reuse_mismatch" };
      }
      return { ok: true, attempt, reused: true };
    }
  }

  // Double-charge guard: one active online attempt per order unless splits allowed.
  if (!input.allowSplitPayments) {
    const active = await prisma.orderPaymentReference.findMany({
      where: { orderId: input.orderId },
      orderBy: { createdAt: "desc" },
      take: 20
    });
    const blocking = active.find((row) =>
      ACTIVE_PAYMENT_ATTEMPT_STATUSES.has(row.status as PaymentAttemptStatus)
    );
    if (blocking) {
      const attempt = parseAttemptFromRef(blocking)!;
      return {
        ok: true,
        attempt,
        reused: true
      };
    }
  }

  // Unknown prior outcome → do not create another charge
  const unknown = await prisma.orderPaymentReference.findFirst({
    where: {
      orderId: input.orderId,
      status: { in: ["UNKNOWN", "REQUIRES_RECONCILIATION"] }
    }
  });
  if (unknown) {
    return {
      ok: false,
      error: "unknown_payment_outcome",
      existingAttemptId: unknown.id
    };
  }

  const externalId = `attempt_${input.idempotencyKey}`;
  const row = await prisma.orderPaymentReference.create({
    data: {
      orderId: input.orderId,
      restaurantId: input.restaurantId,
      provider: input.provider,
      externalId,
      amountCents: input.amountCents,
      currency: input.currency,
      status: "REQUIRES_ACTION",
      idempotencyKey: input.idempotencyKey
    }
  });

  const attempt: PaymentAttemptRecord = {
    ...input,
    tipCents: input.tipCents ?? 0,
    id: row.id,
    status: "REQUIRES_ACTION",
    externalId,
    idempotencyKey: input.idempotencyKey,
    requestFingerprint: fp,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };

  return { ok: true, attempt, reused: false };
}

export async function transitionPaymentAttempt(
  prisma: PrismaClient,
  input: {
    attemptId: string;
    restaurantId: string;
    to: PaymentAttemptStatus;
    providerEventVersion?: string | null;
  }
): Promise<{ ok: true; status: PaymentAttemptStatus } | { ok: false; error: string }> {
  const row = await prisma.orderPaymentReference.findUnique({ where: { id: input.attemptId } });
  if (!row) return { ok: false, error: "attempt_not_found" };
  if (row.restaurantId !== input.restaurantId) return { ok: false, error: "cross_tenant_denied" };

  const from = row.status as PaymentAttemptStatus;
  const check = assertPaymentTransition(from, input.to);
  if (!check.ok) return { ok: false, error: check.error };

  await prisma.orderPaymentReference.update({
    where: { id: row.id },
    data: { status: input.to }
  });
  return { ok: true, status: input.to };
}

export async function findActivePaymentAttempt(prisma: PrismaClient, orderId: string) {
  const rows = await prisma.orderPaymentReference.findMany({
    where: { orderId },
    orderBy: { createdAt: "desc" },
    take: 10
  });
  return rows.find((r) => ACTIVE_PAYMENT_ATTEMPT_STATUSES.has(r.status as PaymentAttemptStatus)) ?? null;
}
