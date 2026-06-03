import type { NotificationCategory, NotificationPriority } from "@prisma/client";

export type DeliveryChannel = "IN_APP" | "PUSH" | "EMAIL" | "SMS" | "WHATSAPP";

export type DomainEventType =
  | "order.created"
  | "order.updated"
  | "order.delivered"
  | "chat.message_sent"
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
  | "integration.failed";

export type DomainEvent = {
  id: string;
  type: DomainEventType;
  occurredAt: string;
  restaurantId?: string | null;
  actorUserId?: string | null;
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
