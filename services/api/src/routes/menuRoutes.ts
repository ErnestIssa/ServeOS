import type { FastifyInstance } from "fastify";
import type { PrismaClient } from "@prisma/client";
import { z } from "zod";
import {
  attachMenuItemMedia,
  listMenuItemMedia,
  mapMenuItemMediaError,
  removeMenuItemMedia,
  reorderMenuItemMedia
} from "../lib/menu/menuItemMediaService.js";
import { requireMenuVenueMembership } from "../lib/menu/menuMembership.js";
import {
  assertMenuEntityPermission,
  assertMenuPermission,
  getMenuCapabilities
} from "../lib/menu/menuPermissions.js";
import { createDraftMenu, listMenusForRestaurant, mapMenuApiError } from "../lib/menu/menuService.js";
import { exportMenuCsv, importMenuCsv, mapImportExportError } from "../lib/menu/menuImportExportService.js";
import {
  archiveMenuSurface,
  duplicateMenuSurface,
  mapMenuOpsError,
  scheduleMenuSurface,
  type MenuAvailabilityWindows
} from "../lib/menu/menuSurfaceOpsService.js";
import { mapPublishMenuError, publishMenuSurface } from "../lib/menu/menuPublishService.js";

const SURFACE_KEYS = ["main", "lunch", "dinner", "drinks", "seasonal", "custom"] as const;

const availabilityWindowSchema = z.object({
  enabled: z.boolean(),
  start: z.string(),
  end: z.string(),
  days: z.array(z.number().int())
});

export function registerMenuRoutes(app: FastifyInstance, prisma: PrismaClient) {
  app.get("/restaurants/:restaurantId/menus", async (req, reply) => {
    const { restaurantId } = z.object({ restaurantId: z.string().min(1) }).parse(req.params);
    const { userId, membership } = await requireMenuVenueMembership(prisma, req, restaurantId);
    assertMenuPermission("view", membership);

    const restaurant = await prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { id: true } });
    if (!restaurant) {
      return reply.status(404).send({ ok: false, error: "restaurant_not_found" });
    }

    const menus = await listMenusForRestaurant(prisma, restaurantId, userId);
    return { ok: true, menus };
  });

  const createSchema = z.object({
    name: z.string().trim().min(2).max(80),
    description: z.string().trim().max(280).optional(),
    surfaceKey: z.enum(SURFACE_KEYS).optional()
  });

  app.post("/restaurants/:restaurantId/menus", async (req, reply) => {
    const { restaurantId } = z.object({ restaurantId: z.string().min(1) }).parse(req.params);
    const body = createSchema.parse(req.body);
    const { userId, membership } = await requireMenuVenueMembership(prisma, req, restaurantId);
    assertMenuPermission("create", membership);

    const restaurant = await prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { id: true } });
    if (!restaurant) {
      return reply.status(404).send({ ok: false, error: "restaurant_not_found" });
    }

    try {
      const menu = await createDraftMenu(prisma, {
        restaurantId,
        createdByUserId: userId,
        name: body.name,
        description: body.description,
        surfaceKey: body.surfaceKey
      });
      return reply.status(201).send({ ok: true, menu });
    } catch (err) {
      const e = err as { message?: string; statusCode?: number };
      const code = e.message ?? "menu_create_failed";
      const status = e.statusCode ?? 400;
      return reply.status(status).send({
        ok: false,
        error: code,
        message: mapMenuApiError(code)
      });
    }
  });

  app.get("/restaurants/:restaurantId/menu/capabilities", async (req, reply) => {
    const { restaurantId } = z.object({ restaurantId: z.string().min(1) }).parse(req.params);
    const { membership } = await requireMenuVenueMembership(prisma, req, restaurantId);

    const restaurant = await prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { id: true } });
    if (!restaurant) {
      return reply.status(404).send({ ok: false, error: "restaurant_not_found" });
    }

    return { ok: true, capabilities: getMenuCapabilities(membership) };
  });

  app.post("/restaurants/:restaurantId/menus/:menuId/publish", async (req, reply) => {
    const params = z.object({ restaurantId: z.string().min(1), menuId: z.string().min(1) }).parse(req.params);
    const { userId, membership } = await requireMenuVenueMembership(prisma, req, params.restaurantId);
    assertMenuEntityPermission("menu", "publish", membership);

    const result = await publishMenuSurface(prisma, {
      restaurantId: params.restaurantId,
      menuId: params.menuId,
      publishedByUserId: userId
    });
    if (!result.ok) {
      return reply.status(400).send({
        ok: false,
        error: result.error,
        message: mapPublishMenuError(result.error)
      });
    }
    return { ok: true, menu: result.menu };
  });

  app.post("/restaurants/:restaurantId/menus/:menuId/archive", async (req, reply) => {
    const params = z.object({ restaurantId: z.string().min(1), menuId: z.string().min(1) }).parse(req.params);
    const { membership } = await requireMenuVenueMembership(prisma, req, params.restaurantId);
    assertMenuEntityPermission("menu", "archive", membership);

    const result = await archiveMenuSurface(prisma, params.restaurantId, params.menuId);
    if (!result.ok) {
      return reply.status(400).send({
        ok: false,
        error: result.error,
        message: mapMenuOpsError(result.error)
      });
    }
    return { ok: true };
  });

  app.post("/restaurants/:restaurantId/menus/:menuId/duplicate", async (req, reply) => {
    const params = z.object({ restaurantId: z.string().min(1), menuId: z.string().min(1) }).parse(req.params);
    const { userId, membership } = await requireMenuVenueMembership(prisma, req, params.restaurantId);
    assertMenuEntityPermission("menu", "create", membership);

    const result = await duplicateMenuSurface(prisma, params.restaurantId, params.menuId, userId);
    if (!result.ok) {
      return reply.status(400).send({
        ok: false,
        error: result.error,
        message: mapMenuOpsError(result.error)
      });
    }
    return reply.status(201).send({ ok: true, menu: result.menu });
  });

  app.patch("/restaurants/:restaurantId/menus/:menuId/schedule", async (req, reply) => {
    const params = z.object({ restaurantId: z.string().min(1), menuId: z.string().min(1) }).parse(req.params);
    const body = z
      .object({
        scheduledPublishAt: z.string().datetime().nullable().optional(),
        availabilityWindows: z.record(availabilityWindowSchema).optional()
      })
      .parse(req.body ?? {});
    const { membership } = await requireMenuVenueMembership(prisma, req, params.restaurantId);
    assertMenuEntityPermission("menu", "edit", membership);

    const result = await scheduleMenuSurface(prisma, params.restaurantId, params.menuId, {
      scheduledPublishAt: body.scheduledPublishAt ?? null,
      availabilityWindows: body.availabilityWindows as MenuAvailabilityWindows | undefined
    });
    if (!result.ok) {
      return reply.status(400).send({
        ok: false,
        error: result.error,
        message: mapMenuOpsError(result.error)
      });
    }
    return { ok: true, menu: result.menu };
  });

  app.get("/restaurants/:restaurantId/menu/export.csv", async (req, reply) => {
    const { restaurantId } = z.object({ restaurantId: z.string().min(1) }).parse(req.params);
    const { membership } = await requireMenuVenueMembership(prisma, req, restaurantId);
    assertMenuEntityPermission("menu", "view", membership);

    const csv = await exportMenuCsv(prisma, restaurantId);
    reply.header("Content-Type", "text/csv; charset=utf-8");
    reply.header("Content-Disposition", `attachment; filename="menu-${restaurantId}.csv"`);
    return reply.send(csv);
  });

  app.post("/restaurants/:restaurantId/menu/import.csv", async (req, reply) => {
    const { restaurantId } = z.object({ restaurantId: z.string().min(1) }).parse(req.params);
    const body = z.object({ csv: z.string().min(1) }).parse(req.body);
    const { membership } = await requireMenuVenueMembership(prisma, req, restaurantId);
    assertMenuEntityPermission("menu", "edit", membership);

    const result = await importMenuCsv(prisma, restaurantId, body.csv);
    if (!result.ok) {
      return reply.status(400).send({
        ok: false,
        error: result.error,
        message: mapImportExportError(result.error)
      });
    }
    return { ok: true, imported: result.imported };
  });

  app.get("/restaurants/:restaurantId/menu/items/:menuItemId/media", async (req, reply) => {
    const params = z
      .object({ restaurantId: z.string().min(1), menuItemId: z.string().min(1) })
      .parse(req.params);
    const { membership } = await requireMenuVenueMembership(prisma, req, params.restaurantId);
    assertMenuEntityPermission("media", "view", membership);

    try {
      const result = await listMenuItemMedia(prisma, params);
      return result;
    } catch (err) {
      const e = err as { message?: string; statusCode?: number };
      const code = e.message ?? "menu_media_failed";
      return reply.status(e.statusCode ?? 400).send({
        ok: false,
        error: code,
        message: mapMenuItemMediaError(code)
      });
    }
  });

  app.post("/restaurants/:restaurantId/menu/items/:menuItemId/media", async (req, reply) => {
    const params = z
      .object({ restaurantId: z.string().min(1), menuItemId: z.string().min(1) })
      .parse(req.params);
    const body = z
      .object({
        mediaId: z.string().min(1),
        setAsCover: z.boolean().optional(),
        durationMs: z.number().int().positive().max(120_000).optional()
      })
      .parse(req.body);
    const { membership } = await requireMenuVenueMembership(prisma, req, params.restaurantId);
    assertMenuEntityPermission("media", "upload", membership);

    const result = await attachMenuItemMedia(prisma, { ...params, ...body });
    if (!result.ok) {
      return reply.status(400).send({
        ok: false,
        error: result.error,
        message: mapMenuItemMediaError(result.error)
      });
    }
    return reply.status(201).send({ ok: true, media: result.media });
  });

  app.delete("/restaurants/:restaurantId/menu/items/:menuItemId/media/:mediaId", async (req, reply) => {
    const params = z
      .object({
        restaurantId: z.string().min(1),
        menuItemId: z.string().min(1),
        mediaId: z.string().min(1)
      })
      .parse(req.params);
    const { membership } = await requireMenuVenueMembership(prisma, req, params.restaurantId);
    assertMenuEntityPermission("media", "remove", membership);

    const result = await removeMenuItemMedia(prisma, params);
    if (!result.ok) {
      return reply.status(400).send({
        ok: false,
        error: result.error,
        message: mapMenuItemMediaError(result.error)
      });
    }
    return { ok: true };
  });

  app.patch("/restaurants/:restaurantId/menu/items/:menuItemId/media/order", async (req, reply) => {
    const params = z
      .object({ restaurantId: z.string().min(1), menuItemId: z.string().min(1) })
      .parse(req.params);
    const body = z.object({ orderedMediaIds: z.array(z.string().min(1)).min(1) }).parse(req.body);
    const { membership } = await requireMenuVenueMembership(prisma, req, params.restaurantId);
    assertMenuEntityPermission("media", "reorder", membership);

    const result = await reorderMenuItemMedia(prisma, { ...params, orderedMediaIds: body.orderedMediaIds });
    if (!result.ok) {
      return reply.status(400).send({
        ok: false,
        error: result.error,
        message: mapMenuItemMediaError(result.error)
      });
    }
    return { ok: true, media: result.media, counts: result.counts, limits: result.limits };
  });
}
