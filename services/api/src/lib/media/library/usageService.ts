import type { MediaUsageTargetType, PrismaClient } from "@prisma/client";
import { attachUsage, detachUsage, duplicateUsage } from "./assetService.js";

export { attachUsage, detachUsage, duplicateUsage };

export async function listAssetUsages(prisma: PrismaClient, assetId: string, restaurantId: string) {
  const usages = await prisma.mediaUsage.findMany({
    where: { assetId, restaurantId },
    orderBy: { createdAt: "desc" }
  });

  const enriched = await Promise.all(
    usages.map(async (u) => {
      const label = await resolveTargetLabel(prisma, u.targetType, u.targetId, restaurantId);
      return {
        id: u.id,
        targetType: u.targetType,
        targetId: u.targetId,
        role: u.role,
        sortOrder: u.sortOrder,
        createdAt: u.createdAt.toISOString(),
        label
      };
    })
  );

  return enriched;
}

async function resolveTargetLabel(
  prisma: PrismaClient,
  targetType: MediaUsageTargetType,
  targetId: string,
  restaurantId: string
): Promise<string> {
  switch (targetType) {
    case "MENU_COVER": {
      const menu = await prisma.menu.findFirst({
        where: { id: targetId, restaurantId },
        select: { name: true }
      });
      return menu?.name ?? "Menu cover";
    }
    case "MENU_ITEM": {
      const item = await prisma.menuItem.findFirst({
        where: { id: targetId },
        select: { name: true }
      });
      return item?.name ?? "Menu item";
    }
    case "CATEGORY": {
      const cat = await prisma.menuCategory.findFirst({
        where: { id: targetId, restaurantId },
        select: { name: true }
      });
      return cat?.name ?? "Category";
    }
    case "VENUE_LOGO":
      return "Venue logo";
    case "VENUE_COVER":
      return "Venue cover";
    default:
      return targetId;
  }
}

export async function detachUsageByTarget(
  prisma: PrismaClient,
  params: {
    assetId: string;
    restaurantId: string;
    targetType: MediaUsageTargetType;
    targetId: string;
    role?: string;
  }
) {
  const usage = await prisma.mediaUsage.findFirst({
    where: {
      assetId: params.assetId,
      restaurantId: params.restaurantId,
      targetType: params.targetType,
      targetId: params.targetId,
      ...(params.role ? { role: params.role as never } : {})
    }
  });
  if (!usage) return { ok: false as const, error: "usage_not_found" };
  return detachUsage(prisma, usage.id);
}
