import type { Prisma, PrismaClient } from "@prisma/client";
import { menuListInclude, serializeMenu } from "./menuService.js";
import {
  sanitizeAvailabilityWindows,
  type MenuAvailabilityWindows
} from "./menuAvailability.js";
import { duplicateMenuEntity, type MenuDuplicateOptions } from "./menuDuplicateService.js";

export type { AvailabilityWindow, MenuAvailabilityWindows } from "./menuAvailability.js";

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
  createdByUserId: string,
  options?: MenuDuplicateOptions
) {
  return duplicateMenuEntity(prisma, {
    restaurantId,
    menuId,
    createdByUserId,
    options
  });
}

export async function scheduleMenuSurface(
  prisma: PrismaClient,
  restaurantId: string,
  menuId: string,
  input: {
    scheduledPublishAt?: string | null;
    scheduledUnpublishAt?: string | null;
    availabilityWindows?: MenuAvailabilityWindows;
  }
) {
  const menu = await loadMenuForOps(prisma, restaurantId, menuId);
  if (!menu) return { ok: false as const, error: "menu_not_found" };

  const data: Prisma.MenuUpdateInput = {};

  if (input.scheduledPublishAt !== undefined) {
    const scheduledPublishAt = input.scheduledPublishAt ? new Date(input.scheduledPublishAt) : null;
    if (scheduledPublishAt && Number.isNaN(scheduledPublishAt.getTime())) {
      return { ok: false as const, error: "invalid_schedule_date" };
    }
    data.scheduledPublishAt = scheduledPublishAt;
  }

  if (input.scheduledUnpublishAt !== undefined) {
    const scheduledUnpublishAt = input.scheduledUnpublishAt ? new Date(input.scheduledUnpublishAt) : null;
    if (scheduledUnpublishAt && Number.isNaN(scheduledUnpublishAt.getTime())) {
      return { ok: false as const, error: "invalid_schedule_date" };
    }
    data.scheduledUnpublishAt = scheduledUnpublishAt;
  }

  if (input.availabilityWindows !== undefined) {
    const windows = sanitizeAvailabilityWindows(input.availabilityWindows) ?? {};
    data.availabilityWindows = windows as unknown as Prisma.InputJsonValue;
  }

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
      scheduledRetireAt: updated.scheduledUnpublishAt?.toISOString() ?? null,
      scheduledUnpublishAt: updated.scheduledUnpublishAt?.toISOString() ?? null,
      availabilityWindows: sanitizeAvailabilityWindows(updated.availabilityWindows),
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
    case "menu_not_draft":
      return "Only draft menus can be deleted this way.";
    case "cannot_unpublish_last_published":
      return "Cannot retire the only live menu — release another menu first.";
    case "menu_not_published":
      return "This menu is not live.";
    case "cannot_retire_last_live":
      return "Cannot retire the only live menu — release another menu first.";
    case "menu_not_live":
      return "Only live menus can be retired.";
    case "target_restaurant_not_found":
      return "Target location not found.";
    case "cannot_move_to_same_restaurant":
      return "Choose a different location.";
    case "confirmation_required":
      return "Type the menu name exactly to confirm this action.";
    case "confirmation_mismatch":
      return "The name you typed does not match this menu. Confirmation failed.";
    case "cannot_duplicate_into_archived_menu":
      return "Cannot duplicate into an archived menu.";
    case "target_menu_not_found":
      return "Destination menu not found.";
    case "target_category_not_found":
      return "Destination category not found.";
    default:
      return "Menu operation failed.";
  }
}

/** SSOT gate for destructive menu ops — confirmName must match the menu’s exact name. */
export async function assertDangerMenuNameConfirmation(
  prisma: PrismaClient,
  restaurantId: string,
  menuId: string,
  confirmName: string | undefined | null
): Promise<{ ok: true; name: string } | { ok: false; error: "confirmation_required" | "confirmation_mismatch" | "menu_not_found" }> {
  const typed = typeof confirmName === "string" ? confirmName : "";
  if (!typed.trim()) {
    return { ok: false, error: "confirmation_required" };
  }

  const menu = await prisma.menu.findFirst({
    where: { id: menuId, restaurantId },
    select: { id: true, name: true }
  });
  if (!menu) return { ok: false, error: "menu_not_found" };

  if (typed !== menu.name) {
    return { ok: false, error: "confirmation_mismatch" };
  }

  return { ok: true, name: menu.name };
}

export async function deleteDraftMenuSurface(prisma: PrismaClient, restaurantId: string, menuId: string) {
  const menu = await prisma.menu.findFirst({
    where: { id: menuId, restaurantId, status: "DRAFT" }
  });
  if (!menu) return { ok: false as const, error: "menu_not_draft" };

  await prisma.menu.delete({ where: { id: menuId } });
  return { ok: true as const };
}

export async function deleteMenuSurface(prisma: PrismaClient, restaurantId: string, menuId: string) {
  const menu = await prisma.menu.findFirst({
    where: { id: menuId, restaurantId, status: { not: "ARCHIVED" } }
  });
  if (!menu) return { ok: false as const, error: "menu_not_found" };

  if (menu.status === "DRAFT") {
    await prisma.menu.delete({ where: { id: menuId } });
    return { ok: true as const, mode: "deleted" as const };
  }

  if (menu.status === "PUBLISHED") {
    const publishedCount = await prisma.menu.count({
      where: { restaurantId, status: "PUBLISHED", id: { not: menuId } }
    });
    if (publishedCount === 0) {
      return { ok: false as const, error: "cannot_archive_last_published" };
    }
    await prisma.menu.update({
      where: { id: menuId },
      data: { status: "ARCHIVED", activeVersionId: null }
    });
    return { ok: true as const, mode: "archived" as const };
  }

  return { ok: false as const, error: "menu_not_found" };
}

export async function unpublishMenuSurface(prisma: PrismaClient, restaurantId: string, menuId: string) {
  const menu = await loadMenuForOps(prisma, restaurantId, menuId);
  if (!menu) return { ok: false as const, error: "menu_not_found" };
  if (menu.status !== "PUBLISHED") return { ok: false as const, error: "menu_not_published" };

  const publishedCount = await prisma.menu.count({
    where: { restaurantId, status: "PUBLISHED", id: { not: menuId } }
  });
  if (publishedCount === 0) {
    return { ok: false as const, error: "cannot_unpublish_last_published" };
  }

  await prisma.menu.update({
    where: { id: menuId },
    data: { status: "DRAFT", activeVersionId: null }
  });

  return { ok: true as const };
}

export async function moveMenuSurface(
  prisma: PrismaClient,
  restaurantId: string,
  menuId: string,
  targetRestaurantId: string
) {
  if (targetRestaurantId === restaurantId) {
    return { ok: false as const, error: "cannot_move_to_same_restaurant" };
  }

  const menu = await loadMenuForOps(prisma, restaurantId, menuId);
  if (!menu) return { ok: false as const, error: "menu_not_found" };

  const target = await prisma.restaurant.findUnique({ where: { id: targetRestaurantId }, select: { id: true } });
  if (!target) return { ok: false as const, error: "target_restaurant_not_found" };

  const sortOrder = await prisma.menu.count({
    where: { restaurantId: targetRestaurantId, status: { not: "ARCHIVED" } }
  });

  await prisma.$transaction([
    prisma.menu.update({
      where: { id: menuId },
      data: { restaurantId: targetRestaurantId, sortOrder }
    }),
    prisma.menuCategory.updateMany({
      where: { menuId },
      data: { restaurantId: targetRestaurantId }
    })
  ]);

  const row = await prisma.menu.findUniqueOrThrow({
    where: { id: menuId },
    include: menuListInclude
  });

  return { ok: true as const, menu: serializeMenu(row) };
}
