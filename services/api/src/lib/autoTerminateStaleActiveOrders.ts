import type { PrismaClient } from "@prisma/client";
import { ACTIVE_KITCHEN_STATUSES, transitionOrderStatus } from "./orders/index.js";
import { ORDER_SLA_POLICY } from "./orders/orderSlaPolicies.js";
import { isVenueOpenNow } from "./venueOpenNow.js";

const ACTIVE_TERMINATION_STATUSES = [
  ...ACTIVE_KITCHEN_STATUSES,
  "PENDING",
  "CONFIRMED"
] as const;

/**
 * Sets matching orders to `CANCELLED` when they are still “active” but:
 * - older than 24 hours from `createdAt`, or
 * - the restaurant is **not** open right now per the same rules as the mobile app **and**
 *   the order is at least {@link MIN_AGE_MS_FOR_VENUE_CLOSED_TERMINATION} old.
 *
 * Returns ids that were cancelled (for broadcasting).
 */
export async function autoTerminateStaleActiveOrdersForCustomer(
  prisma: PrismaClient,
  customerUserId: string,
  now: Date = new Date()
): Promise<string[]> {
  const candidates = await prisma.order.findMany({
    where: {
      customerUserId,
      status: { in: [...ACTIVE_TERMINATION_STATUSES] }
    },
    select: {
      id: true,
      createdAt: true,
      restaurant: { select: { openingHours: true } }
    }
  });

  const ids = candidates
    .filter((o) => {
      const ageMs = now.getTime() - o.createdAt.getTime();
      if (ageMs >= ORDER_SLA_POLICY.maxActiveAgeMs) return true;
      if (ageMs < ORDER_SLA_POLICY.minAgeForVenueClosedCancelMs) return false;
      const hours = o.restaurant?.openingHours ?? null;
      if (!isVenueOpenNow(hours, now)) return true;
      return false;
    })
    .map((o) => o.id);

  if (ids.length === 0) return [];

  for (const id of ids) {
    await transitionOrderStatus(prisma, {
      orderId: id,
      targetStatus: "CANCELLED",
      actor: { source: "SYSTEM" },
      reason: "auto_terminated_stale"
    });
  }

  return ids;
}
