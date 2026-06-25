import type { CanonicalOrderStatus } from "../orders/orderTypes.js";
import type { OrderSourceContract } from "./orderSourceTypes.js";
import type { FrozenSourcePolicySnapshot } from "./orderSourceTypes.js";
import { buildSourceNotificationPlan, type SourceNotificationPlan } from "./orderSourceNotifications.js";
import { resolveFrozenContractFromMetadata } from "./orderSourcePolicyVersioning.js";

export type SourceNotificationContext = {
  slaBreached?: boolean;
  paymentRetryFailed?: boolean;
  cancelledAfterAccepted?: boolean;
  delayed?: boolean;
};

export type SourceStateNotificationPlan = SourceNotificationPlan & {
  onStatus: Partial<Record<CanonicalOrderStatus, string[]>>;
  exceptional: string[];
};

const STATUS_NOTIFY_MAP: Partial<Record<CanonicalOrderStatus, string[]>> = {
  ACCEPTED: ["order.accepted.customer"],
  READY: ["order.ready.customer"],
  COMPLETED: ["order.completed.customer"],
  CANCELLED: ["order.cancelled.customer", "order.cancelled.staff"]
};

/** State + source combined notification routing. */
export function buildSourceStateNotificationPlan(
  contract: OrderSourceContract,
  currentStatus: CanonicalOrderStatus,
  ctx?: SourceNotificationContext
): SourceStateNotificationPlan {
  const base = buildSourceNotificationPlan(contract);
  const onStatus: SourceStateNotificationPlan["onStatus"] = {};
  const exceptional: string[] = [];

  if (contract.notifications.notifyCustomerOnStatus) {
    for (const [status, events] of Object.entries(STATUS_NOTIFY_MAP)) {
      onStatus[status as CanonicalOrderStatus] = [...events];
    }
  }

  if (ctx?.delayed && contract.source === "QR_ORDER") {
    exceptional.push("order.delayed.customer");
  }
  if (ctx?.paymentRetryFailed) {
    exceptional.push("order.payment_retry_failed.customer");
  }
  if (ctx?.cancelledAfterAccepted) {
    exceptional.push("order.cancelled_after_acceptance.staff");
    if (contract.notifications.partnerCallback) {
      exceptional.push("order.cancelled_after_acceptance.partner_callback");
    }
  }
  if (ctx?.slaBreached) {
    exceptional.push("order.sla_breached.staff");
  }

  const activeForStatus = onStatus[currentStatus] ?? [];
  return {
    ...base,
    onStatus,
    exceptional,
    onStatusChange: [...new Set([...base.onStatusChange, ...activeForStatus, ...exceptional])]
  };
}

export function buildSourceStateNotificationPlanFromMetadata(
  metadata: unknown,
  currentStatus: CanonicalOrderStatus,
  ctx?: SourceNotificationContext
): SourceStateNotificationPlan | null {
  const frozen = resolveFrozenContractFromMetadata(metadata);
  if (!frozen) return null;

  const contract: OrderSourceContract = {
    source: frozen.source,
    label: frozen.source,
    validation: {} as OrderSourceContract["validation"],
    payment: frozen.payment,
    ownership: {} as OrderSourceContract["ownership"],
    notifications: frozen.notifications,
    analytics: { channel: frozen.source, conversionTrackable: false, revenueBucket: "frozen" }
  };

  return buildSourceStateNotificationPlan(contract, currentStatus, ctx);
}

export const SOURCE_STATE_NOTIFICATION_AUTHORITY = {
  rule: "consumers must use buildSourceStateNotificationPlan(contract, status, ctx)",
  dimensions: ["source_contract", "order_status", "operational_context"]
} as const;
