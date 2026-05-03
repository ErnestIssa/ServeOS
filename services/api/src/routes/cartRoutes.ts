import type { FastifyInstance } from "fastify";
import jwt from "jsonwebtoken";
import type { PrismaClient } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { priceMenuItemLineInput, resolveQuickAddModifierOptionIds } from "../lib/menuItemLinePricing.js";

function requireCustomer(req: { headers: { authorization?: string } }) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw Object.assign(new Error("JWT_SECRET is required"), { statusCode: 500 });
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) {
    throw Object.assign(new Error("missing_token"), { statusCode: 401 });
  }
  const token = auth.slice("Bearer ".length);
  const p = jwt.verify(token, secret) as { sub: string; role: string };
  if (p.role !== "CUSTOMER") {
    throw Object.assign(new Error("forbidden"), { statusCode: 403 });
  }
  return p;
}

async function serializeCustomerCart(prisma: PrismaClient, userId: string, restaurantId: string) {
  const restaurant = await prisma.restaurant.findUnique({ where: { id: restaurantId } });
  if (!restaurant) throw Object.assign(new Error("restaurant_not_found"), { statusCode: 404 });

  const cart = await prisma.shoppingCart.findUnique({
    where: { userId_restaurantId: { userId, restaurantId } },
    include: {
      lines: {
        include: {
          menuItem: {
            select: {
              id: true,
              name: true,
              priceCents: true,
              isActive: true,
              category: { select: { restaurantId: true, isActive: true } }
            }
          }
        }
      }
    }
  });

  if (!cart) {
    return {
      cart: null as null,
      lines: [] as Array<{
        id: string;
        menuItemId: string;
        name: string;
        quantity: number;
        unitPriceCents: number;
        lineTotalCents: number;
        modifierOptionIds: string[];
        stale?: boolean;
      }>,
      subtotalCents: 0,
      lineCount: 0,
      totalQuantity: 0
    };
  }

  const linesOut: Array<{
    id: string;
    menuItemId: string;
    name: string;
    quantity: number;
    unitPriceCents: number;
    lineTotalCents: number;
    modifierOptionIds: string[];
    stale?: boolean;
  }> = [];

  let subtotalCents = 0;
  let totalQuantity = 0;

  for (const line of cart.lines) {
    const rawMods = Array.isArray(line.modifierOptionIds) ? (line.modifierOptionIds as string[]) : [];
    let stale = false;
    let name = line.menuItem.name;
    let unit = 0;
    let lineTotal = 0;
    try {
      const priced = await priceMenuItemLineInput(prisma, {
        restaurantId,
        menuItemId: line.menuItemId,
        quantity: 1,
        modifierOptionIds: rawMods
      });
      unit = priced.unitPriceCents;
      lineTotal = priced.unitPriceCents * line.quantity;
      name = priced.nameSnapshot;
    } catch {
      stale = true;
      unit = line.menuItem.priceCents;
      lineTotal = unit * line.quantity;
    }

    if (!line.menuItem.isActive || !line.menuItem.category.isActive || line.menuItem.category.restaurantId !== restaurantId) {
      stale = true;
    }

    subtotalCents += lineTotal;
    totalQuantity += line.quantity;
    linesOut.push({
      id: line.id,
      menuItemId: line.menuItemId,
      name,
      quantity: line.quantity,
      unitPriceCents: unit,
      lineTotalCents: lineTotal,
      modifierOptionIds: rawMods,
      ...(stale ? { stale: true } : {})
    });
  }

  return {
    cart: { id: cart.id, restaurantId: cart.restaurantId, updatedAt: cart.updatedAt },
    lines: linesOut,
    subtotalCents,
    lineCount: linesOut.length,
    totalQuantity
  };
}

export function registerCartRoutes(app: FastifyInstance, prisma: PrismaClient) {
  app.get("/cart/me", async (req) => {
    const user = requireCustomer(req);
    const q = req.query as { restaurantId?: string };
    const restaurantId = typeof q.restaurantId === "string" ? q.restaurantId.trim() : "";
    if (!restaurantId) throw Object.assign(new Error("restaurant_required"), { statusCode: 400 });

    const body = await serializeCustomerCart(prisma, user.sub, restaurantId);
    return { ok: true, ...body };
  });

  const addItemSchema = z.object({
    restaurantId: z.string(),
    menuItemId: z.string(),
    quantity: z.number().int().positive().optional(),
    modifierOptionIds: z.array(z.string()).optional()
  });

  app.post("/cart/me/items", async (req) => {
    const user = requireCustomer(req);
    const body = addItemSchema.parse(req.body);
    const restaurantId = body.restaurantId.trim();
    const qty = body.quantity ?? 1;

    const restaurant = await prisma.restaurant.findUnique({ where: { id: restaurantId } });
    if (!restaurant) throw Object.assign(new Error("restaurant_not_found"), { statusCode: 404 });

    const inferredMods = await resolveQuickAddModifierOptionIds(prisma, restaurantId, body.menuItemId, body.modifierOptionIds);

    await priceMenuItemLineInput(prisma, {
      restaurantId,
      menuItemId: body.menuItemId,
      quantity: 1,
      modifierOptionIds: inferredMods
    });

    const modJson = inferredMods as unknown as Prisma.InputJsonValue;

    const cart = await prisma.shoppingCart.upsert({
      where: { userId_restaurantId: { userId: user.sub, restaurantId } },
      create: { userId: user.sub, restaurantId },
      update: {}
    });

    const existing = await prisma.cartLine.findFirst({
      where: {
        cartId: cart.id,
        menuItemId: body.menuItemId,
        modifierOptionIds: { equals: modJson }
      }
    });

    if (existing) {
      await prisma.cartLine.update({
        where: { id: existing.id },
        data: { quantity: existing.quantity + qty }
      });
    } else {
      await prisma.cartLine.create({
        data: {
          cartId: cart.id,
          menuItemId: body.menuItemId,
          quantity: qty,
          modifierOptionIds: modJson
        }
      });
    }

    const serialized = await serializeCustomerCart(prisma, user.sub, restaurantId);
    return { ok: true, ...serialized };
  });

  app.delete("/cart/me/lines/:lineId", async (req) => {
    const user = requireCustomer(req);
    const { lineId } = req.params as { lineId: string };
    const line = await prisma.cartLine.findUnique({
      where: { id: lineId },
      include: { cart: true }
    });
    if (!line || line.cart.userId !== user.sub) {
      throw Object.assign(new Error("not_found"), { statusCode: 404 });
    }
    const rid = line.cart.restaurantId;
    await prisma.cartLine.delete({ where: { id: lineId } });
    const serialized = await serializeCustomerCart(prisma, user.sub, rid);
    return { ok: true, ...serialized };
  });

  app.patch("/cart/me/lines/:lineId", async (req) => {
    const user = requireCustomer(req);
    const { lineId } = req.params as { lineId: string };
    const body = z.object({ quantity: z.number().int().positive() }).parse(req.body);

    const line = await prisma.cartLine.findUnique({
      where: { id: lineId },
      include: { cart: true }
    });
    if (!line || line.cart.userId !== user.sub) {
      throw Object.assign(new Error("not_found"), { statusCode: 404 });
    }

    await prisma.cartLine.update({
      where: { id: lineId },
      data: { quantity: body.quantity }
    });
    const serialized = await serializeCustomerCart(prisma, user.sub, line.cart.restaurantId);
    return { ok: true, ...serialized };
  });
}
