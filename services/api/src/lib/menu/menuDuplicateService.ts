import type { Prisma, PrismaClient } from "@prisma/client";
import { menuListInclude, serializeMenu } from "./menuService.js";

export type MenuDuplicateOptions = {
  name?: string;
  copyCategories?: boolean;
  copyAvailability?: boolean;
  copyMedia?: boolean;
};

export type CategoryDuplicateOptions = {
  name?: string;
  targetMenuId?: string | null;
  copyItems?: boolean;
  copyMedia?: boolean;
};

export type ItemDuplicateOptions = {
  name?: string;
  targetCategoryId?: string;
  copyModifiers?: boolean;
  copyMedia?: boolean;
};

export type ModifierDuplicateOptions = {
  name?: string;
};

/** Burgers → Burgers (Copy) → Burgers (Copy 2) … */
export async function nextUniqueCopyName(
  prisma: PrismaClient,
  baseName: string,
  exists: (name: string) => Promise<boolean>
): Promise<string> {
  const root = baseName.replace(/\s*\(Copy(?:\s+\d+)?\)\s*$/i, "").trim() || baseName.trim();
  let candidate = `${root} (Copy)`;
  if (!(await exists(candidate))) return candidate;
  for (let n = 2; n < 500; n += 1) {
    candidate = `${root} (Copy ${n})`;
    if (!(await exists(candidate))) return candidate;
  }
  return `${root} (Copy ${Date.now()})`;
}

async function cloneItemMediaRefs(
  tx: Prisma.TransactionClient,
  sourceItemId: string,
  targetItemId: string,
  restaurantId: string
) {
  const rows = await tx.storedMedia.findMany({
    where: { menuItemId: sourceItemId, scope: { in: ["MENU_IMAGE", "VIDEO"] } },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
  });
  for (const row of rows) {
    // Same S3 objectKey — new DB row only (no file copy).
    await tx.storedMedia.create({
      data: {
        objectKey: row.objectKey,
        scope: row.scope,
        contentType: row.contentType,
        byteSize: row.byteSize,
        sha256Hex: row.sha256Hex,
        visibility: row.visibility,
        originalName: row.originalName,
        uploadedById: row.uploadedById,
        restaurantId,
        menuItemId: targetItemId,
        sortOrder: row.sortOrder,
        durationMs: row.durationMs
      }
    });
  }
}

export async function duplicateMenuEntity(
  prisma: PrismaClient,
  params: {
    restaurantId: string;
    menuId: string;
    createdByUserId: string;
    options?: MenuDuplicateOptions;
  }
) {
  const opts = {
    copyCategories: params.options?.copyCategories !== false,
    copyAvailability: params.options?.copyAvailability !== false,
    copyMedia: params.options?.copyMedia !== false
  };

  const source = await prisma.menu.findFirst({
    where: { id: params.menuId, restaurantId: params.restaurantId },
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

  const name =
    params.options?.name?.trim() ||
    (await nextUniqueCopyName(prisma, source.name, async (n) => {
      const hit = await prisma.menu.findFirst({
        where: {
          restaurantId: params.restaurantId,
          status: { not: "ARCHIVED" },
          name: { equals: n, mode: "insensitive" }
        },
        select: { id: true }
      });
      return Boolean(hit);
    }));

  const sortOrder = await prisma.menu.count({
    where: { restaurantId: params.restaurantId, status: { not: "ARCHIVED" } }
  });

  const newMenu = await prisma.$transaction(async (tx) => {
    const created = await tx.menu.create({
      data: {
        restaurantId: params.restaurantId,
        name,
        description: source.description,
        surfaceKey: source.surfaceKey,
        status: "DRAFT",
        createdByUserId: params.createdByUserId,
        sortOrder,
        coverMediaKey: opts.copyMedia ? source.coverMediaKey : null,
        availabilityWindows: opts.copyAvailability
          ? ((source.availabilityWindows as Prisma.InputJsonValue) ?? undefined)
          : undefined
      }
    });

    if (!opts.copyCategories) return created;

    for (const cat of source.categories) {
      const newCat = await tx.menuCategory.create({
        data: {
          restaurantId: params.restaurantId,
          menuId: created.id,
          name: cat.name,
          description: cat.description,
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
            ingredients: item.ingredients,
            specialNotes: item.specialNotes,
            priceCents: item.priceCents,
            imageKey: opts.copyMedia ? item.imageKey : null,
            sortOrder: item.sortOrder,
            isActive: item.isActive,
            isSoldOut: false,
            lifecycle: item.lifecycle
          }
        });

        for (const group of item.modifierGroups) {
          const newGroup = await tx.modifierGroup.create({
            data: {
              menuItemId: newItem.id,
              name: group.name,
              minSelect: group.minSelect,
              maxSelect: group.maxSelect,
              sortOrder: group.sortOrder,
              lifecycle: group.lifecycle
            }
          });
          for (const opt of group.options) {
            await tx.modifierOption.create({
              data: {
                modifierGroupId: newGroup.id,
                name: opt.name,
                priceDeltaCents: opt.priceDeltaCents,
                sortOrder: opt.sortOrder,
                isActive: opt.isActive,
                lifecycle: opt.lifecycle
              }
            });
          }
        }

        if (opts.copyMedia) {
          await cloneItemMediaRefs(tx, item.id, newItem.id, params.restaurantId);
        }
      }
    }

    return created;
  });

  const row = await prisma.menu.findUniqueOrThrow({
    where: { id: newMenu.id },
    include: menuListInclude
  });

  return {
    ok: true as const,
    menu: serializeMenu(row),
    audit: {
      action: "menu_duplicated",
      sourceId: source.id,
      newId: newMenu.id,
      actorUserId: params.createdByUserId
    }
  };
}

export async function duplicateCategoryEntity(
  prisma: PrismaClient,
  params: {
    restaurantId: string;
    categoryId: string;
    actorUserId: string;
    options?: CategoryDuplicateOptions;
  }
) {
  const opts = {
    copyItems: params.options?.copyItems !== false,
    copyMedia: params.options?.copyMedia !== false
  };

  const source = await prisma.menuCategory.findFirst({
    where: { id: params.categoryId, restaurantId: params.restaurantId },
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
  if (!source) return { ok: false as const, error: "category_not_found" };

  const targetMenuId =
    params.options?.targetMenuId !== undefined ? params.options.targetMenuId : source.menuId;

  if (targetMenuId) {
    const targetMenu = await prisma.menu.findFirst({
      where: { id: targetMenuId, restaurantId: params.restaurantId },
      select: { id: true, status: true }
    });
    if (!targetMenu) return { ok: false as const, error: "target_menu_not_found" };
    if (targetMenu.status === "ARCHIVED") {
      return { ok: false as const, error: "cannot_duplicate_into_archived_menu" };
    }
  }

  const name =
    params.options?.name?.trim() ||
    (await nextUniqueCopyName(prisma, source.name, async (n) => {
      const hit = await prisma.menuCategory.findFirst({
        where: {
          restaurantId: params.restaurantId,
          menuId: targetMenuId ?? undefined,
          name: { equals: n, mode: "insensitive" }
        },
        select: { id: true }
      });
      return Boolean(hit);
    }));

  const sortOrder = await prisma.menuCategory.count({
    where: { restaurantId: params.restaurantId, menuId: targetMenuId }
  });

  const category = await prisma.$transaction(async (tx) => {
    const created = await tx.menuCategory.create({
      data: {
        restaurantId: params.restaurantId,
        menuId: targetMenuId,
        name,
        description: source.description,
        sortOrder,
        isActive: false
      }
    });

    if (!opts.copyItems) return created;

    for (const item of source.items) {
      const newItem = await tx.menuItem.create({
        data: {
          categoryId: created.id,
          name: item.name,
          description: item.description,
          ingredients: item.ingredients,
          specialNotes: item.specialNotes,
          priceCents: item.priceCents,
          imageKey: opts.copyMedia ? item.imageKey : null,
          sortOrder: item.sortOrder,
          isActive: item.isActive,
          isSoldOut: false,
          lifecycle: item.lifecycle === "ARCHIVED" ? "DRAFT" : item.lifecycle
        }
      });

      for (const group of item.modifierGroups) {
        const newGroup = await tx.modifierGroup.create({
          data: {
            menuItemId: newItem.id,
            name: group.name,
            minSelect: group.minSelect,
            maxSelect: group.maxSelect,
            sortOrder: group.sortOrder,
            lifecycle: group.lifecycle
          }
        });
        for (const opt of group.options) {
          await tx.modifierOption.create({
            data: {
              modifierGroupId: newGroup.id,
              name: opt.name,
              priceDeltaCents: opt.priceDeltaCents,
              sortOrder: opt.sortOrder,
              isActive: opt.isActive,
              lifecycle: opt.lifecycle
            }
          });
        }
      }

      if (opts.copyMedia) {
        try {
          await cloneItemMediaRefs(tx, item.id, newItem.id, params.restaurantId);
        } catch {
          // Missing/invalid media refs — keep placeholder imageKey only.
        }
      }
    }

    return created;
  });

  return {
    ok: true as const,
    category: { id: category.id, name: category.name },
    audit: {
      action: "category_duplicated",
      sourceId: source.id,
      newId: category.id,
      actorUserId: params.actorUserId,
      targetMenuId: targetMenuId ?? null
    }
  };
}

export async function duplicateItemEntity(
  prisma: PrismaClient,
  params: {
    restaurantId: string;
    itemId: string;
    actorUserId: string;
    options?: ItemDuplicateOptions;
  }
) {
  const opts = {
    copyModifiers: params.options?.copyModifiers !== false,
    copyMedia: params.options?.copyMedia !== false
  };

  const source = await prisma.menuItem.findFirst({
    where: { id: params.itemId },
    include: {
      category: { select: { id: true, restaurantId: true, menuId: true } },
      modifierGroups: {
        orderBy: { sortOrder: "asc" },
        include: { options: { orderBy: { sortOrder: "asc" } } }
      }
    }
  });
  if (!source || source.category.restaurantId !== params.restaurantId) {
    return { ok: false as const, error: "item_not_found" };
  }

  const targetCategoryId = params.options?.targetCategoryId?.trim() || source.categoryId;
  const targetCat = await prisma.menuCategory.findFirst({
    where: { id: targetCategoryId, restaurantId: params.restaurantId },
    include: { menu: { select: { id: true, status: true } } }
  });
  if (!targetCat) return { ok: false as const, error: "target_category_not_found" };
  if (targetCat.menu?.status === "ARCHIVED") {
    return { ok: false as const, error: "cannot_duplicate_into_archived_menu" };
  }

  const name =
    params.options?.name?.trim() ||
    (await nextUniqueCopyName(prisma, source.name, async (n) => {
      const hit = await prisma.menuItem.findFirst({
        where: {
          categoryId: targetCategoryId,
          name: { equals: n, mode: "insensitive" }
        },
        select: { id: true }
      });
      return Boolean(hit);
    }));

  const sortOrder = await prisma.menuItem.count({ where: { categoryId: targetCategoryId } });

  const created = await prisma.$transaction(async (tx) => {
    const item = await tx.menuItem.create({
      data: {
        categoryId: targetCategoryId,
        name,
        description: source.description,
        ingredients: source.ingredients,
        specialNotes: source.specialNotes,
        priceCents: source.priceCents,
        imageKey: opts.copyMedia ? source.imageKey : null,
        sortOrder,
        isActive: false,
        isSoldOut: false,
        lifecycle: "DRAFT"
      }
    });

    if (opts.copyModifiers) {
      for (const group of source.modifierGroups) {
        const newGroup = await tx.modifierGroup.create({
          data: {
            menuItemId: item.id,
            name: group.name,
            minSelect: group.minSelect,
            maxSelect: group.maxSelect,
            sortOrder: group.sortOrder,
            lifecycle: group.lifecycle
          }
        });
        for (const opt of group.options) {
          await tx.modifierOption.create({
            data: {
              modifierGroupId: newGroup.id,
              name: opt.name,
              priceDeltaCents: opt.priceDeltaCents,
              sortOrder: opt.sortOrder,
              isActive: opt.isActive,
              lifecycle: opt.lifecycle
            }
          });
        }
      }
    }

    if (opts.copyMedia) {
      try {
        await cloneItemMediaRefs(tx, source.id, item.id, params.restaurantId);
      } catch {
        /* keep imageKey placeholder */
      }
    }

    return item;
  });

  return {
    ok: true as const,
    item: { id: created.id, name: created.name, categoryId: created.categoryId },
    audit: {
      action: "item_duplicated",
      sourceId: source.id,
      newId: created.id,
      actorUserId: params.actorUserId,
      targetCategoryId
    }
  };
}

export function mapDuplicateError(code: string): string {
  switch (code) {
    case "menu_not_found":
      return "Menu not found.";
    case "category_not_found":
      return "Category not found.";
    case "item_not_found":
      return "Item not found.";
    case "target_menu_not_found":
      return "Destination menu not found.";
    case "target_category_not_found":
      return "Destination category not found.";
    case "cannot_duplicate_into_archived_menu":
      return "Cannot duplicate into an archived menu.";
    default:
      return "Could not create a copy.";
  }
}
