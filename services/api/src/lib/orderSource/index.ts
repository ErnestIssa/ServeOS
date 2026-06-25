export {
  type CanonicalOrderSource,
  type FutureOrderSource,
  type OrderSourceContract,
  type OrderSourcePlacementContext,
  type SourcePaymentRules,
  type SourceValidationRules,
  type SourceOwnershipRules,
  type SourceNotificationRules,
  type SourceAnalyticsAttribution,
  type SourcePlacementAuditPayload,
  type CompositionalSourceAttribution,
  type SourceAttributionModifier,
  type FrozenSourcePolicySnapshot,
  type SourceInterpretationType,
  PHASE_1_ORDER_SOURCES,
  FUTURE_ORDER_SOURCES,
  SOURCE_CONTRACT_VERSION,
  TENANT_SOURCE_POLICY_VERSION
} from "./orderSourceTypes.js";

export { ORDER_SOURCE_CONTRACTS, getSourceContract } from "./orderSourceContracts.js";

export {
  mergeTenantSourcePolicy,
  loadRestaurantSourcePolicy,
  resolveEffectiveSourceContract,
  listAllSourceContracts,
  type TenantSourcePolicy
} from "./orderSourcePolicy.js";

export {
  normalizeToCanonicalSource,
  toPrismaOrderSource,
  inferCanonicalSourceFromPlacement,
  buildPlacementSourceContext,
  buildSourceIdentifier
} from "./orderSourceResolution.js";

export {
  validateOrderSourcePlacement,
  validateAndResolveSourceContract
} from "./orderSourceValidation.js";

export {
  buildSourceAttributionSnapshot,
  buildOrderSourceMetadata,
  recordSourcePlacementAudit,
  SOURCE_ANALYTICS_DIMENSIONS
} from "./orderSourceAttribution.js";

export {
  buildSourceNotificationPlan,
  SOURCE_NOTIFICATION_AUTHORITY,
  type SourceNotificationPlan
} from "./orderSourceNotifications.js";

export {
  derivePlacementDefaultsFromSource,
  assertSourcePaymentGate
} from "./orderSourcePayment.js";

export {
  assertSourcePaymentEvolution,
  resolvePaymentRulesForOrder,
  SOURCE_PAYMENT_EVOLUTION_RULES,
  type SourcePaymentEvolutionEvent
} from "./orderSourcePaymentEvolution.js";

export {
  freezeSourcePolicySnapshot,
  resolveFrozenContractFromMetadata,
  SOURCE_POLICY_VERSIONING_RULES,
  describeTenantPolicyChangeImpact
} from "./orderSourcePolicyVersioning.js";

export {
  SOURCE_OWNERSHIP_MATRIX,
  resolveOwnershipHintsFromSource,
  SOURCE_OWNERSHIP_BRIDGE_RULES,
  type SourceOwnershipExpectation
} from "./orderSourceOwnershipBridge.js";

export {
  canApplySourceInterpretation,
  recordSourceInterpretation,
  persistSourceInterpretation,
  appendAttributionModifier,
  SOURCE_LIFECYCLE_RULES
} from "./orderSourceLifecycle.js";

export {
  reconcilePartnerPlacement,
  assertPartnerCancellationAllowed,
  assertPartnerPartialFulfillment,
  PARTNER_RECONCILIATION_POLICY
} from "./orderPartnerReconciliation.js";

export {
  buildSourceStateNotificationPlan,
  buildSourceStateNotificationPlanFromMetadata,
  SOURCE_STATE_NOTIFICATION_AUTHORITY,
  type SourceNotificationContext,
  type SourceStateNotificationPlan
} from "./orderSourceNotificationState.js";

export {
  buildInitialCompositionalAttribution,
  resolveAnalyticsAttributionView,
  COMPOSABLE_ANALYTICS_RULES,
  type AnalyticsAttributionView
} from "./orderSourceComposableAnalytics.js";

export const ORDER_SOURCE_DOMAIN_RULES = {
  authority: "orderSource module is SSOT — no scattered source if-checks",
  validationTiming: "before order creation",
  lifecycleSeparation: "source domain does not mutate order FSM — only gates and defaults",
  lifecycleOverlays: "reinterpretation via persistSourceInterpretation — Order.source stays immutable",
  policyVersioning: "frozenPolicySnapshot on each order — tenant policy changes affect new placements only",
  tenantSafety: "restaurantId required on every placement context",
  frontendRule: "clients send source + metadata; backend resolves contracts"
} as const;
