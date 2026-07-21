import type { Prisma, PrismaClient, StoredMediaVisibility } from "@prisma/client";
import {
  createPresignedGetUrl,
  isObjectStorageConfigured,
  parseStoredContentRef,
  publicUrlForKey
} from "../integrations/objectStorage.js";
import { fetchMenuTree } from "../menu.js";
import { evaluateAvailability, type AvailabilityEvaluation } from "./availabilityEvaluationService.js";
import { sanitizeAvailabilityWindows } from "./menuAvailability.js";

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
  /** SSOT orderability from availabilityEvaluationService */
  orderable?: boolean;
  availabilityStatus?: string;
  availabilityReasons?: AvailabilityEvaluation["reasons"];
  isSoldOut?: boolean;
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

function normalizeObjectKey(key: string): string {
  return parseStoredContentRef(key.trim()) ?? key.trim();
}

function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

function cdnConfigured(): boolean {
  return Boolean(process.env.CLOUDFLARE_CDN_URL?.trim() || process.env.AWS_S3_PUBLIC_URL?.trim());
}

type MediaUrlResolver = {
  resolveKey: (key: string | null | undefined) => Promise<string | null>;
};

async function createMediaUrlResolver(
  prisma: PrismaClient,
  keys: Array<string | null | undefined>
): Promise<MediaUrlResolver> {
  const normalized = [
    ...new Set(
      keys
        .map((k) => (typeof k === "string" && k.trim() ? normalizeObjectKey(k.trim()) : ""))
        .filter(Boolean)
    )
  ];
  const visRows = normalized.length
    ? await prisma.storedMedia.findMany({
        where: { objectKey: { in: normalized } },
        select: { objectKey: true, visibility: true }
      })
    : [];
  const visByKey = new Map<string, StoredMediaVisibility>(
    visRows.map((r) => [r.objectKey, r.visibility])
  );
  const hasCdn = cdnConfigured();

  async function resolveKey(key: string | null | undefined): Promise<string | null> {
    if (!key?.trim()) return null;
    const raw = key.trim();
    if (isHttpUrl(raw)) return raw;
    const objectKey = normalizeObjectKey(raw);
    const visibility = visByKey.get(objectKey) ?? "PUBLIC";
    const needsPresigned = visibility === "PRIVATE" || !hasCdn;
    if (needsPresigned) {
      if (!isObjectStorageConfigured()) return null;
      try {
        return await createPresignedGetUrl(objectKey, { expiresInSeconds: 86_400 });
      } catch {
        return null;
      }
    }
    try {
      return publicUrlForKey(objectKey);
    } catch {
      return null;
    }
  }

  return { resolveKey };
}

async function hydrateMenuCategoryUrls(
  prisma: PrismaClient,
  categories: PublicMenuCategory[]
): Promise<PublicMenuCategory[]> {
  const itemIds = categories.flatMap((c) => c.items.map((i) => i.id));
  const mediaRows = itemIds.length
    ? await prisma.storedMedia.findMany({
        where: { menuItemId: { in: itemIds }, scope: { in: ["MENU_IMAGE", "VIDEO"] } },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          menuItemId: true,
          scope: true,
          objectKey: true,
          sortOrder: true,
          durationMs: true
        }
      })
    : [];

  const imageKeys = categories.flatMap((c) => c.items.map((i) => i.imageKey));
  const resolver = await createMediaUrlResolver(prisma, [
    ...imageKeys,
    ...mediaRows.map((r) => r.objectKey)
  ]);

  const mediaByItem = new Map<string, PublicMenuMedia[]>();
  for (const row of mediaRows) {
    if (!row.menuItemId) continue;
    const kind = row.scope === "MENU_IMAGE" ? "image" : "video";
    const entry: PublicMenuMedia = {
      id: row.id,
      kind,
      url: await resolver.resolveKey(row.objectKey),
      sortOrder: row.sortOrder,
      durationMs: row.durationMs
    };
    const list = mediaByItem.get(row.menuItemId) ?? [];
    list.push(entry);
    mediaByItem.set(row.menuItemId, list);
  }

  return Promise.all(
    categories.map(async (cat) => ({
      ...cat,
      items: await Promise.all(
        cat.items.map(async (item) => {
          const media = mediaByItem.get(item.id) ?? [];
          const coverUrl =
            (await resolver.resolveKey(item.imageKey)) ??
            media.find((m) => m.kind === "image" && m.url)?.url ??
            (item.coverUrl && isHttpUrl(item.coverUrl) ? item.coverUrl : null);
          return { ...item, media, coverUrl };
        })
      )
    }))
  );
}

function serializeLiveTree(
  categories: Awaited<ReturnType<typeof fetchMenuTree>>
): PublicMenuCategory[] {
  return categories.map((cat) => ({
    id: cat.id,
    name: cat.name,
    sortOrder: cat.sortOrder,
    isActive: cat.isActive,
    items: cat.items.map((item) => ({
      id: item.id,
      name: item.name,
      description: item.description,
      priceCents: item.priceCents,
      sortOrder: item.sortOrder,
      isActive: item.isActive,
      imageKey: item.imageKey,
      coverUrl: null,
      media: [],
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
    }))
  }));
}

function parseSnapshotCategories(snapshot: unknown): PublicMenuCategory[] | null {
  if (!snapshot || typeof snapshot !== "object") return null;
  const root = snapshot as { categories?: unknown };
  if (!Array.isArray(root.categories)) return null;
  return root.categories as PublicMenuCategory[];
}

function hasBrowsableLiveItems(
  categories: Array<{ isActive: boolean; items: Array<{ isActive: boolean }> }>
): boolean {
  return categories.some((c) => c.isActive && c.items.some((i) => i.isActive));
}

function filterActiveLiveCategories<T extends { isActive: boolean; items: Array<{ isActive: boolean }> }>(
  categories: T[]
): T[] {
  return categories
    .filter((c) => c.isActive)
    .map((c) => ({ ...c, items: c.items.filter((i) => i.isActive) }))
    .filter((c) => c.items.length > 0);
}

async function serializeActiveLiveTree(
  categories: Awaited<ReturnType<typeof fetchMenuTree>>
): Promise<PublicMenuCategory[]> {
  const activeLive = filterActiveLiveCategories(categories);
  if (!activeLive.length) return [];
  return serializeLiveTree(activeLive);
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
    if (linked.length > 0 && hasBrowsableLiveItems(linked)) return linked;
  }
  return fetchMenuTree(prisma, restaurantId, { onlyActive: false });
}

async function buildBrowsableLiveCategories(
  prisma: PrismaClient,
  restaurantId: string,
  menuId: string | null
): Promise<PublicMenuCategory[]> {
  const surfaced = await serializeActiveLiveTree(await fetchTreeForMenuSurface(prisma, restaurantId, menuId));
  if (surfaced.length) return surfaced;
  const fallback = await fetchMenuTree(prisma, restaurantId, { onlyActive: true });
  return serializeActiveLiveTree(fallback);
}

export async function buildPublishedPublicMenu(
  prisma: PrismaClient,
  restaurantId: string,
  opts?: { menuId?: string | null; channel?: "DINE_IN" | "TAKEAWAY" | "DELIVERY" | "QR" | "KIOSK" | "STAFF" }
): Promise<PublicMenuPayload | null> {
  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: { id: true, name: true, openingHours: true }
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
            coverUrl: null,
            media: i.media ?? []
          }))
      }))
      .filter((c) => c.items.length > 0);
    if (!categories.length) {
      categories = await buildBrowsableLiveCategories(prisma, restaurantId, menu?.id ?? null);
    }
  } else {
    categories = await buildBrowsableLiveCategories(prisma, restaurantId, menu?.id ?? null);
  }

  if (!categories.length) return null;

  categories = await hydrateMenuCategoryUrls(prisma, categories);

  const windows = sanitizeAvailabilityWindows(menu?.availabilityWindows ?? null);
  const channel = opts?.channel ?? "QR";
  const timezone = "Europe/Stockholm";

  // Attach SSOT orderability (browse still shows items; clients gate add-to-cart on orderable).
  const liveItems = menu
    ? await prisma.menuItem.findMany({
        where: { category: { restaurantId, ...(menu.id ? { menuId: menu.id } : {}) } },
        select: { id: true, isActive: true, isSoldOut: true, lifecycle: true, category: { select: { isActive: true } } }
      })
    : [];
  const liveById = new Map(liveItems.map((i) => [i.id, i]));

  categories = categories.map((cat) => ({
    ...cat,
    items: cat.items
      .map((item) => {
        const live = liveById.get(item.id);
        const evaluation = evaluateAvailability({
          openingHours: restaurant.openingHours,
          timezone,
          menuStatus: menu?.status === "PUBLISHED" ? "PUBLISHED" : menu?.status === "ARCHIVED" ? "ARCHIVED" : "DRAFT",
          scheduledPublishAt: menu?.scheduledPublishAt ?? null,
          scheduledUnpublishAt: menu?.scheduledUnpublishAt ?? null,
          windows,
          categoryActive: live?.category.isActive ?? cat.isActive,
          itemActive: live?.isActive ?? item.isActive,
          itemLifecycle: live?.lifecycle ?? "ACTIVE",
          itemSoldOut: live?.isSoldOut ?? false,
          channel,
          locationId: restaurant.id,
          audience: "CUSTOMER"
        });
        return {
          ...item,
          isSoldOut: live?.isSoldOut ?? false,
          orderable: evaluation.orderable,
          availabilityStatus: evaluation.status,
          availabilityReasons: evaluation.reasons,
          _hide: !evaluation.orderable && (evaluation.status === "HIDDEN" || evaluation.status === "TESTING")
        };
      })
      .filter((item) => !item._hide)
      .map(({ _hide: _, ...item }) => item)
  })).filter((c) => c.items.length > 0);

  if (!categories.length) return null;

  return {
    restaurant: { id: restaurant.id, name: restaurant.name },
    menuId: menu?.id ?? null,
    menuVersionNumber: menu?.activeVersion?.versionNumber ?? null,
    publishedAt: menu?.activeVersion?.publishedAt?.toISOString() ?? null,
    categories
  };
}

export async function buildMenuSnapshotForPublish(prisma: PrismaClient, restaurantId: string, menuId: string) {
  const tree = await fetchTreeForMenuSurface(prisma, restaurantId, menuId);
  const activeLive = filterActiveLiveCategories(tree);
  const categories = serializeLiveTree(activeLive);
  return { categories } satisfies Prisma.InputJsonValue;
}
