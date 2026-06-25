import type { OrderSourceContract } from "./orderSourceTypes.js";
import { TENANT_SOURCE_POLICY_VERSION } from "./orderSourceTypes.js";
import type { FrozenSourcePolicySnapshot } from "./orderSourceTypes.js";
import type { TenantSourcePolicy } from "./orderSourcePolicy.js";

/** Policy frozen at placement — existing orders never re-read live tenant policy. */
export function freezeSourcePolicySnapshot(contract: OrderSourceContract): FrozenSourcePolicySnapshot {
  return {
    source: contract.source,
    payment: { ...contract.payment },
    notifications: { ...contract.notifications },
    policyVersion: TENANT_SOURCE_POLICY_VERSION,
    frozenAt: new Date().toISOString()
  };
}

export function resolveFrozenContractFromMetadata(
  metadata: unknown
): FrozenSourcePolicySnapshot | null {
  if (!metadata || typeof metadata !== "object") return null;
  const snap = (metadata as { frozenPolicySnapshot?: FrozenSourcePolicySnapshot }).frozenPolicySnapshot;
  return snap ?? null;
}

export const SOURCE_POLICY_VERSIONING_RULES = {
  guarantee: "orders use frozenPolicySnapshot from sourceMetadata for lifecycle gates",
  tenantPolicyChanges: "affect new placements only — never retroactive",
  currentPolicyVersion: TENANT_SOURCE_POLICY_VERSION
} as const;

export function describeTenantPolicyChangeImpact(
  _previous: TenantSourcePolicy,
  _next: TenantSourcePolicy
): { affectsExistingOrders: false; affectsNewPlacements: true } {
  return { affectsExistingOrders: false, affectsNewPlacements: true };
}
