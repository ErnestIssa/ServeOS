import type { EventEmitter } from "node:events";
import type { FastifyBaseLogger } from "fastify";
import type { PrismaClient } from "@prisma/client";
import { applyPaymentSucceededWebhook } from "../orders/orderPaymentService.js";
import { getVenuePaymentSettings } from "../payments/venuePaymentSettingsService.js";
import { normalizeOrderStatus } from "../orders/orderTypes.js";

export type CheckoutSession = {
  orderId: string;
  provider: "stripe" | "swish" | "cash";
  amountCents: number;
  currency: string;
  status: "requires_payment" | "ready" | "completed";
  clientSecret?: string;
  swishQrData?: string;
  swishDeepLink?: string;
  instructions?: string;
};

export async function createOrderCheckout(
  prisma: PrismaClient,
  orderId: string,
  provider: "stripe" | "swish" | "cash"
): Promise<{ ok: true; checkout: CheckoutSession } | { ok: false; error: string }> {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) return { ok: false, error: "order_not_found" };

  const canon = normalizeOrderStatus(order.status);
  if (canon !== "PENDING_PAYMENT" && canon !== "CREATED") {
    return { ok: false, error: "order_not_payable" };
  }

  const settings = await getVenuePaymentSettings(prisma, order.restaurantId);
  if (!settings.ok) return { ok: false, error: settings.error };

  if (provider === "cash") {
    return {
      ok: true,
      checkout: {
        orderId,
        provider: "cash",
        amountCents: order.totalCents,
        currency: "SEK",
        status: "ready",
        instructions: "Pay at the counter when your order is ready."
      }
    };
  }

  if (provider === "stripe") {
    if (!settings.settings.providers.stripe.connected && !settings.settings.methods.card) {
      return { ok: false, error: "stripe_not_connected" };
    }
    const clientSecret = `pi_sim_${orderId}_${Date.now()}`;
    return {
      ok: true,
      checkout: {
        orderId,
        provider: "stripe",
        amountCents: order.totalCents,
        currency: "SEK",
        status: "requires_payment",
        clientSecret,
        instructions: "Complete card payment to confirm your order."
      }
    };
  }

  if (!settings.settings.providers.swish.connected && !settings.settings.methods.swish) {
    return { ok: false, error: "swish_not_connected" };
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
      instructions: "Open Swish and approve the payment request."
    }
  };
}

export async function completeOrderCheckout(
  prisma: PrismaClient,
  orderId: string,
  provider: string,
  buses?: { domainEventBus?: EventEmitter; orderBus?: EventEmitter },
  log?: FastifyBaseLogger
) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) return { ok: false as const, error: "order_not_found" };

  const externalId = `checkout_${provider}_${orderId}_${Date.now()}`;
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
    default:
      return "Checkout failed.";
  }
}
