import type { MenuStatus, Prisma, PrismaClient } from "@prisma/client";
import { fetchMenuTree } from "../menu.js";
import { buildMenuSnapshotForPublish } from "./publicMenuService.js";
import { sanitizeAvailabilityWindows, type MenuAvailabilityWindows } from "./menuAvailability.js";
import { deriveMenuScopeHealth, type MenuScopeTone } from "./menuManageService.js";
import {
  deriveMenuReleaseState,
  type MenuReleaseState
} from "./menuReleaseLifecycle.js";
import { getMenuDraftReleaseState, processDueMenuLifecycleJobs } from "./menuReleaseService.js";

export type MenuListItem = {
  id: string;
  name: string;
  description: string | null;
  surfaceKey: string | null;
  status: MenuStatus;
  /** Derived release lifecycle badge — independent from availability. */
  releaseState: MenuReleaseState;
  releaseLabel: string;
  sortOrder: number;
  categoryCount: number;
  itemCount: number;
  coverMediaKey: string | null;
  activeVersionNumber: number | null;
  publishedAt: string | null;
  scheduledPublishAt: string | null;
  /** Scheduled retirement (DB: scheduledUnpublishAt). */
  scheduledRetireAt: string | null;
  hasUnpublishedChanges: boolean;
  draftChangeCount: number;
  availabilityWindows: MenuAvailabilityWindows | null;
  scopeTone: MenuScopeTone;
  scopeLabel: string;
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
    coverMediaKey?: string | null;
    availabilityWindows?: unknown;
    scheduledPublishAt?: Date | null;
    scheduledUnpublishAt?: Date | null;
    createdAt: Date;
    updatedAt: Date;
    categories: Array<{ _count: { items: number } }>;
    activeVersion: { versionNumber: number; publishedAt: Date | null } | null;
  },
  release?: { hasUnpublishedChanges: boolean; draftChangeCount: number }
): MenuListItem {
  const categoryCount = row.categories.length;
  const itemCount = row.categories.reduce((sum, c) => sum + c._count.items, 0);
  const hasUnpublishedChanges = release?.hasUnpublishedChanges ?? false;
  const lifecycle = deriveMenuReleaseState({
    status: row.status,
    scheduledPublishAt: row.scheduledPublishAt,
    scheduledUnpublishAt: row.scheduledUnpublishAt,
    hasUnpublishedChanges
  });
  const { scopeTone, scopeLabel } = deriveMenuScopeHealth({
    status: row.status,
    itemCount,
    hasUnpublishedChanges,
    releaseState: lifecycle.releaseState
  });
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    surfaceKey: row.surfaceKey,
    status: row.status,
    releaseState: lifecycle.releaseState,
    releaseLabel: lifecycle.releaseLabel,
    sortOrder: row.sortOrder,
    categoryCount,
    itemCount,
    coverMediaKey: row.coverMediaKey ?? null,
    activeVersionNumber: row.activeVersion?.versionNumber ?? null,
    publishedAt: row.activeVersion?.publishedAt?.toISOString() ?? null,
    scheduledPublishAt: lifecycle.scheduledPublishAt,
    scheduledRetireAt: lifecycle.scheduledRetireAt,
    hasUnpublishedChanges,
    draftChangeCount: release?.draftChangeCount ?? 0,
    availabilityWindows: sanitizeAvailabilityWindows(row.availabilityWindows),
    scopeTone,
    scopeLabel,
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

export type MenuListStatusFilter = "active" | "DRAFT" | "PUBLISHED" | "ARCHIVED";

function menuListStatusWhere(status: MenuListStatusFilter): Prisma.MenuWhereInput["status"] {
  if (status === "active") return { notIn: ["ARCHIVED"] };
  return status;
}

export async function listMenusForRestaurant(
  prisma: PrismaClient,
  restaurantId: string,
  userId: string,
  status: MenuListStatusFilter = "active"
) {
  if (status === "active" || status === "DRAFT" || status === "PUBLISHED") {
    await ensureVenueMenusBootstrapped(prisma, restaurantId, userId);
  }

  // Release/retire scheduler runs on a background interval; list still triggers a catch-up pass.
  await processDueMenuLifecycleJobs(prisma);

  const rows = await prisma.menu.findMany({
    where: { restaurantId, status: menuListStatusWhere(status) },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    include: menuListInclude
  });

  const serialized = await Promise.all(
    rows.map(async (row) => {
      const release = await getMenuDraftReleaseState(prisma, restaurantId, row.id);
      return serializeMenu(row, {
        hasUnpublishedChanges: release?.hasUnpublishedChanges ?? false,
        draftChangeCount: release?.draftChangeCount ?? 0
      });
    })
  );

  return serialized;
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

export async function updateMenuSurface(
  prisma: PrismaClient,
  input: {
    restaurantId: string;
    menuId: string;
    name: string;
    description?: string | null;
    surfaceKey?: string | null;
  }
) {
  const existing = await prisma.menu.findFirst({
    where: { id: input.menuId, restaurantId: input.restaurantId, status: { not: "ARCHIVED" } }
  });
  if (!existing) {
    throw Object.assign(new Error("menu_not_found"), { statusCode: 404 });
  }

  const name = input.name.trim();
  const duplicate = await prisma.menu.findFirst({
    where: {
      restaurantId: input.restaurantId,
      id: { not: input.menuId },
      status: { not: "ARCHIVED" },
      name: { equals: name, mode: "insensitive" }
    }
  });
  if (duplicate) {
    throw Object.assign(new Error("menu_name_taken"), { statusCode: 409 });
  }

  const menu = await prisma.menu.update({
    where: { id: input.menuId },
    data: {
      name,
      description: input.description?.trim() || null,
      surfaceKey: input.surfaceKey?.trim() || null
    },
    include: menuListInclude
  });

  return serializeMenu(menu);
}

export function mapMenuApiError(code: string): string {
  switch (code) {
    case "menu_name_taken":
      return "A menu with this name already exists for this venue.";
    case "menu_not_found":
      return "That menu could not be found.";
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
