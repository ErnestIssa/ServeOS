import type { DomainEventType } from "../../notifications/types.js";

/**
 * Independent projection decisions. A domain event must not automatically
 * become a chat line, a notification, and an audit row.
 */
export type EventProjectionDecision = {
  chatTimeline: boolean;
  notification: boolean;
  audit: boolean;
};

const none: EventProjectionDecision = { chatTimeline: false, notification: false, audit: false };
const ops: EventProjectionDecision = { chatTimeline: true, notification: true, audit: true };
const notifyAudit: EventProjectionDecision = { chatTimeline: false, notification: true, audit: true };
const auditOnly: EventProjectionDecision = { chatTimeline: false, notification: false, audit: true };
const chatNotify: EventProjectionDecision = { chatTimeline: false, notification: true, audit: false };

/**
 * Which consumers fire for each DomainEventType.
 * Order/reservation status chat lines are written by OCL seeders (once per status),
 * not by blindly projecting every `order.updated`.
 */
export const EVENT_PROJECTIONS: Record<DomainEventType, EventProjectionDecision> = {
  "order.created": ops,
  "order.updated": { chatTimeline: false, notification: true, audit: true },
  "order.delivered": ops,
  "order.refunded": ops,
  "order.discount.applied": auditOnly,
  "order.recovery.escalated": notifyAudit,
  "ocl.updated": none,
  "chat.message_sent": chatNotify,
  "reservation.created": notifyAudit,
  "reservation.confirmed": ops,
  "reservation.cancelled": ops,
  "payment.succeeded": ops,
  "payment.failed": ops,
  "staff.invited": notifyAudit,
  "staff.pending_approval": notifyAudit,
  "staff.approved": notifyAudit,
  "staff.rejected": notifyAudit,
  "system.alert": notifyAudit,
  "device.offline": notifyAudit,
  "integration.failed": notifyAudit,
  "fraud.risk.detected": notifyAudit,
  "fraud.action.blocked": notifyAudit,
  "approval.request.created": notifyAudit,
  "approval.request.approved": notifyAudit,
  "approval.request.rejected": notifyAudit,
  "approval.request.expired": notifyAudit
};

export function shouldProjectChatTimeline(type: DomainEventType | string): boolean {
  return EVENT_PROJECTIONS[type as DomainEventType]?.chatTimeline === true;
}

export function shouldCreateNotification(type: DomainEventType | string): boolean {
  return EVENT_PROJECTIONS[type as DomainEventType]?.notification === true;
}
