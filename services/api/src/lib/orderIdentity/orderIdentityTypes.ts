/**
 * Order Identity — canonical identity layers (backend-owned, immutable after assignment).
 */

export type OrderIdentityLayer =
  | "internal"
  | "tenant_display"
  | "payment_reference"
  | "source_session"
  | "tracking_code";

export type SourceSessionType = "QR" | "STAFF_DEVICE" | "WALK_IN" | "RESERVATION" | "OTHER";

export type DisplayNumberResetPolicy = "never" | "yearly" | "monthly";

export type InternalIdSchema = "cuid" | "ulid";

export type OrderIdentityPolicy = {
  displayNumberReset: DisplayNumberResetPolicy;
  trackingCodePrefix: string;
  internalIdSchema: InternalIdSchema;
};

export type OrderIdentitySnapshot = {
  internalOrderId: string;
  internalIdSchema: string;
  restaurantId: string;
  displayNumber: string;
  displaySeq: number | null;
  displayPeriodKey: string;
  trackingCode: string;
  gs1Identifier: string | null;
  receiptSearchHash: string | null;
  receiptLookupCode: string | null;
  federationId: string | null;
  sourceSessionId: string | null;
  sourceSessionType: string | null;
};

export type OrderIdentityAssignmentInput = {
  restaurantId: string;
  sourceSessionId?: string | null;
  sourceSessionType?: SourceSessionType | null;
};
