/** Shared order types for admin, staff, and customer clients. */

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

export type OrderSource =
  | "QR_ORDER"
  | "STAFF_CREATED"
  | "WALK_IN"
  | "PHONE_ORDER"
  | "RESERVATION"
  | "DELIVERY_PARTNER";

export type OrderPaymentStatus =
  | "UNPAID"
  | "PENDING"
  | "PAID"
  | "FAILED"
  | "REFUNDED"
  | "PARTIAL_REFUND";

export type OrderLineSummary = {
  id: string;
  name: string;
  quantity: number;
  unitPriceCents: number;
  lineTotalCents: number;
  modifiers?: string[];
};

export type OrderSummary = {
  id: string;
  restaurantId: string;
  displayNumber: string;
  status: CanonicalOrderStatus | string;
  paymentStatus: OrderPaymentStatus;
  source: OrderSource;
  totalCents: number;
  subtotalCents: number;
  taxCents: number;
  customerUserId?: string | null;
  customerName?: string | null;
  tableLabel?: string | null;
  assignedStaffUserId?: string | null;
  createdAt: string;
  updatedAt: string;
  lines: OrderLineSummary[];
};

export type OrderEventPayload = {
  type: string;
  orderId: string;
  restaurantId: string;
  status: string;
  totalCents: number;
  displayNumber?: string;
  paymentStatus?: string;
  customerUserId?: string | null;
  restaurantName?: string;
};

export type OrderEventEnvelopeV1 = {
  schemaVersion: 1;
  eventId: string;
  type: string;
  orderId: string;
  restaurantId: string;
  sequence: number;
  occurredAt: string;
  payload: {
    status: string;
    canonicalStatus: string;
    totalCents: number;
    customerUserId: string | null;
    displayNumber: string;
    paymentStatus: string | null;
    fromStatus: string | null;
    actorUserId: string | null;
  };
};
