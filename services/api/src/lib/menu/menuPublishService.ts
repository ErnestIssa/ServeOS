import type { PrismaClient, Prisma } from "@prisma/client";
import { buildMenuSnapshotForPublish } from "./publicMenuService.js";

export async function publishMenuSurface(
  prisma: PrismaClient,
  params: { restaurantId: string; menuId: string; publishedByUserId: string }
) {
  const menu = await prisma.menu.findFirst({
    where: { id: params.menuId, restaurantId: params.restaurantId, status: { not: "ARCHIVED" } },
    include: { activeVersion: { select: { versionNumber: true } } }
  });
  if (!menu) return { ok: false as const, error: "menu_not_found" };

  const snapshot = await buildMenuSnapshotForPublish(prisma, params.restaurantId, menu.id);
  const nextVersion = (menu.activeVersion?.versionNumber ?? 0) + 1;
  const publishedAt = new Date();

  const version = await prisma.menuVersion.create({
    data: {
      menuId: menu.id,
      versionNumber: nextVersion,
      snapshot: snapshot as unknown as Prisma.InputJsonValue,
      publishedAt,
      createdByUserId: params.publishedByUserId
    }
  });

  await prisma.menu.update({
    where: { id: menu.id },
    data: { status: "PUBLISHED", activeVersionId: version.id }
  });

  return {
    ok: true as const,
    menu: {
      id: menu.id,
      status: "PUBLISHED" as const,
      versionNumber: nextVersion,
      publishedAt: publishedAt.toISOString()
    }
  };
}

export function mapPublishMenuError(code: string): string {
  switch (code) {
    case "menu_not_found":
      return "Menu not found.";
    case "menu_permission_denied":
      return "You do not have permission to publish menus.";
    default:
      return "Could not publish menu.";
  }
}
