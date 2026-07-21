import type { Prisma, PrismaClient } from "@prisma/client";
import { buildMenuSnapshotForPublish } from "./publicMenuService.js";
import {
  compareMenuSnapshots,
  countSnapshotEntities,
  diffMenuSnapshots,
  snapshotsEqual,
  type MenuReleaseChangeSummary,
  type MenuVersionCompareResult
} from "./menuReleaseDiff.js";
import { validateMenuForRelease, type MenuReleaseValidationResult } from "./menuReleaseValidation.js";

export type MenuPublishReport = {
  versionNumber: number;
  publishedAt: string;
  publishedByUserId: string;
  categoryCount: number;
  itemCount: number;
  modifierGroupCount: number;
  modifierOptionCount: number;
  mediaCount: number;
  changeSummary: MenuReleaseChangeSummary;
};

export type MenuReleasePreview = {
  menuId: string;
  menuName: string;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  currentVersionNumber: number | null;
  nextVersionNumber: number;
  hasUnpublishedChanges: boolean;
  draftChangeCount: number;
  changeSummary: MenuReleaseChangeSummary;
  validation: MenuReleaseValidationResult;
  scheduledPublishAt: string | null;
};

export type MenuVersionListItem = {
  id: string;
  versionNumber: number;
  publishedAt: string | null;
  createdAt: string;
  createdByUserId: string;
  isActive: boolean;
  categoryCount: number;
  itemCount: number;
  changeSummary: MenuReleaseChangeSummary | null;
  publishReport: MenuPublishReport | null;
  releaseNotes: string | null;
};

function asChangeSummary(value: unknown): MenuReleaseChangeSummary | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Partial<MenuReleaseChangeSummary>;
  if (typeof v.totalChanges !== "number" || !Array.isArray(v.lines)) return null;
  return value as MenuReleaseChangeSummary;
}

function asPublishReport(value: unknown): MenuPublishReport | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Partial<MenuPublishReport>;
  if (typeof v.versionNumber !== "number" || typeof v.publishedAt !== "string") return null;
  return value as MenuPublishReport;
}

export async function getMenuDraftReleaseState(
  prisma: PrismaClient,
  restaurantId: string,
  menuId: string
): Promise<{
  hasUnpublishedChanges: boolean;
  draftChangeCount: number;
  changeSummary: MenuReleaseChangeSummary;
  currentVersionNumber: number | null;
  nextVersionNumber: number;
  draftSnapshot: { categories: unknown };
  publishedSnapshot: unknown;
} | null> {
  const menu = await prisma.menu.findFirst({
    where: { id: menuId, restaurantId, status: { not: "ARCHIVED" } },
    include: { activeVersion: { select: { versionNumber: true, snapshot: true } } }
  });
  if (!menu) return null;

  const draftSnapshot = await buildMenuSnapshotForPublish(prisma, restaurantId, menu.id);
  const publishedSnapshot = menu.activeVersion?.snapshot ?? { categories: [] };
  const neverPublished = !menu.activeVersion;

  const changeSummary = neverPublished
    ? diffMenuSnapshots({ categories: [] }, draftSnapshot)
    : diffMenuSnapshots(publishedSnapshot, draftSnapshot);

  const equal = neverPublished
    ? countSnapshotEntities(draftSnapshot).itemCount === 0 &&
      countSnapshotEntities(draftSnapshot).categoryCount === 0
    : snapshotsEqual(publishedSnapshot, draftSnapshot);

  return {
    hasUnpublishedChanges: !equal,
    draftChangeCount: changeSummary.totalChanges,
    changeSummary,
    currentVersionNumber: menu.activeVersion?.versionNumber ?? null,
    nextVersionNumber: (menu.activeVersion?.versionNumber ?? 0) + 1,
    draftSnapshot,
    publishedSnapshot
  };
}

export async function previewMenuRelease(
  prisma: PrismaClient,
  restaurantId: string,
  menuId: string
): Promise<{ ok: true; preview: MenuReleasePreview } | { ok: false; error: string }> {
  const menu = await prisma.menu.findFirst({
    where: { id: menuId, restaurantId, status: { not: "ARCHIVED" } },
    select: { id: true, name: true, status: true, scheduledPublishAt: true }
  });
  if (!menu) return { ok: false, error: "menu_not_found" };

  const state = await getMenuDraftReleaseState(prisma, restaurantId, menuId);
  if (!state) return { ok: false, error: "menu_not_found" };

  const validation = await validateMenuForRelease(prisma, restaurantId, menuId);

  return {
    ok: true,
    preview: {
      menuId: menu.id,
      menuName: menu.name,
      status: menu.status,
      currentVersionNumber: state.currentVersionNumber,
      nextVersionNumber: state.nextVersionNumber,
      hasUnpublishedChanges: state.hasUnpublishedChanges,
      draftChangeCount: state.draftChangeCount,
      changeSummary: state.changeSummary,
      validation,
      scheduledPublishAt: menu.scheduledPublishAt?.toISOString() ?? null
    }
  };
}

export async function publishMenuRelease(
  prisma: PrismaClient,
  params: {
    restaurantId: string;
    menuId: string;
    publishedByUserId: string;
    releaseNotes?: string | null;
    requireChanges?: boolean;
  }
): Promise<
  | {
      ok: true;
      menu: {
        id: string;
        status: "PUBLISHED";
        versionNumber: number;
        publishedAt: string;
      };
      report: MenuPublishReport;
      changeSummary: MenuReleaseChangeSummary;
    }
  | { ok: false; error: string; validation?: MenuReleaseValidationResult }
> {
  const menu = await prisma.menu.findFirst({
    where: { id: params.menuId, restaurantId: params.restaurantId, status: { not: "ARCHIVED" } },
    include: { activeVersion: { select: { versionNumber: true, snapshot: true } } }
  });
  if (!menu) return { ok: false, error: "menu_not_found" };

  const validation = await validateMenuForRelease(prisma, params.restaurantId, menu.id);
  if (!validation.ok) {
    return { ok: false, error: "menu_validation_failed", validation };
  }

  const state = await getMenuDraftReleaseState(prisma, params.restaurantId, menu.id);
  if (!state) return { ok: false, error: "menu_not_found" };

  if (params.requireChanges !== false && menu.status === "PUBLISHED" && !state.hasUnpublishedChanges) {
    return { ok: false, error: "no_unpublished_changes" };
  }

  const publishedAt = new Date();
  const versionNumber = state.nextVersionNumber;
  const counts = countSnapshotEntities(state.draftSnapshot);

  const report: MenuPublishReport = {
    versionNumber,
    publishedAt: publishedAt.toISOString(),
    publishedByUserId: params.publishedByUserId,
    categoryCount: counts.categoryCount,
    itemCount: counts.itemCount,
    modifierGroupCount: counts.modifierGroupCount,
    modifierOptionCount: counts.modifierOptionCount,
    mediaCount: counts.mediaCount,
    changeSummary: state.changeSummary
  };

  const version = await prisma.menuVersion.create({
    data: {
      menuId: menu.id,
      versionNumber,
      snapshot: state.draftSnapshot as unknown as Prisma.InputJsonValue,
      publishedAt,
      createdByUserId: params.publishedByUserId,
      changeSummary: state.changeSummary as unknown as Prisma.InputJsonValue,
      publishReport: report as unknown as Prisma.InputJsonValue,
      releaseNotes: params.releaseNotes?.trim() || null
    }
  });

  await prisma.menu.update({
    where: { id: menu.id },
    data: {
      status: "PUBLISHED",
      activeVersionId: version.id,
      scheduledPublishAt: null
    }
  });

  return {
    ok: true,
    menu: {
      id: menu.id,
      status: "PUBLISHED",
      versionNumber,
      publishedAt: publishedAt.toISOString()
    },
    report,
    changeSummary: state.changeSummary
  };
}

export async function listMenuVersions(
  prisma: PrismaClient,
  restaurantId: string,
  menuId: string
): Promise<{ ok: true; versions: MenuVersionListItem[] } | { ok: false; error: string }> {
  const menu = await prisma.menu.findFirst({
    where: { id: menuId, restaurantId },
    select: { id: true, activeVersionId: true }
  });
  if (!menu) return { ok: false, error: "menu_not_found" };

  const versions = await prisma.menuVersion.findMany({
    where: { menuId },
    orderBy: { versionNumber: "desc" }
  });

  return {
    ok: true,
    versions: versions.map((v) => {
      const counts = countSnapshotEntities(v.snapshot);
      return {
        id: v.id,
        versionNumber: v.versionNumber,
        publishedAt: v.publishedAt?.toISOString() ?? null,
        createdAt: v.createdAt.toISOString(),
        createdByUserId: v.createdByUserId,
        isActive: v.id === menu.activeVersionId,
        categoryCount: counts.categoryCount,
        itemCount: counts.itemCount,
        changeSummary: asChangeSummary(v.changeSummary),
        publishReport: asPublishReport(v.publishReport),
        releaseNotes: v.releaseNotes ?? null
      };
    })
  };
}

export async function compareMenuVersions(
  prisma: PrismaClient,
  restaurantId: string,
  menuId: string,
  fromVersionNumber: number,
  toVersionNumber: number
): Promise<{ ok: true; compare: MenuVersionCompareResult } | { ok: false; error: string }> {
  const menu = await prisma.menu.findFirst({
    where: { id: menuId, restaurantId },
    select: { id: true }
  });
  if (!menu) return { ok: false, error: "menu_not_found" };

  const versions = await prisma.menuVersion.findMany({
    where: {
      menuId,
      versionNumber: { in: [fromVersionNumber, toVersionNumber] }
    }
  });
  const from = versions.find((v) => v.versionNumber === fromVersionNumber);
  const to = versions.find((v) => v.versionNumber === toVersionNumber);
  if (!from || !to) return { ok: false, error: "version_not_found" };

  return {
    ok: true,
    compare: compareMenuSnapshots(fromVersionNumber, toVersionNumber, from.snapshot, to.snapshot)
  };
}

export async function rollbackMenuVersion(
  prisma: PrismaClient,
  params: { restaurantId: string; menuId: string; versionNumber: number; rolledBackByUserId: string }
): Promise<
  | {
      ok: true;
      menu: { id: string; status: "PUBLISHED"; versionNumber: number; publishedAt: string };
      report: MenuPublishReport;
    }
  | { ok: false; error: string }
> {
  const menu = await prisma.menu.findFirst({
    where: { id: params.menuId, restaurantId: params.restaurantId, status: { not: "ARCHIVED" } },
    include: { activeVersion: { select: { versionNumber: true, id: true } } }
  });
  if (!menu) return { ok: false, error: "menu_not_found" };

  const target = await prisma.menuVersion.findFirst({
    where: { menuId: menu.id, versionNumber: params.versionNumber }
  });
  if (!target) return { ok: false, error: "version_not_found" };
  if (menu.activeVersionId === target.id) {
    return { ok: false, error: "version_already_active" };
  }

  const publishedAt = new Date();
  const nextVersion = (menu.activeVersion?.versionNumber ?? 0) + 1;
  const counts = countSnapshotEntities(target.snapshot);

  const activeSnap = menu.activeVersion
    ? (
        await prisma.menuVersion.findUnique({
          where: { id: menu.activeVersion.id },
          select: { snapshot: true }
        })
      )?.snapshot
    : { categories: [] };
  const rollbackSummary = diffMenuSnapshots(activeSnap ?? { categories: [] }, target.snapshot);

  const report: MenuPublishReport = {
    versionNumber: nextVersion,
    publishedAt: publishedAt.toISOString(),
    publishedByUserId: params.rolledBackByUserId,
    categoryCount: counts.categoryCount,
    itemCount: counts.itemCount,
    modifierGroupCount: counts.modifierGroupCount,
    modifierOptionCount: counts.modifierOptionCount,
    mediaCount: counts.mediaCount,
    changeSummary: rollbackSummary
  };

  const version = await prisma.menuVersion.create({
    data: {
      menuId: menu.id,
      versionNumber: nextVersion,
      snapshot: target.snapshot as Prisma.InputJsonValue,
      publishedAt,
      createdByUserId: params.rolledBackByUserId,
      changeSummary: rollbackSummary as unknown as Prisma.InputJsonValue,
      publishReport: report as unknown as Prisma.InputJsonValue,
      releaseNotes: `Rollback to version ${params.versionNumber}`
    }
  });

  await prisma.menu.update({
    where: { id: menu.id },
    data: {
      status: "PUBLISHED",
      activeVersionId: version.id,
      scheduledPublishAt: null
    }
  });

  return {
    ok: true,
    menu: {
      id: menu.id,
      status: "PUBLISHED",
      versionNumber: nextVersion,
      publishedAt: publishedAt.toISOString()
    },
    report
  };
}

/** Process due scheduled publishes — creates immutable versions from draft workspace. */
export async function processDueMenuReleases(prisma: PrismaClient, limit = 25) {
  const now = new Date();
  const due = await prisma.menu.findMany({
    where: {
      status: { not: "ARCHIVED" },
      scheduledPublishAt: { lte: now }
    },
    take: limit,
    orderBy: { scheduledPublishAt: "asc" },
    select: { id: true, restaurantId: true, createdByUserId: true, scheduledPublishAt: true }
  });

  const results: Array<{ menuId: string; ok: boolean; error?: string; versionNumber?: number }> = [];

  for (const menu of due) {
    const published = await publishMenuRelease(prisma, {
      restaurantId: menu.restaurantId,
      menuId: menu.id,
      publishedByUserId: menu.createdByUserId,
      releaseNotes: "Scheduled release",
      requireChanges: false
    });
    if (!published.ok) {
      // Clear stale schedule that cannot publish so it does not loop forever.
      if (published.error === "menu_validation_failed" || published.error === "menu_not_found") {
        await prisma.menu.update({
          where: { id: menu.id },
          data: { scheduledPublishAt: null }
        });
      }
      results.push({ menuId: menu.id, ok: false, error: published.error });
      continue;
    }
    results.push({ menuId: menu.id, ok: true, versionNumber: published.menu.versionNumber });
  }

  return results;
}

export function mapMenuReleaseError(code: string): string {
  switch (code) {
    case "menu_not_found":
      return "Menu not found.";
    case "menu_validation_failed":
      return "This menu is not ready to publish. Fix validation issues and try again.";
    case "no_unpublished_changes":
      return "No draft changes to publish.";
    case "version_not_found":
      return "Version not found.";
    case "version_already_active":
      return "That version is already live.";
    case "menu_permission_denied":
      return "You do not have permission to publish menus.";
    default:
      return "Could not complete menu release.";
  }
}
