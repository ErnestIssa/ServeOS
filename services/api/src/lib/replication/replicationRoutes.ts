import type { FastifyInstance } from "fastify";
import type { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { requireMenuVenueMembership } from "../menu/menuMembership.js";
import { assertMenuEntityPermission } from "../menu/menuPermissions.js";
import {
  cancelReplicationJob,
  enqueueReplicationJob,
  getReplicationJob,
  listReplicationJobs,
  serializeReplicationJob
} from "./replicationJobService.js";
import {
  deleteContentTemplate,
  enqueueApplyTemplate,
  listContentTemplates,
  saveMenuAsTemplate
} from "./contentTemplateService.js";
import { duplicateUsage, listVenueAssets } from "./mediaAssetService.js";
import { getMediaSignedUrl } from "../media/mediaService.js";

export function registerReplicationRoutes(app: FastifyInstance, prisma: PrismaClient) {
  app.get("/restaurants/:restaurantId/replication/jobs", async (req, reply) => {
    const params = z.object({ restaurantId: z.string().min(1) }).parse(req.params);
    await requireMenuVenueMembership(prisma, req, params.restaurantId);
    const jobs = await listReplicationJobs(prisma, params.restaurantId);
    return { ok: true, jobs };
  });

  app.get("/restaurants/:restaurantId/replication/jobs/:jobId", async (req, reply) => {
    const params = z
      .object({ restaurantId: z.string().min(1), jobId: z.string().min(1) })
      .parse(req.params);
    await requireMenuVenueMembership(prisma, req, params.restaurantId);
    const job = await getReplicationJob(prisma, params.jobId);
    if (
      !job ||
      (job.sourceRestaurantId !== params.restaurantId && job.targetRestaurantId !== params.restaurantId)
    ) {
      return reply.status(404).send({ ok: false, error: "job_not_found", message: "Job not found." });
    }
    return { ok: true, job: serializeReplicationJob(job) };
  });

  app.post("/restaurants/:restaurantId/replication/jobs/:jobId/cancel", async (req, reply) => {
    const params = z
      .object({ restaurantId: z.string().min(1), jobId: z.string().min(1) })
      .parse(req.params);
    const { userId } = await requireMenuVenueMembership(prisma, req, params.restaurantId);
    const result = await cancelReplicationJob(prisma, params.jobId, userId);
    if (!result.ok) {
      const status = result.error === "job_not_found" ? 404 : 400;
      return reply.status(status).send({ ok: false, error: result.error });
    }
    return { ok: true, job: result.job };
  });

  app.post("/restaurants/:restaurantId/menus/:menuId/duplicate-to-location", async (req, reply) => {
    const params = z
      .object({ restaurantId: z.string().min(1), menuId: z.string().min(1) })
      .parse(req.params);
    const body = z
      .object({
        targetRestaurantId: z.string().min(1),
        name: z.string().trim().min(2).max(80).optional(),
        copyCategories: z.boolean().optional(),
        copyAvailability: z.boolean().optional(),
        copyMedia: z.boolean().optional()
      })
      .parse(req.body ?? {});

    if (body.targetRestaurantId === params.restaurantId) {
      return reply.status(400).send({
        ok: false,
        error: "cannot_duplicate_to_same_restaurant",
        message: "Choose a different location."
      });
    }

    const { userId, membership: sourceMembership } = await requireMenuVenueMembership(
      prisma,
      req,
      params.restaurantId
    );
    assertMenuEntityPermission("menu", "create", sourceMembership);

    const { membership: targetMembership } = await requireMenuVenueMembership(
      prisma,
      req,
      body.targetRestaurantId
    );
    assertMenuEntityPermission("menu", "create", targetMembership);

    const source = await prisma.menu.findFirst({
      where: { id: params.menuId, restaurantId: params.restaurantId },
      select: { id: true }
    });
    if (!source) {
      return reply.status(404).send({ ok: false, error: "menu_not_found", message: "Menu not found." });
    }

    const job = await enqueueReplicationJob(prisma, {
      kind: "DUPLICATE_TO_LOCATION",
      sourceRestaurantId: params.restaurantId,
      targetRestaurantId: body.targetRestaurantId,
      actorUserId: userId,
      payload: {
        menuId: params.menuId,
        targetRestaurantId: body.targetRestaurantId,
        name: body.name,
        copyCategories: body.copyCategories,
        copyAvailability: body.copyAvailability,
        copyMedia: body.copyMedia
      }
    });

    return reply.status(202).send({ ok: true, jobId: job.id });
  });

  app.get("/restaurants/:restaurantId/content-templates", async (req) => {
    const params = z.object({ restaurantId: z.string().min(1) }).parse(req.params);
    await requireMenuVenueMembership(prisma, req, params.restaurantId);
    const templates = await listContentTemplates(prisma, params.restaurantId);
    return { ok: true, templates };
  });

  app.post("/restaurants/:restaurantId/menus/:menuId/save-as-template", async (req, reply) => {
    const params = z
      .object({ restaurantId: z.string().min(1), menuId: z.string().min(1) })
      .parse(req.params);
    const body = z
      .object({
        name: z.string().trim().min(2).max(80).optional(),
        description: z.string().trim().max(400).optional()
      })
      .parse(req.body ?? {});
    const { userId, membership } = await requireMenuVenueMembership(prisma, req, params.restaurantId);
    assertMenuEntityPermission("menu", "create", membership);

    const result = await saveMenuAsTemplate(prisma, {
      restaurantId: params.restaurantId,
      menuId: params.menuId,
      actorUserId: userId,
      name: body.name,
      description: body.description
    });
    if (!result.ok) {
      return reply.status(404).send({ ok: false, error: result.error, message: "Menu not found." });
    }
    req.log.info(
      { audit: { action: "template.created", templateId: result.template.id, menuId: params.menuId, actorUserId: userId } },
      "template.created"
    );
    return reply.status(201).send({ ok: true, template: result.template });
  });

  app.post("/restaurants/:restaurantId/content-templates/:templateId/apply", async (req, reply) => {
    const params = z
      .object({ restaurantId: z.string().min(1), templateId: z.string().min(1) })
      .parse(req.params);
    const body = z
      .object({
        targetRestaurantId: z.string().min(1).optional(),
        name: z.string().trim().min(2).max(80).optional()
      })
      .parse(req.body ?? {});

    const targetRestaurantId = body.targetRestaurantId ?? params.restaurantId;
    const { userId, membership } = await requireMenuVenueMembership(prisma, req, params.restaurantId);
    assertMenuEntityPermission("menu", "create", membership);

    if (targetRestaurantId !== params.restaurantId) {
      const { membership: targetMembership } = await requireMenuVenueMembership(
        prisma,
        req,
        targetRestaurantId
      );
      assertMenuEntityPermission("menu", "create", targetMembership);
    }

    const result = await enqueueApplyTemplate(prisma, {
      templateId: params.templateId,
      actorUserId: userId,
      targetRestaurantId,
      name: body.name
    });
    if (!result.ok) {
      return reply.status(404).send({ ok: false, error: result.error, message: "Template not found." });
    }
    return reply.status(202).send({ ok: true, jobId: result.jobId });
  });

  app.delete("/restaurants/:restaurantId/content-templates/:templateId", async (req, reply) => {
    const params = z
      .object({ restaurantId: z.string().min(1), templateId: z.string().min(1) })
      .parse(req.params);
    const { membership } = await requireMenuVenueMembership(prisma, req, params.restaurantId);
    assertMenuEntityPermission("menu", "delete", membership);
    const result = await deleteContentTemplate(prisma, {
      templateId: params.templateId,
      restaurantId: params.restaurantId
    });
    if (!result.ok) {
      return reply.status(404).send({ ok: false, error: result.error });
    }
    return { ok: true };
  });

  app.get("/restaurants/:restaurantId/media/assets", async (req, reply) => {
    const params = z.object({ restaurantId: z.string().min(1) }).parse(req.params);
    const { membership } = await requireMenuVenueMembership(prisma, req, params.restaurantId);
    assertMenuEntityPermission("media", "view", membership);
    const assets = await listVenueAssets(prisma, params.restaurantId);

    const withUrls = [];
    for (const a of assets) {
      const media = await prisma.storedMedia.findFirst({
        where: { objectKey: a.objectKey },
        orderBy: { createdAt: "desc" },
        select: { id: true }
      });
      let url: string | null = null;
      if (media) {
        const signed = await getMediaSignedUrl(prisma, media.id);
        url = signed.ok ? signed.url : null;
      }
      withUrls.push({ ...a, url });
    }
    return { ok: true, assets: withUrls };
  });

  app.post("/restaurants/:restaurantId/media/assets/:assetId/duplicate-usage", async (req, reply) => {
    const params = z
      .object({ restaurantId: z.string().min(1), assetId: z.string().min(1) })
      .parse(req.params);
    const body = z
      .object({
        targetType: z.enum(["MENU_COVER", "MENU_ITEM", "CATEGORY", "VENUE_LOGO", "VENUE_COVER"]),
        targetId: z.string().min(1),
        role: z.enum(["PRIMARY", "GALLERY", "COVER"]).optional(),
        sortOrder: z.number().int().optional()
      })
      .parse(req.body ?? {});

    const { userId, membership } = await requireMenuVenueMembership(prisma, req, params.restaurantId);
    assertMenuEntityPermission("media", "upload", membership);

    const result = await duplicateUsage(prisma, {
      assetId: params.assetId,
      restaurantId: params.restaurantId,
      targetType: body.targetType,
      targetId: body.targetId,
      role: body.role,
      sortOrder: body.sortOrder,
      actorUserId: userId
    });
    if (!result.ok) {
      return reply.status(404).send({ ok: false, error: result.error, message: "Asset not found." });
    }

    req.log.info(
      {
        audit: {
          action: "media.usage_duplicated",
          assetId: params.assetId,
          usageId: result.usage.id,
          actorUserId: userId
        }
      },
      "media.usage_duplicated"
    );
    return reply.status(201).send({
      ok: true,
      usage: { id: result.usage.id },
      assetId: result.asset.id,
      storedMediaId: result.storedMediaId
    });
  });
}
