/**
 * Future extension boundary — item-level FSM is NOT implemented yet.
 * Order-level status remains SSOT; line items stay passive snapshots until Phase 2.
 *
 * Schema note: OrderLineItem already stores immutable price snapshots.
 * When item FSM ships, add `kitchenStatus` per line WITHOUT removing snapshot fields.
 */

export type OrderItemKitchenStatus =
  | "QUEUED"
  | "PREPARING"
  | "READY"
  | "SERVED"
  | "CANCELLED";

/** Planned item transitions — not enforced by the engine today. */
export const PLANNED_ITEM_TRANSITIONS: Record<OrderItemKitchenStatus, OrderItemKitchenStatus[]> = {
  QUEUED: ["PREPARING", "CANCELLED"],
  PREPARING: ["READY", "CANCELLED"],
  READY: ["SERVED"],
  SERVED: [],
  CANCELLED: []
};

/**
 * Extension hook for multi-station KDS (grill, fry, expo).
 * Consumers should treat `order.status` as aggregate; item status is derived later.
 */
export type OrderItemFsmExtension = {
  lineItemId: string;
  stationId?: string;
  kitchenStatus: OrderItemKitchenStatus;
  startedAt?: string;
  readyAt?: string;
};

export const ORDER_ITEM_FSM_PHASE = "planned" as const;
