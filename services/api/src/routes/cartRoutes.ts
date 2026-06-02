import type { FastifyInstance } from "fastify";
import jwt from "jsonwebtoken";
import type { PrismaClient } from "@prisma/client";
import { z } from "zod";
import {
  addItemToCustomerCart,
  CART_ORDER_NOTE_MAX_LEN,
  isCartHttpError,
  mutateCustomerCartLine,
  removeCustomerCartLine,
  serializeCustomerCart,
  updateCustomerCartOrderNote
} from "../lib/customerCartService.js";

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

function cartReply(err: unknown) {
  if (isCartHttpError(err)) {
    throw Object.assign(new Error(err.code), {
      statusCode: err.statusCode,
      meta: err.meta
    });
  }
  throw err;
}

export function registerCartRoutes(app: FastifyInstance, prisma: PrismaClient) {
  app.get("/cart/me", async (req) => {
    const user = requireCustomer(req);
    const q = req.query as { restaurantId?: string };
    const restaurantId = typeof q.restaurantId === "string" ? q.restaurantId.trim() : "";
    if (!restaurantId) throw Object.assign(new Error("restaurant_required"), { statusCode: 400 });

    try {
      const body = await serializeCustomerCart(prisma, user.sub, restaurantId);
      return { ok: true, ...body };
    } catch (err) {
      cartReply(err);
    }
  });

  app.patch("/cart/me", async (req) => {
    const user = requireCustomer(req);
    const body = z
      .object({
        restaurantId: z.string().min(1),
        orderNote: z.string().max(CART_ORDER_NOTE_MAX_LEN)
      })
      .parse(req.body);

    try {
      const serialized = await updateCustomerCartOrderNote(
        prisma,
        user.sub,
        body.restaurantId,
        body.orderNote
      );
      return { ok: true, ...serialized };
    } catch (err) {
      cartReply(err);
    }
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

    try {
      const serialized = await addItemToCustomerCart(prisma, user.sub, {
        restaurantId: body.restaurantId,
        menuItemId: body.menuItemId,
        quantity: body.quantity,
        modifierOptionIds: body.modifierOptionIds
      });
      return { ok: true, ...serialized };
    } catch (err) {
      cartReply(err);
    }
  });

  app.delete("/cart/me/lines/:lineId", async (req) => {
    const user = requireCustomer(req);
    const { lineId } = req.params as { lineId: string };
    const q = req.query as { confirmed?: string };
    const confirmed = q.confirmed === "1" || q.confirmed === "true";

    try {
      const serialized = await removeCustomerCartLine(prisma, user.sub, lineId, { confirmed });
      return { ok: true, ...serialized };
    } catch (err) {
      cartReply(err);
    }
  });

  app.patch("/cart/me/lines/:lineId", async (req) => {
    const user = requireCustomer(req);
    const { lineId } = req.params as { lineId: string };
    const body = z
      .object({
        quantity: z.number().int().min(0).optional(),
        delta: z.number().int().optional(),
        confirmRemove: z.boolean().optional()
      })
      .refine((b) => b.quantity !== undefined || b.delta !== undefined, {
        message: "quantity_or_delta_required"
      })
      .parse(req.body);

    try {
      const serialized = await mutateCustomerCartLine(prisma, user.sub, lineId, {
        quantity: body.quantity,
        delta: body.delta,
        confirmRemove: body.confirmRemove
      });
      return { ok: true, ...serialized };
    } catch (err) {
      cartReply(err);
    }
  });
}
