import type { OrderPaymentStatus, OrderStatus, PrismaClient } from "@prisma/client";

/**
 * Payment lifecycle edge cases — handlers return action codes for webhooks/workers.
 * Full Stripe/Swish signature verification ships with provider integration.
 */

export type PaymentEdgeCase =
  | "apply_paid"
  | "already_paid_replay"
  | "order_not_found_retry"
  | "amount_mismatch"
  | "invalid_order_state"
  | "partial_capture_pending"
  | "authorize_only_pending_capture";

export function classifyPaymentWebhook(input: {
  order: {
    id: string;
    status: OrderStatus;
    paymentStatus: OrderPaymentStatus;
    totalCents: number;
  } | null;
  amountCents: number;
  captureMode?: "full" | "partial" | "authorize";
}): PaymentEdgeCase {
  if (!input.order) return "order_not_found_retry";

  if (input.captureMode === "authorize") return "authorize_only_pending_capture";
  if (input.captureMode === "partial" && input.amountCents < input.order.totalCents) {
    return "partial_capture_pending";
  }

  if (input.amountCents !== input.order.totalCents) return "amount_mismatch";

  if (input.order.paymentStatus === "PAID") return "already_paid_replay";

  const activeUnpaid = ["CREATED", "PENDING_PAYMENT", "PENDING"].includes(input.order.status);
  if (!activeUnpaid) {
    if (input.order.status === "PAID" || input.order.paymentStatus === "PAID") return "already_paid_replay";
    return "invalid_order_state";
  }

  return "apply_paid";
}

/** Provider should retry when order is not created yet (race with checkout). */
export function httpStatusForPaymentEdge(edge: PaymentEdgeCase): number {
  switch (edge) {
    case "order_not_found_retry":
      return 409;
    case "amount_mismatch":
    case "invalid_order_state":
      return 400;
    case "partial_capture_pending":
    case "authorize_only_pending_capture":
      return 202;
    default:
      return 200;
  }
}

export async function recordPendingPaymentIntent(
  prisma: PrismaClient,
  input: {
    provider: string;
    externalId: string;
    orderId?: string;
    amountCents: number;
    idempotencyKey: string;
  }
) {
  if (input.orderId) {
    const order = await prisma.order.findUnique({ where: { id: input.orderId } });
    if (!order) return { stored: false, reason: "order_not_found" as const };
    await prisma.orderPaymentReference.upsert({
      where: { provider_externalId: { provider: input.provider, externalId: input.externalId } },
      create: {
        orderId: order.id,
        restaurantId: order.restaurantId,
        provider: input.provider,
        externalId: input.externalId,
        amountCents: input.amountCents,
        status: "PENDING",
        idempotencyKey: input.idempotencyKey
      },
      update: { amountCents: input.amountCents, idempotencyKey: input.idempotencyKey }
    });
    return { stored: true, reason: "linked" as const };
  }
  return { stored: false, reason: "order_id_required_for_link" as const };
}
