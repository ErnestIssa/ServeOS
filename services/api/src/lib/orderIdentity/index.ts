export {
  type OrderIdentityLayer,
  type SourceSessionType,
  type DisplayNumberResetPolicy,
  type InternalIdSchema,
  type OrderIdentityPolicy,
  type TenantDisplayAllocation,
  type OrderIdentitySnapshot,
  type OrderIdentityAssignmentInput
} from "./orderIdentityTypes.js";

export {
  DEFAULT_ORDER_IDENTITY_POLICY,
  mergeOrderIdentityPolicy,
  loadRestaurantIdentityPolicy,
  computeDisplayPeriodKey
} from "./orderIdentityPolicy.js";

export {
  assertValidInternalOrderId,
  generateInternalOrderId,
  INTERNAL_ORDER_ID_RULES
} from "./orderInternalId.js";

export { generateUlid, isUlid, ULID_MIGRATION_POLICY } from "./orderUlid.js";

export { allocateTenantDisplayNumber } from "./orderTenantNumber.js";

export { formatTenantDisplayNumber, formatDisplayNumber } from "./orderTenantDisplay.js";

export { deriveTrackingCode } from "./orderTrackingCode.js";

export { deriveGs1StyleIdentifier, GS1_IDENTITY_POLICY } from "./orderGs1Identifier.js";

export {
  computeReceiptSearchHash,
  receiptLookupCode,
  RECEIPT_HASH_POLICY
} from "./orderReceiptHash.js";

export { deriveFederationId, FEDERATION_NAMESPACE, ORDER_FEDERATION_POLICY } from "./orderFederation.js";

export {
  registerPartnerOrderIdentity,
  resolveOrderByPartnerIdentity,
  PARTNER_IDENTITY_REGISTRY_POLICY
} from "./orderPartnerRegistry.js";

export { validateIdentityPolicyChange, HISTORICAL_IDENTITY_GUARANTEE } from "./orderPolicyChangeGuard.js";

export { buildExtendedIdentityFields } from "./orderExtendedIdentity.js";

export {
  buildOrderIdentitySnapshot,
  buildOrderIdentitySnapshotForRestaurant
} from "./orderIdentitySnapshot.js";

export {
  prepareOrderIdentityFields,
  recordOrderIdentityAssignments,
  normalizeSourceSessionType
} from "./orderIdentityFacade.js";

export { logIdentityAssignment } from "./orderIdentityAudit.js";

export {
  resolveOrderByInternalId,
  resolveOrderByTenantNumber,
  resolveOrderByPaymentReference,
  resolveOrderByReceiptHash,
  resolveOrderByGs1Identifier,
  resolveOrderByFederationId,
  resolveOrderFromAuditLog,
  listOrdersBySessionId
} from "./orderIdentityResolver.js";

export { linkPaymentReferenceIdentity, type LinkPaymentReferenceInput } from "./orderPaymentIdentity.js";

export const ORDER_IDENTITY_CROSS_SERVICE_RULES = {
  orderService: "internalOrderId",
  paymentService: "provider_externalId → internalOrderId",
  partnerService: "partnerId + externalOrderId → internalOrderId",
  kds: "internalOrderId",
  notifications: "internalOrderId",
  analytics: "internalOrderId + tenant display + federationId",
  admin: "internalOrderId + tenant display + gs1Identifier",
  customerApp: "tenant display + receiptLookupCode + internalOrderId (opaque)",
  federation: "federationId → internalOrderId"
} as const;

export const ORDER_IDENTITY_IMMUTABILITY = {
  internalOrderId: true,
  tenantDisplayNumber: true,
  displayPeriodKey: true,
  paymentReferenceMapping: true,
  sourceSessionId: true,
  gs1Identifier: true,
  receiptSearchHash: true,
  federationId: true
} as const;
