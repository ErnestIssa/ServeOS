import type { PrismaClient } from "@prisma/client";
import { isVenueOpenNow } from "./venueOpenNow.js";

const ACTIVE_TERMINATION_STATUSES = ["PENDING", "CONFIRMED", "PREPARING", "READY"] as const;

/** Rolling 24 hours from `createdAt` (not calendar midnight). */
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Sets matching orders to `CANCELLED` when they are still “active” but:
 * - older than 24 hours from `createdAt`, or
 * - the restaurant is **not** open right now per the same rules as the mobile app.
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
      if (now.getTime() - o.createdAt.getTime() >= MS_PER_DAY) return true;
      const hours = o.restaurant?.openingHours ?? null;
      if (!isVenueOpenNow(hours, now)) return true;
      return false;
    })
    .map((o) => o.id);

  if (ids.length === 0) return [];

  await prisma.order.updateMany({
    where: { id: { in: ids } },
    data: { status: "CANCELLED" }
  });

  return ids;
}
