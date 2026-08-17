import type { NotificationCategory, NotificationPriority } from "@prisma/client";

export type DeliveryChannel = "IN_APP" | "PUSH" | "EMAIL" | "SMS" | "WHATSAPP";

export type DomainEventType =
  | "order.created"
  | "order.updated"
  | "order.delivered"
  | "chat.message_sent"
  | "ocl.updated"
  | "reservation.created"
  | "reservation.confirmed"
  | "reservation.cancelled"
  | "payment.succeeded"
  | "payment.failed"
  | "staff.invited"
  | "staff.pending_approval"
  | "staff.approved"
  | "staff.rejected"
  | "system.alert"
  | "device.offline"
  | "integration.failed"
  | "fraud.risk.detected"
  | "fraud.action.blocked"
  | "approval.request.created"
  | "approval.request.approved"
  | "approval.request.rejected"
  | "approval.request.expired"
  | "order.discount.applied"
  | "order.refunded"
  | "order.recovery.escalated";

export type CommunicationEntityType =
  | "ORDER"
  | "CHAT_ROOM"
  | "PAYMENT"
  | "DEVICE"
  | "STAFF"
  | "RESERVATION"
  | "TABLE"
  | "SYSTEM";

/** Semantic destination — clients map this to their own routes. `href` is admin-web convenience only. */
export type CommunicationTarget = {
  entityType: CommunicationEntityType;
  entityId: string | null;
  chatRoomId?: string;
  restaurantId?: string | null;
  href?: string;
};

export type DomainEvent = {
  /** Unique occurrence id (UUID). Retries of the same publish reuse this id. */
  id: string;
  type: DomainEventType;
  occurredAt: string;
  restaurantId?: string | null;
  actorUserId?: string | null;
  entityType?: CommunicationEntityType;
  entityId?: string | null;
  /**
   * Event *schema* version (shape of this event type).
   * Do not use this as the order/payment aggregate version.
   */
  schemaVersion: number;
  /** Owning aggregate version when known (e.g. order revision). */
  aggregateVersion: number | null;
  /** @deprecated Use aggregateVersion. Kept so existing callers keep compiling. */
  version: number;
  /** Business retry key. Distinct from id — never encode "same resulting status". */
  idempotencyKey?: string | null;
  correlationId?: string | null;
  causationId?: string | null;
  payload: Record<string, unknown>;
};

export type NotificationTarget =
  | { kind: "user"; userId: string }
  | { kind: "contact"; email?: string; phone?: string; name?: string };

export type RoutedNotification = {
  target: NotificationTarget;
  category: NotificationCategory;
  eventKey: string;
  title: string;
  body: string;
  payload: Record<string, unknown>;
  priority: NotificationPriority;
  channels: DeliveryChannel[];
  restaurantId?: string | null;
};

export type InAppUserPayload = {
  notificationId: string;
  category: NotificationCategory;
  eventKey: string;
  title: string;
  body: string;
  priority: NotificationPriority;
  payload: Record<string, unknown>;
  createdAt: string;
};
