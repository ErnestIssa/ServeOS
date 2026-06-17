import type { FastifyInstance } from "fastify";
import type { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";
import { z } from "zod";
import { bearerUserId } from "../lib/mobileAuthContext.js";
import { requireActiveAdminAtVenue } from "../lib/venueAccessGuard.js";
import { requireMobileAuth } from "../lib/mobileAuthContext.js";
import {
  completeWorkspaceEnrollment,
  createCustomerInvitation,
  inviteEmailForToken,
  resolveWorkspaceInvite
} from "../lib/workspaceEnrollmentService.js";
import { toJwtRole } from "../plugins/auth.js";
import { notifyStaffPendingApproval } from "../notifications/integrations/staff.js";
import type { EventEmitter } from "node:events";

const SALT_ROUNDS = 10;

function optionalSessionUserId(
  req: { headers: { authorization?: string } },
  app: FastifyInstance
): string | undefined {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) return undefined;
  try {
    return bearerUserId(req.headers, app);
  } catch {
    return undefined;
  }
}

export function registerWorkspaceEnrollmentRoutes(
  app: FastifyInstance,
  prisma: PrismaClient,
  domainEventBus: EventEmitter
) {
  app.get("/workspace-enrollment/resolve", async (req, reply) => {
    const token = String((req.query as { token?: string }).token ?? "").trim();
    if (!token) return reply.status(400).send({ ok: false, error: "token_required" });

    const sessionUserId = optionalSessionUserId(req, app);
    const resolved = await resolveWorkspaceInvite(prisma, token, sessionUserId);
    if (!resolved.ok) {
      const status =
        resolved.status === "EXPIRED" ? 410 : resolved.status === "ALREADY_USED" ? 409 : 400;
      return reply.status(status).send({ ok: false, error: resolved.error, status: resolved.status });
    }
    return { ok: true, ...resolved };
  });

  app.post("/workspace-enrollment/accept", async (req, reply) => {
    const body = z
      .object({
        token: z.string().min(16),
        action: z.enum(["create_account", "use_existing", "merge_accounts"]),
        password: z.string().min(8).optional(),
        fullName: z.string().min(2).optional(),
        phone: z.string().min(6).optional(),
        mergeConfirm: z.boolean().optional()
      })
      .parse(req.body);

    const sessionUserId = optionalSessionUserId(req, app);

    if (body.action === "create_account" && !body.password) {
      return reply.status(400).send({ ok: false, error: "password_required" });
    }

    let passwordHash: string | undefined;
    if (body.action === "create_account" && body.password) {
      passwordHash = await bcrypt.hash(body.password, SALT_ROUNDS);
    }

    if (body.action === "use_existing" && !sessionUserId && body.password) {
      const resolved = await resolveWorkspaceInvite(prisma, body.token);
      if (!resolved.ok) {
        return reply.status(400).send({ ok: false, error: resolved.error });
      }
      const inviteEmail = await inviteEmailForToken(prisma, body.token);
      if (!inviteEmail) return reply.status(400).send({ ok: false, error: "invalid_token" });

      const user = await prisma.user.findFirst({
        where: { email: inviteEmail },
        select: { id: true, password: true }
      });
      if (!user) return reply.status(401).send({ ok: false, error: "login_required" });

      let valid = false;
      if (user.password.startsWith("$2")) {
        valid = await bcrypt.compare(body.password, user.password);
      } else {
        valid = user.password === body.password;
      }
      if (!valid) return reply.status(401).send({ ok: false, error: "invalid_credentials" });

      try {
        const result = await completeWorkspaceEnrollment(prisma, {
          token: body.token,
          action: "use_existing",
          sessionUserId: user.id,
          fullName: body.fullName,
          phone: body.phone
        });
        const dbUser = await prisma.user.findUnique({
          where: { id: result.userId },
          select: { id: true, email: true, phone: true, role: true, signupProfile: true }
        });
        const token = app.signJwt({
          sub: result.userId,
          role: toJwtRole(dbUser?.role ?? result.intendedRole)
        });
        return await enrollmentSuccessResponse(prisma, domainEventBus, result, token, dbUser);
      } catch (e: unknown) {
        const err = e as { statusCode?: number; message?: string };
        return reply.status(err.statusCode ?? 400).send({ ok: false, error: err.message ?? "accept_failed" });
      }
    }

    try {
      const result = await completeWorkspaceEnrollment(prisma, {
        token: body.token,
        action: body.action,
        sessionUserId,
        passwordHash,
        fullName: body.fullName,
        phone: body.phone,
        mergeConfirm: body.mergeConfirm
      });

      const dbUser = await prisma.user.findUnique({
        where: { id: result.userId },
        select: { id: true, email: true, phone: true, role: true, signupProfile: true }
      });
      const token = app.signJwt({
        sub: result.userId,
        role: toJwtRole(dbUser?.role ?? result.intendedRole)
      });
      return await enrollmentSuccessResponse(prisma, domainEventBus, result, token, dbUser);
    } catch (e: unknown) {
      const err = e as { statusCode?: number; message?: string };
      return reply.status(err.statusCode ?? 400).send({ ok: false, error: err.message ?? "accept_failed" });
    }
  });

  app.post("/restaurants/:restaurantId/customer-invitations", async (req, reply) => {
    const ctx = await requireMobileAuth(req, app, prisma);
    const restaurantId = String((req.params as { restaurantId: string }).restaurantId);
    await requireActiveAdminAtVenue(prisma, ctx, restaurantId);

    const body = z
      .object({
        email: z.string().email(),
        fullName: z.string().min(2).optional(),
        phone: z.string().min(6).optional()
      })
      .parse(req.body);

    try {
      const created = await createCustomerInvitation(prisma, {
        restaurantId,
        email: body.email,
        fullName: body.fullName,
        phone: body.phone,
        invitedByUserId: ctx.userId
      });
      return {
        ok: true,
        invitationId: created.invitationId,
        expiresAt: created.expiresAt.toISOString(),
        acceptUrl: created.acceptUrl
      };
    } catch (e: unknown) {
      const err = e as { statusCode?: number; message?: string };
      return reply.status(err.statusCode ?? 500).send({ ok: false, error: err.message ?? "error" });
    }
  });
}

async function enrollmentSuccessResponse(
  prisma: PrismaClient,
  domainEventBus: EventEmitter,
  result: Awaited<ReturnType<typeof completeWorkspaceEnrollment>>,
  token: string,
  dbUser: {
    id: string;
    email: string | null;
    phone: string | null;
    role: string;
    signupProfile: unknown;
  } | null
) {
  if (result.pendingApproval) {
    const venue = await prisma.restaurant.findUnique({
      where: { id: result.restaurantId },
      select: { name: true }
    });
    const membership = await prisma.membership.findUnique({
      where: { id: result.membershipId },
      select: { role: true }
    });
    await notifyStaffPendingApproval(domainEventBus, {
      restaurantId: result.restaurantId,
      restaurantName: venue?.name ?? "Venue",
      membershipId: result.membershipId,
      userId: result.userId,
      fullName:
        typeof (dbUser?.signupProfile as { fullName?: string } | null)?.fullName === "string"
          ? (dbUser!.signupProfile as { fullName: string }).fullName
          : null,
      role: membership?.role ?? result.intendedRole
    });
  }

  return {
    ok: true,
    token,
    user: dbUser
      ? {
          id: dbUser.id,
          email: dbUser.email,
          phone: dbUser.phone,
          role: dbUser.role
        }
      : { id: result.userId },
    pendingApproval: result.pendingApproval,
    restaurantId: result.restaurantId,
    intendedRole: result.intendedRole,
    redirectPath: result.redirectPath,
    merged: result.merged ?? false
  };
}
