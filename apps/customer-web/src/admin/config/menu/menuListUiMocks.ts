import type { MenuSurfaceRow, MenuTree } from "../../../api";
import type { AvailabilityCard } from "./availabilityHelpers";
import { AVAILABILITY_COLOR_PRESETS } from "./availabilityHelpers";

export function isUiOnlyListId(id: string) {
  return id.startsWith("ui-mock-");
}

export type UiMockCategory = MenuTree["categories"][number];
export type UiMockFlatItem = {
  id: string;
  name: string;
  categoryName: string;
  categoryId: string;
  menuId: string | null;
  priceCents: number;
  isActive: boolean;
  isSoldOut: boolean;
  lifecycle: "DRAFT" | "ACTIVE" | "ARCHIVED";
  modifierCount: number;
  description: string | null;
  ingredients: string | null;
  specialNotes: string | null;
  sortOrder: number;
};
export type UiMockModifierGroup = {
  id: string;
  name: string;
  itemName: string;
  itemId: string;
  minSelect: number;
  maxSelect: number;
  optionCount: number;
};
export type UiMockModifierOption = {
  id: string;
  name: string;
  itemName: string;
  groupId: string;
  groupName: string;
  priceDeltaCents: number;
  isActive: boolean;
};

const MENU_EXTRA_SEEDS: Array<{
  name: string;
  description: string;
  surfaceKey: string;
  status: MenuSurfaceRow["status"];
  scopeTone: MenuSurfaceRow["scopeTone"];
  scopeLabel: string;
  categoryCount: number;
  itemCount: number;
}> = [
  { name: "Tapas hour", description: "Small plates with house vermouth.", surfaceKey: "dinner", status: "DRAFT", scopeTone: "draft", scopeLabel: "Draft", categoryCount: 5, itemCount: 21 },
  { name: "Sushi bar", description: "Nigiri, rolls, and omakase seats.", surfaceKey: "dinner", status: "PUBLISHED", scopeTone: "live", scopeLabel: "Live", categoryCount: 4, itemCount: 28 },
  { name: "Mocktails", description: "Zero-proof cocktails and shrubs.", surfaceKey: "drinks", status: "DRAFT", scopeTone: "draft", scopeLabel: "Draft", categoryCount: 2, itemCount: 14 },
  { name: "Sunday roast", description: "Family roast with sides and gravy.", surfaceKey: "main", status: "PUBLISHED", scopeTone: "live", scopeLabel: "Live", categoryCount: 3, itemCount: 12 },
  { name: "Street food", description: "Handhelds inspired by night markets.", surfaceKey: "custom", status: "DRAFT", scopeTone: "draft", scopeLabel: "Draft", categoryCount: 6, itemCount: 24 },
  { name: "Cheese board", description: "Regional cheeses and preserves.", surfaceKey: "dinner", status: "PUBLISHED", scopeTone: "live", scopeLabel: "Live", categoryCount: 2, itemCount: 9 },
  { name: "Raw bar", description: "Oysters, crudo, and chilled seafood.", surfaceKey: "dinner", status: "DRAFT", scopeTone: "problem", scopeLabel: "Needs attention", categoryCount: 3, itemCount: 0 },
  { name: "Dessert cart", description: "Tableside sweets and gelato.", surfaceKey: "seasonal", status: "PUBLISHED", scopeTone: "live", scopeLabel: "Live", categoryCount: 2, itemCount: 11 },
  { name: "Staff meal", description: "Internal tasting board for crew.", surfaceKey: "custom", status: "DRAFT", scopeTone: "draft", scopeLabel: "Draft", categoryCount: 1, itemCount: 6 },
  { name: "Happy hour", description: "Discounted bites and drafts 4–6pm.", surfaceKey: "lunch", status: "PUBLISHED", scopeTone: "live", scopeLabel: "Live", categoryCount: 4, itemCount: 17 },
  { name: "Picnic baskets", description: "Packaged outdoor dining sets.", surfaceKey: "custom", status: "DRAFT", scopeTone: "draft", scopeLabel: "Draft", categoryCount: 3, itemCount: 8 },
  { name: "Tasting flight", description: "Chef’s multi-course progressive menu.", surfaceKey: "dinner", status: "PUBLISHED", scopeTone: "live", scopeLabel: "Live", categoryCount: 1, itemCount: 7 },
  { name: "Bakehouse", description: "Fresh bread, viennoiserie, and tarts.", surfaceKey: "brunch", status: "DRAFT", scopeTone: "draft", scopeLabel: "Draft", categoryCount: 3, itemCount: 15 },
  { name: "Bar snacks", description: "Salted nuts, olives, and fried bites.", surfaceKey: "drinks", status: "PUBLISHED", scopeTone: "live", scopeLabel: "Live", categoryCount: 2, itemCount: 10 },
  { name: "Farm supper", description: "Seasonal harvest plates.", surfaceKey: "seasonal", status: "DRAFT", scopeTone: "draft", scopeLabel: "Draft", categoryCount: 4, itemCount: 13 },
  { name: "Delivery only", description: "Packaging-optimized takeout menu.", surfaceKey: "main", status: "PUBLISHED", scopeTone: "live", scopeLabel: "Live", categoryCount: 5, itemCount: 20 }
];

function toMenuRows(
  seeds: typeof MENU_EXTRA_SEEDS,
  idPrefix: string,
  sortStart: number
): MenuSurfaceRow[] {
  const now = new Date().toISOString();
  return seeds.map((seed, index) => ({
    id: `${idPrefix}${index + 1}`,
    name: seed.name,
    description: seed.description,
    surfaceKey: seed.surfaceKey,
    status: seed.status,
    sortOrder: sortStart + index,
    categoryCount: seed.categoryCount,
    itemCount: seed.itemCount,
    coverMediaKey: null,
    activeVersionNumber: seed.status === "PUBLISHED" ? 1 : null,
    publishedAt: seed.status === "PUBLISHED" ? now : null,
    availabilityWindows: null,
    scopeTone: seed.scopeTone,
    scopeLabel: seed.scopeLabel,
    createdAt: now,
    updatedAt: now
  }));
}

/** 16 extra preview menus appended on the active Menus tab. */
export const UI_MOCK_MENUS_EXTRA = toMenuRows(MENU_EXTRA_SEEDS, "ui-mock-menu-extra-", 2000);

export const UI_MOCK_LIVE_MENUS = toMenuRows(
  MENU_EXTRA_SEEDS.map((s) => ({
    ...s,
    status: "PUBLISHED" as const,
    scopeTone: "live" as const,
    scopeLabel: "Live"
  })),
  "ui-mock-live-menu-",
  3000
);

export const UI_MOCK_ARCHIVED_MENUS = toMenuRows(
  MENU_EXTRA_SEEDS.map((s) => ({
    ...s,
    status: "ARCHIVED" as const,
    scopeTone: "draft" as const,
    scopeLabel: "Archived"
  })),
  "ui-mock-archived-menu-",
  4000
);

const CATEGORY_NAMES = [
  "Antipasti",
  "Wood-fired pizza",
  "Handmade pasta",
  "Grill & steaks",
  "Seafood tower",
  "Garden bowls",
  "Sides & sharers",
  "Kids plates",
  "Breakfast pastries",
  "Espresso bar",
  "Craft cocktails",
  "Zero-proof",
  "Dessert flight",
  "Cheese & charcuterie",
  "Seasonal specials",
  "Late-night fries"
];

export const UI_MOCK_CATEGORIES: UiMockCategory[] = CATEGORY_NAMES.map((name, index) => ({
  id: `ui-mock-category-${index + 1}`,
  menuId: null,
  name,
  description: `Preview category for ${name.toLowerCase()}.`,
  sortOrder: 1000 + index,
  isActive: index % 4 !== 3,
  items: []
}));

const ITEM_SEEDS = [
  ["Truffle fries", "Sides", 900],
  ["Margherita pizza", "Pizza", 1450],
  ["Cacio e pepe", "Pasta", 1680],
  ["Seared tuna", "Mains", 2450],
  ["Burrata toast", "Starters", 1250],
  ["Lamb chops", "Grill", 2890],
  ["Mushroom risotto", "Pasta", 1750],
  ["Caesar salad", "Salads", 1100],
  ["Fish & chips", "Mains", 1890],
  ["Chocolate fondant", "Desserts", 980],
  ["Espresso martini", "Drinks", 1200],
  ["House lemonade", "Drinks", 450],
  ["Avocado toast", "Brunch", 1050],
  ["Beef burger", "Burgers", 1650],
  ["Pad thai", "Noodles", 1550],
  ["Gelato trio", "Desserts", 850]
] as const;

export const UI_MOCK_ITEMS: UiMockFlatItem[] = ITEM_SEEDS.map(([name, categoryName, priceCents], index) => ({
  id: `ui-mock-item-${index + 1}`,
  name,
  categoryName,
  categoryId: `ui-mock-category-${(index % 16) + 1}`,
  menuId: null,
  priceCents,
  isActive: index % 5 !== 4,
  isSoldOut: index % 7 === 0,
  lifecycle: index % 11 === 0 ? "DRAFT" : index % 13 === 0 ? "ARCHIVED" : "ACTIVE",
  modifierCount: index % 3,
  description: `Preview dish — ${name}.`,
  ingredients: null,
  specialNotes: null,
  sortOrder: 1000 + index
}));

const GROUP_SEEDS = [
  ["Choose size", "Margherita pizza", 1, 1, 3],
  ["Choose bread", "Avocado toast", 1, 1, 4],
  ["Add protein", "Garden bowl", 0, 2, 5],
  ["Sauce choice", "Fish & chips", 1, 1, 3],
  ["Spice level", "Pad thai", 1, 1, 4],
  ["Doneness", "Beef burger", 1, 1, 4],
  ["Toppings", "Truffle fries", 0, 3, 6],
  ["Milk type", "Espresso martini", 0, 1, 4],
  ["Dressing", "Caesar salad", 1, 1, 3],
  ["Side swap", "Lamb chops", 0, 1, 3],
  ["Pasta shape", "Cacio e pepe", 1, 1, 3],
  ["Extra scoops", "Gelato trio", 0, 2, 3],
  ["Glaze", "Seared tuna", 0, 1, 2],
  ["Cheese add-on", "Burrata toast", 0, 2, 4],
  ["Bun style", "Beef burger", 1, 1, 3],
  ["Noodle type", "Pad thai", 1, 1, 3]
] as const;

export const UI_MOCK_MODIFIER_GROUPS: UiMockModifierGroup[] = GROUP_SEEDS.map(
  ([name, itemName, minSelect, maxSelect, optionCount], index) => ({
    id: `ui-mock-mod-group-${index + 1}`,
    name,
    itemName,
    itemId: `ui-mock-item-${(index % 16) + 1}`,
    minSelect,
    maxSelect,
    optionCount
  })
);

const OPTION_SEEDS = [
  ["Small", "Choose size", "Margherita pizza", 0],
  ["Medium", "Choose size", "Margherita pizza", 150],
  ["Large", "Choose size", "Margherita pizza", 300],
  ["Sourdough", "Choose bread", "Avocado toast", 0],
  ["Whole wheat", "Choose bread", "Avocado toast", 50],
  ["Gluten-free", "Choose bread", "Avocado toast", 150],
  ["Chicken", "Add protein", "Garden bowl", 250],
  ["Tofu", "Add protein", "Garden bowl", 200],
  ["Mild", "Spice level", "Pad thai", 0],
  ["Hot", "Spice level", "Pad thai", 0],
  ["Medium rare", "Doneness", "Beef burger", 0],
  ["Well done", "Doneness", "Beef burger", 0],
  ["Parmesan", "Toppings", "Truffle fries", 100],
  ["Oat milk", "Milk type", "Espresso martini", 50],
  ["Extra dressing", "Dressing", "Caesar salad", 75],
  ["Udon", "Noodle type", "Pad thai", 100]
] as const;

export const UI_MOCK_MODIFIER_OPTIONS: UiMockModifierOption[] = OPTION_SEEDS.map(
  ([name, groupName, itemName, priceDeltaCents], index) => ({
    id: `ui-mock-mod-option-${index + 1}`,
    name,
    groupName,
    itemName,
    groupId: `ui-mock-mod-group-${(index % 16) + 1}`,
    priceDeltaCents,
    isActive: index % 6 !== 5
  })
);

const AVAILABILITY_SEEDS = [
  ["Weekday lunch", "11:00", "15:00", [1, 2, 3, 4, 5], true],
  ["Dinner service", "17:00", "22:30", [1, 2, 3, 4, 5, 6], true],
  ["Weekend brunch", "09:00", "14:00", [6, 0], true],
  ["Happy hour", "16:00", "18:00", [1, 2, 3, 4, 5], true],
  ["Late kitchen", "22:00", "00:00", [5, 6], false],
  ["Breakfast window", "07:00", "11:00", [1, 2, 3, 4, 5], true],
  ["Sunday roast", "12:00", "16:00", [0], true],
  ["Patio only", "12:00", "20:00", [1, 2, 3, 4, 5, 6, 0], true],
  ["Holiday hours", "10:00", "21:00", [1, 2, 3, 4, 5, 6, 0], false],
  ["Staff tasting", "14:00", "15:00", [2, 4], true],
  ["Bar late night", "20:00", "01:00", [4, 5, 6], true],
  ["Catering slot", "09:00", "17:00", [1, 2, 3, 4, 5], true],
  ["Seasonal patio", "11:30", "19:00", [5, 6, 0], true],
  ["Breakfast express", "06:30", "10:30", [1, 2, 3, 4, 5], false],
  ["Afternoon tea", "14:00", "17:00", [3, 4, 5, 6], true],
  ["All-day café", "08:00", "20:00", [1, 2, 3, 4, 5, 6, 0], true]
] as const;

export const UI_MOCK_AVAILABILITY: AvailabilityCard[] = AVAILABILITY_SEEDS.map(
  ([label, start, end, days, enabled], index) => ({
    key: `ui-mock-availability-${index + 1}`,
    menuId: `ui-mock-availability-menu-${index + 1}`,
    menuName: `Preview menu ${index + 1}`,
    window: {
      label,
      start,
      end,
      days: [...days],
      enabled,
      color: AVAILABILITY_COLOR_PRESETS[index % AVAILABILITY_COLOR_PRESETS.length]!
    }
  })
);

export function matchesListSearch(query: string, ...parts: Array<string | number | null | undefined>) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return parts
    .filter((p) => p != null && String(p).trim().length > 0)
    .join(" ")
    .toLowerCase()
    .includes(q);
}
