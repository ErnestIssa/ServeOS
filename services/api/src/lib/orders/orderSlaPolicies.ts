import type { OrderStatus } from "@prisma/client";
import { normalizeOrderStatus, type CanonicalOrderStatus } from "./orderTypes.js";

/** Formal SLA thresholds — used by stale termination and future escalation jobs. */
export const ORDER_SLA_POLICY = {
  /** Rolling window — order auto-cancelled if still active after this. */
  maxActiveAgeMs: 24 * 60 * 60 * 1000,
  /** Minimum age before venue-closed rule applies (protects fresh checkouts). */
  minAgeForVenueClosedCancelMs: 30 * 60 * 1000,
  /** Kitchen delay flag — PREPARING longer than this → problem/delay signal. */
  preparingDelayWarningMs: 30 * 60 * 1000,
  /** ACCEPTED but kitchen not started — escalation threshold. */
  acceptedWithoutPrepEscalationMs: 15 * 60 * 1000,
  /** READY waiting for handoff — pickup delay threshold. */
  readyHandoffDelayMs: 20 * 60 * 1000
} as const;

export type OrderSlaSignal =
  | "none"
  | "preparing_delayed"
  | "accepted_stalled"
  | "ready_waiting"
  | "stale_active";

export type OrderSlaThresholds = {
  maxActiveAgeMs: number;
  preparingDelayWarningMs: number;
  acceptedWithoutPrepEscalationMs: number;
  readyHandoffDelayMs: number;
};

export function evaluateOrderSla(order: {
  status: OrderStatus;
  createdAt: Date;
  kitchenStartedAt: Date | null;
  completedAt: Date | null;
  updatedAt: Date;
  now?: Date;
  sla?: OrderSlaThresholds;
}): OrderSlaSignal {
  const now = order.now ?? new Date();
  const canon = normalizeOrderStatus(order.status);
  const ageMs = now.getTime() - order.createdAt.getTime();
  const sla = order.sla ?? ORDER_SLA_POLICY;

  if (["CREATED", "PENDING_PAYMENT", "PAID", "ACCEPTED", "PREPARING", "READY"].includes(canon)) {
    if (ageMs >= sla.maxActiveAgeMs) return "stale_active";
  }

  if (canon === "PREPARING" && order.kitchenStartedAt) {
    const prepMs = now.getTime() - order.kitchenStartedAt.getTime();
    if (prepMs >= sla.preparingDelayWarningMs) return "preparing_delayed";
  }

  if (canon === "ACCEPTED" && !order.kitchenStartedAt) {
    const sinceUpdate = now.getTime() - order.updatedAt.getTime();
    if (sinceUpdate >= sla.acceptedWithoutPrepEscalationMs) return "accepted_stalled";
  }

  if (canon === "READY") {
    const sinceUpdate = now.getTime() - order.updatedAt.getTime();
    if (sinceUpdate >= sla.readyHandoffDelayMs) return "ready_waiting";
  }

  return "none";
}

export const ACTIVE_SLA_STATUSES: CanonicalOrderStatus[] = [
  "CREATED",
  "PENDING_PAYMENT",
  "PAID",
  "ACCEPTED",
  "PREPARING",
  "READY"
];
