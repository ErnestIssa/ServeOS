import type { FastifyInstance } from "fastify";
import jwt from "jsonwebtoken";
import type { Prisma } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { fetchMenuTree } from "../lib/menu.js";
import { buildPublishedPublicMenu } from "../lib/menu/publicMenuService.js";
import { assertMenuEntityPermission } from "../lib/menu/menuPermissions.js";
import { requireMenuVenueMembership } from "../lib/menu/menuMembership.js";
import { isCustomerBrowsableRestaurant } from "../lib/customerRestaurantDirectory.js";

export function registerRestaurantRoutes(app: FastifyInstance, prisma: PrismaClient) {
  function requireUser(req: { headers: { authorization?: string } }) {
    const secret = process.env.JWT_SECRET;
    if (!secret) throw Object.assign(new Error("JWT_SECRET is required"), { statusCode: 500 });
    const auth = req.headers.authorization;
    if (!auth?.startsWith("Bearer ")) {
      throw Object.assign(new Error("missing_token"), { statusCode: 401 });
    }
    const token = auth.slice("Bearer ".length);
    return jwt.verify(token, secret) as { sub: string; role: string };
  }

  async function requireStaff(req: { headers: { authorization?: string } }, restaurantId: string) {
    const { userId, membership } = await requireMenuVenueMembership(prisma, req, restaurantId);
    return { user: { sub: userId }, membership };
  }

  async function assertCategoryRestaurant(categoryId: string, restaurantId: string) {
    const c = await prisma.menuCategory.findFirst({
      where: { id: categoryId, restaurantId }
    });
    if (!c) throw Object.assign(new Error("category_not_found"), { statusCode: 404 });
    return c;
  }

  async function assertItemRestaurant(itemId: string, restaurantId: string) {
    const item = await prisma.menuItem.findFirst({
      where: { id: itemId },
      include: { category: true }
    });
    if (!item || item.category.restaurantId !== restaurantId) {
      throw Object.assign(new Error("item_not_found"), { statusCode: 404 });
    }
    return item;
  }

  async function assertGroupRestaurant(groupId: string, restaurantId: string) {
    const g = await prisma.modifierGroup.findFirst({
      where: { id: groupId },
      include: { menuItem: { include: { category: true } } }
    });
    if (!g || g.menuItem.category.restaurantId !== restaurantId) {
      throw Object.assign(new Error("modifier_group_not_found"), { statusCode: 404 });
    }
    return g;
  }

  async function assertOptionRestaurant(optionId: string, restaurantId: string) {
    const o = await prisma.modifierOption.findFirst({
      where: { id: optionId },
      include: { group: { include: { menuItem: { include: { category: true } } } } }
    });
    if (!o || o.group.menuItem.category.restaurantId !== restaurantId) {
      throw Object.assign(new Error("modifier_option_not_found"), { statusCode: 404 });
    }
    return o;
  }

  app.get("/restaurants/restaurants", async (req) => {
    const user = requireUser(req);
    const memberships = await prisma.membership.findMany({
      where: { userId: user.sub },
      include: { restaurant: true }
    });
    type RestaurantRow = { id: string; name: string; companyId: string | null; establishmentLocation: string | null };
    return {
      ok: true,
      restaurants: memberships.map((m) => {
        const r = m.restaurant as unknown as RestaurantRow;
        return {
          id: r.id,
          name: r.name,
          role: m.role,
          status: m.status,
          companyId: r.companyId,
          establishmentLocation: r.establishmentLocation?.trim() || null
        };
      })
    };
  });

  const createRestaurantSchema = z.object({
    name: z.string().min(2),
    openingHours: z.string().optional(),
    companyId: z.string().min(1).optional()
  });

  app.post("/restaurants/restaurants", async (req, reply) => {
    const user = requireUser(req);

    const body = createRestaurantSchema.parse(req.body);

    const ownerMemberships = await prisma.membership.findMany({
      where: { userId: user.sub, role: "OWNER", status: "ACTIVE" },
      select: { restaurantId: true }
    });
    if (ownerMemberships.length === 0) {
      return reply
        .status(403)
        .send({ ok: false, error: "first_venue_requires_business_signup" });
    }

    type CompanyRef = { companyId: string | null };
    const ownerRestaurantIds = [...new Set(ownerMemberships.map((m) => m.restaurantId))];
    const ownerRestaurants = await prisma.restaurant.findMany({
      where: { id: { in: ownerRestaurantIds } }
    });
    const companyIdsKnown = [
      ...new Set(
        (ownerRestaurants as unknown as CompanyRef[])
          .map((r) => r.companyId)
          .filter((id): id is string => typeof id === "string" && id.length > 0)
      )
    ];

    let chosenCompanyId: string | null;

    if (companyIdsKnown.length === 0) {
      chosenCompanyId = body.companyId ?? null;
    } else if (body.companyId) {
      if (!companyIdsKnown.includes(body.companyId)) {
        return reply.status(403).send({ ok: false, error: "company_not_allowed" });
      }
      chosenCompanyId = body.companyId;
    } else if (companyIdsKnown.length === 1) {
      chosenCompanyId = companyIdsKnown[0]!;
    } else {
      return reply.status(400).send({ ok: false, error: "company_id_required" });
    }

    const restaurant = await prisma.restaurant.create({
      data: {
        name: body.name,
        openingHours: body.openingHours ?? null,
        companyId: chosenCompanyId
      } as Prisma.RestaurantUncheckedCreateInput
    });

    await prisma.membership.create({
      data: {
        userId: user.sub,
        restaurantId: restaurant.id,
        role: "OWNER"
      }
    });

    return { ok: true, restaurant };
  });

  app.get("/restaurants/public/menu/:restaurantId", async (req, reply) => {
    const { restaurantId } = req.params as { restaurantId: string };
    const browsable = await isCustomerBrowsableRestaurant(prisma, restaurantId);
    if (!browsable) return reply.status(404).send({ ok: false, error: "restaurant_not_found" });
    const menu = await buildPublishedPublicMenu(prisma, restaurantId);
    if (!menu) return reply.status(404).send({ ok: false, error: "menu_not_published" });
    return { ok: true, ...menu };
  });

  app.get("/restaurants/:restaurantId/menu", async (req, reply) => {
    const { restaurantId } = req.params as { restaurantId: string };
    const { membership } = await requireStaff(req, restaurantId);
    assertMenuEntityPermission("menu", "view", membership);
    const r = await prisma.restaurant.findUnique({ where: { id: restaurantId } });
    if (!r) throw Object.assign(new Error("restaurant_not_found"), { statusCode: 404 });
    try {
      const categories = await fetchMenuTree(prisma, restaurantId, { onlyActive: false });
      return {
        ok: true,
        restaurant: { id: r.id, name: r.name },
        categories: categories.map((cat) => ({
          ...cat,
          description: cat.description ?? null,
          items: cat.items.map((item) => ({
            ...item,
            description: item.description ?? null,
            ingredients: item.ingredients ?? null,
            specialNotes: item.specialNotes ?? null
          }))
        }))
      };
    } catch (err) {
      req.log.error({ err, restaurantId }, "menu_admin_load_failed");
      return reply.status(500).send({
        ok: false,
        error: "menu_load_failed",
        message: "Could not load menu for this venue. If this continues, contact support."
      });
    }
  });

  const createCategorySchema = z.object({
    name: z.string().trim().min(2).max(80),
    description: z.string().trim().max(280).optional(),
    menuId: z.string().min(1).optional(),
    sortOrder: z.number().int().optional(),
    isActive: z.boolean().optional()
  });

  app.post("/restaurants/:restaurantId/menu/categories", async (req, reply) => {
    const { restaurantId } = req.params as { restaurantId: string };
    const { membership } = await requireStaff(req, restaurantId);
    assertMenuEntityPermission("category", "create", membership);
    const body = createCategorySchema.parse(req.body);

    let menuId = body.menuId ?? null;
    if (menuId) {
      const menu = await prisma.menu.findFirst({
        where: { id: menuId, restaurantId, status: { not: "ARCHIVED" } },
        select: { id: true }
      });
      if (!menu) {
        return reply.status(404).send({ ok: false, error: "menu_not_found", message: "Menu not found for this venue." });
      }
    } else {
      const fallbackMenu = await prisma.menu.findFirst({
        where: { restaurantId, status: { not: "ARCHIVED" } },
        orderBy: { sortOrder: "asc" },
        select: { id: true }
      });
      if (!fallbackMenu) {
        return reply.status(400).send({
          ok: false,
          error: "category_requires_menu",
          message: "Create a menu before adding categories."
        });
      }
      menuId = fallbackMenu.id;
    }

    const sortOrder =
      body.sortOrder ??
      (await prisma.menuCategory.count({
        where: { restaurantId, menuId }
      }));

    const category = await prisma.menuCategory.create({
      data: {
        restaurantId,
        menuId,
        name: body.name.trim(),
        description: body.description?.trim() || null,
        sortOrder,
        isActive: body.isActive ?? true
      }
    });
    return { ok: true, category };
  });

  const patchCategorySchema = z.object({
    name: z.string().min(1).optional(),
    description: z.string().trim().max(280).nullable().optional(),
    sortOrder: z.number().int().optional(),
    isActive: z.boolean().optional(),
    menuId: z.string().min(1).nullable().optional()
  });

  app.patch("/restaurants/:restaurantId/menu/categories/:categoryId", async (req, reply) => {
    const { restaurantId, categoryId } = req.params as { restaurantId: string; categoryId: string };
    const { membership } = await requireStaff(req, restaurantId);
    assertMenuEntityPermission("category", "edit", membership);
    await assertCategoryRestaurant(categoryId, restaurantId);
    const body = patchCategorySchema.parse(req.body);

    if (body.menuId) {
      const menu = await prisma.menu.findFirst({
        where: { id: body.menuId, restaurantId, status: { not: "ARCHIVED" } },
        select: { id: true }
      });
      if (!menu) {
        return reply.status(404).send({ ok: false, error: "menu_not_found", message: "Menu not found for this venue." });
      }
    }

    const category = await prisma.menuCategory.update({
      where: { id: categoryId },
      data: {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.description !== undefined ? { description: body.description } : {}),
        ...(body.sortOrder !== undefined ? { sortOrder: body.sortOrder } : {}),
        ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
        ...(body.menuId !== undefined ? { menuId: body.menuId } : {})
      }
    });
    return { ok: true, category };
  });

  app.post("/restaurants/:restaurantId/menu/categories/:categoryId/duplicate", async (req, reply) => {
    const { restaurantId, categoryId } = req.params as { restaurantId: string; categoryId: string };
    const { membership } = await requireStaff(req, restaurantId);
    assertMenuEntityPermission("category", "create", membership);
    await assertCategoryRestaurant(categoryId, restaurantId);

    const source = await prisma.menuCategory.findFirst({
      where: { id: categoryId, restaurantId },
      include: { items: { include: { modifierGroups: { include: { options: true } } } } }
    });
    if (!source) {
      return reply.status(404).send({ ok: false, error: "category_not_found", message: "Category not found." });
    }

    const sortOrder = await prisma.menuCategory.count({
      where: { restaurantId, menuId: source.menuId }
    });

    const category = await prisma.$transaction(async (tx) => {
      const created = await tx.menuCategory.create({
        data: {
          restaurantId,
          menuId: source.menuId,
          name: `${source.name} (copy)`,
          description: source.description,
          sortOrder,
          isActive: false
        }
      });
      for (const item of source.items) {
        const newItem = await tx.menuItem.create({
          data: {
            categoryId: created.id,
            name: item.name,
            description: item.description,
            ingredients: item.ingredients,
            specialNotes: item.specialNotes,
            priceCents: item.priceCents,
            sortOrder: item.sortOrder,
            isActive: item.isActive
          }
        });
        for (const group of item.modifierGroups) {
          const newGroup = await tx.modifierGroup.create({
            data: {
              menuItemId: newItem.id,
              name: group.name,
              minSelect: group.minSelect,
              maxSelect: group.maxSelect,
              sortOrder: group.sortOrder
            }
          });
          for (const opt of group.options) {
            await tx.modifierOption.create({
              data: {
                modifierGroupId: newGroup.id,
                name: opt.name,
                priceDeltaCents: opt.priceDeltaCents,
                sortOrder: opt.sortOrder,
                isActive: opt.isActive
              }
            });
          }
        }
      }
      return created;
    });

    return reply.status(201).send({ ok: true, category: { id: category.id, name: category.name } });
  });

  app.delete("/restaurants/:restaurantId/menu/categories/:categoryId", async (req) => {
    const { restaurantId, categoryId } = req.params as { restaurantId: string; categoryId: string };
    const { membership } = await requireStaff(req, restaurantId);
    assertMenuEntityPermission("category", "delete", membership);
    await assertCategoryRestaurant(categoryId, restaurantId);
    await prisma.menuCategory.delete({ where: { id: categoryId } });
    return { ok: true };
  });

  const createItemSchema = z.object({
    categoryId: z.string(),
    name: z.string().min(1),
    description: z.string().optional(),
    ingredients: z.string().optional(),
    specialNotes: z.string().optional(),
    priceCents: z.number().int().nonnegative(),
    sortOrder: z.number().int().optional(),
    isActive: z.boolean().optional()
  });

  app.post("/restaurants/:restaurantId/menu/items", async (req) => {
    const { restaurantId } = req.params as { restaurantId: string };
    const { membership } = await requireStaff(req, restaurantId);
    assertMenuEntityPermission("item", "create", membership);
    const body = createItemSchema.parse(req.body);
    await assertCategoryRestaurant(body.categoryId, restaurantId);
    const item = await prisma.menuItem.create({
      data: {
        categoryId: body.categoryId,
        name: body.name,
        description: body.description,
        ingredients: body.ingredients,
        specialNotes: body.specialNotes,
        priceCents: body.priceCents,
        sortOrder: body.sortOrder ?? 0,
        isActive: body.isActive ?? true
      }
    });
    return { ok: true, item };
  });

  const patchItemSchema = z.object({
    categoryId: z.string().optional(),
    name: z.string().min(1).optional(),
    description: z.string().nullable().optional(),
    ingredients: z.string().nullable().optional(),
    specialNotes: z.string().nullable().optional(),
    priceCents: z.number().int().nonnegative().optional(),
    sortOrder: z.number().int().optional(),
    isActive: z.boolean().optional(),
    isSoldOut: z.boolean().optional(),
    lifecycle: z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]).optional()
  });

  app.patch("/restaurants/:restaurantId/menu/items/:itemId", async (req) => {
    const { restaurantId, itemId } = req.params as { restaurantId: string; itemId: string };
    const { membership } = await requireStaff(req, restaurantId);
    assertMenuEntityPermission("item", "edit", membership);
    await assertItemRestaurant(itemId, restaurantId);
    const body = patchItemSchema.parse(req.body);
    if (body.categoryId) await assertCategoryRestaurant(body.categoryId, restaurantId);
    const item = await prisma.menuItem.update({
      where: { id: itemId },
      data: body
    });
    return { ok: true, item };
  });

  app.post("/restaurants/:restaurantId/menu/items/:itemId/duplicate", async (req, reply) => {
    const { restaurantId, itemId } = req.params as { restaurantId: string; itemId: string };
    const { membership } = await requireStaff(req, restaurantId);
    assertMenuEntityPermission("item", "create", membership);
    await assertItemRestaurant(itemId, restaurantId);

    const source = await prisma.menuItem.findFirst({
      where: { id: itemId },
      include: { modifierGroups: { include: { options: true } }, category: { select: { restaurantId: true } } }
    });
    if (!source || source.category.restaurantId !== restaurantId) {
      return reply.status(404).send({ ok: false, error: "item_not_found", message: "Item not found." });
    }

    const sortOrder = await prisma.menuItem.count({ where: { categoryId: source.categoryId } });
    const created = await prisma.$transaction(async (tx) => {
      const item = await tx.menuItem.create({
        data: {
          categoryId: source.categoryId,
          name: `${source.name} (copy)`,
          description: source.description,
          ingredients: source.ingredients,
          specialNotes: source.specialNotes,
          priceCents: source.priceCents,
          sortOrder,
          isActive: false,
          isSoldOut: false,
          lifecycle: "DRAFT"
        }
      });
      for (const group of source.modifierGroups) {
        const newGroup = await tx.modifierGroup.create({
          data: {
            menuItemId: item.id,
            name: group.name,
            minSelect: group.minSelect,
            maxSelect: group.maxSelect,
            sortOrder: group.sortOrder
          }
        });
        for (const opt of group.options) {
          await tx.modifierOption.create({
            data: {
              modifierGroupId: newGroup.id,
              name: opt.name,
              priceDeltaCents: opt.priceDeltaCents,
              sortOrder: opt.sortOrder,
              isActive: opt.isActive
            }
          });
        }
      }
      return item;
    });

    return reply.status(201).send({ ok: true, item: { id: created.id, name: created.name } });
  });

  app.post("/restaurants/:restaurantId/menu/items/:itemId/copy", async (req, reply) => {
    const { restaurantId, itemId } = req.params as { restaurantId: string; itemId: string };
    const body = z.object({ categoryId: z.string().min(1) }).parse(req.body ?? {});
    const { membership } = await requireStaff(req, restaurantId);
    assertMenuEntityPermission("item", "create", membership);
    await assertItemRestaurant(itemId, restaurantId);
    await assertCategoryRestaurant(body.categoryId, restaurantId);

    const source = await prisma.menuItem.findFirst({
      where: { id: itemId },
      include: { modifierGroups: { include: { options: true } }, category: { select: { restaurantId: true } } }
    });
    if (!source || source.category.restaurantId !== restaurantId) {
      return reply.status(404).send({ ok: false, error: "item_not_found", message: "Item not found." });
    }

    const sortOrder = await prisma.menuItem.count({ where: { categoryId: body.categoryId } });
    const created = await prisma.$transaction(async (tx) => {
      const item = await tx.menuItem.create({
        data: {
          categoryId: body.categoryId,
          name: source.name,
          description: source.description,
          ingredients: source.ingredients,
          specialNotes: source.specialNotes,
          priceCents: source.priceCents,
          sortOrder,
          isActive: source.isActive,
          isSoldOut: source.isSoldOut,
          lifecycle: source.lifecycle
        }
      });
      for (const group of source.modifierGroups) {
        const newGroup = await tx.modifierGroup.create({
          data: {
            menuItemId: item.id,
            name: group.name,
            minSelect: group.minSelect,
            maxSelect: group.maxSelect,
            sortOrder: group.sortOrder
          }
        });
        for (const opt of group.options) {
          await tx.modifierOption.create({
            data: {
              modifierGroupId: newGroup.id,
              name: opt.name,
              priceDeltaCents: opt.priceDeltaCents,
              sortOrder: opt.sortOrder,
              isActive: opt.isActive
            }
          });
        }
      }
      return item;
    });

    return reply.status(201).send({ ok: true, item: { id: created.id, name: created.name } });
  });

  app.delete("/restaurants/:restaurantId/menu/items/:itemId", async (req) => {
    const { restaurantId, itemId } = req.params as { restaurantId: string; itemId: string };
    const { membership } = await requireStaff(req, restaurantId);
    assertMenuEntityPermission("item", "delete", membership);
    await assertItemRestaurant(itemId, restaurantId);
    await prisma.menuItem.delete({ where: { id: itemId } });
    return { ok: true };
  });

  const createGroupSchema = z.object({
    name: z.string().min(1),
    minSelect: z.number().int().nonnegative().optional(),
    maxSelect: z.number().int().nonnegative().optional(),
    sortOrder: z.number().int().optional()
  });

  app.post("/restaurants/:restaurantId/menu/items/:itemId/modifier-groups", async (req) => {
    const { restaurantId, itemId } = req.params as { restaurantId: string; itemId: string };
    const { membership } = await requireStaff(req, restaurantId);
    assertMenuEntityPermission("modifier_group", "create", membership);
    await assertItemRestaurant(itemId, restaurantId);
    const body = createGroupSchema.parse(req.body);
    const group = await prisma.modifierGroup.create({
      data: {
        menuItemId: itemId,
        name: body.name,
        minSelect: body.minSelect ?? 0,
        maxSelect: body.maxSelect ?? 1,
        sortOrder: body.sortOrder ?? 0
      }
    });
    return { ok: true, group };
  });

  const patchGroupSchema = z.object({
    name: z.string().min(1).optional(),
    minSelect: z.number().int().nonnegative().optional(),
    maxSelect: z.number().int().nonnegative().optional(),
    sortOrder: z.number().int().optional()
  });

  app.patch("/restaurants/:restaurantId/menu/modifier-groups/:groupId", async (req) => {
    const { restaurantId, groupId } = req.params as { restaurantId: string; groupId: string };
    const { membership } = await requireStaff(req, restaurantId);
    assertMenuEntityPermission("modifier_group", "edit", membership);
    await assertGroupRestaurant(groupId, restaurantId);
    const body = patchGroupSchema.parse(req.body);
    const group = await prisma.modifierGroup.update({ where: { id: groupId }, data: body });
    return { ok: true, group };
  });

  app.delete("/restaurants/:restaurantId/menu/modifier-groups/:groupId", async (req) => {
    const { restaurantId, groupId } = req.params as { restaurantId: string; groupId: string };
    const { membership } = await requireStaff(req, restaurantId);
    assertMenuEntityPermission("modifier_group", "delete", membership);
    await assertGroupRestaurant(groupId, restaurantId);
    await prisma.modifierGroup.delete({ where: { id: groupId } });
    return { ok: true };
  });

  const createOptionSchema = z.object({
    name: z.string().min(1),
    priceDeltaCents: z.number().int().optional(),
    sortOrder: z.number().int().optional(),
    isActive: z.boolean().optional()
  });

  app.post("/restaurants/:restaurantId/menu/modifier-groups/:groupId/options", async (req) => {
    const { restaurantId, groupId } = req.params as { restaurantId: string; groupId: string };
    const { membership } = await requireStaff(req, restaurantId);
    assertMenuEntityPermission("modifier_option", "create", membership);
    await assertGroupRestaurant(groupId, restaurantId);
    const body = createOptionSchema.parse(req.body);
    const option = await prisma.modifierOption.create({
      data: {
        modifierGroupId: groupId,
        name: body.name,
        priceDeltaCents: body.priceDeltaCents ?? 0,
        sortOrder: body.sortOrder ?? 0,
        isActive: body.isActive ?? true
      }
    });
    return { ok: true, option };
  });

  const patchOptionSchema = z.object({
    name: z.string().min(1).optional(),
    priceDeltaCents: z.number().int().optional(),
    sortOrder: z.number().int().optional(),
    isActive: z.boolean().optional()
  });

  app.patch("/restaurants/:restaurantId/menu/modifier-options/:optionId", async (req) => {
    const { restaurantId, optionId } = req.params as { restaurantId: string; optionId: string };
    const { membership } = await requireStaff(req, restaurantId);
    assertMenuEntityPermission("modifier_option", "edit", membership);
    await assertOptionRestaurant(optionId, restaurantId);
    const body = patchOptionSchema.parse(req.body);
    const option = await prisma.modifierOption.update({ where: { id: optionId }, data: body });
    return { ok: true, option };
  });

  app.delete("/restaurants/:restaurantId/menu/modifier-options/:optionId", async (req) => {
    const { restaurantId, optionId } = req.params as { restaurantId: string; optionId: string };
    const { membership } = await requireStaff(req, restaurantId);
    assertMenuEntityPermission("modifier_option", "delete", membership);
    await assertOptionRestaurant(optionId, restaurantId);
    await prisma.modifierOption.delete({ where: { id: optionId } });
    return { ok: true };
  });
}
