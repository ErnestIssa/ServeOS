import type { Prisma, PrismaClient } from "@prisma/client";
import { nextUniqueCopyName } from "../../menu/menuDuplicateService.js";
import { cloneItemMediaViaAssets, ensureAssetFromUpload, attachUsage } from "../mediaAssetService.js";
import {
  recordMapEntry,
  updateJobProgress
} from "../replicationJobService.js";
import type {
  ApplyTemplateJobPayload,
  DuplicateMenuJobPayload,
  DuplicateToLocationJobPayload,
  MenuTemplateSnapshot,
  ReplicationProgressCounts
} from "../replicationTypes.js";

type ProgressCb = (pct: number, phase: string, counts: ReplicationProgressCounts) => Promise<void>;

async function loadSourceMenuTree(prisma: PrismaClient, restaurantId: string, menuId: string) {
  return prisma.menu.findFirst({
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
}

export async function runDuplicateMenuJob(
  prisma: PrismaClient,
  params: {
    jobId: string;
    sourceRestaurantId: string;
    targetRestaurantId: string;
    actorUserId: string;
    payload: DuplicateMenuJobPayload | DuplicateToLocationJobPayload;
  }
) {
  const opts = {
    copyCategories: params.payload.copyCategories !== false,
    copyAvailability: params.payload.copyAvailability !== false,
    copyMedia: params.payload.copyMedia !== false
  };

  const source = await loadSourceMenuTree(prisma, params.sourceRestaurantId, params.payload.menuId);
  if (!source) throw new Error("menu_not_found");

  const totalCats = opts.copyCategories ? source.categories.length : 0;
  const totalItems = opts.copyCategories
    ? source.categories.reduce((n, c) => n + c.items.length, 0)
    : 0;
  let doneCats = 0;
  let doneItems = 0;
  let doneMedia = 0;

  const report: ProgressCb = async (pct, phase, counts) => {
    await updateJobProgress(prisma, params.jobId, { progressPct: pct, phase, counts });
  };

  await report(2, "preparing", {
    categories: { done: 0, total: totalCats },
    items: { done: 0, total: totalItems },
    media: { done: 0, total: 0 }
  });

  const name =
    params.payload.name?.trim() ||
    (await nextUniqueCopyName(prisma, source.name, async (n) => {
      const hit = await prisma.menu.findFirst({
        where: {
          restaurantId: params.targetRestaurantId,
          status: { not: "ARCHIVED" },
          name: { equals: n, mode: "insensitive" }
        },
        select: { id: true }
      });
      return Boolean(hit);
    }));

  const sortOrder = await prisma.menu.count({
    where: { restaurantId: params.targetRestaurantId, status: { not: "ARCHIVED" } }
  });

  const created = await prisma.menu.create({
    data: {
      restaurantId: params.targetRestaurantId,
      name,
      description: source.description,
      surfaceKey: source.surfaceKey,
      status: "DRAFT",
      createdByUserId: params.actorUserId,
      sortOrder,
      coverMediaKey: opts.copyMedia ? source.coverMediaKey : null,
      availabilityWindows: opts.copyAvailability
        ? ((source.availabilityWindows as Prisma.InputJsonValue) ?? undefined)
        : undefined
    }
  });
  await recordMapEntry(prisma, params.jobId, "menu", source.id, created.id);

  if (opts.copyMedia && source.coverMediaKey) {
    const coverRow = await prisma.storedMedia.findFirst({
      where: { objectKey: source.coverMediaKey },
      orderBy: { createdAt: "asc" }
    });
    if (coverRow) {
      const { asset } = await ensureAssetFromUpload(prisma, {
        objectKey: coverRow.objectKey,
        contentType: coverRow.contentType,
        byteSize: coverRow.byteSize,
        sha256Hex: coverRow.sha256Hex,
        originalName: coverRow.originalName,
        visibility: coverRow.visibility,
        createdByUserId: params.actorUserId,
        restaurantId: params.targetRestaurantId
      });
      const usage = await attachUsage(prisma, {
        assetId: asset.id,
        restaurantId: params.targetRestaurantId,
        targetType: "MENU_COVER",
        targetId: created.id,
        role: "COVER",
        sortOrder: 0
      });
      await recordMapEntry(prisma, params.jobId, "media_usage", coverRow.id, usage.id);
      doneMedia += 1;
    }
  }

  await report(8, "menu_created", {
    categories: { done: 0, total: totalCats },
    items: { done: 0, total: totalItems },
    media: { done: doneMedia, total: doneMedia }
  });

  if (!opts.copyCategories) {
    await report(100, "completed", {
      categories: { done: 0, total: 0 },
      items: { done: 0, total: 0 },
      media: { done: doneMedia, total: doneMedia }
    });
    return { newMenuId: created.id, name: created.name };
  }

  for (const cat of source.categories) {
    const newCat = await prisma.menuCategory.create({
      data: {
        restaurantId: params.targetRestaurantId,
        menuId: created.id,
        name: cat.name,
        description: cat.description,
        sortOrder: cat.sortOrder,
        isActive: false
      }
    });
    await recordMapEntry(prisma, params.jobId, "category", cat.id, newCat.id);
    doneCats += 1;

    for (const item of cat.items) {
      const newItem = await prisma.menuItem.create({
        data: {
          categoryId: newCat.id,
          name: item.name,
          description: item.description,
          ingredients: item.ingredients,
          specialNotes: item.specialNotes,
          priceCents: item.priceCents,
          imageKey: opts.copyMedia ? item.imageKey : null,
          sortOrder: item.sortOrder,
          isActive: false,
          isSoldOut: false,
          lifecycle: "DRAFT"
        }
      });
      await recordMapEntry(prisma, params.jobId, "item", item.id, newItem.id);

      for (const group of item.modifierGroups) {
        const newGroup = await prisma.modifierGroup.create({
          data: {
            menuItemId: newItem.id,
            name: group.name,
            minSelect: group.minSelect,
            maxSelect: group.maxSelect,
            sortOrder: group.sortOrder,
            lifecycle: group.lifecycle === "ARCHIVED" ? "ACTIVE" : group.lifecycle
          }
        });
        await recordMapEntry(prisma, params.jobId, "modifier_group", group.id, newGroup.id);
        for (const opt of group.options) {
          const newOpt = await prisma.modifierOption.create({
            data: {
              modifierGroupId: newGroup.id,
              name: opt.name,
              priceDeltaCents: opt.priceDeltaCents,
              sortOrder: opt.sortOrder,
              isActive: opt.isActive,
              lifecycle: opt.lifecycle
            }
          });
          await recordMapEntry(prisma, params.jobId, "modifier_option", opt.id, newOpt.id);
        }
      }

      if (opts.copyMedia) {
        try {
          const n = await cloneItemMediaViaAssets(
            prisma,
            item.id,
            newItem.id,
            params.targetRestaurantId,
            params.actorUserId
          );
          doneMedia += n;
        } catch {
          /* keep imageKey placeholder */
        }
      }

      doneItems += 1;
      const pct = 8 + Math.floor((82 * (doneCats + doneItems)) / Math.max(1, totalCats + totalItems));
      await report(pct, "copying_items", {
        categories: { done: doneCats, total: totalCats },
        items: { done: doneItems, total: totalItems },
        media: { done: doneMedia, total: doneMedia }
      });
    }
  }

  await report(100, "completed", {
    categories: { done: doneCats, total: totalCats },
    items: { done: doneItems, total: totalItems },
    media: { done: doneMedia, total: doneMedia }
  });

  return { newMenuId: created.id, name: created.name };
}

export async function buildMenuTemplateSnapshot(
  prisma: PrismaClient,
  restaurantId: string,
  menuId: string
): Promise<MenuTemplateSnapshot | null> {
  const source = await loadSourceMenuTree(prisma, restaurantId, menuId);
  if (!source) return null;

  const categories: MenuTemplateSnapshot["categories"] = [];
  for (const cat of source.categories) {
    const items: MenuTemplateSnapshot["categories"][number]["items"] = [];
    for (const item of cat.items) {
      const mediaRows = await prisma.storedMedia.findMany({
        where: { menuItemId: item.id, scope: { in: ["MENU_IMAGE", "VIDEO"] } },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
      });
      items.push({
        name: item.name,
        description: item.description,
        ingredients: item.ingredients,
        specialNotes: item.specialNotes,
        priceCents: item.priceCents,
        imageKey: item.imageKey,
        sortOrder: item.sortOrder,
        media: mediaRows.map((m) => ({
          objectKey: m.objectKey,
          contentType: m.contentType,
          byteSize: m.byteSize,
          sha256Hex: m.sha256Hex,
          originalName: m.originalName,
          scope: m.scope as "MENU_IMAGE" | "VIDEO",
          sortOrder: m.sortOrder,
          durationMs: m.durationMs
        })),
        modifierGroups: item.modifierGroups.map((g) => ({
          name: g.name,
          minSelect: g.minSelect,
          maxSelect: g.maxSelect,
          sortOrder: g.sortOrder,
          options: g.options.map((o) => ({
            name: o.name,
            priceDeltaCents: o.priceDeltaCents,
            sortOrder: o.sortOrder,
            isActive: o.isActive
          }))
        }))
      });
    }
    categories.push({
      name: cat.name,
      description: cat.description,
      sortOrder: cat.sortOrder,
      items
    });
  }

  return {
    version: 1,
    menu: {
      name: source.name,
      description: source.description,
      surfaceKey: source.surfaceKey,
      coverMediaKey: source.coverMediaKey,
      availabilityWindows: source.availabilityWindows
    },
    categories
  };
}

export async function runApplyTemplateJob(
  prisma: PrismaClient,
  params: {
    jobId: string;
    targetRestaurantId: string;
    actorUserId: string;
    payload: ApplyTemplateJobPayload;
  }
) {
  const template = await prisma.contentTemplate.findUnique({ where: { id: params.payload.templateId } });
  if (!template || template.kind !== "MENU") throw new Error("template_not_found");

  const snapshot = template.snapshot as unknown as MenuTemplateSnapshot;
  if (!snapshot?.version || !snapshot.menu) throw new Error("invalid_template_snapshot");

  const totalCats = snapshot.categories?.length ?? 0;
  const totalItems = (snapshot.categories ?? []).reduce((n, c) => n + c.items.length, 0);
  let doneCats = 0;
  let doneItems = 0;
  let doneMedia = 0;

  await updateJobProgress(prisma, params.jobId, {
    progressPct: 5,
    phase: "applying_template",
    counts: {
      categories: { done: 0, total: totalCats },
      items: { done: 0, total: totalItems },
      media: { done: 0, total: 0 }
    }
  });

  const baseName = params.payload.name?.trim() || snapshot.menu.name || template.name;
  const name = await nextUniqueCopyName(prisma, baseName, async (n) => {
    const hit = await prisma.menu.findFirst({
      where: {
        restaurantId: params.targetRestaurantId,
        status: { not: "ARCHIVED" },
        name: { equals: n, mode: "insensitive" }
      },
      select: { id: true }
    });
    return Boolean(hit);
  });

  const sortOrder = await prisma.menu.count({
    where: { restaurantId: params.targetRestaurantId, status: { not: "ARCHIVED" } }
  });

  const created = await prisma.menu.create({
    data: {
      restaurantId: params.targetRestaurantId,
      name,
      description: snapshot.menu.description,
      surfaceKey: snapshot.menu.surfaceKey,
      status: "DRAFT",
      createdByUserId: params.actorUserId,
      sortOrder,
      coverMediaKey: snapshot.menu.coverMediaKey,
      availabilityWindows: (snapshot.menu.availabilityWindows as Prisma.InputJsonValue) ?? undefined
    }
  });
  await recordMapEntry(prisma, params.jobId, "menu", template.id, created.id);

  for (const cat of snapshot.categories ?? []) {
    const newCat = await prisma.menuCategory.create({
      data: {
        restaurantId: params.targetRestaurantId,
        menuId: created.id,
        name: cat.name,
        description: cat.description,
        sortOrder: cat.sortOrder,
        isActive: false
      }
    });
    doneCats += 1;

    for (const item of cat.items) {
      const newItem = await prisma.menuItem.create({
        data: {
          categoryId: newCat.id,
          name: item.name,
          description: item.description,
          ingredients: item.ingredients,
          specialNotes: item.specialNotes,
          priceCents: item.priceCents,
          imageKey: item.imageKey,
          sortOrder: item.sortOrder,
          isActive: false,
          isSoldOut: false,
          lifecycle: "DRAFT"
        }
      });

      for (const group of item.modifierGroups) {
        const newGroup = await prisma.modifierGroup.create({
          data: {
            menuItemId: newItem.id,
            name: group.name,
            minSelect: group.minSelect,
            maxSelect: group.maxSelect,
            sortOrder: group.sortOrder,
            lifecycle: "ACTIVE"
          }
        });
        for (const opt of group.options) {
          await prisma.modifierOption.create({
            data: {
              modifierGroupId: newGroup.id,
              name: opt.name,
              priceDeltaCents: opt.priceDeltaCents,
              sortOrder: opt.sortOrder,
              isActive: opt.isActive,
              lifecycle: "ACTIVE"
            }
          });
        }
      }

      for (const m of item.media ?? []) {
        const { asset } = await ensureAssetFromUpload(prisma, {
          objectKey: m.objectKey,
          contentType: m.contentType,
          byteSize: m.byteSize,
          sha256Hex: m.sha256Hex,
          originalName: m.originalName,
          createdByUserId: params.actorUserId,
          restaurantId: params.targetRestaurantId
        });
        await attachUsage(prisma, {
          assetId: asset.id,
          restaurantId: params.targetRestaurantId,
          targetType: "MENU_ITEM",
          targetId: newItem.id,
          role: "GALLERY",
          sortOrder: m.sortOrder
        });
        await prisma.storedMedia.create({
          data: {
            objectKey: m.objectKey,
            scope: m.scope,
            contentType: m.contentType,
            byteSize: m.byteSize,
            sha256Hex: m.sha256Hex,
            originalName: m.originalName,
            uploadedById: params.actorUserId,
            restaurantId: params.targetRestaurantId,
            menuItemId: newItem.id,
            sortOrder: m.sortOrder,
            durationMs: m.durationMs
          }
        });
        doneMedia += 1;
      }

      doneItems += 1;
      const pct = 5 + Math.floor((90 * (doneCats + doneItems)) / Math.max(1, totalCats + totalItems));
      await updateJobProgress(prisma, params.jobId, {
        progressPct: pct,
        phase: "applying_template",
        counts: {
          categories: { done: doneCats, total: totalCats },
          items: { done: doneItems, total: totalItems },
          media: { done: doneMedia, total: doneMedia }
        }
      });
    }
  }

  await updateJobProgress(prisma, params.jobId, {
    progressPct: 100,
    phase: "completed",
    counts: {
      categories: { done: doneCats, total: totalCats },
      items: { done: doneItems, total: totalItems },
      media: { done: doneMedia, total: doneMedia }
    }
  });

  return { newMenuId: created.id, name: created.name };
}
