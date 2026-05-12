import {
  clusterLabelForCategoryName,
  flattenMenu,
  rankedBySeed,
  type MenuCategoryLite,
  type MenuItemFlat,
  uniqueById
} from "../menu/menuBrowseUtils";

/** Pure, client-only helpers for search sheet UX (no network). */

const PRESET_QUICK_TERMS = [
  "burger",
  "pasta",
  "chicken",
  "pizza",
  "salad",
  "vegan",
  "coffee",
  "cola",
  "dessert",
  "soup"
] as const;

export function menuPoolFromCategories(categories: MenuCategoryLite[]): MenuItemFlat[] {
  return uniqueById(flattenMenu(categories ?? []));
}

/** Chips grounded in menu (only terms that match at least one dish). */
export function quickSuggestionQueries(pool: MenuItemFlat[]): string[] {
  const hay = pool.map((it) => `${it.name} ${it.description ?? ""} ${it.categoryName}`.toLowerCase());
  const out: string[] = [];
  for (const term of PRESET_QUICK_TERMS) {
    const t = term.toLowerCase();
    if (hay.some((s) => s.includes(t))) out.push(term.charAt(0).toUpperCase() + term.slice(1));
  }
  return out.slice(0, 8);
}

export function filterPoolByCategory(pool: MenuItemFlat[], categoryId: string | null): MenuItemFlat[] {
  if (!categoryId) return pool;
  return pool.filter((it) => it.categoryId === categoryId);
}

export function searchItems(pool: MenuItemFlat[], query: string): MenuItemFlat[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return pool.filter((it) => {
    const blob = `${it.name} ${it.description ?? ""} ${it.categoryName}`.toLowerCase();
    return blob.includes(q);
  });
}

/** Same category as hits + token overlap — never replaces API ranking; UX only. */
export function relatedItemsForQuery(pool: MenuItemFlat[], primary: MenuItemFlat[], query: string, cap = 14): MenuItemFlat[] {
  const q = query.trim().toLowerCase();
  if (!q || primary.length === 0) return [];
  const primaryIds = new Set(primary.map((p) => p.id));
  const catIds = new Set(primary.map((p) => p.categoryId));
  const tokens = q
    .split(/\s+/)
    .map((w) => w.replace(/[^a-z0-9åäö]/gi, ""))
    .filter((w) => w.length >= 2);

  const scored: MenuItemFlat[] = [];
  for (const it of pool) {
    if (primaryIds.has(it.id)) continue;
    let score = 0;
    if (catIds.has(it.categoryId)) score += 2;
    const blob = `${it.name} ${it.description ?? ""}`.toLowerCase();
    for (const tok of tokens) {
      if (tok && blob.includes(tok)) score += 1;
    }
    if (score > 0) scored.push(it);
  }

  return rankedBySeed(scored, `rel-${q}`).slice(0, cap);
}

export function popularTonightItems(pool: MenuItemFlat[], restaurantId: string): MenuItemFlat[] {
  if (!pool.length) return [];
  return rankedBySeed(pool, `${restaurantId}-tonight`).slice(0, 10);
}

export function staffPickItems(pool: MenuItemFlat[], restaurantId: string): MenuItemFlat[] {
  if (!pool.length) return [];
  return rankedBySeed(pool, `${restaurantId}-staff`).slice(0, 6);
}

export function fastestPrepareItems(pool: MenuItemFlat[]): MenuItemFlat[] {
  const starters = pool.filter((it) => /starter|small|tapas|soup|salad|snack|share/i.test(it.categoryName));
  if (starters.length) return uniqueById(starters).slice(0, 8);
  return rankedBySeed([...pool], "fast-fallback").slice(0, 8);
}

export function bestDrinksItems(pool: MenuItemFlat[]): MenuItemFlat[] {
  const drinks = pool.filter((it) => clusterLabelForCategoryName(it.categoryName) === "Drinks & sweets");
  if (drinks.length) return rankedBySeed(uniqueById(drinks), "drinks").slice(0, 8);
  return rankedBySeed([...pool], "drinks-fallback").slice(0, 6);
}
