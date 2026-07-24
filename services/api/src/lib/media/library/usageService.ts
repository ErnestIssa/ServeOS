import type { MediaUsageTargetType, PrismaClient } from "@prisma/client";
import { attachUsage, detachUsage, duplicateUsage, hardDeleteLibraryAsset } from "./assetService.js";

export { attachUsage, detachUsage, duplicateUsage, hardDeleteLibraryAsset };

export type UsageGraphNode = {
  id: string;
  targetType: MediaUsageTargetType;
  targetId: string;
  role: string;
  sortOrder: number;
  createdAt: string;
  label: string;
  group: "Menus" | "Items" | "Categories" | "Venue";
  hrefHint: string;
};

function usageGroup(targetType: MediaUsageTargetType): UsageGraphNode["group"] {
  switch (targetType) {
    case "MENU_COVER":
      return "Menus";
    case "MENU_ITEM":
    case "MODIFIER_OPTION":
      return "Items";
    case "CATEGORY":
      return "Categories";
    case "VENUE_LOGO":
    case "VENUE_COVER":
    case "RECEIPT_BRANDING":
      return "Venue";
    default:
      return "Venue";
  }
}

function usageHrefHint(targetType: MediaUsageTargetType, targetId: string): string {
  switch (targetType) {
    case "MENU_COVER":
      return `#ws-config/menu?tab=menus&menuId=${encodeURIComponent(targetId)}`;
    case "MENU_ITEM":
      return `#ws-config/menu?tab=items&itemId=${encodeURIComponent(targetId)}`;
    case "CATEGORY":
      return `#ws-config/menu?tab=categories&categoryId=${encodeURIComponent(targetId)}`;
    case "VENUE_LOGO":
    case "VENUE_COVER":
    case "RECEIPT_BRANDING":
      return "#venue-control-centre";
    case "STAFF_AVATAR":
    case "CUSTOMER_AVATAR":
      return "#top-account";
    default:
      return "#ws-config/media-library";
  }
}

export async function listAssetUsages(
  prisma: PrismaClient,
  assetId: string,
  restaurantId: string
): Promise<UsageGraphNode[]> {
  const usages = await prisma.mediaUsage.findMany({
    where: { assetId, restaurantId },
    orderBy: { createdAt: "desc" }
  });

  return Promise.all(
    usages.map(async (u) => {
      const label = await resolveTargetLabel(prisma, u.targetType, u.targetId, restaurantId);
      return {
        id: u.id,
        targetType: u.targetType,
        targetId: u.targetId,
        role: u.role,
        sortOrder: u.sortOrder,
        createdAt: u.createdAt.toISOString(),
        label,
        group: usageGroup(u.targetType),
        hrefHint: usageHrefHint(u.targetType, u.targetId)
      };
    })
  );
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
    case "STAFF_AVATAR":
      return "Staff avatar";
    case "CUSTOMER_AVATAR":
      return "Customer avatar";
    case "MODIFIER_OPTION":
      return "Modifier option";
    case "QR_HERO":
      return "QR hero";
    case "MARKETING_CAMPAIGN":
      return "Marketing campaign";
    case "LOYALTY_REWARD":
      return "Loyalty reward";
    case "RECEIPT_BRANDING":
      return "Receipt branding";
    case "RESERVATION":
      return "Reservation";
    case "GIFT_CARD":
      return "Gift card";
    default:
      return targetId;
  }
}

export async function getDeleteImpact(prisma: PrismaClient, assetId: string, restaurantId: string) {
  const asset = await prisma.mediaAsset.findFirst({
    where: {
      id: assetId,
      OR: [{ restaurantId }, { usages: { some: { restaurantId } } }]
    },
    select: { id: true, displayName: true, originalName: true }
  });
  if (!asset) return null;

  const usages = await listAssetUsages(prisma, assetId, restaurantId);
  const byType: Record<string, number> = {};
  for (const u of usages) {
    byType[u.targetType] = (byType[u.targetType] ?? 0) + 1;
  }
  const byGroup: Record<string, number> = {};
  for (const u of usages) {
    byGroup[u.group] = (byGroup[u.group] ?? 0) + 1;
  }

  return {
    assetId: asset.id,
    displayName: asset.displayName ?? asset.originalName ?? "Untitled",
    total: usages.length,
    canHardDelete: usages.length === 0,
    byType,
    byGroup,
    usages
  };
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

export async function detachManyUsages(
  prisma: PrismaClient,
  params: { assetId: string; restaurantId: string; usageIds: string[] }
) {
  const ids = [...new Set(params.usageIds.filter(Boolean))];
  if (ids.length === 0) return { ok: false as const, error: "usage_ids_required" };

  const usages = await prisma.mediaUsage.findMany({
    where: {
      id: { in: ids },
      assetId: params.assetId,
      restaurantId: params.restaurantId
    }
  });
  if (usages.length === 0) return { ok: false as const, error: "usage_not_found" };

  let detached = 0;
  for (const usage of usages) {
    const result = await detachUsage(prisma, usage.id);
    if (result.ok) detached += 1;
  }
  return { ok: true as const, detached };
}
