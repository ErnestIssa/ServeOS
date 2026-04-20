import type { FastifyInstance } from "fastify";
import jwt from "jsonwebtoken";
import type { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { fetchMenuTree } from "../lib/menu.js";

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
    const user = requireUser(req);
    const m = await prisma.membership.findUnique({
      where: { userId_restaurantId: { userId: user.sub, restaurantId } }
    });
    if (!m || (m.role !== "OWNER" && m.role !== "STAFF")) {
      throw Object.assign(new Error("forbidden"), { statusCode: 403 });
    }
    return { user, membership: m };
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
    return {
      ok: true,
      restaurants: memberships.map((m: (typeof memberships)[number]) => ({
        id: m.restaurant.id,
        name: m.restaurant.name,
        role: m.role
      }))
    };
  });

  const createRestaurantSchema = z.object({
    name: z.string().min(2),
    openingHours: z.string().optional()
  });

  app.post("/restaurants/restaurants", async (req) => {
    const user = requireUser(req);
    const body = createRestaurantSchema.parse(req.body);

    const restaurant = await prisma.restaurant.create({
      data: {
        name: body.name,
        openingHours: body.openingHours
      }
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
    const r = await prisma.restaurant.findUnique({ where: { id: restaurantId } });
    if (!r) return reply.status(404).send({ ok: false, error: "restaurant_not_found" });
    const categories = await fetchMenuTree(prisma, restaurantId, { onlyActive: true });
    return { ok: true, restaurant: { id: r.id, name: r.name }, categories };
  });

  app.get("/restaurants/:restaurantId/menu", async (req) => {
    const { restaurantId } = req.params as { restaurantId: string };
    await requireStaff(req, restaurantId);
    const r = await prisma.restaurant.findUnique({ where: { id: restaurantId } });
    if (!r) throw Object.assign(new Error("restaurant_not_found"), { statusCode: 404 });
    const categories = await fetchMenuTree(prisma, restaurantId, { onlyActive: false });
    return { ok: true, restaurant: { id: r.id, name: r.name }, categories };
  });

  const createCategorySchema = z.object({
    name: z.string().min(1),
    sortOrder: z.number().int().optional(),
    isActive: z.boolean().optional()
  });

  app.post("/restaurants/:restaurantId/menu/categories", async (req) => {
    const { restaurantId } = req.params as { restaurantId: string };
    await requireStaff(req, restaurantId);
    const body = createCategorySchema.parse(req.body);
    const category = await prisma.menuCategory.create({
      data: {
        restaurantId,
        name: body.name,
        sortOrder: body.sortOrder ?? 0,
        isActive: body.isActive ?? true
      }
    });
    return { ok: true, category };
  });

  const patchCategorySchema = z.object({
    name: z.string().min(1).optional(),
    sortOrder: z.number().int().optional(),
    isActive: z.boolean().optional()
  });

  app.patch("/restaurants/:restaurantId/menu/categories/:categoryId", async (req) => {
    const { restaurantId, categoryId } = req.params as { restaurantId: string; categoryId: string };
    await requireStaff(req, restaurantId);
    await assertCategoryRestaurant(categoryId, restaurantId);
    const body = patchCategorySchema.parse(req.body);
    const category = await prisma.menuCategory.update({
      where: { id: categoryId },
      data: body
    });
    return { ok: true, category };
  });

  app.delete("/restaurants/:restaurantId/menu/categories/:categoryId", async (req) => {
    const { restaurantId, categoryId } = req.params as { restaurantId: string; categoryId: string };
    await requireStaff(req, restaurantId);
    await assertCategoryRestaurant(categoryId, restaurantId);
    await prisma.menuCategory.delete({ where: { id: categoryId } });
    return { ok: true };
  });

  const createItemSchema = z.object({
    categoryId: z.string(),
    name: z.string().min(1),
    description: z.string().optional(),
    priceCents: z.number().int().nonnegative(),
    sortOrder: z.number().int().optional(),
    isActive: z.boolean().optional()
  });

  app.post("/restaurants/:restaurantId/menu/items", async (req) => {
    const { restaurantId } = req.params as { restaurantId: string };
    await requireStaff(req, restaurantId);
    const body = createItemSchema.parse(req.body);
    await assertCategoryRestaurant(body.categoryId, restaurantId);
    const item = await prisma.menuItem.create({
      data: {
        categoryId: body.categoryId,
        name: body.name,
        description: body.description,
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
    priceCents: z.number().int().nonnegative().optional(),
    sortOrder: z.number().int().optional(),
    isActive: z.boolean().optional()
  });

  app.patch("/restaurants/:restaurantId/menu/items/:itemId", async (req) => {
    const { restaurantId, itemId } = req.params as { restaurantId: string; itemId: string };
    await requireStaff(req, restaurantId);
    await assertItemRestaurant(itemId, restaurantId);
    const body = patchItemSchema.parse(req.body);
    if (body.categoryId) await assertCategoryRestaurant(body.categoryId, restaurantId);
    const item = await prisma.menuItem.update({
      where: { id: itemId },
      data: body
    });
    return { ok: true, item };
  });

  app.delete("/restaurants/:restaurantId/menu/items/:itemId", async (req) => {
    const { restaurantId, itemId } = req.params as { restaurantId: string; itemId: string };
    await requireStaff(req, restaurantId);
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
    await requireStaff(req, restaurantId);
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
    await requireStaff(req, restaurantId);
    await assertGroupRestaurant(groupId, restaurantId);
    const body = patchGroupSchema.parse(req.body);
    const group = await prisma.modifierGroup.update({ where: { id: groupId }, data: body });
    return { ok: true, group };
  });

  app.delete("/restaurants/:restaurantId/menu/modifier-groups/:groupId", async (req) => {
    const { restaurantId, groupId } = req.params as { restaurantId: string; groupId: string };
    await requireStaff(req, restaurantId);
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
    await requireStaff(req, restaurantId);
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
    await requireStaff(req, restaurantId);
    await assertOptionRestaurant(optionId, restaurantId);
    const body = patchOptionSchema.parse(req.body);
    const option = await prisma.modifierOption.update({ where: { id: optionId }, data: body });
    return { ok: true, option };
  });

  app.delete("/restaurants/:restaurantId/menu/modifier-options/:optionId", async (req) => {
    const { restaurantId, optionId } = req.params as { restaurantId: string; optionId: string };
    await requireStaff(req, restaurantId);
    await assertOptionRestaurant(optionId, restaurantId);
    await prisma.modifierOption.delete({ where: { id: optionId } });
    return { ok: true };
  });
}
