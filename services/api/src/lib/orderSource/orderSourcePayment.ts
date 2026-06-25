import type { OrderSourceContract } from "./orderSourceTypes.js";
import type { CanonicalOrderStatus } from "../orders/orderTypes.js";
import { toPrismaOrderStatus } from "../orders/orderTypes.js";
import type { OrderPaymentStatus } from "@prisma/client";

export function derivePlacementDefaultsFromSource(contract: OrderSourceContract): {
  initialStatus: ReturnType<typeof toPrismaOrderStatus>;
  paymentStatus: OrderPaymentStatus;
} {
  const initialStatus = toPrismaOrderStatus(contract.payment.defaultInitialStatus as CanonicalOrderStatus);

  let paymentStatus: OrderPaymentStatus = "UNPAID";
  if (contract.payment.externalPaymentOwned || contract.payment.defaultInitialStatus === "PAID") {
    paymentStatus = "PAID";
  } else if (contract.payment.defaultInitialStatus === "PENDING_PAYMENT") {
    paymentStatus = "PENDING";
  }

  return { initialStatus, paymentStatus };
}

export function assertSourcePaymentGate(
  contract: OrderSourceContract,
  targetStatus: CanonicalOrderStatus,
  paymentStatus: OrderPaymentStatus
): void {
  if (
    contract.payment.paymentRequiredBeforeAcceptance &&
    ["ACCEPTED", "PREPARING", "READY", "COMPLETED"].includes(targetStatus) &&
    paymentStatus !== "PAID"
  ) {
    throw Object.assign(new Error("source_payment_required_before_acceptance"), { statusCode: 409 });
  }

  if (
    contract.payment.paymentRequiredBeforePreparation &&
    ["PREPARING", "READY", "COMPLETED"].includes(targetStatus) &&
    paymentStatus !== "PAID"
  ) {
    throw Object.assign(new Error("source_payment_required_before_preparation"), { statusCode: 409 });
  }
}
