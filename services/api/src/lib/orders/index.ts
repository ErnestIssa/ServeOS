export {
  ACTIVE_KITCHEN_STATUSES,
  formatDisplayNumber,
  LEGACY_STATUS_MAP,
  normalizeOrderStatus,
  TERMINAL_STATUSES,
  toPrismaOrderStatus,
  type CanonicalOrderStatus,
  type OrderEventType,
  type OrderPlacementLineInput,
  type OrderTransitionActor,
  type OrderTransitionRequest,
  type PlaceOrderInput
} from "./orderTypes.js";

export {
  ALLOWED_TRANSITIONS,
  getKitchenAdvanceTarget,
  isTransitionAllowed,
  KITCHEN_ADVANCE,
  STATUS_LABELS,
  deriveLockFlags,
  canEditLineItems,
  canApplyDiscount,
  validateTransition
} from "./orderStatusMachine.js";

export {
  appendOrderAuditLog,
  appendOrderStatusHistory,
  listOrderAuditTrail,
  listOrderDomainEvents,
  listOrderStatusHistory,
  persistOrderDomainEvent
} from "./orderAuditService.js";

export {
  ORDER_EVENT_SCHEMA_VERSION,
  PRICING_SNAPSHOT_FIELDS,
  describePricingSnapshot,
  parseOrderEventEnvelope,
  type OrderEventEnvelopeV1
} from "./orderEventSchema.js";

export { withOrderIdempotency, hashIdempotencyPayload, enqueueOrderOutboxEvent } from "./orderIdempotencyService.js";

export {
  flushOrderOutboxForOrder,
  processOrderOutboxBatch,
  startOrderOutboxProcessor
} from "./orderOutboxProcessor.js";

export { resolveOrderEngineActor, optimisticOrderUpdate } from "./orderEnginePermissions.js";

export {
  applyPaymentSucceededWebhook,
  applyPaymentFailedWebhook,
  type PaymentWebhookInput
} from "./orderPaymentService.js";

export { buildPricedOrderSnapshot, priceOrderLines, summarizeOrderTotals } from "./orderPricing.js";

export { placeOrder } from "./orderPlacementService.js";

export { transitionOrderStatus } from "./orderTransitionService.js";

export {
  ORDER_EVENT_DELIVERY,
  ORDER_CONSUMER_IDEMPOTENCY_RULES,
  shouldApplyOrderEvent
} from "./orderConsumerContracts.js";

export { ORDER_ITEM_FSM_PHASE, PLANNED_ITEM_TRANSITIONS, type OrderItemKitchenStatus } from "./orderItemFsmBoundary.js";

export { ORDER_SLA_POLICY, evaluateOrderSla, type OrderSlaSignal } from "./orderSlaPolicies.js";

export {
  listDeadLetterOutboxEvents,
  replayDeadLetterOutboxEvent,
  countOutboxByStatus
} from "./orderOutboxDeadLetter.js";

export { classifyPaymentWebhook, httpStatusForPaymentEdge } from "./orderPaymentEdgeCases.js";

export { listAdminOrders, getAdminOrderDetail, getAdminOrderStats } from "./orderQueryService.js";

export {
  DEFAULT_ORDER_ENGINE_POLICY,
  loadRestaurantOrderPolicy,
  mergeOrderEnginePolicy,
  type OrderEngineTenantPolicy
} from "./orderTenantPolicies.js";

export {
  SUPPORTED_EVENT_SCHEMA_VERSIONS,
  CURRENT_EVENT_SCHEMA_VERSION,
  EVENT_EVOLUTION_POLICY,
  parseOrderEventEnvelopeAny,
  canConsumerProcessVersion,
  type NormalizedOrderEventEnvelope
} from "./orderEventVersioning.js";

export { ORDER_READ_MODEL_POLICY, isStaleRead, type ReadModelSurface } from "./orderReadModelPolicy.js";

export {
  ORDER_DEGRADATION_POLICY,
  evaluateDegradationState,
  shouldBlockOrderMutation,
  type DegradationState
} from "./orderDegradationPolicy.js";

export {
  compensatePaidOrderMismatch,
  recordDuplicateConsumerSafeIgnore,
  listPendingCompensations,
  runCompensationSweep,
  type CompensationType
} from "./orderCompensationService.js";

export {
  scanAndRecoverStuckOrders,
  retryStaleOutboxEvents,
  runOrderRecoveryCycle,
  startOrderRecoveryProcessor,
  getOrderEngineOperationalSnapshot
} from "./orderRecoveryService.js";

export { searchOrders, ORDER_SEARCH_STRATEGY } from "./orderSearchService.js";
