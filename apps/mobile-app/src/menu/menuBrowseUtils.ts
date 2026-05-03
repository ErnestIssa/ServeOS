/** Flatten categories from public menu payload */
export type MenuItemFlat = {
  id: string;
  name: string;
  description?: string | null;
  priceCents: number;
  categoryId: string;
  categoryName: string;
};

export type MenuCategoryLite = {
  id: string;
  name: string;
  sortOrder?: number;
  items: Array<{
    id: string;
    name: string;
    description?: string | null;
    priceCents: number;
  }>;
};

export function flattenMenu(categories: MenuCategoryLite[]): MenuItemFlat[] {
  const out: MenuItemFlat[] = [];
  for (const cat of categories ?? []) {
    for (const item of cat.items ?? []) {
      out.push({
        id: item.id,
        name: item.name,
        description: item.description,
        priceCents: item.priceCents ?? 0,
        categoryId: cat.id,
        categoryName: cat.name
      });
    }
  }
  return out;
}

/** Broad “aisle” for grouping headings (meal / food mood) */
export function clusterLabelForCategoryName(name: string): string {
  const n = String(name).toLowerCase();
  if (/(coffee|tea|beer|wine|smoothie|juice|\bdrinks?\b|\bdesserts?\b|\bsweets?\b|candy|bakery\b)/.test(n)) {
    return "Drinks & sweets";
  }
  if (/(starter|small plate|tapas|salad|soup|appetizer|share\b|snack)/.test(n)) {
    return "Starters & small plates";
  }
  if (/(main|entre|burger|bowl|pasta|plated|chef|special|sandwich|\bmains\b)/i.test(name)) {
    return "Plates & mains";
  }
  if (/(breakfast|brunch)/.test(n)) return "Breakfast & brunch";
  if (/(lunch)/.test(n)) return "Lunch";
  if (/(dinner|evening)/.test(n)) return "Evening";
  return "Chef menu lanes";
}

const CLUSTER_ORDER = [
  "Breakfast & brunch",
  "Lunch",
  "Plates & mains",
  "Starters & small plates",
  "Drinks & sweets",
  "Evening",
  "Chef menu lanes"
];

export type ClusteredCategories = Array<{ aisle: string; categories: MenuCategoryLite[] }>;

export function clusterCategoriesForBrowse(categories: MenuCategoryLite[]): ClusteredCategories {
  /** Omit categories with no dishes — avoids empty headings/lanes in browse UI */
  const buckets = new Map<string, MenuCategoryLite[]>();
  for (const cat of categories ?? []) {
    if (!(cat.items?.length ?? 0)) continue;
    const label = clusterLabelForCategoryName(cat.name);
    const arr = buckets.get(label);
    if (arr) arr.push(cat);
    else buckets.set(label, [cat]);
  }

  const out: ClusteredCategories = [];
  const seen = new Set<string>();

  for (const label of CLUSTER_ORDER) {
    const list = buckets.get(label);
    if (list?.length) {
      out.push({ aisle: label, categories: [...list] });
      seen.add(label);
    }
  }

  for (const [aisle, list] of buckets) {
    if (!seen.has(aisle)) out.push({ aisle, categories: list });
  }

  return out;
}

/** Deterministic faux-random ranking for carousel variety */
export function rankedBySeed(items: MenuItemFlat[], seed: string): MenuItemFlat[] {
  const copy = [...items];
  copy.sort((a, b) => {
    const sa = scramble(a.id + seed);
    const sb = scramble(b.id + seed);
    return sa - sb;
  });
  return copy;
}

function scramble(key: string): number {
  let h = 0;
  for (let i = 0; i < key.length; i++) {
    h = (h << 5) - h + key.charCodeAt(i);
    h |= 0;
  }
  return h;
}

export function uniqueById(items: MenuItemFlat[]): MenuItemFlat[] {
  const map = new Map<string, MenuItemFlat>();
  for (const it of items) {
    if (!map.has(it.id)) map.set(it.id, it);
  }
  return [...map.values()];
}

export function filterMenuItems(items: MenuItemFlat[], query: string): MenuItemFlat[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  return items.filter((it) => {
    const n = `${it.name} ${it.description ?? ""} ${it.categoryName}`.toLowerCase();
    return n.includes(q);
  });
}

/** Flat filtered pool — single source for CustomerMenuBrowsing + home “Menu” visibility. */
export function buildFilteredMenuPool(categories: MenuCategoryLite[], filterQuery: string): MenuItemFlat[] {
  const flat = uniqueById(
    (categories ?? []).flatMap((c) =>
      (c.items ?? []).map((item) => ({
        id: item.id,
        name: item.name,
        description: item.description,
        priceCents: item.priceCents ?? 0,
        categoryId: c.id,
        categoryName: c.name
      }))
    )
  );
  return filterMenuItems(flat, filterQuery);
}

export function idsToItems(ids: string[], pool: MenuItemFlat[]): MenuItemFlat[] {
  const byId = new Map(pool.map((x) => [x.id, x]));
  const out: MenuItemFlat[] = [];
  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) continue;
    seen.add(id);
    const hit = byId.get(id);
    if (hit) out.push(hit);
  }
  return out;
}
