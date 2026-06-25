import type { OrderSourceContract } from "./orderSourceTypes.js";

export type SourceNotificationPlan = {
  onCreate: string[];
  onStatusChange: string[];
  channels: ("IN_APP" | "PUSH" | "SMS" | "EMAIL" | "PARTNER_WEBHOOK")[];
};

/** Declarative notification plan — consumers read contract, not source enums. */
export function buildSourceNotificationPlan(contract: OrderSourceContract): SourceNotificationPlan {
  const channels: SourceNotificationPlan["channels"] = ["IN_APP"];
  const onCreate: string[] = [];
  const onStatusChange: string[] = [];

  if (contract.notifications.notifyStaffOnCreate) {
    onCreate.push("order.created.staff");
  }

  if (contract.notifications.notifyCustomerOnStatus) {
    onStatusChange.push("order.updated.customer");
  }

  if (contract.notifications.smsAllowed) {
    channels.push("SMS");
  }

  if (contract.notifications.partnerCallback) {
    channels.push("PARTNER_WEBHOOK");
    onStatusChange.push("order.updated.partner_callback");
  }

  if (contract.notifications.minimalCustomerNotifications) {
    return { onCreate, onStatusChange: [], channels };
  }

  if (contract.notifications.notifyCustomerOnStatus) {
    channels.push("PUSH");
  }

  return { onCreate, onStatusChange, channels };
}

export const SOURCE_NOTIFICATION_AUTHORITY = {
  rule: "notification routing must consult buildSourceNotificationPlan(contract)",
  antiPattern: "if (order.source === 'QR_ORDER') in notification code"
} as const;
