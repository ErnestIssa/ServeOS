import type { NotificationCategory, Prisma } from "@prisma/client";
import type { CommunicationEntityType, CommunicationTarget } from "./types.js";

export type NotificationEntityType = CommunicationEntityType;

export type NotificationDeepLink = CommunicationTarget;

export function commsOrderChatHref(chatRoomId: string) {
  return `#ws-comms/order-chats?roomId=${encodeURIComponent(chatRoomId)}`;
}

export function commsStaffChatHref(chatRoomId: string) {
  return `#ws-comms/staff-internal-chat?roomId=${encodeURIComponent(chatRoomId)}`;
}

export function commsCustomerInboxHref(chatRoomId: string) {
  return `#ws-comms/customer-inbox?roomId=${encodeURIComponent(chatRoomId)}`;
}

export function notificationDeepLink(input: {
  type: string;
  restaurantId?: string | null;
  payload: Record<string, unknown>;
}): CommunicationTarget {
  const p = input.payload;
  const chatRoomId = typeof p.chatRoomId === "string" ? p.chatRoomId : undefined;
  const orderId = typeof p.orderId === "string" ? p.orderId : null;
  const reservationId = typeof p.reservationId === "string" ? p.reservationId : null;

  if (input.type === "chat.message_sent" && chatRoomId) {
    const href =
      typeof p.href === "string" && p.href.startsWith("#")
        ? p.href
        : commsOrderChatHref(chatRoomId);
    return {
      entityType: "CHAT_ROOM",
      entityId: chatRoomId,
      chatRoomId,
      restaurantId: input.restaurantId ?? null,
      href
    };
  }

  if (input.type.startsWith("order.") && orderId) {
    return {
      entityType: "ORDER",
      entityId: orderId,
      chatRoomId,
      restaurantId: input.restaurantId ?? null,
      href: chatRoomId ? commsOrderChatHref(chatRoomId) : `#ws-orders/all-orders`
    };
  }

  if (input.type.startsWith("reservation.")) {
    return {
      entityType: "RESERVATION",
      entityId: reservationId,
      restaurantId: input.restaurantId ?? null,
      href: `#ws-venue/reservations`
    };
  }

  if (input.type.startsWith("payment.")) {
    return {
      entityType: "PAYMENT",
      entityId: typeof p.paymentId === "string" ? p.paymentId : orderId,
      restaurantId: input.restaurantId ?? null,
      href: `#ws-config/payments?tab=transactions`
    };
  }

  if (input.type.startsWith("staff.")) {
    return {
      entityType: "STAFF",
      entityId: typeof p.userId === "string" ? p.userId : null,
      restaurantId: input.restaurantId ?? null,
      href: `#top-add-staff`
    };
  }

  if (input.type === "device.offline" || input.type === "integration.failed") {
    return {
      entityType: "DEVICE",
      entityId: typeof p.deviceId === "string" ? p.deviceId : null,
      restaurantId: input.restaurantId ?? null,
      href: `#ws-devices/all-devices`
    };
  }

  return {
    entityType: "SYSTEM",
    entityId: typeof p.entityId === "string" ? p.entityId : null,
    restaurantId: input.restaurantId ?? null,
    href: `#top-notify-system-updates`
  };
}

export function communicationTargetFromPayload(
  payload: Record<string, unknown>,
  restaurantId?: string | null
): CommunicationTarget {
  return {
    entityType: (typeof payload.entityType === "string" ? payload.entityType : "SYSTEM") as CommunicationEntityType,
    entityId: typeof payload.entityId === "string" ? payload.entityId : null,
    chatRoomId: typeof payload.chatRoomId === "string" ? payload.chatRoomId : undefined,
    restaurantId:
      (typeof payload.restaurantId === "string" ? payload.restaurantId : null) ?? restaurantId ?? null,
    href: typeof payload.href === "string" ? payload.href : undefined
  };
}

export function mergeNotificationDeepLink(
  type: string,
  restaurantId: string | null | undefined,
  payload: Record<string, unknown>
): Record<string, unknown> {
  const target = notificationDeepLink({ type, restaurantId, payload });
  const href =
    typeof payload.href === "string" && payload.href.startsWith("#") ? payload.href : target.href;
  return {
    ...payload,
    entityType: target.entityType,
    entityId: target.entityId,
    chatRoomId: target.chatRoomId ?? payload.chatRoomId,
    restaurantId: target.restaurantId ?? restaurantId ?? payload.restaurantId,
    href
  };
}

const CUSTOMER_CATEGORIES: NotificationCategory[] = ["CHAT", "ORDER", "RESERVATION"];
const DEVICE_EVENT_KEYS = ["device.offline", "integration.failed"];

export function notificationFilterWhere(filter: string | undefined): Prisma.NotificationWhereInput | null {
  const f = (filter ?? "all").trim().toLowerCase();
  if (!f || f === "all") return null;
  if (f === "customer") return { category: { in: CUSTOMER_CATEGORIES } };
  if (f === "staff") return { category: "STAFF" };
  if (f === "payments") return { category: "PAYMENT" };
  if (f === "devices") return { eventKey: { in: DEVICE_EVENT_KEYS } };
  if (f === "system") {
    return { category: "SYSTEM", eventKey: { notIn: DEVICE_EVENT_KEYS } };
  }
  return null;
}
