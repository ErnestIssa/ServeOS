import type { OrderStatus, PrismaClient } from "@prisma/client";

const ACTIVE: OrderStatus[] = ["PENDING", "CONFIRMED", "PREPARING", "READY"];

/** Active in-progress orders for bottom-nav Orders badge. */
export async function countActiveCustomerOrders(prisma: PrismaClient, customerUserId: string): Promise<number> {
  return prisma.order.count({
    where: {
      customerUserId,
      status: { in: ACTIVE }
    }
  });
}
