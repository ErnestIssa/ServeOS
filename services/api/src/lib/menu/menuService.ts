import type { MenuStatus, Prisma, PrismaClient } from "@prisma/client";
import { fetchMenuTree } from "../menu.js";
import { buildMenuSnapshotForPublish } from "./publicMenuService.js";

export type MenuListItem = {
  id: string;
  name: string;
  description: string | null;
  surfaceKey: string | null;
  status: MenuStatus;
  sortOrder: number;
  categoryCount: number;
  itemCount: number;
  activeVersionNumber: number | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export function serializeMenu(
  row: {
    id: string;
    name: string;
    description: string | null;
    surfaceKey: string | null;
    status: MenuStatus;
    sortOrder: number;
    createdAt: Date;
    updatedAt: Date;
    categories: Array<{ _count: { items: number } }>;
    activeVersion: { versionNumber: number; publishedAt: Date | null } | null;
  }
): MenuListItem {
  const categoryCount = row.categories.length;
  const itemCount = row.categories.reduce((sum, c) => sum + c._count.items, 0);
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    surfaceKey: row.surfaceKey,
    status: row.status,
    sortOrder: row.sortOrder,
    categoryCount,
    itemCount,
    activeVersionNumber: row.activeVersion?.versionNumber ?? null,
    publishedAt: row.activeVersion?.publishedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };
}

export const menuListInclude = {
  categories: {
    select: { _count: { select: { items: true } } }
  },
  activeVersion: {
    select: { versionNumber: true, publishedAt: true }
  }
} satisfies Prisma.MenuInclude;

/** Ensures legacy venues have a published Main Menu linked to existing categories. */
export async function ensureVenueMenusBootstrapped(
  prisma: PrismaClient,
  restaurantId: string,
  createdByUserId: string
) {
  const existing = await prisma.menu.count({ where: { restaurantId, status: { not: "ARCHIVED" } } });
  if (existing > 0) return;

  const menu = await prisma.menu.create({
    data: {
      restaurantId,
      name: "Main Menu",
      description: "Default guest menu for this venue",
      surfaceKey: "main",
      status: "PUBLISHED",
      createdByUserId,
      sortOrder: 0
    }
  });

  const version = await prisma.menuVersion.create({
    data: {
      menuId: menu.id,
      versionNumber: 1,
      snapshot: { categories: await buildMenuSnapshotForPublish(prisma, restaurantId, menu.id).then((s) => s.categories) } as Prisma.InputJsonValue,
      publishedAt: new Date(),
      createdByUserId
    }
  });

  await prisma.$transaction([
    prisma.menu.update({
      where: { id: menu.id },
      data: { activeVersionId: version.id }
    }),
    prisma.menuCategory.updateMany({
      where: { restaurantId, menuId: null },
      data: { menuId: menu.id }
    })
  ]);
}

export async function listMenusForRestaurant(prisma: PrismaClient, restaurantId: string, userId: string) {
  await ensureVenueMenusBootstrapped(prisma, restaurantId, userId);

  const rows = await prisma.menu.findMany({
    where: { restaurantId, status: { not: "ARCHIVED" } },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    include: menuListInclude
  });

  return rows.map(serializeMenu);
}

export async function createDraftMenu(
  prisma: PrismaClient,
  input: {
    restaurantId: string;
    createdByUserId: string;
    name: string;
    description?: string | null;
    surfaceKey?: string | null;
  }
) {
  const name = input.name.trim();
  const duplicate = await prisma.menu.findFirst({
    where: {
      restaurantId: input.restaurantId,
      status: { not: "ARCHIVED" },
      name: { equals: name, mode: "insensitive" }
    }
  });
  if (duplicate) {
    throw Object.assign(new Error("menu_name_taken"), { statusCode: 409 });
  }

  const sortOrder = await prisma.menu.count({
    where: { restaurantId: input.restaurantId, status: { not: "ARCHIVED" } }
  });

  const menu = await prisma.menu.create({
    data: {
      restaurantId: input.restaurantId,
      name,
      description: input.description?.trim() || null,
      surfaceKey: input.surfaceKey?.trim() || null,
      status: "DRAFT",
      createdByUserId: input.createdByUserId,
      sortOrder
    },
    include: menuListInclude
  });

  return serializeMenu(menu);
}

export function mapMenuApiError(code: string): string {
  switch (code) {
    case "menu_name_taken":
      return "A menu with this name already exists for this venue.";
    case "menu_permission_denied":
      return "You do not have permission to manage menus.";
    case "restaurant_not_found":
      return "Venue not found.";
    case "forbidden":
      return "You do not have access to this venue.";
    default:
      return "Menu request failed.";
  }
}
