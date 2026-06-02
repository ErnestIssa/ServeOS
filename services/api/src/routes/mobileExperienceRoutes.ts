import type { FastifyInstance } from "fastify";
import type { PrismaClient } from "@prisma/client";
import { buildMobileExperienceManifest } from "../lib/mobileExperience.js";
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

    const user = await prisma.user.findUnique({
      where: { id: sub },
      select: {
        role: true,
        signupProfile: true,
        memberships: { select: { role: true } }
      }
    });
    if (!user) return reply.status(404).send({ ok: false, error: "user_not_found" });

    const experience = buildMobileExperienceManifest({
      userRole: user.role,
      membershipRoles: user.memberships.map((m) => m.role),
      signupProfile: user.signupProfile
    });

    const workspace =
      experience.roleType !== "CUSTOMER"
        ? await buildWorkspaceContext(
            prisma,
            (await loadMobileAuthContext(prisma, user.sub))!
          )
        : null;

    return { ok: true, experience, workspace };
  });
}
