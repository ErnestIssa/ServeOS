import type { FastifyInstance } from "fastify";
import type { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { toJwtRole } from "../plugins/auth.js";
import { assertBearerUserStillActive, assessWorkspaceAuthState } from "../lib/auth/authAccessGuard.js";
import { maskIp, requestIp, upsertUserSession } from "../lib/account/sessionService.js";
import { logSecurityActivity } from "../lib/account/securityActivity.js";
import { enrichUserWithExperience, publicUserFromDbRow } from "../lib/auth/authRouteHelpers.js";
import {
  businessProvisionSchema,
  provisionBusinessWorkspaceForUser
} from "../lib/businessProvisioningService.js";

const provisionBodySchema = z.object({
  registrationProfile: z.record(z.string(), z.any()).optional()
});

export function registerWorkspaceProvisioningRoutes(app: FastifyInstance, prisma: PrismaClient) {
  app.post("/workspaces/provision-business", async (req, reply) => {
    const auth = req.headers.authorization;
    if (!auth?.startsWith("Bearer ")) {
      return reply.status(401).send({ ok: false, error: "missing_token" });
    }
    const sessionToken = auth.slice("Bearer ".length).trim();

    let userId: string;
    try {
      userId = app.verifyJwt(sessionToken).sub;
    } catch {
      return reply.status(401).send({ ok: false, error: "invalid_token" });
    }

    const active = await assertBearerUserStillActive(prisma, userId);
    if (!active.ok) {
      return reply.status(403).send({ ok: false, error: active.error });
    }

    const body = provisionBodySchema.parse(req.body ?? {});
    const reg = body.registrationProfile;
    if (!reg || typeof reg !== "object") {
      return reply.status(400).send({ ok: false, error: "invalid_registration_profile" });
    }

    const parsed = businessProvisionSchema.safeParse(reg);
    if (!parsed.success) {
      return reply.status(400).send({ ok: false, error: "invalid_registration_profile" });
    }

    try {
      const result = await provisionBusinessWorkspaceForUser(prisma, userId, parsed.data, {
        registrationProfile: reg as Record<string, unknown>
      });

      const dbUser = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          phone: true,
          role: true,
          signupProfile: true,
          accountProfile: { select: { fullName: true } }
        }
      });
      if (!dbUser) {
        return reply.status(404).send({ ok: false, error: "user_not_found" });
      }

      const token = app.signJwt({
        sub: userId,
        role: toJwtRole(dbUser.role)
      });
      const ua = typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : undefined;
      await upsertUserSession(prisma, {
        userId,
        token,
        userAgent: ua,
        ip: requestIp(req as { headers: Record<string, unknown>; ip?: string })
      });
      await logSecurityActivity(prisma, {
        userId,
        type: "LOGIN_SUCCESS",
        ipMasked: maskIp(requestIp(req as { headers: Record<string, unknown>; ip?: string })),
        metadata: { method: "provision_business" }
      }).catch(() => undefined);

      const user = await enrichUserWithExperience(
        prisma,
        userId,
        publicUserFromDbRow({
          ...dbUser,
          accountFullName: dbUser.accountProfile?.fullName ?? null
        })
      );
      const workspaceAuth = await assessWorkspaceAuthState(prisma, userId);

      return {
        ok: true,
        token,
        user,
        workspaceAuth,
        restaurantId: result.restaurantId,
        companyId: result.companyId,
        membershipId: result.membershipId
      };
    } catch (e: unknown) {
      const err = e as { statusCode?: number; message?: string };
      return reply.status(err.statusCode ?? 500).send({ ok: false, error: err.message ?? "provision_failed" });
    }
  });
}
