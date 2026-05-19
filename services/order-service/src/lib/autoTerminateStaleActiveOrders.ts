import type { PrismaClient } from "@prisma/client";
import { isVenueOpenNow } from "./venueOpenNow.js";

const ACTIVE_TERMINATION_STATUSES = ["PENDING", "CONFIRMED", "PREPARING", "READY"] as const;

const MS_PER_DAY = 24 * 60 * 60 * 1000;
/** Same as main API — never “closed venue” cancel a brand-new order on first `/orders/mine`. */
const MIN_AGE_MS_FOR_VENUE_CLOSED_TERMINATION = 30 * 60 * 1000;

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
      if (ageMs >= MS_PER_DAY) return true;
      if (ageMs < MIN_AGE_MS_FOR_VENUE_CLOSED_TERMINATION) return false;
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
