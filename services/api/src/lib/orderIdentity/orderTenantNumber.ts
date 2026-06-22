import type { Prisma, PrismaClient } from "@prisma/client";
import type { TenantDisplayAllocation } from "./orderIdentityTypes.js";
import { computeDisplayPeriodKey, loadRestaurantIdentityPolicy } from "./orderIdentityPolicy.js";

type Tx = Prisma.TransactionClient;

/**
 * Atomically allocates the next tenant display number for a restaurant.
 * Uses row-level locking via RestaurantOrderCounter — safe under concurrent placement.
 */
export async function allocateTenantDisplayNumber(
  tx: Tx,
  restaurantId: string,
  at = new Date()
): Promise<TenantDisplayAllocation> {
  const policy = await loadRestaurantIdentityPolicy(tx as unknown as PrismaClient, restaurantId);
  const targetPeriod = computeDisplayPeriodKey(policy.displayNumberReset, at);

  await tx.$executeRaw`
    INSERT INTO "RestaurantOrderCounter" ("restaurantId", "nextSeq", "periodKey", "periodStartSeq", "updatedAt")
    VALUES (${restaurantId}, 0, ${targetPeriod}, 0, NOW())
    ON CONFLICT ("restaurantId") DO NOTHING
  `;

  const locked = await tx.$queryRaw<
    Array<{ restaurantId: string; nextSeq: number; periodKey: string; periodStartSeq: number }>
  >`
    SELECT "restaurantId", "nextSeq", "periodKey", "periodStartSeq"
    FROM "RestaurantOrderCounter"
    WHERE "restaurantId" = ${restaurantId}
    FOR UPDATE
  `;

  const row = locked[0];
  if (!row) {
    throw Object.assign(new Error("order_counter_unavailable"), { statusCode: 500 });
  }

  let periodKey = row.periodKey;
  let periodStartSeq = row.periodStartSeq;
  let nextSeq = row.nextSeq;

  if (periodKey !== targetPeriod) {
    periodKey = targetPeriod;
    periodStartSeq = nextSeq;
  }

  nextSeq += 1;
  const displaySeq = nextSeq - periodStartSeq;

  await tx.restaurantOrderCounter.update({
    where: { restaurantId },
    data: { nextSeq, periodKey, periodStartSeq }
  });

  return {
    displaySeq,
    displayPeriodKey: periodKey,
    monotonicSeq: nextSeq
  };
}
