import type { FastifyInstance } from "fastify";
import type { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { loadMobileAuthContext, requireMobileAuth } from "../lib/mobileAuthContext.js";
import { buildWorkspaceContext } from "../lib/mobileWorkspaceService.js";
import {
  buildExperienceSwitcherPayload,
  setMobileActiveExperience
} from "../lib/mobileExperienceSwitcher.js";

function bearerSub(headers: { authorization?: string }, app: FastifyInstance): string | null {
  const auth = headers.authorization;
  if (!auth?.startsWith("Bearer ")) return null;
  try {
    return app.verifyJwt(auth.slice("Bearer ".length)).sub;
  } catch {
    return null;
  }
}

export function registerMobileExperienceRoutes(app: FastifyInstance, prisma: PrismaClient) {
  app.get("/mobile/experience", async (req, reply) => {
    const sub = bearerSub(req.headers as { authorization?: string }, app);
    if (!sub) return reply.status(401).send({ ok: false, error: "missing_token" });

    const ctx = await loadMobileAuthContext(prisma, sub);
    if (!ctx) return reply.status(404).send({ ok: false, error: "user_not_found" });

    const workspace =
      ctx.experience.roleType !== "CUSTOMER" && ctx.venueAccessState === "active"
        ? await buildWorkspaceContext(prisma, ctx)
        : null;

    return {
      ok: true,
      customerAccess: true,
      experience: ctx.experience,
      memberships: ctx.memberships,
      activeRestaurantId: ctx.activeRestaurantId,
      workspace
    };
  });

  app.get("/mobile/experience-switcher", async (req, reply) => {
    const ctx = await requireMobileAuth(req, app, prisma);
    const switcher = await buildExperienceSwitcherPayload(prisma, ctx.userId);
    return { ok: true, switcher };
  });

  app.patch("/mobile/active-experience", async (req, reply) => {
    const ctx = await requireMobileAuth(req, app, prisma);
    const body = z
      .discriminatedUnion("mode", [
        z.object({ mode: z.literal("CUSTOMER") }),
        z.object({ mode: z.literal("WORKSPACE"), restaurantId: z.string().min(1) })
      ])
      .parse(req.body);

    try {
      const result = await setMobileActiveExperience(prisma, ctx.userId, body);
      return {
        ok: true,
        experience: result.ctx.experience,
        switcher: result.switcher,
        workspace: result.workspace
      };
    } catch (e: unknown) {
      const err = e as { statusCode?: number; message?: string };
      return reply.status(err.statusCode ?? 400).send({ ok: false, error: err.message ?? "switch_failed" });
    }
  });
}
