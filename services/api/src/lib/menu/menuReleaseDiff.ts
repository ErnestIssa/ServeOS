import type { PublicMenuCategory, PublicMenuItem } from "./publicMenuService.js";

export type MenuReleaseChangeLine = {
  kind:
    | "category_added"
    | "category_removed"
    | "category_updated"
    | "item_added"
    | "item_removed"
    | "item_updated"
    | "price_changed"
    | "item_hidden"
    | "item_shown"
    | "media_changed"
    | "modifier_changed";
  label: string;
  detail?: string;
};

export type MenuReleaseChangeSummary = {
  totalChanges: number;
  categoriesAdded: number;
  categoriesRemoved: number;
  categoriesUpdated: number;
  itemsAdded: number;
  itemsRemoved: number;
  itemsUpdated: number;
  pricesChanged: number;
  itemsHidden: number;
  itemsShown: number;
  mediaChanged: number;
  modifiersChanged: number;
  lines: MenuReleaseChangeLine[];
};

export type MenuVersionCompareResult = {
  fromVersionNumber: number;
  toVersionNumber: number;
  summary: MenuReleaseChangeSummary;
  priceChanges: Array<{ itemId: string; name: string; fromCents: number; toCents: number }>;
  addedItems: Array<{ id: string; name: string; priceCents: number }>;
  removedItems: Array<{ id: string; name: string; priceCents: number }>;
};

function emptySummary(): MenuReleaseChangeSummary {
  return {
    totalChanges: 0,
    categoriesAdded: 0,
    categoriesRemoved: 0,
    categoriesUpdated: 0,
    itemsAdded: 0,
    itemsRemoved: 0,
    itemsUpdated: 0,
    pricesChanged: 0,
    itemsHidden: 0,
    itemsShown: 0,
    mediaChanged: 0,
    modifiersChanged: 0,
    lines: []
  };
}

function parseCategories(snapshot: unknown): PublicMenuCategory[] {
  if (!snapshot || typeof snapshot !== "object") return [];
  const root = snapshot as { categories?: unknown };
  return Array.isArray(root.categories) ? (root.categories as PublicMenuCategory[]) : [];
}

function itemKeyMedia(item: PublicMenuItem): string {
  const mediaIds = (item.media ?? []).map((m) => m.id).sort().join(",");
  return `${item.imageKey ?? ""}|${mediaIds}`;
}

function itemKeyModifiers(item: PublicMenuItem): string {
  return JSON.stringify(
    (item.modifierGroups ?? []).map((g) => ({
      id: g.id,
      name: g.name,
      minSelect: g.minSelect,
      maxSelect: g.maxSelect,
      options: (g.options ?? []).map((o) => ({
        id: o.id,
        name: o.name,
        priceDeltaCents: o.priceDeltaCents,
        isActive: o.isActive
      }))
    }))
  );
}

function stableItemFingerprint(item: PublicMenuItem): string {
  return JSON.stringify({
    name: item.name,
    description: item.description,
    priceCents: item.priceCents,
    sortOrder: item.sortOrder,
    isActive: item.isActive,
    media: itemKeyMedia(item),
    modifiers: itemKeyModifiers(item)
  });
}

function indexTree(categories: PublicMenuCategory[]) {
  const cats = new Map(categories.map((c) => [c.id, c]));
  const items = new Map<string, { categoryId: string; item: PublicMenuItem }>();
  for (const c of categories) {
    for (const item of c.items ?? []) {
      items.set(item.id, { categoryId: c.id, item });
    }
  }
  return { cats, items };
}

/** Diff draft (live) snapshot vs published snapshot. `from` = published, `to` = draft. */
export function diffMenuSnapshots(
  publishedSnapshot: unknown,
  draftSnapshot: unknown
): MenuReleaseChangeSummary {
  const fromCats = parseCategories(publishedSnapshot);
  const toCats = parseCategories(draftSnapshot);
  const from = indexTree(fromCats);
  const to = indexTree(toCats);
  const summary = emptySummary();

  for (const [id, cat] of to.cats) {
    if (!from.cats.has(id)) {
      summary.categoriesAdded += 1;
      summary.lines.push({ kind: "category_added", label: `Added category “${cat.name}”` });
    } else {
      const prev = from.cats.get(id)!;
      if (prev.name !== cat.name || prev.sortOrder !== cat.sortOrder || prev.isActive !== cat.isActive) {
        summary.categoriesUpdated += 1;
        summary.lines.push({
          kind: "category_updated",
          label: `Updated category “${cat.name}”`,
          detail: prev.name !== cat.name ? `Renamed from “${prev.name}”` : undefined
        });
      }
    }
  }

  for (const [id, cat] of from.cats) {
    if (!to.cats.has(id)) {
      summary.categoriesRemoved += 1;
      summary.lines.push({ kind: "category_removed", label: `Removed category “${cat.name}”` });
    }
  }

  for (const [id, { item }] of to.items) {
    const prev = from.items.get(id);
    if (!prev) {
      summary.itemsAdded += 1;
      summary.lines.push({
        kind: "item_added",
        label: `Added “${item.name}”`,
        detail: `${(item.priceCents / 100).toFixed(2)}`
      });
      continue;
    }

    const before = prev.item;
    let touched = false;

    if (before.priceCents !== item.priceCents) {
      summary.pricesChanged += 1;
      touched = true;
      summary.lines.push({
        kind: "price_changed",
        label: `Price: ${before.name}`,
        detail: `${(before.priceCents / 100).toFixed(2)} → ${(item.priceCents / 100).toFixed(2)}`
      });
    }

    if (before.isActive !== item.isActive) {
      if (!item.isActive) {
        summary.itemsHidden += 1;
        summary.lines.push({ kind: "item_hidden", label: `Hidden “${item.name}”` });
      } else {
        summary.itemsShown += 1;
        summary.lines.push({ kind: "item_shown", label: `Shown “${item.name}”` });
      }
      touched = true;
    }

    if (itemKeyMedia(before) !== itemKeyMedia(item)) {
      summary.mediaChanged += 1;
      touched = true;
      summary.lines.push({ kind: "media_changed", label: `Media updated on “${item.name}”` });
    }

    if (itemKeyModifiers(before) !== itemKeyModifiers(item)) {
      summary.modifiersChanged += 1;
      touched = true;
      summary.lines.push({ kind: "modifier_changed", label: `Modifiers updated on “${item.name}”` });
    }

    if (
      before.name !== item.name ||
      before.description !== item.description ||
      before.sortOrder !== item.sortOrder
    ) {
      if (!touched) {
        summary.lines.push({ kind: "item_updated", label: `Updated “${item.name}”` });
      }
      touched = true;
    }

    if (touched) summary.itemsUpdated += 1;
  }

  for (const [id, { item }] of from.items) {
    if (!to.items.has(id)) {
      summary.itemsRemoved += 1;
      summary.lines.push({ kind: "item_removed", label: `Removed “${item.name}”` });
    }
  }

  summary.totalChanges = summary.lines.length;
  return summary;
}

export function compareMenuSnapshots(
  fromVersionNumber: number,
  toVersionNumber: number,
  fromSnapshot: unknown,
  toSnapshot: unknown
): MenuVersionCompareResult {
  const summary = diffMenuSnapshots(fromSnapshot, toSnapshot);
  const from = indexTree(parseCategories(fromSnapshot));
  const to = indexTree(parseCategories(toSnapshot));

  const priceChanges: MenuVersionCompareResult["priceChanges"] = [];
  const addedItems: MenuVersionCompareResult["addedItems"] = [];
  const removedItems: MenuVersionCompareResult["removedItems"] = [];

  for (const [id, { item }] of to.items) {
    const prev = from.items.get(id);
    if (!prev) {
      addedItems.push({ id, name: item.name, priceCents: item.priceCents });
    } else if (prev.item.priceCents !== item.priceCents) {
      priceChanges.push({
        itemId: id,
        name: item.name,
        fromCents: prev.item.priceCents,
        toCents: item.priceCents
      });
    }
  }

  for (const [id, { item }] of from.items) {
    if (!to.items.has(id)) {
      removedItems.push({ id, name: item.name, priceCents: item.priceCents });
    }
  }

  return { fromVersionNumber, toVersionNumber, summary, priceChanges, addedItems, removedItems };
}

export function countSnapshotEntities(snapshot: unknown): {
  categoryCount: number;
  itemCount: number;
  modifierGroupCount: number;
  modifierOptionCount: number;
  mediaCount: number;
} {
  const categories = parseCategories(snapshot);
  let itemCount = 0;
  let modifierGroupCount = 0;
  let modifierOptionCount = 0;
  let mediaCount = 0;
  for (const c of categories) {
    for (const item of c.items ?? []) {
      itemCount += 1;
      mediaCount += (item.media ?? []).length + (item.imageKey ? 1 : 0);
      for (const g of item.modifierGroups ?? []) {
        modifierGroupCount += 1;
        modifierOptionCount += (g.options ?? []).length;
      }
    }
  }
  return {
    categoryCount: categories.length,
    itemCount,
    modifierGroupCount,
    modifierOptionCount,
    mediaCount
  };
}

export function snapshotsEqual(a: unknown, b: unknown): boolean {
  const fa = indexTree(parseCategories(a));
  const fb = indexTree(parseCategories(b));
  if (fa.cats.size !== fb.cats.size || fa.items.size !== fb.items.size) return false;
  for (const [id, cat] of fa.cats) {
    const other = fb.cats.get(id);
    if (!other) return false;
    if (cat.name !== other.name || cat.sortOrder !== other.sortOrder || cat.isActive !== other.isActive) {
      return false;
    }
  }
  for (const [id, { item }] of fa.items) {
    const other = fb.items.get(id);
    if (!other) return false;
    if (stableItemFingerprint(item) !== stableItemFingerprint(other.item)) return false;
  }
  return true;
}

export { parseCategories as parseSnapshotCategoriesFromRelease };
