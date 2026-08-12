import type { EventEmitter } from "node:events";
import type { FastifyBaseLogger } from "fastify";
import type { PrismaClient } from "@prisma/client";
import { applyPaymentFailedWebhook, applyPaymentSucceededWebhook } from "../../orders/orderPaymentService.js";
import { classifyPaymentOrderRace } from "../resilience/paymentOrderMismatch.js";
import {
  mapProviderEventToStatus,
  shouldApplyProviderEvent,
  type PaymentAttemptStatus
} from "../runtime/paymentAttemptStateMachine.js";
import { transitionPaymentAttempt } from "../runtime/paymentAttemptService.js";
import {
  redactPaymentPayload,
  rememberProviderEvent,
  verifyPaymentWebhookSignature
} from "./paymentWebhookSecurity.js";
import { assertSameRestaurant } from "../tenant/paymentTenantGuard.js";
import { emitPaymentRiskSignal } from "../risk/paymentRiskSignals.js";

export type ProcessPaymentWebhookInput = {
  provider: string;
  providerEventId: string;
  eventType: string;
  orderId: string;
  restaurantId?: string;
  externalId: string;
  amountCents: number;
  currency?: string;
  idempotencyKey?: string;
  rawBody?: string;
  signatureHeader?: string | null;
  timestampHeader?: string | null;
  eventTimestamp?: string | null;
  eventVersion?: string | null;
};

/**
 * Secure, idempotent webhook processor.
 * Delayed webhooks after disable/cancel still resolve via mismatch/reconciliation paths.
 */
export async function processPaymentProviderWebhook(
  prisma: PrismaClient,
  input: ProcessPaymentWebhookInput,
  buses?: { domainEventBus?: EventEmitter; orderBus?: EventEmitter },
  log?: FastifyBaseLogger
) {
  const secret = process.env.PAYMENT_WEBHOOK_SECRET?.trim() || process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (input.rawBody != null || input.signatureHeader) {
    const verified = verifyPaymentWebhookSignature({
      provider: input.provider,
      rawBody: input.rawBody ?? JSON.stringify(input),
      signatureHeader: input.signatureHeader,
      timestampHeader: input.timestampHeader,
      secret
    });
    if (!verified.ok) {
      throw Object.assign(new Error(verified.error), { statusCode: verified.statusCode });
    }
  }

  const remembered = rememberProviderEvent({
    provider: input.provider,
    providerEventId: input.providerEventId,
    eventType: input.eventType,
    restaurantId: input.restaurantId,
    orderId: input.orderId,
    eventTimestamp: input.eventTimestamp ?? null,
    receivedAt: new Date().toISOString(),
    payloadHash: "n/a",
    signatureValid: true,
    processingResult: null
  });

  if (remembered.duplicate && remembered.record.processingResult === "ok") {
    return { ok: true as const, duplicate: true, result: { replay: true } };
  }

  const order = await prisma.order.findUnique({ where: { id: input.orderId } });
  if (!order) {
    throw Object.assign(new Error("order_not_found_retry"), { statusCode: 409 });
  }
  if (input.restaurantId) {
    assertSameRestaurant(input.restaurantId, order.restaurantId, "webhook_order");
  }

  const incomingStatus =
    mapProviderEventToStatus(input.eventType) ??
    (input.eventType.toLowerCase().includes("fail") ? "FAILED" : "SUCCEEDED");

  const ref = await prisma.orderPaymentReference.findUnique({
    where: { provider_externalId: { provider: input.provider, externalId: input.externalId } }
  });

  if (ref) {
    assertSameRestaurant(order.restaurantId, ref.restaurantId, "webhook_payment_ref");
    const decision = shouldApplyProviderEvent({
      currentStatus: ref.status as PaymentAttemptStatus,
      incomingStatus,
      lastEventVersion: null,
      incomingEventVersion: input.eventVersion ?? null,
      lastEventAtMs: ref.updatedAt.getTime(),
      incomingEventAtMs: input.eventTimestamp ? Date.parse(input.eventTimestamp) : null
    });
    if (!decision.apply && decision.reason === "idempotent_replay") {
      return { ok: true as const, duplicate: true, result: { replay: true } };
    }
    if (!decision.apply && decision.reason === "stale_event_version") {
      return { ok: true as const, duplicate: false, result: { ignored: true, reason: decision.reason } };
    }
    if (decision.apply) {
      await transitionPaymentAttempt(prisma, {
        attemptId: ref.id,
        restaurantId: order.restaurantId,
        to: incomingStatus,
        providerEventVersion: input.eventVersion
      }).catch(() => undefined);
    }

    const mismatch = classifyPaymentOrderRace({
      orderId: order.id,
      restaurantId: order.restaurantId,
      attemptId: ref.id,
      orderStatus: order.status,
      orderPaymentStatus: order.paymentStatus,
      attemptStatus: incomingStatus,
      amountCents: input.amountCents,
      orderVersionAtAttempt: order.version,
      currentOrderVersion: order.version,
      currentOrderTotalCents: order.totalCents,
      attemptAmountCents: ref.amountCents
    });
    if (mismatch) {
      emitPaymentRiskSignal({
        type: "manual_override",
        restaurantId: order.restaurantId,
        orderId: order.id,
        severity: "high",
        metadata: { ...mismatch, redactedPayload: redactPaymentPayload(input) }
      });
      await transitionPaymentAttempt(prisma, {
        attemptId: ref.id,
        restaurantId: order.restaurantId,
        to: "PAYMENT_ORDER_MISMATCH"
      }).catch(() => undefined);
      // Still record money movement for refund workflow when success on cancelled order.
    }
  }

  if (incomingStatus === "FAILED") {
    const result = await applyPaymentFailedWebhook(
      prisma,
      {
        provider: input.provider,
        externalId: input.externalId,
        orderId: input.orderId,
        amountCents: input.amountCents,
        currency: input.currency,
        idempotencyKey: input.idempotencyKey ?? `${input.provider}:${input.providerEventId}`
      },
      log
    );
    remembered.record.processingResult = "ok";
    return { ok: true as const, duplicate: false, result };
  }

  if (incomingStatus === "SUCCEEDED" || incomingStatus === "CAPTURED") {
    const result = await applyPaymentSucceededWebhook(
      prisma,
      {
        provider: input.provider,
        externalId: input.externalId,
        orderId: input.orderId,
        amountCents: input.amountCents,
        currency: input.currency,
        idempotencyKey: input.idempotencyKey ?? `${input.provider}:${input.providerEventId}`
      },
      buses,
      log
    );
    remembered.record.processingResult = "ok";
    return { ok: true as const, duplicate: false, result };
  }

  remembered.record.processingResult = "accepted_non_terminal";
  return {
    ok: true as const,
    duplicate: false,
    result: { accepted: true, status: incomingStatus }
  };
}
