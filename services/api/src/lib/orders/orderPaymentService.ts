import type { EventEmitter } from "node:events";
import type { FastifyBaseLogger } from "fastify";
import type { PrismaClient } from "@prisma/client";
import { withOrderIdempotency } from "./orderIdempotencyService.js";
import { flushOrderOutboxForOrder } from "./orderOutboxProcessor.js";
import { logOrderEngineInfo, logOrderEngineWarning } from "./orderEngineLog.js";
import { classifyPaymentWebhook, httpStatusForPaymentEdge } from "./orderPaymentEdgeCases.js";
import { transitionOrderStatus } from "./orderTransitionService.js";
import { loadRestaurantOrderPolicy } from "./orderTenantPolicies.js";
import { normalizeOrderStatus } from "./orderTypes.js";

export type PaymentWebhookInput = {
  provider: string;
  externalId: string;
  orderId: string;
  amountCents: number;
  currency?: string;
  idempotencyKey?: string;
  captureMode?: "full" | "partial" | "authorize";
};

/**
 * Payment webhook entry — idempotent via (provider, externalId) and optional idempotency key.
 * Payment service must NOT mutate order state directly; only this path marks PAID.
 */
export async function applyPaymentSucceededWebhook(
  prisma: PrismaClient,
  input: PaymentWebhookInput,
  buses?: { domainEventBus?: EventEmitter; orderBus?: EventEmitter },
  log?: FastifyBaseLogger
) {
  const idempotencyKey = input.idempotencyKey ?? `${input.provider}:${input.externalId}`;

  return withOrderIdempotency(
    prisma,
    {
      scope: "payment_webhook",
      key: idempotencyKey,
      requestHash: `${input.orderId}:${input.amountCents}`
    },
    async () => {
      const order = await prisma.order.findUnique({ where: { id: input.orderId } });
      const edge = classifyPaymentWebhook({
        order,
        amountCents: input.amountCents,
        captureMode: input.captureMode
      });

      if (edge === "order_not_found_retry") {
        throw Object.assign(new Error("order_not_found_retry"), {
          statusCode: httpStatusForPaymentEdge(edge)
        });
      }

      if (edge === "amount_mismatch") {
        logOrderEngineWarning(
          log,
          { orderId: input.orderId, action: "payment_amount_mismatch", provider: input.provider },
          "payment_amount_mismatch"
        );
        throw Object.assign(new Error("payment_amount_mismatch"), { statusCode: 400 });
      }

      if (edge === "partial_capture_pending" || edge === "authorize_only_pending_capture") {
        return {
          orderId: input.orderId,
          response: { orderId: input.orderId, edge, accepted: true }
        };
      }

      if (!order) throw Object.assign(new Error("order_not_found"), { statusCode: 404 });

      if (edge === "already_paid_replay") {
        logOrderEngineInfo(log, { orderId: order.id, action: "payment_webhook_duplicate" }, "payment_webhook_idempotent_replay");
        return {
          orderId: order.id,
          response: { orderId: order.id, status: order.status, paymentStatus: order.paymentStatus, replay: true }
        };
      }

      if (edge === "invalid_order_state") {
        throw Object.assign(new Error("payment_invalid_order_state"), { statusCode: 409 });
      }

      await prisma.orderPaymentReference.upsert({
        where: { provider_externalId: { provider: input.provider, externalId: input.externalId } },
        create: {
          orderId: order.id,
          restaurantId: order.restaurantId,
          provider: input.provider,
          externalId: input.externalId,
          amountCents: input.amountCents,
          currency: input.currency ?? "SEK",
          status: "SUCCEEDED",
          idempotencyKey
        },
        update: {
          status: "SUCCEEDED",
          amountCents: input.amountCents,
          idempotencyKey
        }
      });

      const canon = normalizeOrderStatus(order.status);
      let updated = order;

      if (canon === "CREATED" || canon === "PENDING_PAYMENT") {
        updated = await transitionOrderStatus(
          prisma,
          {
            orderId: order.id,
            targetStatus: "PAID",
            actor: { source: "PAYMENT", userId: null },
            reason: `payment_webhook:${input.provider}:${input.externalId}`
          },
          buses
        );
      } else if (canon === "PAID") {
        logOrderEngineInfo(log, { orderId: order.id, action: "payment_already_paid" }, "payment_webhook_order_already_paid");
      } else {
        throw Object.assign(new Error("payment_invalid_order_state"), { statusCode: 409 });
      }

      if (buses) await flushOrderOutboxForOrder(prisma, updated.id, buses, log);

      const policy = await loadRestaurantOrderPolicy(prisma, updated.restaurantId);
      if (policy.autoAcceptOnPayment && normalizeOrderStatus(updated.status) === "PAID") {
        updated = await transitionOrderStatus(
          prisma,
          {
            orderId: updated.id,
            targetStatus: "ACCEPTED",
            actor: { source: "SYSTEM" },
            reason: "tenant_policy:auto_accept_on_payment"
          },
          buses,
          log
        );
        if (buses) await flushOrderOutboxForOrder(prisma, updated.id, buses, log);
      }

      return {
        orderId: updated.id,
        response: {
          orderId: updated.id,
          status: updated.status,
          paymentStatus: updated.paymentStatus,
          replay: false
        }
      };
    }
  );
}

export async function applyPaymentFailedWebhook(
  prisma: PrismaClient,
  input: PaymentWebhookInput,
  log?: FastifyBaseLogger
) {
  const idempotencyKey = `failed:${input.idempotencyKey ?? `${input.provider}:${input.externalId}`}`;

  return withOrderIdempotency(
    prisma,
    { scope: "payment_webhook", key: idempotencyKey },
    async () => {
      const order = await prisma.order.findUnique({ where: { id: input.orderId } });
      if (!order) throw Object.assign(new Error("order_not_found"), { statusCode: 404 });

      await prisma.orderPaymentReference.upsert({
        where: { provider_externalId: { provider: input.provider, externalId: input.externalId } },
        create: {
          orderId: order.id,
          restaurantId: order.restaurantId,
          provider: input.provider,
          externalId: input.externalId,
          amountCents: input.amountCents,
          currency: input.currency ?? "SEK",
          status: "FAILED",
          idempotencyKey
        },
        update: { status: "FAILED", idempotencyKey }
      });

      if (order.paymentStatus !== "PAID") {
        await prisma.order.update({
          where: { id: order.id },
          data: { paymentStatus: "FAILED", version: { increment: 1 } }
        });
      }

      logOrderEngineInfo(log, { orderId: order.id, action: "payment_failed_recorded" }, "payment_failed_webhook");

      return {
        orderId: order.id,
        response: { orderId: order.id, paymentStatus: "FAILED" }
      };
    }
  );
}
