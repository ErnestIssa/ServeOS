import type { Prisma, PrismaClient } from "@prisma/client";
import { menuListInclude, serializeMenu } from "./menuService.js";

export type AvailabilityWindow = {
  enabled: boolean;
  start: string;
  end: string;
  days: number[];
};

export type MenuAvailabilityWindows = Record<string, AvailabilityWindow>;

async function loadMenuForOps(prisma: PrismaClient, restaurantId: string, menuId: string) {
  return prisma.menu.findFirst({
    where: { id: menuId, restaurantId, status: { not: "ARCHIVED" } },
    include: menuListInclude
  });
}

export async function archiveMenuSurface(prisma: PrismaClient, restaurantId: string, menuId: string) {
  const menu = await loadMenuForOps(prisma, restaurantId, menuId);
  if (!menu) return { ok: false as const, error: "menu_not_found" };
  if (menu.status === "ARCHIVED") return { ok: false as const, error: "menu_already_archived" };

  const publishedCount = await prisma.menu.count({
    where: { restaurantId, status: "PUBLISHED", id: { not: menuId } }
  });
  if (menu.status === "PUBLISHED" && publishedCount === 0) {
    return { ok: false as const, error: "cannot_archive_last_published" };
  }

  await prisma.menu.update({
    where: { id: menuId },
    data: { status: "ARCHIVED", activeVersionId: menu.status === "PUBLISHED" ? null : menu.activeVersionId }
  });

  return { ok: true as const };
}

export async function duplicateMenuSurface(
  prisma: PrismaClient,
  restaurantId: string,
  menuId: string,
  createdByUserId: string
) {
  const source = await prisma.menu.findFirst({
    where: { id: menuId, restaurantId },
    include: {
      categories: {
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
      }
    }
  });
  if (!source) return { ok: false as const, error: "menu_not_found" };

  const copyName = `${source.name} (copy)`;
  const sortOrder = await prisma.menu.count({ where: { restaurantId, status: { not: "ARCHIVED" } } });

  const newMenu = await prisma.$transaction(async (tx) => {
    const created = await tx.menu.create({
      data: {
        restaurantId,
        name: copyName,
        description: source.description,
        surfaceKey: source.surfaceKey,
        status: "DRAFT",
        createdByUserId,
        sortOrder,
        availabilityWindows: source.availabilityWindows ?? undefined
      }
    });

    for (const cat of source.categories) {
      const newCat = await tx.menuCategory.create({
        data: {
          restaurantId,
          menuId: created.id,
          name: cat.name,
          sortOrder: cat.sortOrder,
          isActive: cat.isActive
        }
      });

      for (const item of cat.items) {
        const newItem = await tx.menuItem.create({
          data: {
            categoryId: newCat.id,
            name: item.name,
            description: item.description,
            priceCents: item.priceCents,
            imageKey: item.imageKey,
            sortOrder: item.sortOrder,
            isActive: item.isActive
          }
        });

        for (const group of item.modifierGroups) {
          const newGroup = await tx.modifierGroup.create({
            data: {
              menuItemId: newItem.id,
              name: group.name,
              minSelect: group.minSelect,
              maxSelect: group.maxSelect,
              sortOrder: group.sortOrder
            }
          });

          for (const opt of group.options) {
            await tx.modifierOption.create({
              data: {
                groupId: newGroup.id,
                name: opt.name,
                priceDeltaCents: opt.priceDeltaCents,
                sortOrder: opt.sortOrder,
                isActive: opt.isActive
              }
            });
          }
        }
      }
    }

    return created;
  });

  const row = await prisma.menu.findUniqueOrThrow({
    where: { id: newMenu.id },
    include: menuListInclude
  });

  return { ok: true as const, menu: serializeMenu(row) };
}

export async function scheduleMenuSurface(
  prisma: PrismaClient,
  restaurantId: string,
  menuId: string,
  input: { scheduledPublishAt: string | null; availabilityWindows?: MenuAvailabilityWindows }
) {
  const menu = await loadMenuForOps(prisma, restaurantId, menuId);
  if (!menu) return { ok: false as const, error: "menu_not_found" };

  const scheduledPublishAt = input.scheduledPublishAt ? new Date(input.scheduledPublishAt) : null;
  if (scheduledPublishAt && Number.isNaN(scheduledPublishAt.getTime())) {
    return { ok: false as const, error: "invalid_schedule_date" };
  }

  const data: Prisma.MenuUpdateInput = {
    scheduledPublishAt,
    ...(input.availabilityWindows
      ? { availabilityWindows: input.availabilityWindows as unknown as Prisma.InputJsonValue }
      : {})
  };

  const updated = await prisma.menu.update({
    where: { id: menuId },
    data,
    include: menuListInclude
  });

  return {
    ok: true as const,
    menu: {
      ...serializeMenu(updated),
      scheduledPublishAt: updated.scheduledPublishAt?.toISOString() ?? null,
      availabilityWindows: (updated.availabilityWindows as MenuAvailabilityWindows | null) ?? null
    }
  };
}

export function mapMenuOpsError(code: string): string {
  switch (code) {
    case "menu_not_found":
      return "Menu not found.";
    case "menu_already_archived":
      return "This menu is already archived.";
    case "cannot_archive_last_published":
      return "Cannot archive the only published menu — publish another menu first.";
    case "invalid_schedule_date":
      return "Invalid schedule date.";
    default:
      return "Menu operation failed.";
  }
}
