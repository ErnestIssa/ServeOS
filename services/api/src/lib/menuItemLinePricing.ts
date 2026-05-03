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
