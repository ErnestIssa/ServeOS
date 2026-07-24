import type {
  OrderActorSource,
  OrderPaymentStatus,
  OrderSource,
  OrderStatus
} from "@prisma/client";
import { formatDisplayNumber as formatOrderDisplayNumber } from "../orderIdentity/orderTenantDisplay.js";

/** Canonical lifecycle status — legacy PENDING/CONFIRMED are normalized away. */
export type CanonicalOrderStatus =
  | "CREATED"
  | "PENDING_PAYMENT"
  | "PAID"
  | "ACCEPTED"
  | "REJECTED"
  | "PREPARING"
  | "READY"
  | "COMPLETED"
  | "CANCELLED"
  | "REFUNDED"
  | "PARTIALLY_REFUNDED"
  | "ARCHIVED";

export const LEGACY_STATUS_MAP: Partial<Record<OrderStatus, CanonicalOrderStatus>> = {
  PENDING: "CREATED",
  CONFIRMED: "ACCEPTED"
};

export function normalizeOrderStatus(status: OrderStatus): CanonicalOrderStatus {
  const mapped = LEGACY_STATUS_MAP[status];
  if (mapped) return mapped;
  return status as CanonicalOrderStatus;
}

export function toPrismaOrderStatus(status: CanonicalOrderStatus): OrderStatus {
  return status as OrderStatus;
}

export type OrderTransitionActor = {
  userId?: string | null;
  source: OrderActorSource;
  membershipRole?: string | null;
  permissions?: string[];
};

export type OrderTransitionRequest = {
  orderId: string;
  targetStatus: OrderStatus;
  actor: OrderTransitionActor;
  reason?: string;
  /** Trust approval task when fraud layer required approval first. */
  trustEventId?: string;
  /** Client-supplied idempotency key for safe retries. */
  idempotencyKey?: string;
};

export type OrderPlacementLineInput = {
  menuItemId: string;
  quantity: number;
  modifierOptionIds?: string[];
};

export type PlaceOrderInput = {
  restaurantId: string;
  note?: string;
  lines: OrderPlacementLineInput[];
  customerUserId?: string | null;
  createdByUserId?: string | null;
  createdByContext?: "CUSTOMER" | "STAFF";
  source?: OrderSource;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  tableLabel?: string;
  assignedStaffUserId?: string;
  initialStatus?: CanonicalOrderStatus;
  paymentStatus?: OrderPaymentStatus;
  /** Idempotency-Key header value — duplicate requests return the same order. */
  idempotencyKey?: string;
  /** Source session traceability (QR scan, staff device, walk-in, reservation). */
  sourceSessionId?: string | null;
  sourceSessionType?: string | null;
  /** Permanent QR identity when order originated from a scanned QR. */
  qrCodeId?: string | null;
  deviceId?: string | null;
  reservationId?: string | null;
  /** Delivery partner registry */
  partnerId?: string | null;
  externalPartnerOrderId?: string | null;
  /** Partner-reported total for reconciliation (cents). */
  partnerTotalCents?: number | null;
};

export type OrderLockFlags = {
  pricingLocked: boolean;
  kitchenStarted: boolean;
  completed: boolean;
};

export type OrderEventType =
  | "order.created"
  | "order.paid"
  | "order.accepted"
  | "order.rejected"
  | "order.status_changed"
  | "order.cancelled"
  | "order.refunded"
  | "order.partially_refunded"
  | "order.completed"
  | "order.archived"
  | "order.edited"
  | "order.item_added"
  | "order.item_removed"
  | "order.pricing_updated";

export function formatDisplayNumber(
  displaySeq: number | null | undefined,
  orderId: string,
  displayPeriodKey = "all"
): string {
  return formatOrderDisplayNumber(displaySeq, orderId, displayPeriodKey);
}

export const ACTIVE_KITCHEN_STATUSES: CanonicalOrderStatus[] = [
  "CREATED",
  "PENDING_PAYMENT",
  "PAID",
  "ACCEPTED",
  "PREPARING",
  "READY"
];

export const TERMINAL_STATUSES: CanonicalOrderStatus[] = [
  "REJECTED",
  "CANCELLED",
  "REFUNDED",
  "ARCHIVED"
];
