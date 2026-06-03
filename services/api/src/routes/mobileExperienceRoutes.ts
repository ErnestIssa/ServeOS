import type { FastifyInstance } from "fastify";
import type { PrismaClient } from "@prisma/client";
import { loadMobileAuthContext } from "../lib/mobileAuthContext.js";
import { buildWorkspaceContext } from "../lib/mobileWorkspaceService.js";

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

    return { ok: true, experience: ctx.experience, workspace };
  });
}
