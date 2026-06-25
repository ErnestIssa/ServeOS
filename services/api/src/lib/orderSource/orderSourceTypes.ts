import type { OrderCreatedContext, OrderSource } from "@prisma/client";

/** Canonical Phase 1 sources — single authority for source behavior. */
export type CanonicalOrderSource =
  | "QR_ORDER"
  | "WALK_IN"
  | "STAFF_CREATED"
  | "PHONE_ORDER"
  | "RESERVATION_ORDER"
  | "DELIVERY_PARTNER";

/** Future-ready — not implemented in Phase 1. */
export type FutureOrderSource =
  | "KIOSK_ORDER"
  | "SELF_CHECKOUT"
  | "MARKETPLACE_ORDER"
  | "CATERING_ORDER";

export const PHASE_1_ORDER_SOURCES: CanonicalOrderSource[] = [
  "QR_ORDER",
  "WALK_IN",
  "STAFF_CREATED",
  "PHONE_ORDER",
  "RESERVATION_ORDER",
  "DELIVERY_PARTNER"
];

export const FUTURE_ORDER_SOURCES: FutureOrderSource[] = [
  "KIOSK_ORDER",
  "SELF_CHECKOUT",
  "MARKETPLACE_ORDER",
  "CATERING_ORDER"
];

export type SourcePaymentRules = {
  paymentRequiredBeforeAcceptance: boolean;
  paymentRequiredBeforePreparation: boolean;
  payLaterAllowed: boolean;
  externalPaymentOwned: boolean;
  defaultInitialStatus: "CREATED" | "PENDING_PAYMENT" | "PAID";
  /** Staff may append lines after initial placement (hybrid / QR + staff assist). */
  allowStaffLineAdditions: boolean;
  /** When true, added lines require payment before kitchen advance. */
  requiresRepaymentOnLineAddition: boolean;
  splitPaymentAllowed: boolean;
  refundRestricted: boolean;
  chargebackReviewRequired: boolean;
};

export type SourceValidationRules = {
  requiresRestaurantContext: boolean;
  requiresCustomerOrGuest: boolean;
  requiresSourceSession: boolean;
  requiresTableContext: boolean;
  requiresStaffCreator: boolean;
  requiresReservationLink: boolean;
  requiresPartnerReference: boolean;
  requiresMenuLines: boolean;
};

export type SourceOwnershipRules = {
  defaultCreatedByContext: OrderCreatedContext;
  customerAccountOptional: boolean;
  staffCreatorRequired: boolean;
  partnerReferenceRequired: boolean;
};

export type SourceNotificationRules = {
  notifyCustomerOnStatus: boolean;
  notifyStaffOnCreate: boolean;
  smsAllowed: boolean;
  partnerCallback: boolean;
  minimalCustomerNotifications: boolean;
};

export type SourceAnalyticsAttribution = {
  channel: string;
  conversionTrackable: boolean;
  revenueBucket: string;
};

export type OrderSourceContract = {
  source: CanonicalOrderSource;
  label: string;
  validation: SourceValidationRules;
  payment: SourcePaymentRules;
  ownership: SourceOwnershipRules;
  notifications: SourceNotificationRules;
  analytics: SourceAnalyticsAttribution;
};

export type OrderSourcePlacementContext = {
  restaurantId: string;
  canonicalSource: CanonicalOrderSource;
  prismaSource: OrderSource;
  customerUserId?: string | null;
  createdByUserId?: string | null;
  createdByContext?: OrderCreatedContext;
  sourceSessionId?: string | null;
  sourceSessionType?: string | null;
  tableLabel?: string | null;
  reservationId?: string | null;
  deviceId?: string | null;
  partnerId?: string | null;
  externalPartnerOrderId?: string | null;
  partnerTotalCents?: number | null;
  internalTotalCents?: number | null;
  lineCount: number;
  actorMembershipRole?: string | null;
};

export type SourcePlacementAuditPayload = {
  source: CanonicalOrderSource;
  sourceIdentifier: string;
  validationPassed: true;
  contractVersion: number;
  policyVersion: number;
  attribution: SourceAnalyticsAttribution;
  compositionalAttribution: CompositionalSourceAttribution;
  frozenPolicySnapshot: FrozenSourcePolicySnapshot;
  metadata: Record<string, unknown>;
};

export type CompositionalSourceAttribution = {
  primarySource: CanonicalOrderSource;
  modifiers: SourceAttributionModifier[];
  revenueSplitPolicy: "primary_100" | "compositional_future";
};

export type SourceAttributionModifier = {
  type: SourceInterpretationType;
  at: string;
  actorUserId?: string | null;
  note?: string;
};

export type FrozenSourcePolicySnapshot = {
  source: CanonicalOrderSource;
  payment: SourcePaymentRules;
  notifications: SourceNotificationRules;
  policyVersion: number;
  frozenAt: string;
};

export type SourceInterpretationType =
  | "STAFF_ASSISTED"
  | "CONVERTED_TO_RESERVATION"
  | "PARTNER_REASSIGNED_INTERNAL"
  | "SOURCE_CORRECTION_LOGGED"
  | "HYBRID_STAFF_LINE_ADDITION";

export const SOURCE_CONTRACT_VERSION = 1 as const;
export const TENANT_SOURCE_POLICY_VERSION = 1 as const;
