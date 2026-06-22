/**
 * Graceful degradation when downstream systems fail.
 * Order mutations ALWAYS succeed if DB is healthy; delivery is best-effort + outbox retry.
 */

export const ORDER_DEGRADATION_POLICY = {
  acceptOrdersWhenRealtimeDown: true,
  acceptOrdersWhenNotificationBusDown: true,
  acceptOrdersWhenOutboxBacklogged: true,
  maxOutboxPendingBeforeDegraded: 500,
  maxOutboxPendingBeforeAlert: 2_000,
  websocketFailureMode: "queue-in-outbox" as const,
  redisFailureMode: "queue-in-outbox" as const,
  notificationFailureMode: "outbox-retry-then-dead-letter" as const
} as const;

export type DegradationState = "healthy" | "degraded" | "critical";

export function evaluateDegradationState(outboxPendingCount: number): DegradationState {
  if (outboxPendingCount >= ORDER_DEGRADATION_POLICY.maxOutboxPendingBeforeAlert) return "critical";
  if (outboxPendingCount >= ORDER_DEGRADATION_POLICY.maxOutboxPendingBeforeDegraded) return "degraded";
  return "healthy";
}

export function shouldBlockOrderMutation(state: DegradationState): boolean {
  void state;
  return false;
}
