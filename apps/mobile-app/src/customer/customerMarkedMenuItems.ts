import { isActiveOrderStatus, type CustomerMineOrder } from "./CustomerOrderTrackingSection";
import type { CartLineApi } from "./cartApi";

export function markedMenuItemIdsToRecord(ids: Iterable<string>): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  for (const id of ids) {
    if (id.trim()) out[id] = true;
  }
  return out;
}

/** Merge server SST ids with cart lines, active venue orders, and short-lived optimistic taps. */
export function buildMarkedMenuItemIdsRecord(params: {
  serverMarkedMenuItemIds: string[];
  cartLines: CartLineApi[];
  orders: CustomerMineOrder[];
  restaurantId: string;
  optimisticMenuItemIds: Iterable<string>;
}): Record<string, boolean> {
  const set = new Set<string>();
  for (const id of params.serverMarkedMenuItemIds) {
    if (id.trim()) set.add(id.trim());
  }
  for (const line of params.cartLines) {
    if (line.menuItemId.trim()) set.add(line.menuItemId.trim());
  }
  const rid = params.restaurantId.trim();
  for (const order of params.orders) {
    if (!isActiveOrderStatus(order.status)) continue;
    const orid = order.restaurant?.id ? String(order.restaurant.id).trim() : "";
    if (rid && orid && orid !== rid) continue;
    for (const line of order.lines ?? []) {
      const mid = line.menuItemId?.trim();
      if (mid) set.add(mid);
    }
  }
  for (const id of params.optimisticMenuItemIds) {
    if (id.trim()) set.add(id.trim());
  }
  return markedMenuItemIdsToRecord(set);
}
