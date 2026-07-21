import type { PrismaClient } from "@prisma/client";
import { evaluateAvailability } from "./menu/availabilityEvaluationService.js";
import { sanitizeAvailabilityWindows } from "./menu/menuAvailability.js";

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
 * Uses availability SSOT — sold-out / schedule / unpublished menu blocks ordering.
 */
export async function priceMenuItemLineInput(
  prisma: PrismaClient,
  opts: {
    restaurantId: string;
    menuItemId: string;
    quantity: number;
    modifierOptionIds?: string[] | undefined;
    channel?: "DINE_IN" | "TAKEAWAY" | "DELIVERY" | "QR" | "KIOSK" | "STAFF";
    locationId?: string | null;
  }
): Promise<PricedOrderLineInput> {
  const { restaurantId, menuItemId, quantity } = opts;
  const optionIds = sortedUniqueOptionIds(opts.modifierOptionIds);

  const item = await prisma.menuItem.findFirst({
    where: {
      id: menuItemId,
      category: { restaurantId }
    },
    include: {
      category: {
        include: {
          menu: {
            select: {
              id: true,
              status: true,
              availabilityWindows: true,
              scheduledPublishAt: true,
              scheduledUnpublishAt: true
            }
          }
        }
      },
      modifierGroups: {
        include: { options: { where: { isActive: true } } }
      }
    }
  });
  if (!item) throw Object.assign(new Error("menu_item_not_found"), { statusCode: 400 });

  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: { openingHours: true }
  });

  let menu = item.category.menu;
  if (!menu) {
    menu = await prisma.menu.findFirst({
      where: { restaurantId, status: "PUBLISHED" },
      select: {
        id: true,
        status: true,
        availabilityWindows: true,
        scheduledPublishAt: true,
        scheduledUnpublishAt: true
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
    });
  }

  const evaluation = evaluateAvailability({
    openingHours: restaurant?.openingHours ?? null,
    timezone: "Europe/Stockholm",
    menuStatus: menu?.status ?? "PUBLISHED",
    scheduledPublishAt: menu?.scheduledPublishAt ?? null,
    scheduledUnpublishAt: menu?.scheduledUnpublishAt ?? null,
    windows: sanitizeAvailabilityWindows(menu?.availabilityWindows ?? null),
    categoryActive: item.category.isActive,
    itemActive: item.isActive,
    itemLifecycle: item.lifecycle,
    itemSoldOut: item.isSoldOut,
    channel: opts.channel ?? "QR",
    locationId: opts.locationId ?? restaurantId,
    audience: "CUSTOMER"
  });

  if (!evaluation.orderable) {
    const blocking = evaluation.reasons.find((r) => !r.ok);
    throw Object.assign(new Error(blocking?.code ?? "not_orderable"), {
      statusCode: 400,
      availability: evaluation
    });
  }

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
