import type { FastifyInstance } from "fastify";
import type { PrismaClient } from "@prisma/client";
import { z } from "zod";
import {
  loadMobileAuthContext,
  requireMobileAuth,
  setActiveRestaurantForUser
} from "../lib/mobileAuthContext.js";
import {
  buildWorkspaceContext,
  loadWorkspaceScreenData
} from "../lib/mobileWorkspaceService.js";
import { assertUserMayOpenScreen } from "../lib/mobileWorkspaceService.js";

export function registerMobileWorkspaceRoutes(app: FastifyInstance, prisma: PrismaClient) {
  app.get("/workspace/context", async (req, reply) => {
    const ctx = await requireMobileAuth(req, app, prisma);
    if (ctx.experience.roleType === "CUSTOMER") {
      return reply.status(403).send({ ok: false, error: "customer_use_customer_routes" });
    }
    return { ok: true, context: await buildWorkspaceContext(prisma, ctx) };
  });

  app.patch("/workspace/active-restaurant", async (req, reply) => {
    const ctx = await requireMobileAuth(req, app, prisma);
    const body = z.object({ restaurantId: z.string().min(1) }).parse(req.body);
    if (ctx.experience.roleType === "CUSTOMER") {
      return reply.status(403).send({ ok: false, error: "customer_use_customer_routes" });
    }
    const m = ctx.memberships.find((x) => x.restaurantId === body.restaurantId.trim());
    if (!m) return reply.status(403).send({ ok: false, error: "venue_access_denied" });
    await setActiveRestaurantForUser(prisma, ctx.userId, body.restaurantId);
    const fresh = await loadMobileAuthContext(prisma, ctx.userId);
    if (!fresh) return reply.status(404).send({ ok: false, error: "user_not_found" });
    return {
      ok: true,
      activeRestaurantId: fresh.activeRestaurantId,
      context: await buildWorkspaceContext(prisma, fresh)
    };
  });

  app.get<{ Params: { screenKey: string } }>("/workspace/screens/:screenKey", async (req, reply) => {
    const ctx = await requireMobileAuth(req, app, prisma);
    const { screenKey } = req.params;
    if (!assertUserMayOpenScreen(ctx, screenKey)) {
      return reply.status(403).send({ ok: false, error: "screen_not_allowed" });
    }
    const q = req.query as { restaurantId?: string };
    try {
      const data = await loadWorkspaceScreenData(
        prisma,
        ctx,
        screenKey,
        typeof q.restaurantId === "string" ? q.restaurantId : undefined
      );
      return { ok: true, ...data };
    } catch (e) {
      const err = e as { statusCode?: number; message?: string };
      return reply.status(err.statusCode ?? 500).send({ ok: false, error: err.message ?? "error" });
    }
  });
}
