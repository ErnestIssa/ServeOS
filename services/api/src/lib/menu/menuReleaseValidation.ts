import type { PrismaClient } from "@prisma/client";
import { buildMenuSnapshotForPublish } from "./publicMenuService.js";
import { countSnapshotEntities, parseSnapshotCategoriesFromRelease } from "./menuReleaseDiff.js";

export type MenuReleaseValidationCheck = {
  id: string;
  ok: boolean;
  label: string;
  detail?: string;
};

export type MenuReleaseValidationResult = {
  ok: boolean;
  checks: MenuReleaseValidationCheck[];
};

export async function validateMenuForRelease(
  prisma: PrismaClient,
  restaurantId: string,
  menuId: string
): Promise<MenuReleaseValidationResult> {
  const menu = await prisma.menu.findFirst({
    where: { id: menuId, restaurantId, status: { not: "ARCHIVED" } },
    select: { id: true, name: true, status: true }
  });

  const checks: MenuReleaseValidationCheck[] = [];

  if (!menu) {
    return {
      ok: false,
      checks: [{ id: "menu_exists", ok: false, label: "Menu exists", detail: "Menu not found." }]
    };
  }

  checks.push({ id: "menu_exists", ok: true, label: "Menu exists" });

  const snapshot = await buildMenuSnapshotForPublish(prisma, restaurantId, menuId);
  const counts = countSnapshotEntities(snapshot);
  const categories = parseSnapshotCategoriesFromRelease(snapshot);

  const hasCategories = counts.categoryCount > 0;
  checks.push({
    id: "has_categories",
    ok: hasCategories,
    label: "Menu has categories",
    detail: hasCategories ? `${counts.categoryCount} categories` : "Add at least one visible category."
  });

  const hasItems = counts.itemCount > 0;
  checks.push({
    id: "has_items",
    ok: hasItems,
    label: "Categories contain items",
    detail: hasItems ? `${counts.itemCount} items` : "Add at least one visible item."
  });

  const emptyCategories = categories.filter((c) => !(c.items ?? []).length);
  checks.push({
    id: "no_empty_categories",
    ok: emptyCategories.length === 0,
    label: "No empty categories",
    detail:
      emptyCategories.length === 0
        ? undefined
        : `${emptyCategories.length} categor${emptyCategories.length === 1 ? "y has" : "ies have"} no items.`
  });

  let pricesValid = true;
  for (const c of categories) {
    for (const item of c.items ?? []) {
      if (!Number.isFinite(item.priceCents) || item.priceCents < 0) {
        pricesValid = false;
        break;
      }
    }
    if (!pricesValid) break;
  }
  checks.push({
    id: "prices_valid",
    ok: pricesValid,
    label: "Prices valid",
    detail: pricesValid ? undefined : "One or more items have invalid prices."
  });

  let modifiersValid = true;
  for (const c of categories) {
    for (const item of c.items ?? []) {
      for (const g of item.modifierGroups ?? []) {
        if (g.minSelect < 0 || g.maxSelect < g.minSelect) {
          modifiersValid = false;
          break;
        }
        const activeOpts = (g.options ?? []).filter((o) => o.isActive !== false);
        if (g.minSelect > activeOpts.length) {
          modifiersValid = false;
          break;
        }
      }
      if (!modifiersValid) break;
    }
    if (!modifiersValid) break;
  }
  checks.push({
    id: "modifiers_valid",
    ok: modifiersValid,
    label: "Modifier references valid",
    detail: modifiersValid ? undefined : "A modifier group requires more options than are available."
  });

  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: { id: true, name: true }
  });
  checks.push({
    id: "restaurant_exists",
    ok: Boolean(restaurant),
    label: "Restaurant configured",
    detail: restaurant ? restaurant.name : "Restaurant not found."
  });

  return {
    ok: checks.every((c) => c.ok),
    checks
  };
}
