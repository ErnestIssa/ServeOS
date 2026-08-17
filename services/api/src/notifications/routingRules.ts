import type { NotificationCategory, NotificationPriority } from "@prisma/client";
import type { DeliveryChannel, DomainEventType } from "./types.js";

export type RecipientStrategy =
  | "order_participants"
  | "chat_participants"
  | "restaurant_admins"
  | "invitee_contact"
  | "affected_user"
  | "actor_only";

export type RouteRule = {
  category: NotificationCategory;
  priority: NotificationPriority;
  channels: DeliveryChannel[];
  recipients: RecipientStrategy;
  title: (payload: Record<string, unknown>) => string;
  body: (payload: Record<string, unknown>) => string;
};

export const ROUTING_RULES: Record<DomainEventType, RouteRule> = {
  "order.created": {
    category: "ORDER",
    priority: "MEDIUM",
    channels: ["IN_APP", "PUSH"],
    recipients: "order_participants",
    title: () => "New order",
    body: (p) => `Order ${String(p.orderId ?? "").slice(0, 8)} received`
  },
  "order.updated": {
    category: "ORDER",
    priority: "MEDIUM",
    channels: ["IN_APP", "PUSH"],
    recipients: "order_participants",
    title: (p) => `Order ${String(p.status ?? "updated")}`,
    body: (p) =>
      `${p.restaurantName ? `${p.restaurantName}: ` : ""}Status is now ${String(p.status ?? "updated")}`
  },
  "order.delivered": {
    category: "ORDER",
    priority: "HIGH",
    channels: ["IN_APP", "PUSH"],
    recipients: "order_participants",
    title: () => "Order ready",
    body: () => "Your order is ready for pickup or delivery"
  },
  "ocl.updated": {
    category: "ORDER",
    priority: "LOW",
    channels: ["IN_APP"],
    recipients: "order_participants",
    title: () => "Operational update",
    body: () => "Thread updated"
  },
  "chat.message_sent": {
    category: "CHAT",
    priority: "MEDIUM",
    channels: ["IN_APP", "PUSH"],
    recipients: "chat_participants",
    title: () => "New message",
    body: (p) => String(p.preview ?? "You have a new chat message")
  },
  "reservation.created": {
    category: "RESERVATION",
    priority: "MEDIUM",
    channels: ["IN_APP", "PUSH", "EMAIL"],
    recipients: "affected_user",
    title: () => "Reservation received",
    body: (p) => `Booking ${String(p.confirmationCode ?? "")}`
  },
  "reservation.confirmed": {
    category: "RESERVATION",
    priority: "MEDIUM",
    channels: ["IN_APP", "PUSH", "EMAIL"],
    recipients: "affected_user",
    title: () => "Reservation confirmed",
    body: (p) => `Confirmed: ${String(p.confirmationCode ?? "")}`
  },
  "reservation.cancelled": {
    category: "RESERVATION",
    priority: "HIGH",
    channels: ["IN_APP", "PUSH", "EMAIL"],
    recipients: "affected_user",
    title: () => "Reservation cancelled",
    body: () => "Your reservation was cancelled"
  },
  "payment.succeeded": {
    category: "PAYMENT",
    priority: "MEDIUM",
    channels: ["IN_APP", "EMAIL"],
    recipients: "affected_user",
    title: () => "Payment received",
    body: () => "Your payment was successful"
  },
  "payment.failed": {
    category: "PAYMENT",
    priority: "HIGH",
    channels: ["IN_APP", "PUSH", "EMAIL"],
    recipients: "affected_user",
    title: () => "Payment failed",
    body: () => "Please update your payment method"
  },
  "staff.invited": {
    category: "STAFF",
    priority: "HIGH",
    channels: ["SMS"],
    recipients: "invitee_contact",
    title: (p) => `Invitation to ${String(p.restaurantName ?? "venue")}`,
    body: (p) => {
      const role = String(p.intendedRole ?? "staff");
      const venue = String(p.restaurantName ?? "venue");
      const url = typeof p.acceptUrl === "string" ? p.acceptUrl : "";
      return url
        ? `You're invited as ${role} at ${venue}. Join: ${url}`
        : `You're invited as ${role} at ${venue}.`;
    }
  },
  "staff.pending_approval": {
    category: "STAFF",
    priority: "HIGH",
    channels: ["IN_APP", "PUSH", "EMAIL"],
    recipients: "restaurant_admins",
    title: () => "Staff awaiting approval",
    body: (p) => `${String(p.fullName ?? "Someone")} is waiting for access`
  },
  "staff.approved": {
    category: "STAFF",
    priority: "MEDIUM",
    channels: ["IN_APP", "PUSH", "EMAIL"],
    recipients: "affected_user",
    title: () => "Access approved",
    body: (p) => `You can now access ${String(p.restaurantName ?? "the venue")}`
  },
  "staff.rejected": {
    category: "STAFF",
    priority: "MEDIUM",
    channels: ["IN_APP", "EMAIL"],
    recipients: "affected_user",
    title: () => "Access not approved",
    body: () => "Your staff request was declined"
  },
  "system.alert": {
    category: "SYSTEM",
    priority: "CRITICAL",
    channels: ["IN_APP", "PUSH", "SMS", "WHATSAPP"],
    recipients: "restaurant_admins",
    title: (p) => String(p.title ?? "System alert"),
    body: (p) => String(p.message ?? "Operational alert")
  },
  "device.offline": {
    category: "SYSTEM",
    priority: "HIGH",
    channels: ["IN_APP", "PUSH"],
    recipients: "restaurant_admins",
    title: () => "Device offline",
    body: (p) => String(p.deviceName ?? "A connected device went offline")
  },
  "integration.failed": {
    category: "SYSTEM",
    priority: "CRITICAL",
    channels: ["IN_APP", "PUSH", "EMAIL"],
    recipients: "restaurant_admins",
    title: () => "Integration error",
    body: (p) => String(p.integration ?? "An integration needs attention")
  },
  "order.recovery.escalated": {
    category: "ORDER",
    priority: "CRITICAL",
    channels: ["IN_APP", "PUSH"],
    recipients: "restaurant_admins",
    title: () => "Order needs attention",
    body: (p) =>
      `Order ${String(p.orderId ?? "").slice(0, 8)} — ${String(p.slaSignal ?? p.signal ?? "stuck")}`
  },
  "order.discount.applied": {
    category: "ORDER",
    priority: "LOW",
    channels: ["IN_APP"],
    recipients: "order_participants",
    title: () => "Discount applied",
    body: () => "A discount was applied to the order"
  },
  "order.refunded": {
    category: "PAYMENT",
    priority: "HIGH",
    channels: ["IN_APP", "PUSH", "EMAIL"],
    recipients: "order_participants",
    title: () => "Refund processed",
    body: () => "A refund was issued for this order"
  },
  "fraud.risk.detected": {
    category: "SYSTEM",
    priority: "HIGH",
    channels: ["IN_APP", "PUSH"],
    recipients: "restaurant_admins",
    title: () => "Fraud risk detected",
    body: (p) => String(p.message ?? "A transaction was flagged for review")
  },
  "fraud.action.blocked": {
    category: "SYSTEM",
    priority: "CRITICAL",
    channels: ["IN_APP", "PUSH", "EMAIL"],
    recipients: "restaurant_admins",
    title: () => "Action blocked",
    body: (p) => String(p.message ?? "A risky action was blocked")
  },
  "approval.request.created": {
    category: "STAFF",
    priority: "HIGH",
    channels: ["IN_APP", "PUSH"],
    recipients: "restaurant_admins",
    title: () => "Approval needed",
    body: (p) => String(p.message ?? "An approval request is waiting")
  },
  "approval.request.approved": {
    category: "STAFF",
    priority: "MEDIUM",
    channels: ["IN_APP"],
    recipients: "affected_user",
    title: () => "Request approved",
    body: () => "Your request was approved"
  },
  "approval.request.rejected": {
    category: "STAFF",
    priority: "MEDIUM",
    channels: ["IN_APP"],
    recipients: "affected_user",
    title: () => "Request declined",
    body: () => "Your request was declined"
  },
  "approval.request.expired": {
    category: "STAFF",
    priority: "LOW",
    channels: ["IN_APP"],
    recipients: "restaurant_admins",
    title: () => "Approval expired",
    body: () => "An approval request expired"
  }
};
