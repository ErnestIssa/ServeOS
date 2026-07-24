import type { FastifyInstance } from "fastify";
import type { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { isCustomerBrowsableRestaurant } from "../lib/customerRestaurantDirectory.js";
import { requireMenuVenueMembership } from "../lib/menu/menuMembership.js";
import { assertMenuEntityPermission } from "../lib/menu/menuPermissions.js";
import { buildPublishedPublicMenu } from "../lib/menu/publicMenuService.js";
import {
  assertOrderingSessionForRestaurant,
  createOrderingSession,
  getOrderingSession,
  mapOrderingSessionError,
  touchOrderingSession
} from "../lib/ordering/orderingSessionService.js";
import {
  addItemToSessionCart,
  clearSessionCart,
  isCartHttpError,
  mutateSessionCartLine,
  serializeSessionCart,
  updateSessionCartOrderNote
} from "../lib/ordering/sessionCartService.js";

export function registerOrderingSessionRoutes(app: FastifyInstance, prisma: PrismaClient) {
  app.get("/ordering-sessions/:sessionId", async (req, reply) => {
    const { sessionId } = z.object({ sessionId: z.string().min(1) }).parse(req.params);
    const result = await getOrderingSession(prisma, sessionId);
    if (!result.ok) {
      return reply.status(404).send({
        ok: false,
        error: result.error,
        message: mapOrderingSessionError(result.error)
      });
    }
    const browsable = await isCustomerBrowsableRestaurant(prisma, result.session.restaurantId);
    if (!browsable) {
      return reply.status(404).send({ ok: false, error: "restaurant_not_found" });
    }
    return { ok: true, session: result.session };
  });

  app.post("/ordering-sessions/:sessionId/touch", async (req, reply) => {
    const { sessionId } = z.object({ sessionId: z.string().min(1) }).parse(req.params);
    const result = await touchOrderingSession(prisma, sessionId);
    if (!result.ok) {
      return reply.status(404).send({
        ok: false,
        error: result.error,
        message: mapOrderingSessionError(result.error)
      });
    }
    return { ok: true, session: result.session };
  });

  app.get("/ordering-sessions/:sessionId/menu", async (req, reply) => {
    const { sessionId } = z.object({ sessionId: z.string().min(1) }).parse(req.params);
    const session = await getOrderingSession(prisma, sessionId);
    if (!session.ok) {
      return reply.status(404).send({
        ok: false,
        error: session.error,
        message: mapOrderingSessionError(session.error)
      });
    }
    const browsable = await isCustomerBrowsableRestaurant(prisma, session.session.restaurantId);
    if (!browsable) {
      return reply.status(404).send({ ok: false, error: "restaurant_not_found" });
    }
    const menu = await buildPublishedPublicMenu(prisma, session.session.restaurantId, {
      menuId: session.session.menuId,
      channel: "QR"
    });
    if (!menu) {
      return reply.status(404).send({ ok: false, error: "menu_not_published" });
    }
    return { ok: true, session: session.session, ...menu };
  });

  function sessionCartReply(err: unknown) {
    if (isCartHttpError(err)) {
      throw Object.assign(new Error(err.code), {
        statusCode: err.statusCode,
        meta: err.meta
      });
    }
    throw err;
  }

  app.get("/ordering-sessions/:sessionId/cart", async (req) => {
    const { sessionId } = z.object({ sessionId: z.string().min(1) }).parse(req.params);
    try {
      const body = await serializeSessionCart(prisma, sessionId);
      return { ok: true, ...body };
    } catch (err) {
      sessionCartReply(err);
    }
  });

  app.post("/ordering-sessions/:sessionId/cart/items", async (req) => {
    const { sessionId } = z.object({ sessionId: z.string().min(1) }).parse(req.params);
    const body = z
      .object({
        menuItemId: z.string().min(1),
        quantity: z.number().int().positive().optional(),
        modifierOptionIds: z.array(z.string()).optional()
      })
      .parse(req.body);
    try {
      const serialized = await addItemToSessionCart(prisma, sessionId, body);
      return { ok: true, ...serialized };
    } catch (err) {
      sessionCartReply(err);
    }
  });

  app.patch("/ordering-sessions/:sessionId/cart", async (req) => {
    const { sessionId } = z.object({ sessionId: z.string().min(1) }).parse(req.params);
    const body = z.object({ orderNote: z.string().max(2000) }).parse(req.body);
    try {
      const serialized = await updateSessionCartOrderNote(prisma, sessionId, body.orderNote);
      return { ok: true, ...serialized };
    } catch (err) {
      sessionCartReply(err);
    }
  });

  app.patch("/ordering-sessions/:sessionId/cart/lines/:lineId", async (req) => {
    const params = z.object({ sessionId: z.string().min(1), lineId: z.string().min(1) }).parse(req.params);
    const body = z
      .object({
        quantity: z.number().int().optional(),
        delta: z.number().int().optional(),
        confirmRemove: z.boolean().optional()
      })
      .parse(req.body ?? {});
    try {
      const serialized = await mutateSessionCartLine(prisma, params.sessionId, params.lineId, body);
      return { ok: true, ...serialized };
    } catch (err) {
      sessionCartReply(err);
    }
  });

  app.delete("/ordering-sessions/:sessionId/cart", async (req) => {
    const { sessionId } = z.object({ sessionId: z.string().min(1) }).parse(req.params);
    try {
      const serialized = await clearSessionCart(prisma, sessionId);
      return { ok: true, ...serialized };
    } catch (err) {
      sessionCartReply(err);
    }
  });

  app.get("/restaurants/:restaurantId/ordering-sessions/:sessionId/qr", async (req, reply) => {
    const params = z.object({ restaurantId: z.string().min(1), sessionId: z.string().min(1) }).parse(req.params);
    const { membership } = await requireMenuVenueMembership(prisma, req, params.restaurantId);
    assertMenuEntityPermission("menu", "publish", membership);

    const session = await assertOrderingSessionForRestaurant(prisma, params.sessionId, params.restaurantId);
    if (!session.ok) {
      return reply.status(400).send({
        ok: false,
        error: session.error,
        message: mapOrderingSessionError(session.error)
      });
    }

    const menuUrl = session.session.menuUrl;
    const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=512x512&data=${encodeURIComponent(menuUrl)}`;
    return {
      ok: true,
      sessionId: params.sessionId,
      menuUrl,
      qrImageUrl,
      pngDownloadUrl: `${qrImageUrl}&format=png`,
      pdfHint: "Use the PNG download and print, or share the menu link directly."
    };
  });

  const createBody = z.object({
    sessionType: z.enum(["QR_SESSION", "WALK_IN_SESSION", "LINK_SESSION", "STAFF_ASSISTED_SESSION"]).optional(),
    entryMode: z.string().max(40).optional(),
    tableId: z.string().max(120).optional(),
    tableLabel: z.string().max(80).optional(),
    locationId: z.string().max(120).optional(),
    paymentMode: z.enum(["PAY_AT_VENUE", "PREPAY", "HYBRID"]).optional(),
    ttlHours: z.number().int().min(1).max(48).optional()
  });

  app.post("/restaurants/:restaurantId/ordering-sessions", async (req, reply) => {
    const { restaurantId } = z.object({ restaurantId: z.string().min(1) }).parse(req.params);
    const body = createBody.parse(req.body ?? {});
    const { membership } = await requireMenuVenueMembership(prisma, req, restaurantId);
    assertMenuEntityPermission("menu", "publish", membership);

    const result = await createOrderingSession(prisma, { restaurantId, ...body });
    if (!result.ok) {
      return reply.status(400).send({
        ok: false,
        error: result.error,
        message: mapOrderingSessionError(result.error)
      });
    }
    return reply.status(201).send({ ok: true, session: result.session });
  });

  app.post("/restaurants/:restaurantId/ordering-sessions/guest", async (req, reply) => {
    const { restaurantId } = z.object({ restaurantId: z.string().min(1) }).parse(req.params);
    const body = createBody.parse(req.body ?? {});
    const browsable = await isCustomerBrowsableRestaurant(prisma, restaurantId);
    if (!browsable) {
      return reply.status(404).send({ ok: false, error: "restaurant_not_found" });
    }
    const result = await createOrderingSession(prisma, {
      restaurantId,
      sessionType: body.sessionType ?? "LINK_SESSION",
      entryMode: body.entryMode ?? "APP",
      paymentMode: body.paymentMode ?? "PAY_AT_VENUE",
      tableId: body.tableId,
      tableLabel: body.tableLabel,
      locationId: body.locationId,
      ttlHours: body.ttlHours
    });
    if (!result.ok) {
      return reply.status(400).send({
        ok: false,
        error: result.error,
        message: mapOrderingSessionError(result.error)
      });
    }
    return reply.status(201).send({ ok: true, session: result.session });
  });

  app.get("/menus/public/:restaurantId", async (req, reply) => {
    const { restaurantId } = z.object({ restaurantId: z.string().min(1) }).parse(req.params);
    const query = z
      .object({ sessionId: z.string().optional() })
      .parse(req.query ?? {});

    if (query.sessionId) {
      const session = await assertOrderingSessionForRestaurant(prisma, query.sessionId, restaurantId);
      if (!session.ok) {
        return reply.status(400).send({
          ok: false,
          error: session.error,
          message: mapOrderingSessionError(session.error)
        });
      }
    }

    const browsable = await isCustomerBrowsableRestaurant(prisma, restaurantId);
    if (!browsable) {
      return reply.status(404).send({ ok: false, error: "restaurant_not_found" });
    }

    const menu = await buildPublishedPublicMenu(prisma, restaurantId);
    if (!menu) {
      return reply.status(404).send({ ok: false, error: "menu_not_published" });
    }
    return { ok: true, ...menu };
  });
}
