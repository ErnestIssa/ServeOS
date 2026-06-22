import type { Prisma, PrismaClient } from "@prisma/client";

/**
 * Order search strategy — DB-backed today; index layer hook for scale.
 * Future: dedicated search index (OpenSearch / pg_trgm) without changing API shape.
 */

export type OrderSearchQuery = {
  restaurantId: string;
  q: string;
  limit?: number;
};

function tokenize(q: string): string[] {
  return q
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 8);
}

export async function searchOrders(prisma: PrismaClient, query: OrderSearchQuery) {
  const tokens = tokenize(query.q);
  if (!tokens.length) return [];

  const limit = Math.min(50, query.limit ?? 25);

  const orBlocks: Prisma.OrderWhereInput[] = [
    { id: { contains: query.q.trim(), mode: "insensitive" } },
    { customerName: { contains: query.q.trim(), mode: "insensitive" } },
    { customerEmail: { contains: query.q.trim(), mode: "insensitive" } },
    { customerPhone: { contains: query.q.trim(), mode: "insensitive" } },
    { tableLabel: { contains: query.q.trim(), mode: "insensitive" } },
    { note: { contains: query.q.trim(), mode: "insensitive" } }
  ];

  const displayNum = Number(query.q.replace(/[^0-9]/g, ""));
  if (Number.isFinite(displayNum) && displayNum > 0) {
    orBlocks.push({ displaySeq: displayNum });
  }

  for (const token of tokens) {
    orBlocks.push({ customerName: { contains: token, mode: "insensitive" } });
  }

  return prisma.order.findMany({
    where: { restaurantId: query.restaurantId, OR: orBlocks },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      displaySeq: true,
      status: true,
      totalCents: true,
      customerName: true,
      createdAt: true
    }
  });
}

export const ORDER_SEARCH_STRATEGY = {
  current: "postgresql_multi_field" as const,
  future: "dedicated_search_index" as const,
  indexFields: ["id", "displaySeq", "customerName", "customerEmail", "customerPhone", "tableLabel", "note"],
  rebuildFrom: "OrderDomainEvent + Order audit tables"
} as const;
