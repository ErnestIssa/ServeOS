/**
 * Offline / design-preview menu: same venue id and copy as `core/database/prisma/seed.ts`.
 * Enable with EXPO_PUBLIC_SERVEOS_USE_DEMO_MENU=true (restart Expo after changing .env).
 */
export const SERVEOS_DEMO_RESTAURANT_ID = "serveos_demo_peak_bistro";

const v = process.env.EXPO_PUBLIC_SERVEOS_USE_DEMO_MENU?.toLowerCase().trim();
export function isServeosDemoMenuEnabled(): boolean {
  return v === "1" || v === "true" || v === "yes";
}

/** Shape matches GET /restaurants/public/menu/:restaurantId (categories + items for UI). */
export function getServeosDemoPublicMenu(): {
  ok: true;
  restaurant: { id: string; name: string };
  categories: Array<{
    id: string;
    name: string;
    sortOrder: number;
    items: Array<{
      id: string;
      name: string;
      description: string | null;
      priceCents: number;
      sortOrder: number;
      modifierGroups?: Array<{
        id: string;
        name: string;
        options: Array<{ id: string; name: string; priceDeltaCents: number }>;
      }>;
    }>;
  }>;
} {
  return {
    ok: true,
    restaurant: { id: SERVEOS_DEMO_RESTAURANT_ID, name: "Peak Mode Bistro" },
    categories: [
      {
        id: "demo_cat_specials",
        name: "Today's specials",
        sortOrder: 0,
        items: [
          {
            id: "demo_item_chicken_bowl",
            name: "Chef's crispy chicken bowl",
            description: "Honey-garlic glaze, pickled veg, jasmine rice.",
            priceCents: 1495,
            sortOrder: 0
          },
          {
            id: "demo_item_trout",
            name: "Seared trout + citrus butter",
            description: "Today's catch, blistered peas, toasted almonds.",
            priceCents: 2295,
            sortOrder: 1
          }
        ]
      },
      {
        id: "demo_cat_starters",
        name: "Starters & sides",
        sortOrder: 1,
        items: [
          {
            id: "demo_item_cauliflower",
            name: "Charred cauliflower",
            description: "Tahini lemon, pomegranate, herbs.",
            priceCents: 895,
            sortOrder: 0
          },
          {
            id: "demo_item_soup",
            name: "Soup of the moment",
            description: "Rotating kettle soup with warm bread.",
            priceCents: 750,
            sortOrder: 1
          },
          {
            id: "demo_item_salad",
            name: "Garden salad",
            description: "Greens, vinaigrette, seeds, parmesan crisp.",
            priceCents: 995,
            sortOrder: 2
          }
        ]
      },
      {
        id: "demo_cat_mains",
        name: "Mains",
        sortOrder: 2,
        items: [
          {
            id: "demo_item_burger",
            name: "Peak smash burger",
            description: "Double patty, cheddar, house sauce, brioche.",
            priceCents: 1695,
            sortOrder: 0,
            modifierGroups: [
              {
                id: "demo_mg_done",
                name: "Doneness",
                options: [
                  { id: "demo_mo_mr", name: "Medium rare", priceDeltaCents: 0 },
                  { id: "demo_mo_md", name: "Medium", priceDeltaCents: 0 },
                  { id: "demo_mo_wd", name: "Well done", priceDeltaCents: 0 }
                ]
              },
              {
                id: "demo_mg_addon",
                name: "Add-ons",
                options: [
                  { id: "demo_mo_bacon", name: "Bacon", priceDeltaCents: 200 },
                  { id: "demo_mo_egg", name: "Fried egg", priceDeltaCents: 175 },
                  { id: "demo_mo_avo", name: "Avocado", priceDeltaCents: 225 }
                ]
              }
            ]
          },
          {
            id: "demo_item_salmon",
            name: "Lemon herb salmon",
            description: "Crispy skin salmon, dill yogurt, lentils.",
            priceCents: 2495,
            sortOrder: 1
          },
          {
            id: "demo_item_pasta",
            name: "Forest mushroom pasta",
            description: "Fresh pappardelle, thyme cream, parmesan.",
            priceCents: 1795,
            sortOrder: 2
          },
          {
            id: "demo_item_noodle",
            name: "Sesame noodle bowl",
            description: "Chili crunch, marinated tofu, shaved veg.",
            priceCents: 1595,
            sortOrder: 3
          }
        ]
      },
      {
        id: "demo_cat_drinks",
        name: "Drinks & dessert",
        sortOrder: 3,
        items: [
          {
            id: "demo_item_soda",
            name: "Sparkling blackberry lime",
            description: "House soda, iced.",
            priceCents: 425,
            sortOrder: 0
          },
          {
            id: "demo_item_coffee",
            name: "Flat white",
            description: "Espresso + velvety milk.",
            priceCents: 495,
            sortOrder: 1
          },
          {
            id: "demo_item_dessert",
            name: "Dark chocolate pot de creme",
            description: "Sea salt, olive oil shortbread.",
            priceCents: 850,
            sortOrder: 2
          }
        ]
      }
    ]
  };
}
