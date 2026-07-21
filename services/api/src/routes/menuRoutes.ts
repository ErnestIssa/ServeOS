import type { FastifyInstance } from "fastify";
import type { PrismaClient } from "@prisma/client";
import { z } from "zod";
import {
  attachMenuItemMedia,
  attachMenuSurfaceCoverMedia,
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
import {
  createDraftMenu,
  listMenusForRestaurant,
  mapMenuApiError,
  updateMenuSurface,
  type MenuListItem,
  type MenuListStatusFilter
} from "../lib/menu/menuService.js";
import {
  buildMenuManageContext,
  buildMenuRowActions,
  statusFilterToPanelVariant,
  type MenuPanelVariant
} from "../lib/menu/menuManageService.js";
import { exportMenuCsv, importMenuCsv, mapImportExportError } from "../lib/menu/menuImportExportService.js";
import {
  archiveMenuSurface,
  assertDangerMenuNameConfirmation,
  deleteDraftMenuSurface,
  deleteMenuSurface,
  duplicateMenuSurface,
  mapMenuOpsError,
  moveMenuSurface,
  scheduleMenuSurface,
  unpublishMenuSurface
} from "../lib/menu/menuSurfaceOpsService.js";
import { sanitizeAvailabilityWindows } from "../lib/menu/menuAvailability.js";
import {
  applyAvailabilityManageAction,
  listAvailabilityOverview,
  mapAvailabilityManageError
} from "../lib/menu/availabilityManageService.js";
import {
  compareMenuVersions,
  listMenuVersions,
  mapMenuReleaseError,
  previewMenuRelease,
  processDueMenuReleases,
  publishMenuRelease,
  rollbackMenuVersion
} from "../lib/menu/menuReleaseService.js";

const surfaceKeySchema = z
  .string()
  .trim()
  .min(2)
  .max(48)
  .regex(/^[a-z0-9][a-z0-9_-]*$/i);

const availabilityChannelSchema = z.enum(["DINE_IN", "TAKEAWAY", "DELIVERY", "QR", "KIOSK", "STAFF"]);

const availabilityWindowSchema = z.object({
  enabled: z.boolean(),
  start: z.string(),
  end: z.string(),
  days: z.array(z.number().int()),
  label: z.string().trim().min(1).max(48).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  scheduleKind: z.enum(["RECURRING", "TEMPORARY", "SEASONAL"]).optional(),
  temporaryStartAt: z.string().nullable().optional(),
  temporaryEndAt: z.string().nullable().optional(),
  seasonalStartMd: z.string().regex(/^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/).nullable().optional(),
  seasonalEndMd: z.string().regex(/^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/).nullable().optional(),
  channels: z.array(availabilityChannelSchema).optional(),
  locationMode: z.enum(["ALL", "SELECTED"]).optional(),
  locationIds: z.array(z.string().min(1)).optional(),
  visibility: z.enum(["CUSTOMERS", "HIDDEN", "STAFF_ONLY", "TESTING"]).optional(),
  outOfStock: z.boolean().optional(),
  requiresManagerApproval: z.boolean().optional(),
  ageRestricted: z.boolean().optional(),
  minAge: z.number().int().min(0).max(120).nullable().optional(),
  paused: z.boolean().optional(),
  history: z
    .array(
      z.object({
        at: z.string(),
        action: z.string(),
        detail: z.string().optional(),
        actorUserId: z.string().nullable().optional()
      })
    )
    .optional()
});

export function registerMenuRoutes(app: FastifyInstance, prisma: PrismaClient) {
  app.get("/restaurants/:restaurantId/menus", async (req, reply) => {
    const { restaurantId } = z.object({ restaurantId: z.string().min(1) }).parse(req.params);
    const query = z
      .object({
        status: z.enum(["active", "DRAFT", "PUBLISHED", "ARCHIVED"]).optional().default("active"),
        page: z.coerce.number().int().min(1).optional(),
        pageSize: z.coerce.number().int().min(1).max(100).optional()
      })
      .parse(req.query);
    const status = query.status as MenuListStatusFilter;
    const { userId, membership } = await requireMenuVenueMembership(prisma, req, restaurantId);
    assertMenuPermission("view", membership);

    const restaurant = await prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { id: true } });
    if (!restaurant) {
      return reply.status(404).send({ ok: false, error: "restaurant_not_found" });
    }

    try {
      const menus = await listMenusForRestaurant(prisma, restaurantId, userId, status);
      const panelVariant = statusFilterToPanelVariant(status);
      const menusWithActions = menus.map((menu: MenuListItem) => ({
        ...menu,
        rowActions: buildMenuRowActions(menu, panelVariant, membership)
      }));

      const total = menusWithActions.length;
      const pagingRequested = query.page != null || query.pageSize != null;
      const pageSize = pagingRequested ? (query.pageSize ?? 15) : Math.max(total, 1);
      const page = pagingRequested ? (query.page ?? 1) : 1;
      const totalPages = Math.max(1, Math.ceil(total / pageSize) || 1);
      const safePage = Math.min(page, totalPages);
      const start = (safePage - 1) * pageSize;
      const pageMenus = pagingRequested
        ? menusWithActions.slice(start, start + pageSize)
        : menusWithActions;

      return {
        ok: true,
        menus: pageMenus,
        pagination: {
          page: safePage,
          pageSize,
          total,
          totalPages,
          hasNextPage: safePage < totalPages,
          hasPrevPage: safePage > 1
        }
      };
    } catch (err) {
      req.log.error({ err, restaurantId }, "menu_surface_list_failed");
      return reply.status(500).send({
        ok: false,
        error: "menu_list_failed",
        message: "Could not load menus for this venue. If this continues, contact support."
      });
    }
  });

  const createSchema = z.object({
    name: z.string().trim().min(2).max(80),
    description: z.string().trim().max(280).optional(),
    surfaceKey: surfaceKeySchema.optional()
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

  app.patch("/restaurants/:restaurantId/menus/:menuId", async (req, reply) => {
    const { restaurantId, menuId } = z
      .object({ restaurantId: z.string().min(1), menuId: z.string().min(1) })
      .parse(req.params);
    const body = createSchema.parse(req.body);
    const { membership } = await requireMenuVenueMembership(prisma, req, restaurantId);
    assertMenuPermission("edit", membership);

    const restaurant = await prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { id: true } });
    if (!restaurant) {
      return reply.status(404).send({ ok: false, error: "restaurant_not_found" });
    }

    try {
      const menu = await updateMenuSurface(prisma, {
        restaurantId,
        menuId,
        name: body.name,
        description: body.description,
        surfaceKey: body.surfaceKey
      });
      return { ok: true, menu };
    } catch (err) {
      const e = err as { message?: string; statusCode?: number };
      const code = e.message ?? "menu_update_failed";
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

  app.get("/restaurants/:restaurantId/menus/manage-context", async (req, reply) => {
    const { restaurantId } = z.object({ restaurantId: z.string().min(1) }).parse(req.params);
    const query = z
      .object({
        variant: z.enum(["active", "live", "archived"]).default("active"),
        menuIds: z.string().optional()
      })
      .parse(req.query);

    const { userId, membership } = await requireMenuVenueMembership(prisma, req, restaurantId);
    assertMenuPermission("view", membership);

    const restaurant = await prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { id: true } });
    if (!restaurant) {
      return reply.status(404).send({ ok: false, error: "restaurant_not_found" });
    }

    const statusMap: Record<MenuPanelVariant, MenuListStatusFilter> = {
      active: "active",
      live: "PUBLISHED",
      archived: "ARCHIVED"
    };
    const status = statusMap[query.variant];
    const menuIds = query.menuIds
      ? query.menuIds.split(",").map((id) => id.trim()).filter(Boolean)
      : undefined;

    try {
      const menus = await listMenusForRestaurant(prisma, restaurantId, userId, status);
      const userMemberships = await prisma.membership.findMany({
        where: { userId },
        include: { restaurant: { select: { id: true, name: true } } }
      });
      const multiLocation = userMemberships.length > 1;
      const moveDestinations = userMemberships
        .filter((m) => m.restaurantId !== restaurantId)
        .map((m) => ({ id: m.restaurant.id, name: m.restaurant.name }));

      const context = buildMenuManageContext({
        menus,
        menuIds,
        panelVariant: query.variant,
        membership,
        multiLocation,
        moveDestinations
      });

      return { ok: true, context };
    } catch (err) {
      req.log.error({ err, restaurantId }, "menu_manage_context_failed");
      return reply.status(500).send({
        ok: false,
        error: "menu_manage_context_failed",
        message: "Could not load menu management context."
      });
    }
  });

  app.post("/restaurants/:restaurantId/menus/:menuId/publish", async (req, reply) => {
    const params = z.object({ restaurantId: z.string().min(1), menuId: z.string().min(1) }).parse(req.params);
    const body = z
      .object({
        releaseNotes: z.string().trim().max(500).nullable().optional(),
        requireChanges: z.boolean().optional()
      })
      .parse(req.body ?? {});
    const { userId, membership } = await requireMenuVenueMembership(prisma, req, params.restaurantId);
    assertMenuEntityPermission("menu", "publish", membership);

    try {
      const result = await publishMenuRelease(prisma, {
        restaurantId: params.restaurantId,
        menuId: params.menuId,
        publishedByUserId: userId,
        releaseNotes: body.releaseNotes,
        requireChanges: body.requireChanges ?? false
      });
      if (!result.ok) {
        return reply.status(400).send({
          ok: false,
          error: result.error,
          message: mapMenuReleaseError(result.error),
          validation: result.validation
        });
      }
      return {
        ok: true,
        menu: result.menu,
        report: result.report,
        changeSummary: result.changeSummary
      };
    } catch (err) {
      req.log.error({ err, menuId: params.menuId, restaurantId: params.restaurantId }, "menu_publish_failed");
      return reply.status(500).send({
        ok: false,
        error: "menu_publish_failed",
        message: "Could not publish menu. Check that categories and items are valid, then try again."
      });
    }
  });

  app.get("/restaurants/:restaurantId/menus/:menuId/release-preview", async (req, reply) => {
    const params = z.object({ restaurantId: z.string().min(1), menuId: z.string().min(1) }).parse(req.params);
    const { membership } = await requireMenuVenueMembership(prisma, req, params.restaurantId);
    assertMenuEntityPermission("menu", "view", membership);

    const result = await previewMenuRelease(prisma, params.restaurantId, params.menuId);
    if (!result.ok) {
      return reply.status(404).send({
        ok: false,
        error: result.error,
        message: mapMenuReleaseError(result.error)
      });
    }
    return { ok: true, preview: result.preview };
  });

  app.get("/restaurants/:restaurantId/menus/:menuId/versions", async (req, reply) => {
    const params = z.object({ restaurantId: z.string().min(1), menuId: z.string().min(1) }).parse(req.params);
    const { membership } = await requireMenuVenueMembership(prisma, req, params.restaurantId);
    assertMenuEntityPermission("menu", "view", membership);

    const result = await listMenuVersions(prisma, params.restaurantId, params.menuId);
    if (!result.ok) {
      return reply.status(404).send({
        ok: false,
        error: result.error,
        message: mapMenuReleaseError(result.error)
      });
    }
    return { ok: true, versions: result.versions };
  });

  app.get("/restaurants/:restaurantId/menus/:menuId/versions/compare", async (req, reply) => {
    const params = z.object({ restaurantId: z.string().min(1), menuId: z.string().min(1) }).parse(req.params);
    const query = z
      .object({
        from: z.coerce.number().int().min(1),
        to: z.coerce.number().int().min(1)
      })
      .parse(req.query);
    const { membership } = await requireMenuVenueMembership(prisma, req, params.restaurantId);
    assertMenuEntityPermission("menu", "view", membership);

    const result = await compareMenuVersions(
      prisma,
      params.restaurantId,
      params.menuId,
      query.from,
      query.to
    );
    if (!result.ok) {
      return reply.status(400).send({
        ok: false,
        error: result.error,
        message: mapMenuReleaseError(result.error)
      });
    }
    return { ok: true, compare: result.compare };
  });

  app.post("/restaurants/:restaurantId/menus/:menuId/rollback", async (req, reply) => {
    const params = z.object({ restaurantId: z.string().min(1), menuId: z.string().min(1) }).parse(req.params);
    const body = z.object({ versionNumber: z.number().int().min(1) }).parse(req.body ?? {});
    const { userId, membership } = await requireMenuVenueMembership(prisma, req, params.restaurantId);
    assertMenuEntityPermission("menu", "publish", membership);

    const result = await rollbackMenuVersion(prisma, {
      restaurantId: params.restaurantId,
      menuId: params.menuId,
      versionNumber: body.versionNumber,
      rolledBackByUserId: userId
    });
    if (!result.ok) {
      return reply.status(400).send({
        ok: false,
        error: result.error,
        message: mapMenuReleaseError(result.error)
      });
    }
    return { ok: true, menu: result.menu, report: result.report };
  });

  app.post("/restaurants/:restaurantId/menus/process-due-releases", async (req, reply) => {
    const params = z.object({ restaurantId: z.string().min(1) }).parse(req.params);
    const { membership } = await requireMenuVenueMembership(prisma, req, params.restaurantId);
    assertMenuEntityPermission("menu", "publish", membership);

    const results = await processDueMenuReleases(prisma);
    return { ok: true, results };
  });

  const dangerConfirmSchema = z.object({
    confirmName: z.string().min(1).max(120)
  });

  app.post("/restaurants/:restaurantId/menus/:menuId/archive", async (req, reply) => {
    const params = z.object({ restaurantId: z.string().min(1), menuId: z.string().min(1) }).parse(req.params);
    const body = dangerConfirmSchema.parse(req.body ?? {});
    const { membership } = await requireMenuVenueMembership(prisma, req, params.restaurantId);
    assertMenuEntityPermission("menu", "archive", membership);

    const confirmed = await assertDangerMenuNameConfirmation(
      prisma,
      params.restaurantId,
      params.menuId,
      body.confirmName
    );
    if (!confirmed.ok) {
      return reply.status(confirmed.error === "menu_not_found" ? 404 : 400).send({
        ok: false,
        error: confirmed.error,
        message: mapMenuOpsError(confirmed.error)
      });
    }

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

  app.delete("/restaurants/:restaurantId/menus/:menuId/draft", async (req, reply) => {
    const params = z.object({ restaurantId: z.string().min(1), menuId: z.string().min(1) }).parse(req.params);
    const body = dangerConfirmSchema.parse(req.body ?? {});
    const { membership } = await requireMenuVenueMembership(prisma, req, params.restaurantId);
    assertMenuEntityPermission("menu", "delete", membership);

    const confirmed = await assertDangerMenuNameConfirmation(
      prisma,
      params.restaurantId,
      params.menuId,
      body.confirmName
    );
    if (!confirmed.ok) {
      return reply.status(confirmed.error === "menu_not_found" ? 404 : 400).send({
        ok: false,
        error: confirmed.error,
        message: mapMenuOpsError(confirmed.error)
      });
    }

    const result = await deleteDraftMenuSurface(prisma, params.restaurantId, params.menuId);
    if (!result.ok) {
      return reply.status(400).send({
        ok: false,
        error: result.error,
        message: mapMenuOpsError(result.error)
      });
    }
    return { ok: true };
  });

  app.delete("/restaurants/:restaurantId/menus/:menuId", async (req, reply) => {
    const params = z.object({ restaurantId: z.string().min(1), menuId: z.string().min(1) }).parse(req.params);
    const body = dangerConfirmSchema.parse(req.body ?? {});
    const { membership } = await requireMenuVenueMembership(prisma, req, params.restaurantId);
    assertMenuEntityPermission("menu", "delete", membership);

    const confirmed = await assertDangerMenuNameConfirmation(
      prisma,
      params.restaurantId,
      params.menuId,
      body.confirmName
    );
    if (!confirmed.ok) {
      return reply.status(confirmed.error === "menu_not_found" ? 404 : 400).send({
        ok: false,
        error: confirmed.error,
        message: mapMenuOpsError(confirmed.error)
      });
    }

    const result = await deleteMenuSurface(prisma, params.restaurantId, params.menuId);
    if (!result.ok) {
      return reply.status(400).send({
        ok: false,
        error: result.error,
        message: mapMenuOpsError(result.error)
      });
    }
    return { ok: true, mode: result.mode };
  });

  app.post("/restaurants/:restaurantId/menus/:menuId/unpublish", async (req, reply) => {
    const params = z.object({ restaurantId: z.string().min(1), menuId: z.string().min(1) }).parse(req.params);
    const body = dangerConfirmSchema.parse(req.body ?? {});
    const { membership } = await requireMenuVenueMembership(prisma, req, params.restaurantId);
    assertMenuEntityPermission("menu", "publish", membership);

    const confirmed = await assertDangerMenuNameConfirmation(
      prisma,
      params.restaurantId,
      params.menuId,
      body.confirmName
    );
    if (!confirmed.ok) {
      return reply.status(confirmed.error === "menu_not_found" ? 404 : 400).send({
        ok: false,
        error: confirmed.error,
        message: mapMenuOpsError(confirmed.error)
      });
    }

    const result = await unpublishMenuSurface(prisma, params.restaurantId, params.menuId);
    if (!result.ok) {
      return reply.status(400).send({
        ok: false,
        error: result.error,
        message: mapMenuOpsError(result.error)
      });
    }
    return { ok: true };
  });

  app.post("/restaurants/:restaurantId/menus/:menuId/move", async (req, reply) => {
    const params = z.object({ restaurantId: z.string().min(1), menuId: z.string().min(1) }).parse(req.params);
    const body = z.object({ targetRestaurantId: z.string().min(1) }).parse(req.body);
    const { membership } = await requireMenuVenueMembership(prisma, req, params.restaurantId);
    assertMenuEntityPermission("menu", "edit", membership);
    await requireMenuVenueMembership(prisma, req, body.targetRestaurantId);

    const result = await moveMenuSurface(
      prisma,
      params.restaurantId,
      params.menuId,
      body.targetRestaurantId
    );
    if (!result.ok) {
      return reply.status(400).send({
        ok: false,
        error: result.error,
        message: mapMenuOpsError(result.error)
      });
    }
    return { ok: true, menu: result.menu };
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
        scheduledUnpublishAt: z.string().datetime().nullable().optional(),
        availabilityWindows: z.record(availabilityWindowSchema).optional()
      })
      .parse(req.body ?? {});
    const { membership } = await requireMenuVenueMembership(prisma, req, params.restaurantId);
    assertMenuEntityPermission("menu", "edit", membership);

    const result = await scheduleMenuSurface(prisma, params.restaurantId, params.menuId, {
      ...(body.scheduledPublishAt !== undefined ? { scheduledPublishAt: body.scheduledPublishAt } : {}),
      ...(body.scheduledUnpublishAt !== undefined ? { scheduledUnpublishAt: body.scheduledUnpublishAt } : {}),
      ...(body.availabilityWindows !== undefined
        ? { availabilityWindows: sanitizeAvailabilityWindows(body.availabilityWindows) ?? {} }
        : {})
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

  app.get("/restaurants/:restaurantId/availability", async (req, reply) => {
    const params = z.object({ restaurantId: z.string().min(1) }).parse(req.params);
    const { membership } = await requireMenuVenueMembership(prisma, req, params.restaurantId);
    assertMenuPermission("view", membership);

    const result = await listAvailabilityOverview(prisma, params.restaurantId);
    if (!result.ok) {
      return reply.status(404).send({
        ok: false,
        error: result.error,
        message: mapAvailabilityManageError(result.error)
      });
    }
    return result;
  });

  app.post("/restaurants/:restaurantId/availability/manage", async (req, reply) => {
    const params = z.object({ restaurantId: z.string().min(1) }).parse(req.params);
    const body = z
      .object({
        action: z.enum([
          "make_available",
          "make_unavailable",
          "set_recurring",
          "set_temporary",
          "set_seasonal",
          "mark_out_of_stock",
          "restock",
          "set_channels",
          "set_locations_all",
          "set_locations",
          "set_visibility",
          "set_business_rules",
          "copy_schedule",
          "copy_availability",
          "apply_to_menus",
          "reset_to_default",
          "remove_rules",
          "update_window",
          "export_rules",
          "import_schedule"
        ]),
        refs: z
          .array(z.object({ menuId: z.string().min(1), key: z.string().min(1) }))
          .default([]),
        patch: availabilityWindowSchema.partial().optional(),
        targetMenuIds: z.array(z.string().min(1)).optional(),
        importWindows: z.record(availabilityWindowSchema).optional()
      })
      .parse(req.body ?? {});

    const { userId, membership } = await requireMenuVenueMembership(prisma, req, params.restaurantId);
    assertMenuEntityPermission("menu", "edit", membership);

    const result = await applyAvailabilityManageAction(prisma, params.restaurantId, {
      action: body.action,
      refs: body.refs,
      patch: body.patch as never,
      targetMenuIds: body.targetMenuIds,
      importWindows: body.importWindows
        ? sanitizeAvailabilityWindows(body.importWindows) ?? undefined
        : undefined,
      actorUserId: userId
    });

    if (!result.ok) {
      return reply.status(400).send({
        ok: false,
        error: result.error,
        message: mapAvailabilityManageError(result.error)
      });
    }
    return result;
  });

  app.post("/restaurants/:restaurantId/menus/:menuId/cover-media", async (req, reply) => {
    const params = z.object({ restaurantId: z.string().min(1), menuId: z.string().min(1) }).parse(req.params);
    const body = z.object({ mediaId: z.string().min(1) }).parse(req.body);
    const { membership } = await requireMenuVenueMembership(prisma, req, params.restaurantId);
    assertMenuEntityPermission("media", "upload", membership);

    const result = await attachMenuSurfaceCoverMedia(prisma, {
      restaurantId: params.restaurantId,
      menuId: params.menuId,
      mediaId: body.mediaId
    });
    if (!result.ok) {
      return reply.status(400).send({
        ok: false,
        error: result.error,
        message: mapMenuItemMediaError(result.error)
      });
    }
    return { ok: true, coverMediaKey: result.coverMediaKey };
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
