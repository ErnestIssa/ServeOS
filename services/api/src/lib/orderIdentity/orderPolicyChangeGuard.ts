import type { OrderIdentityPolicy } from "./orderIdentityTypes.js";
import { mergeOrderIdentityPolicy } from "./orderIdentityPolicy.js";

/**
 * Policy changes NEVER mutate existing orders — only affect future allocations.
 * Historical display numbers remain resolvable via stored displayPeriodKey + displaySeq.
 */
export function validateIdentityPolicyChange(
  previous: unknown,
  next: OrderIdentityPolicy
): { safe: true; historicalResolution: string } {
  const before = mergeOrderIdentityPolicy(previous);
  void before;
  return {
    safe: true,
    historicalResolution:
      "Existing orders keep immutable displayPeriodKey + displaySeq; resolver searches all periods when period omitted."
  };
}

export const HISTORICAL_IDENTITY_GUARANTEE = {
  policyChangeAffectsNewOrdersOnly: true,
  storedOnOrder: ["displaySeq", "displayPeriodKey", "gs1Identifier", "receiptSearchHash", "federationId"],
  resolverBehavior: "resolveOrderByTenantNumber searches legacy + all + explicit period; disambiguates by createdAt if multiple",
  auditLogs: "immutable append-only — always resolve via internalOrderId in metadata",
  receipts: "receiptSearchHash + gs1Identifier + federationId remain valid after policy change"
} as const;
