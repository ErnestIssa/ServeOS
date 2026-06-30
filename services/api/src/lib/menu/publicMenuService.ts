import type { Prisma, PrismaClient } from "@prisma/client";
import { publicUrlForKey } from "../integrations/objectStorage.js";
import { fetchMenuTree } from "../menu.js";

export type PublicMenuMedia = {
  id: string;
  kind: "image" | "video";
  url: string | null;
  sortOrder: number;
  durationMs: number | null;
};

export type PublicMenuItem = {
  id: string;
  name: string;
  description: string | null;
  priceCents: number;
  sortOrder: number;
  isActive: boolean;
  imageKey: string | null;
  coverUrl: string | null;
  media: PublicMenuMedia[];
  modifierGroups: Array<{
    id: string;
    name: string;
    minSelect: number;
    maxSelect: number;
    sortOrder: number;
    options: Array<{
      id: string;
      name: string;
      priceDeltaCents: number;
      sortOrder: number;
      isActive: boolean;
    }>;
  }>;
};

export type PublicMenuCategory = {
  id: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
  items: PublicMenuItem[];
};

export type PublicMenuPayload = {
  restaurant: { id: string; name: string };
  menuId: string | null;
  menuVersionNumber: number | null;
  publishedAt: string | null;
  categories: PublicMenuCategory[];
};

function urlForObjectKey(key: string | null | undefined): string | null {
  if (!key?.trim()) return null;
  try {
    return publicUrlForKey(key);
  } catch {
    return null;
  }
}

async function loadMediaByItemIds(prisma: PrismaClient, itemIds: string[]) {
  const map = new Map<string, PublicMenuMedia[]>();
  if (!itemIds.length) return map;

  const rows = await prisma.storedMedia.findMany({
    where: { menuItemId: { in: itemIds }, scope: { in: ["MENU_IMAGE", "VIDEO"] } },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
  });

  for (const row of rows) {
    const kind = row.scope === "MENU_IMAGE" ? "image" : "video";
    const entry: PublicMenuMedia = {
      id: row.id,
      kind,
      url: urlForObjectKey(row.objectKey),
      sortOrder: row.sortOrder,
      durationMs: row.durationMs
    };
    const list = map.get(row.menuItemId!) ?? [];
    list.push(entry);
    map.set(row.menuItemId!, list);
  }
  return map;
}

function serializeLiveTree(
  categories: Awaited<ReturnType<typeof fetchMenuTree>>,
  mediaByItem: Map<string, PublicMenuMedia[]>
): PublicMenuCategory[] {
  return categories.map((cat) => ({
    id: cat.id,
    name: cat.name,
    sortOrder: cat.sortOrder,
    isActive: cat.isActive,
    items: cat.items.map((item) => {
      const media = mediaByItem.get(item.id) ?? [];
      const coverUrl = urlForObjectKey(item.imageKey) ?? media.find((m) => m.kind === "image")?.url ?? null;
      return {
        id: item.id,
        name: item.name,
        description: item.description,
        priceCents: item.priceCents,
        sortOrder: item.sortOrder,
        isActive: item.isActive,
        imageKey: item.imageKey,
        coverUrl,
        media,
        modifierGroups: item.modifierGroups.map((g) => ({
          id: g.id,
          name: g.name,
          minSelect: g.minSelect,
          maxSelect: g.maxSelect,
          sortOrder: g.sortOrder,
          options: g.options.map((o) => ({
            id: o.id,
            name: o.name,
            priceDeltaCents: o.priceDeltaCents,
            sortOrder: o.sortOrder,
            isActive: o.isActive
          }))
        }))
      };
    })
  }));
}

function parseSnapshotCategories(snapshot: unknown): PublicMenuCategory[] | null {
  if (!snapshot || typeof snapshot !== "object") return null;
  const root = snapshot as { categories?: unknown };
  if (!Array.isArray(root.categories)) return null;
  return root.categories as PublicMenuCategory[];
}

async function fetchTreeForMenuSurface(prisma: PrismaClient, restaurantId: string, menuId: string | null) {
  if (menuId) {
    const linked = await prisma.menuCategory.findMany({
      where: { restaurantId, menuId },
      orderBy: { sortOrder: "asc" },
      include: {
        items: {
          orderBy: { sortOrder: "asc" },
          include: {
            modifierGroups: {
              orderBy: { sortOrder: "asc" },
              include: { options: { orderBy: { sortOrder: "asc" } } }
            }
          }
        }
      }
    });
    if (linked.length > 0) return linked;
  }
  return fetchMenuTree(prisma, restaurantId, { onlyActive: false });
}

export async function buildPublishedPublicMenu(
  prisma: PrismaClient,
  restaurantId: string,
  opts?: { menuId?: string | null }
): Promise<PublicMenuPayload | null> {
  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: { id: true, name: true }
  });
  if (!restaurant) return null;

  let menu =
    opts?.menuId != null
      ? await prisma.menu.findFirst({
          where: { id: opts.menuId, restaurantId, status: "PUBLISHED" },
          include: { activeVersion: true }
        })
      : await prisma.menu.findFirst({
          where: { restaurantId, status: "PUBLISHED" },
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
          include: { activeVersion: true }
        });

  if (!menu) {
    menu = await prisma.menu.findFirst({
      where: { restaurantId, status: { not: "ARCHIVED" }, surfaceKey: "main" },
      include: { activeVersion: true }
    });
  }

  const snapshotCategories = menu?.activeVersion?.snapshot
    ? parseSnapshotCategories(menu.activeVersion.snapshot)
    : null;

  let categories: PublicMenuCategory[];
  if (snapshotCategories?.length) {
    categories = snapshotCategories
      .filter((c) => c.isActive !== false)
      .map((c) => ({
        ...c,
        items: (c.items ?? [])
          .filter((i) => i.isActive !== false)
          .map((i) => ({
            ...i,
            coverUrl: i.coverUrl ?? urlForObjectKey(i.imageKey) ?? null,
            media: i.media ?? []
          }))
      }))
      .filter((c) => c.items.length > 0);
  } else {
    const live = await fetchTreeForMenuSurface(prisma, restaurantId, menu?.id ?? null);
    const activeLive = live
      .filter((c) => c.isActive)
      .map((c) => ({ ...c, items: c.items.filter((i) => i.isActive) }))
      .filter((c) => c.items.length > 0);
    const itemIds = activeLive.flatMap((c) => c.items.map((i) => i.id));
    const mediaByItem = await loadMediaByItemIds(prisma, itemIds);
    categories = serializeLiveTree(activeLive, mediaByItem);
  }

  if (!categories.length) return null;

  const itemIds = categories.flatMap((c) => c.items.map((i) => i.id));
  const freshMedia = await loadMediaByItemIds(prisma, itemIds);
  categories = categories.map((cat) => ({
    ...cat,
    items: cat.items.map((item) => {
      const media = freshMedia.get(item.id) ?? item.media ?? [];
      const coverUrl = item.coverUrl ?? urlForObjectKey(item.imageKey) ?? media.find((m) => m.kind === "image")?.url ?? null;
      return { ...item, media, coverUrl };
    })
  }));

  return {
    restaurant,
    menuId: menu?.id ?? null,
    menuVersionNumber: menu?.activeVersion?.versionNumber ?? null,
    publishedAt: menu?.activeVersion?.publishedAt?.toISOString() ?? null,
    categories
  };
}

export async function buildMenuSnapshotForPublish(prisma: PrismaClient, restaurantId: string, menuId: string) {
  const tree = await fetchTreeForMenuSurface(prisma, restaurantId, menuId);
  const itemIds = tree.flatMap((c) => c.items.map((i) => i.id));
  const mediaByItem = await loadMediaByItemIds(prisma, itemIds);
  const categories = serializeLiveTree(tree, mediaByItem);
  return { categories } satisfies Prisma.InputJsonValue;
}
