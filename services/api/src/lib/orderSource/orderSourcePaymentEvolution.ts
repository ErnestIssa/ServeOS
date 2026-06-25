import type { OrderPaymentStatus } from "@prisma/client";
import type { SourcePaymentRules } from "./orderSourceTypes.js";
import type { FrozenSourcePolicySnapshot } from "./orderSourceTypes.js";
import type { CanonicalOrderStatus } from "../orders/orderTypes.js";
import { resolveFrozenContractFromMetadata } from "./orderSourcePolicyVersioning.js";
import { assertSourcePaymentGate } from "./orderSourcePayment.js";
import type { OrderSourceContract } from "./orderSourceTypes.js";

export type SourcePaymentEvolutionEvent =
  | "staff_line_added"
  | "split_payment_requested"
  | "refund_requested"
  | "chargeback_received";

function paymentEvolutionError(code: string, statusCode: number): Error {
  return Object.assign(new Error(code), { statusCode });
}

function rulesFromFrozenOrContract(
  frozen: FrozenSourcePolicySnapshot | null,
  contract?: OrderSourceContract
): SourcePaymentRules {
  if (frozen) return frozen.payment;
  if (contract) return contract.payment;
  throw paymentEvolutionError("source_payment_policy_missing", 500);
}

export function assertSourcePaymentEvolution(
  event: SourcePaymentEvolutionEvent,
  input: {
    frozenPolicy?: FrozenSourcePolicySnapshot | null;
    contract?: OrderSourceContract;
    paymentStatus: OrderPaymentStatus;
    targetStatus?: CanonicalOrderStatus;
  }
): void {
  const rules = rulesFromFrozenOrContract(input.frozenPolicy ?? null, input.contract);

  switch (event) {
    case "staff_line_added":
      if (!rules.allowStaffLineAdditions) {
        throw paymentEvolutionError("source_hybrid_line_addition_blocked", 409);
      }
      if (rules.requiresRepaymentOnLineAddition && input.paymentStatus === "PAID") {
        throw paymentEvolutionError("source_repayment_required_after_line_addition", 409);
      }
      break;
    case "split_payment_requested":
      if (!rules.splitPaymentAllowed) {
        throw paymentEvolutionError("source_split_payment_not_allowed", 409);
      }
      break;
    case "refund_requested":
      if (rules.refundRestricted) {
        throw paymentEvolutionError("source_refund_restricted", 409);
      }
      break;
    case "chargeback_received":
      if (!rules.chargebackReviewRequired) {
        break;
      }
      break;
  }

  if (input.targetStatus && input.contract) {
    assertSourcePaymentGate(input.contract, input.targetStatus, input.paymentStatus);
  }
}

export function resolvePaymentRulesForOrder(metadata: unknown): SourcePaymentRules | null {
  const frozen = resolveFrozenContractFromMetadata(metadata);
  return frozen?.payment ?? null;
}

export const SOURCE_PAYMENT_EVOLUTION_RULES = {
  authority: "lifecycle payment gates use frozenPolicySnapshot — not live tenant policy",
  hybridOrders: "staff_line_added consults allowStaffLineAdditions + requiresRepaymentOnLineAddition"
} as const;
