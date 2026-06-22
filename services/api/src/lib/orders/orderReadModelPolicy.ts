/**
 * Read-model consistency guarantees — documents expected freshness per surface.
 */

export const ORDER_READ_MODEL_POLICY = {
  adminOrderList: {
    source: "orderQueryService",
    consistency: "eventual" as const,
    maxStalenessMs: 5_000,
    note: "Acceptable for dashboard tables; poll or WS invalidates on order.updated."
  },
  adminOrderDetail: {
    source: "getAdminOrderDetail",
    consistency: "strong" as const,
    maxStalenessMs: 0,
    note: "Always read from primary DB on open."
  },
  kitchenBoard: {
    source: "websocket + optional poll",
    consistency: "near-real-time" as const,
    maxStalenessMs: 2_000,
    note: "Consumers dedupe by eventId; sequence ordering per orderId."
  },
  customerTracking: {
    source: "websocket + /orders/:id",
    consistency: "near-real-time" as const,
    maxStalenessMs: 3_000,
    note: "Timeline uses status history; eventual if WS down."
  },
  analytics: {
    source: "OrderDomainEvent store",
    consistency: "eventual" as const,
    maxStalenessMs: 60_000,
    note: "Rebuild-safe from append-only domain events."
  }
} as const;

export type ReadModelSurface = keyof typeof ORDER_READ_MODEL_POLICY;

export function isStaleRead(surface: ReadModelSurface, lastUpdatedAt: Date, now = new Date()): boolean {
  const policy = ORDER_READ_MODEL_POLICY[surface];
  if (policy.consistency === "strong") return false;
  return now.getTime() - lastUpdatedAt.getTime() > policy.maxStalenessMs;
}
