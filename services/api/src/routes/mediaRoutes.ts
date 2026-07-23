import type { FastifyInstance } from "fastify";
import type { PrismaClient } from "@prisma/client";
import { z } from "zod";
import type { StorageScope } from "../lib/integrations/objectStorage.js";
import {
  attachRestaurantImage,
  createMediaUploadSession,
  deleteStoredMedia,
  getMediaSignedUrl,
  recordUploadedObject,
  refreshMediaCdnCache,
  uploadMediaBase64
} from "../lib/media/mediaService.js";
import { attachMenuItemCoverImage } from "../lib/menu/menuItemMediaService.js";
import { requireMenuVenueMembership } from "../lib/menu/menuMembership.js";
import { assertMenuEntityPermission } from "../lib/menu/menuPermissions.js";
import { toJwtRole } from "../plugins/auth.js";

const scopeSchema = z.enum([
  "profile",
  "restaurant",
  "menu",
  "chat",
  "video",
  "pdf",
  "invoice",
  "document",
  "attachment"
]);

function bearerUser(req: { headers: { authorization?: string } }, app: FastifyInstance) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) {
    throw Object.assign(new Error("missing_token"), { statusCode: 401 });
  }
  const token = auth.slice("Bearer ".length).trim();
  const payload = app.verifyJwt(token);
  return { userId: payload.sub, role: toJwtRole(payload.role) };
}

async function assertVenueMenuMediaUpload(
  prisma: PrismaClient,
  req: { headers: { authorization?: string } },
  restaurantId: string,
  scope: string
) {
  if (scope !== "menu" && scope !== "video") return;
  const { membership } = await requireMenuVenueMembership(prisma, req, restaurantId);
  assertMenuEntityPermission("media", "upload", membership);
}

export function registerMediaRoutes(app: FastifyInstance, prisma: PrismaClient) {
  app.post("/media/upload-session", async (req, reply) => {
    const { userId } = bearerUser(req, app);
    const body = z
      .object({
        scope: scopeSchema,
        contentType: z.string(),
        restaurantId: z.string().optional(),
        menuItemId: z.string().optional(),
        chatRoomId: z.string().optional(),
        originalName: z.string().max(200).optional()
      })
      .parse(req.body);

    if (body.restaurantId) {
      const member = await prisma.membership.findFirst({
        where: { userId, restaurantId: body.restaurantId, status: "ACTIVE" }
      });
      if (!member) return reply.status(403).send({ ok: false, error: "venue_access_denied" });
      await assertVenueMenuMediaUpload(prisma, req, body.restaurantId, body.scope);
    }

    const keyParts: string[] = [];
    if (body.scope === "profile") keyParts.push(userId);
    else if (body.scope === "menu") keyParts.push(body.restaurantId ?? "venue", body.menuItemId ?? "item");
    else if (body.scope === "chat") keyParts.push(body.chatRoomId ?? "room");
    else if (body.restaurantId) keyParts.push(body.restaurantId);
    else keyParts.push(userId);

    const result = await createMediaUploadSession({
      scope: body.scope as StorageScope,
      contentType: body.contentType,
      keyParts
    });
    if (!result.ok) return reply.status(result.error === "object_storage_not_configured" ? 503 : 400).send(result);
    return { ok: true, upload: result.upload, originalName: body.originalName ?? null };
  });

  app.post("/media/upload", async (req, reply) => {
    const { userId } = bearerUser(req, app);
    const body = z
      .object({
        scope: scopeSchema,
        objectKey: z.string().min(8),
        contentType: z.string(),
        dataBase64: z.string().min(20),
        restaurantId: z.string().optional(),
        menuItemId: z.string().optional(),
        chatRoomId: z.string().optional(),
        originalName: z.string().max(200).optional(),
        uploadJobId: z.string().optional(),
        displayName: z.string().max(200).optional(),
        altText: z.string().max(500).optional(),
        width: z.number().int().optional(),
        height: z.number().int().optional(),
        durationMs: z.number().int().optional()
      })
      .parse(req.body);

    const expectedPrefix = (() => {
      if (body.scope === "profile") return `profiles/${userId}/`;
      if (body.scope === "restaurant" && body.restaurantId) return `venues/${body.restaurantId}/`;
      if (body.scope === "menu" && body.restaurantId) return `venues/${body.restaurantId}/menu/`;
      if (body.scope === "chat" && body.chatRoomId) return `chat/${body.chatRoomId}/`;
      if (body.scope === "video" && body.restaurantId) return `venues/${body.restaurantId}/videos/`;
      if (body.scope === "invoice" && body.restaurantId) return `venues/${body.restaurantId}/invoices/`;
      if (body.scope === "pdf" || body.scope === "document") return "documents/";
      return "attachments/";
    })();
    if (!body.objectKey.startsWith(expectedPrefix)) {
      return reply.status(400).send({ ok: false, error: "invalid_object_key" });
    }

    if (body.restaurantId) {
      const member = await prisma.membership.findFirst({
        where: { userId, restaurantId: body.restaurantId, status: "ACTIVE" }
      });
      if (!member) return reply.status(403).send({ ok: false, error: "venue_access_denied" });
      await assertVenueMenuMediaUpload(prisma, req, body.restaurantId, body.scope);
    }

    const result = await uploadMediaBase64(prisma, {
      scope: body.scope as StorageScope,
      objectKey: body.objectKey,
      dataBase64: body.dataBase64,
      contentType: body.contentType,
      uploadedById: userId,
      restaurantId: body.restaurantId,
      userId: body.scope === "profile" ? userId : undefined,
      menuItemId: body.menuItemId,
      chatRoomId: body.chatRoomId,
      originalName: body.originalName,
      uploadJobId: body.uploadJobId,
      displayName: body.displayName,
      altText: body.altText,
      width: body.width,
      height: body.height,
      durationMs: body.durationMs
    });
    if (!result.ok) return reply.status(400).send(result);
    return { ok: true, media: result.media, assetId: result.assetId ?? null };
  });

  app.post("/media/complete", async (req, reply) => {
    const { userId } = bearerUser(req, app);
    const body = z
      .object({
        scope: scopeSchema,
        objectKey: z.string().min(8),
        contentType: z.string(),
        restaurantId: z.string().optional(),
        menuItemId: z.string().optional(),
        chatRoomId: z.string().optional(),
        originalName: z.string().max(200).optional(),
        uploadJobId: z.string().optional(),
        sha256Hex: z.string().optional()
      })
      .parse(req.body);

    if (body.restaurantId) {
      const member = await prisma.membership.findFirst({
        where: { userId, restaurantId: body.restaurantId, status: "ACTIVE" }
      });
      if (!member) return reply.status(403).send({ ok: false, error: "venue_access_denied" });
      await assertVenueMenuMediaUpload(prisma, req, body.restaurantId, body.scope);
    }

    const result = await recordUploadedObject(prisma, {
      scope: body.scope as StorageScope,
      objectKey: body.objectKey,
      contentType: body.contentType,
      uploadedById: userId,
      restaurantId: body.restaurantId,
      userId: body.scope === "profile" ? userId : undefined,
      menuItemId: body.menuItemId,
      chatRoomId: body.chatRoomId,
      originalName: body.originalName,
      uploadJobId: body.uploadJobId,
      sha256Hex: body.sha256Hex
    });
    if (!result.ok) return reply.status(400).send(result);
    return { ok: true, media: result.media, assetId: result.assetId ?? null };
  });

  app.get("/media/:mediaId/url", async (req, reply) => {
    bearerUser(req, app);
    const { mediaId } = z.object({ mediaId: z.string() }).parse(req.params);
    const result = await getMediaSignedUrl(prisma, mediaId);
    if (!result.ok) return reply.status(404).send(result);
    return { ok: true, url: result.url, media: result.media };
  });

  app.post("/media/:mediaId/refresh-cache", async (req, reply) => {
    const { userId } = bearerUser(req, app);
    const { mediaId } = z.object({ mediaId: z.string() }).parse(req.params);
    const media = await prisma.storedMedia.findUnique({ where: { id: mediaId } });
    if (!media) return reply.status(404).send({ ok: false, error: "media_not_found" });
    if (media.uploadedById && media.uploadedById !== userId) {
      const member = media.restaurantId
        ? await prisma.membership.findFirst({
            where: { userId, restaurantId: media.restaurantId, status: "ACTIVE" }
          })
        : null;
      if (!member) return reply.status(403).send({ ok: false, error: "forbidden" });
    }
    const result = await refreshMediaCdnCache(prisma, mediaId);
    if (!result.ok) {
      const status = result.error === "cloudflare_cdn_not_configured" ? 503 : 400;
      return reply.status(status).send(result);
    }
    return { ok: true, purged: result.purged, objectKey: result.objectKey };
  });

  app.delete("/media/:mediaId", async (req, reply) => {
    const { userId } = bearerUser(req, app);
    const { mediaId } = z.object({ mediaId: z.string() }).parse(req.params);
    const media = await prisma.storedMedia.findUnique({ where: { id: mediaId } });
    if (!media) return reply.status(404).send({ ok: false, error: "media_not_found" });
    if (media.uploadedById && media.uploadedById !== userId) {
      return reply.status(403).send({ ok: false, error: "forbidden" });
    }
    const result = await deleteStoredMedia(prisma, mediaId);
    if (!result.ok) return reply.status(400).send(result);
    return { ok: true };
  });

  app.post("/restaurants/:restaurantId/media/logo", async (req, reply) => {
    const { userId } = bearerUser(req, app);
    const params = z.object({ restaurantId: z.string() }).parse(req.params);
    const body = z.object({ mediaId: z.string() }).parse(req.body);
    const member = await prisma.membership.findFirst({
      where: { userId, restaurantId: params.restaurantId, status: "ACTIVE" }
    });
    if (!member) return reply.status(403).send({ ok: false, error: "venue_access_denied" });
    const result = await attachRestaurantImage(prisma, {
      restaurantId: params.restaurantId,
      mediaId: body.mediaId,
      kind: "logo"
    });
    if (!result.ok) return reply.status(400).send(result);
    return { ok: true, logoImageKey: result.objectKey };
  });

  app.post("/restaurants/:restaurantId/media/cover", async (req, reply) => {
    const { userId } = bearerUser(req, app);
    const params = z.object({ restaurantId: z.string() }).parse(req.params);
    const body = z.object({ mediaId: z.string() }).parse(req.body);
    const member = await prisma.membership.findFirst({
      where: { userId, restaurantId: params.restaurantId, status: "ACTIVE" }
    });
    if (!member) return reply.status(403).send({ ok: false, error: "venue_access_denied" });
    const result = await attachRestaurantImage(prisma, {
      restaurantId: params.restaurantId,
      mediaId: body.mediaId,
      kind: "cover"
    });
    if (!result.ok) return reply.status(400).send(result);
    return { ok: true, coverImageKey: result.objectKey };
  });

  app.post("/restaurants/:restaurantId/menu/items/:menuItemId/image", async (req, reply) => {
    const params = z.object({ restaurantId: z.string(), menuItemId: z.string() }).parse(req.params);
    const body = z.object({ mediaId: z.string() }).parse(req.body);
    const { membership } = await requireMenuVenueMembership(prisma, req, params.restaurantId);
    assertMenuEntityPermission("media", "upload", membership);
    const result = await attachMenuItemCoverImage(prisma, {
      restaurantId: params.restaurantId,
      menuItemId: params.menuItemId,
      mediaId: body.mediaId
    });
    if (!result.ok) return reply.status(400).send(result);
    return { ok: true, imageKey: result.media?.objectKey ?? null, media: result.media };
  });
}
