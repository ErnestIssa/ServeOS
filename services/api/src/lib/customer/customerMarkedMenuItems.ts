import type { PrismaClient } from "@prisma/client";

/** Matches mobile `isActiveOrderStatus` — items in these orders stay marked on the menu. */
export const CUSTOMER_ACTIVE_ORDER_STATUSES = ["PENDING", "CONFIRMED", "PREPARING", "READY"] as const;

/**
 * Menu item ids the customer should see as already added (✓) at a venue:
 * anything in their cart and anything on a non-terminal order at that restaurant.
 */
export async function listMarkedMenuItemIdsForRestaurant(
  prisma: PrismaClient,
  userId: string,
  restaurantId: string
): Promise<string[]> {
  const ids = new Set<string>();

  const cart = await prisma.shoppingCart.findUnique({
    where: { userId_restaurantId: { userId, restaurantId } },
    select: { lines: { select: { menuItemId: true } } }
  });
  for (const line of cart?.lines ?? []) {
    ids.add(line.menuItemId);
  }

  const activeOrders = await prisma.order.findMany({
    where: {
      customerUserId: userId,
      restaurantId,
      status: { in: [...CUSTOMER_ACTIVE_ORDER_STATUSES] }
    },
    select: { lines: { select: { menuItemId: true } } }
  });
  for (const order of activeOrders) {
    for (const line of order.lines) {
      ids.add(line.menuItemId);
    }
  }

  return [...ids];
}
