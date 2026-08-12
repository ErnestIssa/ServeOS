import type { EventEmitter } from "node:events";
import type { FastifyBaseLogger } from "fastify";
import type { PrismaClient } from "@prisma/client";
import { applyPaymentSucceededWebhook } from "../orders/orderPaymentService.js";
import { normalizeOrderStatus } from "../orders/orderTypes.js";
import {
  assertMethodEligibleForCharge,
  createPaymentAttempt,
  getPaymentProviderEnvReady,
  getVenuePaymentSettings,
  processPaymentProviderWebhook,
  transitionPaymentAttempt
} from "../payments/index.js";

export type CheckoutSession = {
  orderId: string;
  provider: "stripe" | "swish" | "cash";
  amountCents: number;
  currency: string;
  status: "requires_payment" | "ready" | "completed" | "requires_reconciliation";
  clientSecret?: string;
  swishQrData?: string;
  swishDeepLink?: string;
  instructions?: string;
  attemptId?: string;
  externalId?: string;
  orderVersion?: number;
};

function providerToMethodId(provider: "stripe" | "swish" | "cash"): string {
  if (provider === "cash") return "cash";
  if (provider === "swish") return "swish";
  return "card";
}

/**
 * Create checkout / payment attempt.
 * Re-checks eligibility at creation time (stale UI protection).
 * Does not mark the order paid.
 */
export async function createOrderCheckout(
  prisma: PrismaClient,
  orderId: string,
  provider: "stripe" | "swish" | "cash",
  opts?: { idempotencyKey?: string }
): Promise<{ ok: true; checkout: CheckoutSession } | { ok: false; error: string }> {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) return { ok: false, error: "order_not_found" };

  const canon = normalizeOrderStatus(order.status);
  if (canon !== "PENDING_PAYMENT" && canon !== "CREATED") {
    return { ok: false, error: "order_not_payable" };
  }

  const settings = await getVenuePaymentSettings(prisma, order.restaurantId);
  if (!settings.ok) return { ok: false, error: settings.error };

  const methodId = providerToMethodId(provider);
  const envReady = getPaymentProviderEnvReady();
  const eligibility = assertMethodEligibleForCharge(settings.settings, envReady, {
    restaurantId: order.restaurantId,
    orderId,
    methodId,
    source: "qr_orders",
    amountCents: order.totalCents,
    currency: "SEK",
    requestedMethodIds: [methodId]
  });
  if (!eligibility.ok) {
    return { ok: false, error: `method_not_eligible:${eligibility.eligibility.reasonCode}` };
  }

  const idempotencyKey =
    opts?.idempotencyKey ?? `checkout:${orderId}:${provider}:${order.version}:${order.totalCents}`;

  const attempt = await createPaymentAttempt(prisma, {
    orderId: order.id,
    restaurantId: order.restaurantId,
    orderVersion: order.version,
    amountCents: order.totalCents,
    currency: "SEK",
    methodKey: methodId,
    provider,
    idempotencyKey,
    source: "qr_orders"
  });

  if (!attempt.ok) {
    return { ok: false, error: attempt.error };
  }

  if (provider === "cash") {
    // Pay-at-venue: attempt recorded, order remains unpaid until staff collects.
    return {
      ok: true,
      checkout: {
        orderId,
        provider: "cash",
        amountCents: order.totalCents,
        currency: "SEK",
        status: "ready",
        instructions: "Pay at the counter when your order is ready. This does not mark the order paid.",
        attemptId: attempt.attempt.id,
        externalId: attempt.attempt.externalId,
        orderVersion: order.version
      }
    };
  }

  await transitionPaymentAttempt(prisma, {
    attemptId: attempt.attempt.id,
    restaurantId: order.restaurantId,
    to: "PROCESSING"
  }).catch(() => undefined);

  if (provider === "stripe") {
    const clientSecret = `pi_sim_${orderId}_${attempt.attempt.id}`;
    return {
      ok: true,
      checkout: {
        orderId,
        provider: "stripe",
        amountCents: order.totalCents,
        currency: "SEK",
        status: "requires_payment",
        clientSecret,
        instructions: "Complete card payment. Order is paid only after provider confirmation.",
        attemptId: attempt.attempt.id,
        externalId: attempt.attempt.externalId,
        orderVersion: order.version
      }
    };
  }

  const swishNumber = settings.settings.providers.swish.merchantId ?? "1234679304";
  return {
    ok: true,
    checkout: {
      orderId,
      provider: "swish",
      amountCents: order.totalCents,
      currency: "SEK",
      status: "requires_payment",
      swishQrData: `C${swishNumber};${(order.totalCents / 100).toFixed(2)};SEK;ServeOS ${order.displaySeq ?? order.id.slice(-6)};${order.id}`,
      swishDeepLink: `swish://payment?dataver=1&amount=${(order.totalCents / 100).toFixed(2)}&message=Order%20${order.displaySeq ?? order.id.slice(-6)}`,
      instructions: "Open Swish and approve. Order is paid only after provider confirmation.",
      attemptId: attempt.attempt.id,
      externalId: attempt.attempt.externalId,
      orderVersion: order.version
    }
  };
}

/**
 * Client observation of payment completion — NOT authoritative.
 * Sandbox: server emits an internal provider webhook through the secure processor.
 * Production path must wait for real provider webhooks / verification.
 */
export async function completeOrderCheckout(
  prisma: PrismaClient,
  orderId: string,
  provider: string,
  buses?: { domainEventBus?: EventEmitter; orderBus?: EventEmitter },
  log?: FastifyBaseLogger
) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) return { ok: false as const, error: "order_not_found" };

  if (provider === "cash") {
    // Client cannot mark cash as paid — staff/manual collection required.
    return {
      ok: false as const,
      error: "cash_requires_staff_collection"
    };
  }

  const ref = await prisma.orderPaymentReference.findFirst({
    where: { orderId, provider },
    orderBy: { createdAt: "desc" }
  });

  if (!ref) {
    return { ok: false as const, error: "payment_attempt_missing" };
  }

  if (ref.status === "UNKNOWN" || ref.status === "REQUIRES_RECONCILIATION") {
    return {
      ok: false as const,
      error: "unknown_payment_outcome",
      attemptId: ref.id
    };
  }

  // Client claim is only an observation — mark processing then emit server-side webhook sim.
  await transitionPaymentAttempt(prisma, {
    attemptId: ref.id,
    restaurantId: order.restaurantId,
    to: "PROCESSING"
  }).catch(() => undefined);

  const allowSim =
    process.env.PAYMENT_ALLOW_CLIENT_COMPLETE_SIM === "true" ||
    process.env.NODE_ENV !== "production";

  if (!allowSim) {
    return {
      ok: true as const,
      clientObserved: true,
      authoritative: false,
      message: "Client observation recorded. Waiting for provider webhook verification.",
      attemptId: ref.id,
      orderId
    };
  }

  const providerEventId = `sim_${ref.externalId}_${Date.now()}`;
  const processed = await processPaymentProviderWebhook(
    prisma,
    {
      provider,
      providerEventId,
      eventType: "payment_succeeded",
      orderId,
      restaurantId: order.restaurantId,
      externalId: ref.externalId,
      amountCents: order.totalCents,
      currency: "SEK",
      idempotencyKey: `sim_complete:${ref.id}`
    },
    buses,
    log
  );

  return {
    ok: true as const,
    clientObserved: true,
    authoritative: true,
    simulatedProviderWebhook: true,
    ...processed.result
  };
}

/** @deprecated Prefer processPaymentProviderWebhook — kept for callers that already verified. */
export async function completeOrderCheckoutLegacyTrusted(
  prisma: PrismaClient,
  orderId: string,
  provider: string,
  buses?: { domainEventBus?: EventEmitter; orderBus?: EventEmitter },
  log?: FastifyBaseLogger
) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) return { ok: false as const, error: "order_not_found" };
  const externalId = `checkout_${provider}_${orderId}_legacy`;
  const result = await applyPaymentSucceededWebhook(
    prisma,
    {
      provider,
      externalId,
      orderId,
      amountCents: order.totalCents,
      currency: "SEK",
      idempotencyKey: externalId
    },
    buses,
    log
  );
  return { ok: true as const, ...result };
}

export function mapCheckoutError(code: string): string {
  switch (code) {
    case "order_not_found":
      return "Order not found.";
    case "order_not_payable":
      return "This order cannot be paid in its current state.";
    case "stripe_not_connected":
      return "Card payments are not enabled for this venue.";
    case "swish_not_connected":
      return "Swish is not enabled for this venue.";
    case "cash_requires_staff_collection":
      return "Cash / pay-at-venue must be collected by staff before the order is marked paid.";
    case "payment_attempt_missing":
      return "Start checkout before completing payment.";
    case "unknown_payment_outcome":
      return "A previous payment result is unknown. Wait for reconciliation before retrying.";
    case "order_version_mismatch":
    case "amount_snapshot_mismatch":
      return "The order changed since checkout opened. Refresh and try again.";
    case "cross_tenant_denied":
      return "Payment is not available for this venue.";
    default:
      if (code.startsWith("method_not_eligible:")) {
        return "That payment method is not available for this order.";
      }
      return "Checkout failed.";
  }
}
