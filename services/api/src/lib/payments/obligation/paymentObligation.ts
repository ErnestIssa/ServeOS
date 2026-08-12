/**
 * Payment obligation / balance model — supports pay-at-venue and future splits.
 * Order is never auto-PAID merely because it was accepted.
 */

export type PaymentObligation = {
  orderId: string;
  restaurantId: string;
  currency: string;
  totalCents: number;
  paidCents: number;
  refundedCents: number;
  outstandingCents: number;
  collectionStatus: "UNPAID" | "PARTIAL" | "PAID" | "OVERPAID" | "REFUNDED";
  mode: "ONLINE" | "PAY_AT_VENUE" | "MIXED";
};

export function derivePaymentObligation(input: {
  orderId: string;
  restaurantId: string;
  currency: string;
  totalCents: number;
  capturedAttempts: Array<{ amountCents: number; status: string }>;
  refundedCents?: number;
  payAtVenue?: boolean;
}): PaymentObligation {
  const refundedCents = Math.max(0, input.refundedCents ?? 0);
  const paidCents = input.capturedAttempts
    .filter((a) => a.status === "SUCCEEDED" || a.status === "CAPTURED" || a.status === "PARTIALLY_REFUNDED")
    .reduce((sum, a) => sum + a.amountCents, 0);
  const netPaid = Math.max(0, paidCents - refundedCents);
  const outstandingCents = Math.max(0, input.totalCents - netPaid);

  let collectionStatus: PaymentObligation["collectionStatus"] = "UNPAID";
  if (refundedCents >= paidCents && paidCents > 0) collectionStatus = "REFUNDED";
  else if (netPaid <= 0) collectionStatus = "UNPAID";
  else if (netPaid < input.totalCents) collectionStatus = "PARTIAL";
  else if (netPaid === input.totalCents) collectionStatus = "PAID";
  else collectionStatus = "OVERPAID";

  return {
    orderId: input.orderId,
    restaurantId: input.restaurantId,
    currency: input.currency,
    totalCents: input.totalCents,
    paidCents: netPaid,
    refundedCents,
    outstandingCents,
    collectionStatus,
    mode: input.payAtVenue ? "PAY_AT_VENUE" : paidCents > 0 && outstandingCents > 0 ? "MIXED" : "ONLINE"
  };
}

export type ManualPaymentEntry = {
  staffUserId: string;
  methodKey: string;
  amountCents: number;
  currency: string;
  reason?: string;
  reference?: string;
  recordedAt: string;
};

export function assertManualPaymentPermissions(roles: string[] | undefined): boolean {
  if (!roles?.length) return false;
  return roles.some((r) => ["owner", "manager", "staff"].includes(r));
}
