import type { PrismaClient } from "@prisma/client";

export async function fetchMenuTree(
  prisma: PrismaClient,
  restaurantId: string,
  opts: { onlyActive: boolean }
) {
  const categories = await prisma.menuCategory.findMany({
    where: {
      restaurantId,
      ...(opts.onlyActive ? { isActive: true } : {})
    },
    orderBy: { sortOrder: "asc" },
    include: {
      items: {
        where: opts.onlyActive ? { isActive: true } : undefined,
        orderBy: { sortOrder: "asc" },
        include: {
          modifierGroups: {
            orderBy: { sortOrder: "asc" },
            include: {
              options: {
                where: opts.onlyActive ? { isActive: true } : undefined,
                orderBy: { sortOrder: "asc" }
              }
            }
          }
        }
      }
    }
  });

  if (!opts.onlyActive) return categories;

  return categories.filter((c) => c.items.length > 0);
}
