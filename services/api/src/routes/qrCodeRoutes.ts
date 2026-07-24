import type { FastifyInstance } from "fastify";
import type { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { requireMenuVenueMembership } from "../lib/menu/menuMembership.js";
import { assertMenuEntityPermission } from "../lib/menu/menuPermissions.js";
import {
  createQrCode,
  deactivateQrCode,
  duplicateQrCode,
  getQrCode,
  getQrDashboardStats,
  listQrCodes,
  mapQrCodeError,
  reactivateQrCode,
  rotateQrCode,
  updateQrCode
} from "../lib/qr/qrCodeManageService.js";
import { resolveQrPublicCode } from "../lib/qr/qrResolveService.js";

const qrTypeSchema = z.enum(["TABLE", "MENU", "TAKEAWAY", "STAFF", "MARKETING", "FEEDBACK"]);
const qrExperienceSchema = z.enum(["ORDERING", "MENU_BROWSE", "FEEDBACK", "PROMOTION", "RESERVATION"]);
const paymentModeSchema = z.enum(["PAY_AT_VENUE", "PREPAY", "HYBRID"]);
const qrStatusSchema = z.enum(["ACTIVE", "INACTIVE", "ROTATED"]);

const createBodySchema = z.object({
  name: z.string().trim().min(1).max(120),
  type: qrTypeSchema,
  experience: qrExperienceSchema.optional(),
  locationLabel: z.string().trim().max(120).nullable().optional(),
  areaLabel: z.string().trim().max(120).nullable().optional(),
  tableLabel: z.string().trim().max(80).nullable().optional(),
  tableId: z.string().trim().max(120).nullable().optional(),
  seatCount: z.number().int().min(1).max(100).nullable().optional(),
  paymentMode: paymentModeSchema.optional(),
  menuId: z.string().min(1).nullable().optional(),
  allowOrdering: z.boolean().optional(),
  headline: z.string().trim().max(80).nullable().optional(),
  showRestaurantLogo: z.boolean().optional(),
  showServeosBranding: z.boolean().optional()
});

const updateBodySchema = createBodySchema.partial().omit({ type: true });

export function registerQrCodeRoutes(app: FastifyInstance, prisma: PrismaClient) {
  /** Public resolve — scan permanent identity, spawn temporary session. */
  app.post("/public/qr/:publicCode/resolve", async (req, reply) => {
    const { publicCode } = z.object({ publicCode: z.string().min(1).max(64) }).parse(req.params);
    const result = await resolveQrPublicCode(prisma, publicCode);
    if (!result.ok) {
      const status =
        result.error === "experience_not_ready"
          ? 501
          : result.error === "qr_unavailable" || result.error === "qr_rotated"
            ? 410
            : 404;
      return reply.status(status).send(result);
    }
    return { ok: true, sessionId: result.sessionId, menuUrl: result.menuUrl, restaurantId: result.restaurantId, qr: result.qr };
  });

  app.get("/public/qr/:publicCode", async (req, reply) => {
    const { publicCode } = z.object({ publicCode: z.string().min(1).max(64) }).parse(req.params);
    const result = await resolveQrPublicCode(prisma, publicCode);
    if (!result.ok) {
      const status =
        result.error === "experience_not_ready"
          ? 501
          : result.error === "qr_unavailable" || result.error === "qr_rotated"
            ? 410
            : 404;
      return reply.status(status).send(result);
    }
    return { ok: true, sessionId: result.sessionId, menuUrl: result.menuUrl, restaurantId: result.restaurantId, qr: result.qr };
  });

  app.get("/restaurants/:restaurantId/qr-codes/stats", async (req) => {
    const { restaurantId } = z.object({ restaurantId: z.string().min(1) }).parse(req.params);
    const { membership } = await requireMenuVenueMembership(prisma, req, restaurantId);
    assertMenuEntityPermission("menu", "view", membership);
    const stats = await getQrDashboardStats(prisma, restaurantId);
    return { ok: true, stats };
  });

  app.get("/restaurants/:restaurantId/qr-codes", async (req) => {
    const { restaurantId } = z.object({ restaurantId: z.string().min(1) }).parse(req.params);
    const query = z
      .object({
        status: qrStatusSchema.optional(),
        type: qrTypeSchema.optional(),
        q: z.string().max(80).optional()
      })
      .parse(req.query ?? {});
    const { membership } = await requireMenuVenueMembership(prisma, req, restaurantId);
    assertMenuEntityPermission("menu", "view", membership);
    const items = await listQrCodes(prisma, restaurantId, query);
    return { ok: true, items };
  });

  app.post("/restaurants/:restaurantId/qr-codes", async (req, reply) => {
    const { restaurantId } = z.object({ restaurantId: z.string().min(1) }).parse(req.params);
    const body = createBodySchema.parse(req.body ?? {});
    const { membership, userId } = await requireMenuVenueMembership(prisma, req, restaurantId);
    assertMenuEntityPermission("menu", "publish", membership);

    const result = await createQrCode(prisma, {
      restaurantId,
      ...body,
      createdByUserId: userId
    });
    if (!result.ok) {
      return reply.status(400).send({
        ok: false,
        error: result.error,
        message: mapQrCodeError(result.error)
      });
    }
    return reply.status(201).send({ ok: true, qr: result.qr });
  });

  app.get("/restaurants/:restaurantId/qr-codes/:qrCodeId", async (req, reply) => {
    const params = z
      .object({ restaurantId: z.string().min(1), qrCodeId: z.string().min(1) })
      .parse(req.params);
    const { membership } = await requireMenuVenueMembership(prisma, req, params.restaurantId);
    assertMenuEntityPermission("menu", "view", membership);
    const result = await getQrCode(prisma, params.restaurantId, params.qrCodeId);
    if (!result.ok) {
      return reply.status(404).send({
        ok: false,
        error: result.error,
        message: mapQrCodeError(result.error)
      });
    }
    return { ok: true, qr: result.qr };
  });

  app.patch("/restaurants/:restaurantId/qr-codes/:qrCodeId", async (req, reply) => {
    const params = z
      .object({ restaurantId: z.string().min(1), qrCodeId: z.string().min(1) })
      .parse(req.params);
    const body = updateBodySchema.parse(req.body ?? {});
    const { membership } = await requireMenuVenueMembership(prisma, req, params.restaurantId);
    assertMenuEntityPermission("menu", "publish", membership);
    const result = await updateQrCode(prisma, params.restaurantId, params.qrCodeId, body);
    if (!result.ok) {
      return reply.status(400).send({
        ok: false,
        error: result.error,
        message: mapQrCodeError(result.error)
      });
    }
    return { ok: true, qr: result.qr };
  });

  app.post("/restaurants/:restaurantId/qr-codes/:qrCodeId/deactivate", async (req, reply) => {
    const params = z
      .object({ restaurantId: z.string().min(1), qrCodeId: z.string().min(1) })
      .parse(req.params);
    const { membership } = await requireMenuVenueMembership(prisma, req, params.restaurantId);
    assertMenuEntityPermission("menu", "publish", membership);
    const result = await deactivateQrCode(prisma, params.restaurantId, params.qrCodeId);
    if (!result.ok) {
      return reply.status(400).send({
        ok: false,
        error: result.error,
        message: mapQrCodeError(result.error)
      });
    }
    return { ok: true, qr: result.qr };
  });

  app.post("/restaurants/:restaurantId/qr-codes/:qrCodeId/reactivate", async (req, reply) => {
    const params = z
      .object({ restaurantId: z.string().min(1), qrCodeId: z.string().min(1) })
      .parse(req.params);
    const { membership } = await requireMenuVenueMembership(prisma, req, params.restaurantId);
    assertMenuEntityPermission("menu", "publish", membership);
    const result = await reactivateQrCode(prisma, params.restaurantId, params.qrCodeId);
    if (!result.ok) {
      return reply.status(400).send({
        ok: false,
        error: result.error,
        message: mapQrCodeError(result.error)
      });
    }
    return { ok: true, qr: result.qr };
  });

  app.post("/restaurants/:restaurantId/qr-codes/:qrCodeId/rotate", async (req, reply) => {
    const params = z
      .object({ restaurantId: z.string().min(1), qrCodeId: z.string().min(1) })
      .parse(req.params);
    const { membership, userId } = await requireMenuVenueMembership(prisma, req, params.restaurantId);
    assertMenuEntityPermission("menu", "publish", membership);
    const result = await rotateQrCode(prisma, params.restaurantId, params.qrCodeId, userId);
    if (!result.ok) {
      return reply.status(400).send({
        ok: false,
        error: result.error,
        message: mapQrCodeError(result.error)
      });
    }
    return { ok: true, qr: result.qr, previousId: result.previousId };
  });

  app.post("/restaurants/:restaurantId/qr-codes/:qrCodeId/duplicate", async (req, reply) => {
    const params = z
      .object({ restaurantId: z.string().min(1), qrCodeId: z.string().min(1) })
      .parse(req.params);
    const { membership, userId } = await requireMenuVenueMembership(prisma, req, params.restaurantId);
    assertMenuEntityPermission("menu", "publish", membership);
    const result = await duplicateQrCode(prisma, params.restaurantId, params.qrCodeId, userId);
    if (!result.ok) {
      return reply.status(400).send({
        ok: false,
        error: result.error,
        message: mapQrCodeError(result.error)
      });
    }
    return reply.status(201).send({ ok: true, qr: result.qr });
  });
}
