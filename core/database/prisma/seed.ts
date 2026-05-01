import { Prisma, PrismaClient } from "@prisma/client";
import { config } from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
config({ path: path.join(repoRoot, ".env") });
config({ path: path.join(repoRoot, ".env.local") });

/** Stable ID so you can paste it into Account → Restaurant ID after seeding */
export const SERVEOS_DEMO_RESTAURANT_ID = "serveos_demo_peak_bistro";

const prisma = new PrismaClient();

const DEMO_ORG_NR = "1000099991001";

async function main() {
  const company = await prisma.company.upsert({
    where: { orgNumberNormalized: DEMO_ORG_NR },
    create: {
      orgNumberNormalized: DEMO_ORG_NR,
      legalName: "ServeOS Demo Venue Group LLC"
    },
    update: { legalName: "ServeOS Demo Venue Group LLC" }
  });

  await prisma.restaurant.deleteMany({
    where: { id: SERVEOS_DEMO_RESTAURANT_ID }
  });

  await prisma.restaurant.create({
    data: {
      id: SERVEOS_DEMO_RESTAURANT_ID,
      name: "Peak Mode Bistro",
      openingHours: "Mon–Sat 11:00–23:00, Sun brunch 10:00–15:00",
      companyId: company.id,
      venueSubtype: "restaurant",
      establishmentLocation: "Downtown Demo District",
      offeringsDescription: "Fast-casual lunch, plated dinner, artisan drinks.",
      menuCategories: {
        create: [
          {
            name: "Today's specials",
            sortOrder: 0,
            items: {
              create: [
                {
                  name: "Chef's crispy chicken bowl",
                  description: "Honey-garlic glaze, pickled veg, jasmine rice.",
                  priceCents: 1495,
                  sortOrder: 0
                },
                {
                  name: "Seared trout + citrus butter",
                  description: "Today's catch, blistered peas, toasted almonds.",
                  priceCents: 2295,
                  sortOrder: 1
                }
              ]
            }
          },
          {
            name: "Starters & sides",
            sortOrder: 1,
            items: {
              create: [
                {
                  name: "Charred cauliflower",
                  description: "Tahini lemon, pomegranate, herbs.",
                  priceCents: 895,
                  sortOrder: 0
                },
                {
                  name: "Soup of the moment",
                  description: "Rotating kettle soup with warm bread.",
                  priceCents: 750,
                  sortOrder: 1
                },
                {
                  name: "Garden salad",
                  description: "Greens, vinaigrette, seeds, parmesan crisp.",
                  priceCents: 995,
                  sortOrder: 2
                }
              ]
            }
          },
          {
            name: "Mains",
            sortOrder: 2,
            items: {
              create: [
                {
                  name: "Peak smash burger",
                  description: "Double patty, cheddar, house sauce, brioche.",
                  priceCents: 1695,
                  sortOrder: 0,
                  modifierGroups: {
                    create: [
                      {
                        name: "Doneness",
                        minSelect: 1,
                        maxSelect: 1,
                        sortOrder: 0,
                        options: {
                          create: [
                            { name: "Medium rare", priceDeltaCents: 0, sortOrder: 0 },
                            { name: "Medium", priceDeltaCents: 0, sortOrder: 1 },
                            { name: "Well done", priceDeltaCents: 0, sortOrder: 2 }
                          ]
                        }
                      },
                      {
                        name: "Add-ons",
                        minSelect: 0,
                        maxSelect: 3,
                        sortOrder: 1,
                        options: {
                          create: [
                            { name: "Bacon", priceDeltaCents: 200, sortOrder: 0 },
                            { name: "Fried egg", priceDeltaCents: 175, sortOrder: 1 },
                            { name: "Avocado", priceDeltaCents: 225, sortOrder: 2 }
                          ]
                        }
                      }
                    ]
                  }
                },
                {
                  name: "Lemon herb salmon",
                  description: "Crispy skin salmon, dill yogurt, lentils.",
                  priceCents: 2495,
                  sortOrder: 1
                },
                {
                  name: "Forest mushroom pasta",
                  description: "Fresh pappardelle, thyme cream, parmesan.",
                  priceCents: 1795,
                  sortOrder: 2
                },
                {
                  name: "Sesame noodle bowl",
                  description: "Chili crunch, marinated tofu, shaved veg.",
                  priceCents: 1595,
                  sortOrder: 3
                }
              ]
            }
          },
          {
            name: "Drinks & dessert",
            sortOrder: 3,
            items: {
              create: [
                {
                  name: "Sparkling blackberry lime",
                  description: "House soda, iced.",
                  priceCents: 425,
                  sortOrder: 0
                },
                {
                  name: "Flat white",
                  description: "Espresso + velvety milk.",
                  priceCents: 495,
                  sortOrder: 1
                },
                {
                  name: "Dark chocolate pot de creme",
                  description: "Sea salt, olive oil shortbread.",
                  priceCents: 850,
                  sortOrder: 2
                }
              ]
            }
          }
        ]
      }
    }
  });

  console.log(
    `[serveos seed] Demo venue ready:\n  Restaurant ID (paste into app): ${SERVEOS_DEMO_RESTAURANT_ID}\n  Name: Peak Mode Bistro\n  Company org # (demo): ${DEMO_ORG_NR}`
  );
}

main()
  .catch((e) => {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2021") {
      console.error(
        "[serveos seed] Database is missing tables. Apply migrations first: npm run db:migrate:deploy (from repo root, with DATABASE_URL)."
      );
    } else {
      console.error(e);
    }
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
