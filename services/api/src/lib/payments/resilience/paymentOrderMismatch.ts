/**
 * When payment and order state diverge (cancel vs succeed, edit mid-payment).
 */

export type PaymentOrderMismatch = {
  code: "PAYMENT_ORDER_MISMATCH";
  orderId: string;
  restaurantId: string;
  attemptId?: string;
  orderStatus: string;
  orderPaymentStatus: string;
  attemptStatus: string;
  amountCents: number;
  recommendedAction: "AUTO_REFUND" | "MANUAL_REVIEW" | "VOID_IF_POSSIBLE" | "COMPLETE_THEN_REFUND";
  reason: string;
};

export function classifyPaymentOrderRace(input: {
  orderId: string;
  restaurantId: string;
  attemptId?: string;
  orderStatus: string;
  orderPaymentStatus: string;
  attemptStatus: string;
  amountCents: number;
  orderVersionAtAttempt: number;
  currentOrderVersion: number;
  currentOrderTotalCents: number;
  attemptAmountCents: number;
}): PaymentOrderMismatch | null {
  const cancelled = ["CANCELLED", "REJECTED", "EXPIRED"].includes(input.orderStatus);
  const paymentSucceeded = ["SUCCEEDED", "CAPTURED"].includes(input.attemptStatus);

  if (cancelled && paymentSucceeded) {
    return {
      code: "PAYMENT_ORDER_MISMATCH",
      orderId: input.orderId,
      restaurantId: input.restaurantId,
      attemptId: input.attemptId,
      orderStatus: input.orderStatus,
      orderPaymentStatus: input.orderPaymentStatus,
      attemptStatus: input.attemptStatus,
      amountCents: input.amountCents,
      recommendedAction: "AUTO_REFUND",
      reason: "Payment succeeded after or during order cancellation."
    };
  }

  if (
    paymentSucceeded &&
    (input.orderVersionAtAttempt !== input.currentOrderVersion ||
      input.attemptAmountCents !== input.currentOrderTotalCents)
  ) {
    return {
      code: "PAYMENT_ORDER_MISMATCH",
      orderId: input.orderId,
      restaurantId: input.restaurantId,
      attemptId: input.attemptId,
      orderStatus: input.orderStatus,
      orderPaymentStatus: input.orderPaymentStatus,
      attemptStatus: input.attemptStatus,
      amountCents: input.amountCents,
      recommendedAction: "MANUAL_REVIEW",
      reason: "Order changed while payment completed — reconcile delta (refund/credit/additional charge)."
    };
  }

  if (
    ["PROCESSING", "REQUIRES_ACTION", "AUTHORIZED"].includes(input.attemptStatus) &&
    input.orderVersionAtAttempt !== input.currentOrderVersion
  ) {
    return {
      code: "PAYMENT_ORDER_MISMATCH",
      orderId: input.orderId,
      restaurantId: input.restaurantId,
      attemptId: input.attemptId,
      orderStatus: input.orderStatus,
      orderPaymentStatus: input.orderPaymentStatus,
      attemptStatus: input.attemptStatus,
      amountCents: input.amountCents,
      recommendedAction: "VOID_IF_POSSIBLE",
      reason: "Order edited while payment still in progress — cancel attempt before confirmation when possible."
    };
  }

  return null;
}
