import type { PrismaClient } from "@prisma/client";

export type ModifierSnap = {
  optionId: string;
  groupName: string;
  optionName: string;
  priceDeltaCents: number;
};

export type PricedOrderLineInput = {
  menuItemId: string;
  nameSnapshot: string;
  quantity: number;
  unitPriceCents: number;
  selectedModifiers: ModifierSnap[];
  lineTotalCents: number;
};

function sortedUniqueOptionIds(raw: string[] | undefined): string[] {
  return [...new Set(raw ?? [])].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

/**
 * For browse "tap +" quick-add (no picker): pad required modifier selections with deterministic defaults
 * (`sortOrder`, then option id); trim to `maxSelect` when needed so validation never fails when the DB requires choices.
 */
export async function resolveQuickAddModifierOptionIds(
  prisma: PrismaClient,
  restaurantId: string,
  menuItemId: string,
  requested: string[] | undefined
): Promise<string[]> {
  const item = await prisma.menuItem.findFirst({
    where: {
      id: menuItemId,
      isActive: true,
      category: { restaurantId, isActive: true }
    },
    include: {
      modifierGroups: {
        orderBy: { sortOrder: "asc" },
        include: { options: { where: { isActive: true } } }
      }
    }
  });

  if (!item) throw Object.assign(new Error("menu_item_not_found"), { statusCode: 400 });

  const groups = [...item.modifierGroups].sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id));

  const optionMeta = new Map<string, string>();
  for (const g of groups) {
    for (const o of g.options) optionMeta.set(o.id, g.id);
  }

  const requestedClean = [...new Set(requested ?? [])].filter((id) => optionMeta.has(id));

  const out: string[] = [];

  for (const g of groups) {
    const optsSorted = [...g.options].sort(
      (a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id)
    );
    const rank = new Map(optsSorted.map((o, ix) => [o.id, ix]));

    let picks = requestedClean.filter((oid) => optsSorted.some((o) => o.id === oid));

    for (const o of optsSorted) {
      if (picks.length >= g.minSelect) break;
      if (!picks.includes(o.id)) picks.push(o.id);
    }

    picks = [...new Set(picks)].sort((a, b) => (rank.get(a)! - rank.get(b)!));
    if (picks.length > g.maxSelect) picks = picks.slice(0, g.maxSelect);

    out.push(...picks);
  }

  return sortedUniqueOptionIds(out);
}

/**
 * Validates menu item + modifiers for `restaurantId`, returns pricing for one order-style line (quantity applied).
 */
export async function priceMenuItemLineInput(
  prisma: PrismaClient,
  opts: {
    restaurantId: string;
    menuItemId: string;
    quantity: number;
    modifierOptionIds?: string[] | undefined;
  }
): Promise<PricedOrderLineInput> {
  const { restaurantId, menuItemId, quantity } = opts;
  const optionIds = sortedUniqueOptionIds(opts.modifierOptionIds);

  const item = await prisma.menuItem.findFirst({
    where: {
      id: menuItemId,
      isActive: true,
      category: { restaurantId, isActive: true }
    },
    include: {
      modifierGroups: {
        include: { options: { where: { isActive: true } } }
      }
    }
  });
  if (!item) throw Object.assign(new Error("menu_item_not_found"), { statusCode: 400 });

  const optionMeta = new Map<string, { groupId: string; groupName: string; priceDeltaCents: number; name: string }>();
  for (const g of item.modifierGroups) {
    for (const o of g.options) {
      optionMeta.set(o.id, {
        groupId: g.id,
        groupName: g.name,
        priceDeltaCents: o.priceDeltaCents,
        name: o.name
      });
    }
  }

  for (const oid of optionIds) {
    if (!optionMeta.has(oid)) {
      throw Object.assign(new Error("invalid_modifier_option"), { statusCode: 400 });
    }
  }

  const selectedByGroup = new Map<string, string[]>();
  for (const g of item.modifierGroups) {
    selectedByGroup.set(g.id, []);
  }
  for (const oid of optionIds) {
    const meta = optionMeta.get(oid)!;
    selectedByGroup.get(meta.groupId)!.push(oid);
  }

  for (const g of item.modifierGroups) {
    const n = selectedByGroup.get(g.id)!.length;
    if (n < g.minSelect || n > g.maxSelect) {
      throw Object.assign(new Error("modifier_count_invalid"), { statusCode: 400 });
    }
  }

  const selectedModifiers: ModifierSnap[] = optionIds.map((oid) => {
    const m = optionMeta.get(oid)!;
    return {
      optionId: oid,
      groupName: m.groupName,
      optionName: m.name,
      priceDeltaCents: m.priceDeltaCents
    };
  });

  const extras = selectedModifiers.reduce((s, m) => s + m.priceDeltaCents, 0);
  const unitPriceCents = item.priceCents + extras;
  const lineTotalCents = unitPriceCents * quantity;

  return {
    menuItemId: item.id,
    nameSnapshot: item.name,
    quantity,
    unitPriceCents,
    selectedModifiers,
    lineTotalCents
  };
}
