import type { PrismaClient } from "@prisma/client";

export async function listCollections(prisma: PrismaClient, restaurantId: string) {
  const rows = await prisma.mediaCollection.findMany({
    where: { restaurantId },
    orderBy: { name: "asc" },
    include: { _count: { select: { items: true } } }
  });
  return rows.map((c) => ({
    id: c.id,
    name: c.name,
    description: c.description,
    itemCount: c._count.items,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString()
  }));
}

export async function createCollection(
  prisma: PrismaClient,
  restaurantId: string,
  input: { name: string; description?: string | null }
) {
  const name = input.name.trim();
  if (!name) return { ok: false as const, error: "name_required" };
  try {
    const row = await prisma.mediaCollection.create({
      data: {
        restaurantId,
        name,
        description: input.description?.trim() || null
      }
    });
    return { ok: true as const, collection: row };
  } catch {
    return { ok: false as const, error: "collection_exists" };
  }
}

export async function updateCollection(
  prisma: PrismaClient,
  restaurantId: string,
  collectionId: string,
  input: { name?: string; description?: string | null }
) {
  const existing = await prisma.mediaCollection.findFirst({
    where: { id: collectionId, restaurantId }
  });
  if (!existing) return { ok: false as const, error: "not_found" };
  try {
    const row = await prisma.mediaCollection.update({
      where: { id: collectionId },
      data: {
        ...(input.name !== undefined ? { name: input.name.trim() } : {}),
        ...(input.description !== undefined ? { description: input.description?.trim() || null } : {})
      }
    });
    return { ok: true as const, collection: row };
  } catch {
    return { ok: false as const, error: "update_failed" };
  }
}

export async function deleteCollection(prisma: PrismaClient, restaurantId: string, collectionId: string) {
  const existing = await prisma.mediaCollection.findFirst({
    where: { id: collectionId, restaurantId }
  });
  if (!existing) return { ok: false as const, error: "not_found" };
  await prisma.mediaCollection.delete({ where: { id: collectionId } });
  return { ok: true as const };
}

export async function addAssetsToCollection(
  prisma: PrismaClient,
  restaurantId: string,
  collectionId: string,
  assetIds: string[]
) {
  const collection = await prisma.mediaCollection.findFirst({
    where: { id: collectionId, restaurantId }
  });
  if (!collection) return { ok: false as const, error: "not_found" };

  let sortOrder = await prisma.mediaCollectionItem.count({ where: { collectionId } });
  for (const assetId of assetIds) {
    const asset = await prisma.mediaAsset.findFirst({
      where: {
        id: assetId,
        OR: [{ restaurantId }, { usages: { some: { restaurantId } } }]
      }
    });
    if (!asset) continue;
    await prisma.mediaCollectionItem.upsert({
      where: { collectionId_assetId: { collectionId, assetId } },
      create: { collectionId, assetId, sortOrder },
      update: {}
    });
    sortOrder += 1;
  }
  return { ok: true as const };
}

export async function removeAssetFromCollection(
  prisma: PrismaClient,
  restaurantId: string,
  collectionId: string,
  assetId: string
) {
  const collection = await prisma.mediaCollection.findFirst({
    where: { id: collectionId, restaurantId }
  });
  if (!collection) return { ok: false as const, error: "not_found" };
  await prisma.mediaCollectionItem.deleteMany({ where: { collectionId, assetId } });
  return { ok: true as const };
}
