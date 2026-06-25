import type { PrismaClient } from "@prisma/client";

export type CustomerBrowsableRestaurant = {
  id: string;
  name: string;
  openingHours: string | null;
  hasMenu: boolean;
};

/**
 * Restaurants registered on ServeOS (linked to a company) that customers may browse.
 * Single source of truth for customer venue directory + preference validation.
 */
export async function listCustomerBrowsableRestaurants(
  prisma: PrismaClient
): Promise<CustomerBrowsableRestaurant[]> {
  const rows = await prisma.restaurant.findMany({
    where: {
      companyId: { not: null }
    },
    select: {
      id: true,
      name: true,
      openingHours: true,
      menuCategories: {
        where: { isActive: true },
        select: {
          items: {
            where: { isActive: true },
            select: { id: true },
            take: 1
          }
        }
      }
    },
    orderBy: { name: "asc" }
  });

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    openingHours: r.openingHours,
    hasMenu: r.menuCategories.some((c) => c.items.length > 0)
  }));
}

export async function isCustomerBrowsableRestaurant(
  prisma: PrismaClient,
  restaurantId: string
): Promise<boolean> {
  if (!restaurantId.trim()) return false;
  const row = await prisma.restaurant.findFirst({
    where: { id: restaurantId, companyId: { not: null } },
    select: { id: true }
  });
  return Boolean(row);
}
