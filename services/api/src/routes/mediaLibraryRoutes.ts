import type { FastifyInstance } from "fastify";
import type { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { createPresignedGetUrl, isObjectStorageConfigured } from "../lib/integrations/objectStorage.js";
import { requireMenuVenueMembership } from "../lib/menu/menuMembership.js";
import { assertMenuEntityPermission } from "../lib/menu/menuPermissions.js";
import {
  duplicateUsage,
  listVenueAssets,
  updateAssetMetadata
} from "../lib/media/library/assetService.js";
import { detachUsage, detachUsageByTarget, listAssetUsages } from "../lib/media/library/usageService.js";
import { getLibraryAssetDetail, queryLibraryAssets } from "../lib/media/library/libraryQueryService.js";
import {
  addAssetsToCollection,
  createCollection,
  deleteCollection,
  listCollections,
  removeAssetFromCollection,
  updateCollection
} from "../lib/media/library/collectionService.js";
import { replaceAssetFile, rollbackAssetVersion } from "../lib/media/library/versionService.js";
import {
  createUploadJob,
  getUploadJob,
  listUploadJobs,
  serializeUploadJob
} from "../lib/media/library/uploadJobService.js";
import { CLOUD_IMPORT_SOURCES } from "../lib/media/library/processingHooks.js";
import { getMediaSignedUrl } from "../lib/media/mediaService.js";

async function signedUrlForObjectKey(prisma: PrismaClient, objectKey: string) {
  if (!isObjectStorageConfigured()) return null;
  const media = await prisma.storedMedia.findFirst({
    where: { objectKey },
    orderBy: { createdAt: "desc" },
    select: { id: true }
  });
  if (media) {
    const signed = await getMediaSignedUrl(prisma, media.id);
    if (signed.ok) return signed.url;
  }
  try {
    return await createPresignedGetUrl(objectKey, { expiresInSeconds: 900 });
  } catch {
    return null;
  }
}

export function registerMediaLibraryRoutes(app: FastifyInstance, prisma: PrismaClient) {
  app.get("/restaurants/:restaurantId/media/library", async (req, reply) => {
    const params = z.object({ restaurantId: z.string().min(1) }).parse(req.params);
    const q = z
      .object({
        page: z.coerce.number().int().optional(),
        pageSize: z.coerce.number().int().optional(),
        q: z.string().optional(),
        type: z.enum(["image", "video", "all"]).optional(),
        used: z.enum(["true", "false"]).optional(),
        unused: z.enum(["true", "false"]).optional(),
        favorite: z.enum(["true", "false"]).optional(),
        archived: z.enum(["true", "false"]).optional(),
        needsAlt: z.enum(["true", "false"]).optional(),
        largeFiles: z.enum(["true", "false"]).optional(),
        recentlyUploaded: z.enum(["true", "false"]).optional(),
        collectionId: z.string().optional()
      })
      .parse(req.query ?? {});

    const { membership } = await requireMenuVenueMembership(prisma, req, params.restaurantId);
    assertMenuEntityPermission("media", "view", membership);

    const result = await queryLibraryAssets(prisma, params.restaurantId, {
      page: q.page,
      pageSize: q.pageSize,
      q: q.q,
      type: q.type === "all" ? undefined : q.type,
      used: q.used === "true",
      unused: q.unused === "true",
      favorite: q.favorite === "true",
      archived: q.archived === "true",
      needsAlt: q.needsAlt === "true",
      largeFiles: q.largeFiles === "true",
      recentlyUploaded: q.recentlyUploaded === "true",
      collectionId: q.collectionId
    });

    const assets = [];
    for (const a of result.assets) {
      const url = await signedUrlForObjectKey(prisma, a.objectKey);
      assets.push({ ...a, url });
    }

    return { ok: true, ...result, assets, cloudSources: CLOUD_IMPORT_SOURCES };
  });

  app.get("/restaurants/:restaurantId/media/library/:assetId", async (req, reply) => {
    const params = z
      .object({ restaurantId: z.string().min(1), assetId: z.string().min(1) })
      .parse(req.params);
    const { membership } = await requireMenuVenueMembership(prisma, req, params.restaurantId);
    assertMenuEntityPermission("media", "view", membership);

    const detail = await getLibraryAssetDetail(prisma, params.restaurantId, params.assetId);
    if (!detail) {
      return reply.status(404).send({ ok: false, error: "asset_not_found" });
    }

    const usages = await listAssetUsages(prisma, params.assetId, params.restaurantId);
    const url = await signedUrlForObjectKey(prisma, detail.objectKey);
    return { ok: true, asset: { ...detail, usages, url } };
  });

  app.patch("/restaurants/:restaurantId/media/library/:assetId", async (req, reply) => {
    const params = z
      .object({ restaurantId: z.string().min(1), assetId: z.string().min(1) })
      .parse(req.params);
    const body = z
      .object({
        displayName: z.string().max(200).nullable().optional(),
        altText: z.string().max(500).nullable().optional(),
        description: z.string().max(2000).nullable().optional(),
        tags: z.array(z.string().max(64)).max(40).optional(),
        favorite: z.boolean().optional(),
        archived: z.boolean().optional(),
        width: z.number().int().nullable().optional(),
        height: z.number().int().nullable().optional(),
        durationMs: z.number().int().nullable().optional()
      })
      .parse(req.body ?? {});

    const { membership } = await requireMenuVenueMembership(prisma, req, params.restaurantId);
    assertMenuEntityPermission("media", "edit", membership);

    const result = await updateAssetMetadata(prisma, params.assetId, params.restaurantId, body);
    if (!result.ok) return reply.status(404).send({ ok: false, error: result.error });
    return { ok: true, asset: { id: result.asset.id } };
  });

  app.post("/restaurants/:restaurantId/media/library/:assetId/replace", async (req, reply) => {
    const params = z
      .object({ restaurantId: z.string().min(1), assetId: z.string().min(1) })
      .parse(req.params);
    const body = z
      .object({
        dataBase64: z.string().min(1),
        contentType: z.string().optional(),
        note: z.string().max(200).optional(),
        purpose: z
          .enum(["menu_cover", "item_image", "logo", "item_video", "marketing_video", "general"])
          .optional()
      })
      .parse(req.body ?? {});

    const { userId, membership } = await requireMenuVenueMembership(prisma, req, params.restaurantId);
    assertMenuEntityPermission("media", "upload", membership);

    const result = await replaceAssetFile(prisma, {
      assetId: params.assetId,
      restaurantId: params.restaurantId,
      dataBase64: body.dataBase64,
      contentType: body.contentType,
      note: body.note,
      purpose: body.purpose,
      actorUserId: userId
    });
    if (!result.ok) {
      return reply.status(400).send({ ok: false, error: result.error });
    }
    return { ok: true, assetId: result.asset.id, versionNumber: result.versionNumber };
  });

  app.post("/restaurants/:restaurantId/media/library/:assetId/rollback", async (req, reply) => {
    const params = z
      .object({ restaurantId: z.string().min(1), assetId: z.string().min(1) })
      .parse(req.params);
    const body = z.object({ versionNumber: z.number().int().positive() }).parse(req.body ?? {});

    const { userId, membership } = await requireMenuVenueMembership(prisma, req, params.restaurantId);
    assertMenuEntityPermission("media", "edit", membership);

    const result = await rollbackAssetVersion(prisma, {
      assetId: params.assetId,
      restaurantId: params.restaurantId,
      versionNumber: body.versionNumber,
      actorUserId: userId
    });
    if (!result.ok) {
      return reply.status(400).send({ ok: false, error: result.error });
    }
    return { ok: true, assetId: result.asset.id, versionNumber: result.versionNumber };
  });

  app.post("/restaurants/:restaurantId/media/library/:assetId/attach", async (req, reply) => {
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
      return reply.status(404).send({ ok: false, error: result.error });
    }
    return reply.status(201).send({
      ok: true,
      usage: { id: result.usage.id },
      assetId: result.asset.id,
      storedMediaId: result.storedMediaId
    });
  });

  app.post("/restaurants/:restaurantId/media/library/:assetId/detach", async (req, reply) => {
    const params = z
      .object({ restaurantId: z.string().min(1), assetId: z.string().min(1) })
      .parse(req.params);
    const body = z
      .object({
        usageId: z.string().optional(),
        targetType: z.enum(["MENU_COVER", "MENU_ITEM", "CATEGORY", "VENUE_LOGO", "VENUE_COVER"]).optional(),
        targetId: z.string().optional(),
        role: z.string().optional()
      })
      .parse(req.body ?? {});

    const { membership } = await requireMenuVenueMembership(prisma, req, params.restaurantId);
    assertMenuEntityPermission("media", "remove", membership);

    if (body.usageId) {
      const result = await detachUsage(prisma, body.usageId);
      if (!result.ok) return reply.status(404).send({ ok: false, error: result.error });
      return { ok: true };
    }

    if (!body.targetType || !body.targetId) {
      return reply.status(400).send({ ok: false, error: "usage_or_target_required" });
    }

    const result = await detachUsageByTarget(prisma, {
      assetId: params.assetId,
      restaurantId: params.restaurantId,
      targetType: body.targetType,
      targetId: body.targetId,
      role: body.role
    });
    if (!result.ok) return reply.status(404).send({ ok: false, error: result.error });
    return { ok: true };
  });

  app.post("/restaurants/:restaurantId/media/library/:assetId/duplicate-usage", async (req, reply) => {
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
      return reply.status(404).send({ ok: false, error: result.error });
    }
    return reply.status(201).send({
      ok: true,
      usage: { id: result.usage.id },
      assetId: result.asset.id,
      storedMediaId: result.storedMediaId
    });
  });

  // Collections
  app.get("/restaurants/:restaurantId/media/collections", async (req) => {
    const params = z.object({ restaurantId: z.string().min(1) }).parse(req.params);
    const { membership } = await requireMenuVenueMembership(prisma, req, params.restaurantId);
    assertMenuEntityPermission("media", "view", membership);
    const collections = await listCollections(prisma, params.restaurantId);
    return { ok: true, collections };
  });

  app.post("/restaurants/:restaurantId/media/collections", async (req, reply) => {
    const params = z.object({ restaurantId: z.string().min(1) }).parse(req.params);
    const body = z
      .object({ name: z.string().min(1).max(120), description: z.string().max(500).nullable().optional() })
      .parse(req.body ?? {});
    const { membership } = await requireMenuVenueMembership(prisma, req, params.restaurantId);
    assertMenuEntityPermission("media", "edit", membership);
    const result = await createCollection(prisma, params.restaurantId, body);
    if (!result.ok) return reply.status(400).send({ ok: false, error: result.error });
    return reply.status(201).send({ ok: true, collection: result.collection });
  });

  app.patch("/restaurants/:restaurantId/media/collections/:collectionId", async (req, reply) => {
    const params = z
      .object({ restaurantId: z.string().min(1), collectionId: z.string().min(1) })
      .parse(req.params);
    const body = z
      .object({
        name: z.string().min(1).max(120).optional(),
        description: z.string().max(500).nullable().optional()
      })
      .parse(req.body ?? {});
    const { membership } = await requireMenuVenueMembership(prisma, req, params.restaurantId);
    assertMenuEntityPermission("media", "edit", membership);
    const result = await updateCollection(prisma, params.restaurantId, params.collectionId, body);
    if (!result.ok) return reply.status(404).send({ ok: false, error: result.error });
    return { ok: true, collection: result.collection };
  });

  app.delete("/restaurants/:restaurantId/media/collections/:collectionId", async (req, reply) => {
    const params = z
      .object({ restaurantId: z.string().min(1), collectionId: z.string().min(1) })
      .parse(req.params);
    const { membership } = await requireMenuVenueMembership(prisma, req, params.restaurantId);
    assertMenuEntityPermission("media", "delete", membership);
    const result = await deleteCollection(prisma, params.restaurantId, params.collectionId);
    if (!result.ok) return reply.status(404).send({ ok: false, error: result.error });
    return { ok: true };
  });

  app.post("/restaurants/:restaurantId/media/collections/:collectionId/items", async (req, reply) => {
    const params = z
      .object({ restaurantId: z.string().min(1), collectionId: z.string().min(1) })
      .parse(req.params);
    const body = z.object({ assetIds: z.array(z.string().min(1)).min(1).max(100) }).parse(req.body ?? {});
    const { membership } = await requireMenuVenueMembership(prisma, req, params.restaurantId);
    assertMenuEntityPermission("media", "edit", membership);
    const result = await addAssetsToCollection(
      prisma,
      params.restaurantId,
      params.collectionId,
      body.assetIds
    );
    if (!result.ok) return reply.status(404).send({ ok: false, error: result.error });
    return { ok: true };
  });

  app.delete(
    "/restaurants/:restaurantId/media/collections/:collectionId/items/:assetId",
    async (req, reply) => {
      const params = z
        .object({
          restaurantId: z.string().min(1),
          collectionId: z.string().min(1),
          assetId: z.string().min(1)
        })
        .parse(req.params);
      const { membership } = await requireMenuVenueMembership(prisma, req, params.restaurantId);
      assertMenuEntityPermission("media", "edit", membership);
      const result = await removeAssetFromCollection(
        prisma,
        params.restaurantId,
        params.collectionId,
        params.assetId
      );
      if (!result.ok) return reply.status(404).send({ ok: false, error: result.error });
      return { ok: true };
    }
  );

  // Upload jobs
  app.post("/restaurants/:restaurantId/media/upload-jobs", async (req, reply) => {
    const params = z.object({ restaurantId: z.string().min(1) }).parse(req.params);
    const body = z
      .object({
        originalName: z.string().max(200).optional(),
        contentType: z.string().optional(),
        purpose: z.string().optional()
      })
      .parse(req.body ?? {});
    const { userId, membership } = await requireMenuVenueMembership(prisma, req, params.restaurantId);
    assertMenuEntityPermission("media", "upload", membership);
    const job = await createUploadJob(prisma, {
      restaurantId: params.restaurantId,
      createdByUserId: userId,
      originalName: body.originalName,
      contentType: body.contentType,
      purpose: body.purpose
    });
    return reply.status(201).send({ ok: true, job: serializeUploadJob(job) });
  });

  app.get("/restaurants/:restaurantId/media/upload-jobs", async (req) => {
    const params = z.object({ restaurantId: z.string().min(1) }).parse(req.params);
    const { membership } = await requireMenuVenueMembership(prisma, req, params.restaurantId);
    assertMenuEntityPermission("media", "view", membership);
    const jobs = await listUploadJobs(prisma, params.restaurantId);
    return { ok: true, jobs: jobs.map(serializeUploadJob) };
  });

  app.get("/restaurants/:restaurantId/media/upload-jobs/:jobId", async (req, reply) => {
    const params = z
      .object({ restaurantId: z.string().min(1), jobId: z.string().min(1) })
      .parse(req.params);
    const { membership } = await requireMenuVenueMembership(prisma, req, params.restaurantId);
    assertMenuEntityPermission("media", "view", membership);
    const job = await getUploadJob(prisma, params.restaurantId, params.jobId);
    if (!job) return reply.status(404).send({ ok: false, error: "job_not_found" });
    return { ok: true, job: serializeUploadJob(job) };
  });

  // Legacy aliases (one release)
  app.get("/restaurants/:restaurantId/media/assets", async (req, reply) => {
    const params = z.object({ restaurantId: z.string().min(1) }).parse(req.params);
    const { membership } = await requireMenuVenueMembership(prisma, req, params.restaurantId);
    assertMenuEntityPermission("media", "view", membership);
    const assets = await listVenueAssets(prisma, params.restaurantId);
    const withUrls = [];
    for (const a of assets) {
      const url = await signedUrlForObjectKey(prisma, a.objectKey);
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
    return reply.status(201).send({
      ok: true,
      usage: { id: result.usage.id },
      assetId: result.asset.id,
      storedMediaId: result.storedMediaId
    });
  });
}
