import bcrypt from "bcrypt";
import type { EventEmitter } from "node:events";
import type { FastifyInstance } from "fastify";
import { Prisma, type PrismaClient } from "@prisma/client";
import { z } from "zod";
import { toJwtRole } from "../plugins/auth.js";
import { completeWorkspaceEnrollment, inviteEmailForToken } from "../lib/workspaceEnrollmentService.js";
import { notifyStaffPendingApproval } from "../notifications/integrations/staff.js";
import { isAuthTokenRevoked, revokeAuthToken } from "../lib/authTokenRevocation.js";
import { logSecurityActivity } from "../lib/account/securityActivity.js";
import { confirmPasswordReset, requestPasswordReset } from "../lib/account/passwordResetService.js";
import { maskIp, requestIp, revokeSessionByToken, upsertUserSession } from "../lib/account/sessionService.js";
import { captureAuthFailure } from "../lib/integrations/sentry.js";
import { verifyTwoFactorTotpCode } from "../lib/account/twoFactorService.js";
import {
  requestTwoFactorSmsCode,
  verifyTwoFactorSmsCode
} from "../lib/account/twoFactorSmsFallback.js";
import { isSmsProviderConfigured } from "../lib/integrations/smsProvider.js";
import {
  assertSignupIdentityAvailable,
  assertBearerUserStillActive,
  assertUserMayAuthenticate,
  assessWorkspaceAuthState,
  buildIdentityLookupWhere,
  normalizeSignupCredentials
} from "../lib/auth/authAccessGuard.js";
import {
  assertLoginNotRateLimited,
  clearLoginFailures,
  recordLoginFailure
} from "../lib/auth/loginProtectionService.js";
import { verifyUserPassword } from "../lib/auth/verifyUserPassword.js";
import { publicUserFromDbRow, enrichUserWithExperience } from "../lib/auth/authRouteHelpers.js";

/** Fields that exist on every deployed DB revision (safe for signup response + fallbacks). */
const USER_CORE_SELECT = {
  id: true,
  email: true,
  phone: true,
  role: true
} as const;

async function findUserForAuthMe(prisma: PrismaClient, sub: string) {
  try {
    const row = await prisma.user.findUnique({
      where: { id: sub },
      select: {
        ...USER_CORE_SELECT,
        signupProfile: true,
        accountProfile: { select: { fullName: true } },
        memberships: { select: { role: true } }
      }
    });
    if (!row) return null;
    const base = publicUserFromDbRow({
      ...row,
      accountFullName: row.accountProfile?.fullName ?? null
    });
    return enrichUserWithExperience(prisma, sub, base);
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2022") {
      const row = await prisma.user.findUnique({
        where: { id: sub },
        select: { ...USER_CORE_SELECT, memberships: { select: { role: true } } }
      });
      if (!row) return null;
      const base = publicUserFromDbRow({ ...row, signupProfile: null });
      return enrichUserWithExperience(prisma, sub, base);
    }
    throw e;
  }
}

const SALT_ROUNDS = 10;

import {
  businessProvisionSchema,
  provisionBusinessWorkspaceForUser
} from "../lib/businessProvisioningService.js";

export function registerAuthRoutes(
  app: FastifyInstance,
  prisma: PrismaClient,
  domainEventBus: EventEmitter
) {
  const signupSchema = z.object({
    email: z.string().email().optional(),
    phone: z.string().min(6).optional(),
    password: z.string().min(8),
  /** Open signup: CUSTOMER self-serve, OWNER business bootstrap. Staff must use invitation. */
    role: z.enum(["OWNER", "CUSTOMER"]).default("CUSTOMER"),
    registrationProfile: z.record(z.string(), z.any()).optional()
  });

  app.post("/auth/signup", async (req, reply) => {
    const body = signupSchema.parse(req.body);
    const normalized = normalizeSignupCredentials({ email: body.email, phone: body.phone });
    if (!normalized.email && !normalized.phone) {
      return reply.status(400).send({ ok: false, error: "email_or_phone_required" });
    }

    const ip = maskIp(requestIp(req as { headers: Record<string, unknown>; ip?: string }));
    const ipGate = await assertLoginNotRateLimited({ ip });
    if (!ipGate.ok) {
      return reply.status(429).send({
        ok: false,
        error: ipGate.error,
        retryAfterSec: ipGate.retryAfterSec
      });
    }

    const identityGate = await assertSignupIdentityAvailable(prisma, normalized);
    if (!identityGate.ok) {
      const status =
        identityGate.error === "email_already_exists" ||
        identityGate.error === "phone_already_exists" ||
        identityGate.error === "user_already_exists"
          ? 409
          : 400;
      return reply.status(status).send({
        ok: false,
        error: identityGate.error,
        ...(identityGate.conflictField ? { conflictField: identityGate.conflictField } : {})
      });
    }

    const passwordHash = await bcrypt.hash(body.password, SALT_ROUNDS);

    const baseUserData = {
      email: normalized.email,
      phone: normalized.phone,
      password: passwordHash,
      role: body.role
    };

    const reg = body.registrationProfile;
    const regFlow =
      reg && typeof reg === "object" ? (reg as { flow?: unknown }).flow : undefined;
    const regSurface =
      reg && typeof reg === "object" ? (reg as { signupSurface?: unknown }).signupSurface : undefined;

    if (body.role === "CUSTOMER" && regFlow === "GUEST" && regSurface !== "mobile") {
      return reply.status(400).send({ ok: false, error: "guest_signup_mobile_only" });
    }
    if (body.role === "OWNER" && regFlow === "BUSINESS" && regSurface !== "web") {
      return reply.status(400).send({ ok: false, error: "business_signup_web_only" });
    }

    const needsBusinessBootstrap =
      body.role === "OWNER" &&
      reg &&
      typeof reg === "object" &&
      (reg as { flow?: unknown }).flow === "BUSINESS";
    let businessProvision: z.infer<typeof businessProvisionSchema> | null = null;
    if (needsBusinessBootstrap) {
      const parsed = businessProvisionSchema.safeParse(reg);
      if (!parsed.success) {
        return reply.status(400).send({ ok: false, error: "invalid_registration_profile" });
      }
      businessProvision = parsed.data;
    }

    let dbUser: {
      id: string;
      email: string | null;
      phone: string | null;
      role: string;
      signupProfile?: unknown | null;
    };
    try {
      dbUser = await prisma.user.create({
        data:
          body.registrationProfile !== undefined
            ? {
                ...baseUserData,
                signupProfile: body.registrationProfile as Prisma.InputJsonValue
              }
            : baseUserData,
        select: { ...USER_CORE_SELECT, signupProfile: true }
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === "P2022" &&
        body.registrationProfile !== undefined
      ) {
        dbUser = await prisma.user.create({
          data: baseUserData,
          select: USER_CORE_SELECT
        });
        dbUser = { ...dbUser, signupProfile: null };
      } else {
        throw e;
      }
    }

    if (businessProvision && dbUser.role === "OWNER") {
      try {
        await provisionBusinessWorkspaceForUser(prisma, dbUser.id, businessProvision, {
          registrationProfile: reg as Record<string, unknown> | undefined
        });
      } catch (e) {
        await prisma.user.delete({ where: { id: dbUser.id } }).catch(() => undefined);
        throw e;
      }
    }

    const token = app.signJwt({
      sub: dbUser.id,
      role: toJwtRole(dbUser.role)
    });
    const ua = typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : undefined;
    await upsertUserSession(prisma, {
      userId: dbUser.id,
      token,
      userAgent: ua,
      ip: requestIp(req as { headers: Record<string, unknown>; ip?: string })
    });
    await logSecurityActivity(prisma, {
      userId: dbUser.id,
      type: "LOGIN_SUCCESS",
      ipMasked: maskIp(requestIp(req as { headers: Record<string, unknown>; ip?: string })),
      metadata: { method: "signup" }
    });
    const user = await enrichUserWithExperience(prisma, dbUser.id, publicUserFromDbRow(dbUser));
    return { ok: true, user, token };
  });

  const loginSchema = z.object({
    email: z.string().email().optional(),
    phone: z.string().min(6).optional(),
    password: z.string().min(8),
    totpCode: z.string().min(6).max(8).optional(),
    smsCode: z.string().min(6).max(8).optional()
  });

  app.post("/auth/login", async (req, reply) => {
    const body = loginSchema.parse(req.body);
    const normalized = normalizeSignupCredentials({ email: body.email, phone: body.phone });
    if (!normalized.email && !normalized.phone) {
      return reply.status(400).send({ ok: false, error: "email_or_phone_required" });
    }

    const ip = requestIp(req as { headers: Record<string, unknown>; ip?: string });
    const ipMasked = maskIp(ip);
    const ipGate = await assertLoginNotRateLimited({ ip });
    if (!ipGate.ok) {
      return reply.status(429).send({
        ok: false,
        error: ipGate.error,
        retryAfterSec: ipGate.retryAfterSec
      });
    }

    const lookup = buildIdentityLookupWhere(normalized);
    const user = lookup
      ? await prisma.user.findFirst({
          where: lookup,
          select: {
            id: true,
            email: true,
            phone: true,
            role: true,
            password: true,
            signupProfile: true,
            accountProfile: { select: { fullName: true } }
          }
        })
      : null;

    if (!user) {
      captureAuthFailure({
        reason: "invalid_credentials",
        req,
        email: normalized.email ?? null
      });
      return reply.status(401).send({ ok: false, error: "invalid_credentials" });
    }

    const accountGate = await assertLoginNotRateLimited({ ip, accountKey: user.id });
    if (!accountGate.ok) {
      return reply.status(429).send({
        ok: false,
        error: accountGate.error,
        retryAfterSec: accountGate.retryAfterSec
      });
    }

    const valid = await verifyUserPassword(prisma, user, body.password);

    if (!valid) {
      await recordLoginFailure({ ip, accountKey: user.id });
      await logSecurityActivity(prisma, {
        userId: user.id,
        type: "LOGIN_FAILED",
        ipMasked,
        metadata: { email: normalized.email ?? null, phone: normalized.phone ?? null }
      }).catch(() => undefined);
      captureAuthFailure({
        reason: "login_failed",
        req,
        userId: user.id,
        email: user.email ?? normalized.email ?? null
      });
      return reply.status(401).send({ ok: false, error: "invalid_credentials" });
    }

    const authGate = await assertUserMayAuthenticate(prisma, user);
    if (!authGate.ok) {
      return reply.status(403).send({ ok: false, error: authGate.error });
    }

    const twoFaRow = await prisma.userTwoFactorAuth.findUnique({
      where: { userId: user.id },
      select: { enabled: true }
    });

    if (twoFaRow?.enabled) {
      const totp = body.totpCode?.trim();
      const sms = body.smsCode?.trim();
      if (!totp && !sms) {
        return reply.status(401).send({
          ok: false,
          error: "2fa_required",
          smsFallbackAvailable: isSmsProviderConfigured() && Boolean(user.phone?.trim())
        });
      }
      let verified = false;
      if (totp) {
        verified = await verifyTwoFactorTotpCode(prisma, user.id, totp);
      } else if (sms) {
        verified = await verifyTwoFactorSmsCode(user.id, sms);
      }
      if (!verified) {
        await recordLoginFailure({ ip, accountKey: user.id });
        return reply.status(401).send({ ok: false, error: "invalid_2fa_code" });
      }
    }

    await clearLoginFailures(user.id);

    const token = app.signJwt({ sub: user.id, role: toJwtRole(user.role) });
    const ua = typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : undefined;
    await upsertUserSession(prisma, {
      userId: user.id,
      token,
      userAgent: ua,
      ip
    });
    await logSecurityActivity(prisma, {
      userId: user.id,
      type: "LOGIN_SUCCESS",
      ipMasked,
      metadata: { method: "login" }
    });
    const base = publicUserFromDbRow({
      id: user.id,
      email: user.email,
      phone: user.phone,
      role: user.role,
      signupProfile: user.signupProfile,
      accountFullName: user.accountProfile?.fullName ?? null
    });
    const enriched = await enrichUserWithExperience(prisma, user.id, base);
    return {
      ok: true,
      user: enriched,
      token,
      workspaceAuth: authGate.workspace
    };
  });

  app.post("/auth/2fa/request-sms-code", async (req, reply) => {
    const body = z
      .object({
        email: z.string().email().optional(),
        phone: z.string().min(6).optional(),
        password: z.string().min(8)
      })
      .parse(req.body);

    if (!body.email && !body.phone) {
      return reply.status(400).send({ ok: false, error: "email_or_phone_required" });
    }

    const user = await prisma.user.findFirst({
      where: {
        OR: [
          body.email ? { email: body.email } : undefined,
          body.phone ? { phone: body.phone } : undefined
        ].filter(Boolean) as Prisma.UserWhereInput[]
      },
      select: { id: true, password: true, phone: true }
    });

    if (!user) {
      return reply.status(401).send({ ok: false, error: "invalid_credentials" });
    }

    let valid = false;
    if (user.password.startsWith("$2")) {
      valid = await bcrypt.compare(body.password, user.password);
    } else {
      valid = user.password === body.password;
    }
    if (!valid) {
      return reply.status(401).send({ ok: false, error: "invalid_credentials" });
    }

    const result = await requestTwoFactorSmsCode(prisma, user.id);
    if (!result.ok) {
      const status =
        result.error === "sms_not_configured" || result.error === "sms_fallback_unavailable"
          ? 503
          : 400;
      return reply.status(status).send(result);
    }
    return { ok: true };
  });

  const acceptInvitationSchema = z.object({
    token: z.string().min(16),
    password: z.string().min(8),
    email: z.string().email().optional(),
    phone: z.string().min(6).optional(),
    fullName: z.string().min(2).optional()
  });

  app.post("/auth/accept-invitation", async (req, reply) => {
    const body = acceptInvitationSchema.parse(req.body);
    try {
      const inviteEmail = await inviteEmailForToken(prisma, body.token);
      const existingUser = inviteEmail
        ? await prisma.user.findFirst({
            where: { email: inviteEmail },
            select: { id: true, password: true }
          })
        : null;

      let result;
      if (existingUser) {
        let valid = false;
        if (existingUser.password.startsWith("$2")) {
          valid = await bcrypt.compare(body.password, existingUser.password);
        } else {
          valid = existingUser.password === body.password;
        }
        if (!valid) return reply.status(401).send({ ok: false, error: "invalid_credentials" });

        result = await completeWorkspaceEnrollment(prisma, {
          token: body.token,
          action: "use_existing",
          sessionUserId: existingUser.id,
          fullName: body.fullName,
          phone: body.phone
        });
      } else {
        const passwordHash = await bcrypt.hash(body.password, SALT_ROUNDS);
        result = await completeWorkspaceEnrollment(prisma, {
          token: body.token,
          action: "create_account",
          passwordHash,
          fullName: body.fullName,
          phone: body.phone
        });
      }

      const dbUser = await prisma.user.findUnique({
        where: { id: result.userId },
        select: { ...USER_CORE_SELECT, signupProfile: true }
      });
      const token = app.signJwt({
        sub: result.userId,
        role: toJwtRole(dbUser?.role ?? result.intendedRole)
      });
      const user = await enrichUserWithExperience(
        prisma,
        result.userId,
        publicUserFromDbRow(
          dbUser ?? {
            id: result.userId,
            email: body.email ?? inviteEmail ?? null,
            phone: body.phone ?? null,
            role: result.intendedRole,
            signupProfile: null
          }
        )
      );
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
          fullName: body.fullName ?? null,
          role: membership?.role ?? result.intendedRole
        });
      }
      return {
        ok: true,
        token,
        user,
        pendingApproval: result.pendingApproval,
        restaurantId: result.restaurantId,
        redirectPath: result.redirectPath
      };
    } catch (e: unknown) {
      const err = e as { statusCode?: number; message?: string };
      return reply.status(err.statusCode ?? 400).send({ ok: false, error: err.message ?? "accept_failed" });
    }
  });

  app.get("/auth/me", async (req, reply) => {
    const auth = req.headers.authorization;
    if (!auth?.startsWith("Bearer ")) return reply.status(401).send({ ok: false, error: "missing_token" });
    const token = auth.slice("Bearer ".length);

    if (await isAuthTokenRevoked(token)) {
      return reply.status(401).send({ ok: false, error: "token_revoked" });
    }

    const payload = app.verifyJwt(token);
    const active = await assertBearerUserStillActive(prisma, payload.sub);
    if (!active.ok) {
      return reply.status(403).send({ ok: false, error: active.error });
    }

    const user = await findUserForAuthMe(prisma, payload.sub);
    if (!user) return reply.status(404).send({ ok: false, error: "user_not_found" });
    const workspace = await assessWorkspaceAuthState(prisma, payload.sub);
    return { ok: true, user, workspaceAuth: workspace };
  });

  app.post("/auth/password-reset/request", async (req, reply) => {
    const body = z
      .object({
        email: z.string().email(),
        returnTo: z.string().max(512).optional()
      })
      .parse(req.body);
    const ip = maskIp(requestIp(req as { headers: Record<string, unknown>; ip?: string }));
    try {
      await requestPasswordReset(prisma, body.email, ip, body.returnTo);
      return { ok: true };
    } catch (e: unknown) {
      const err = e as { message?: string };
      return reply.status(502).send({ ok: false, error: err.message ?? "email_send_failed" });
    }
  });

  app.post("/auth/password-reset/confirm", async (req, reply) => {
    const body = z
      .object({
        token: z.string().min(16),
        newPassword: z.string().min(8),
        confirmPassword: z.string().min(8)
      })
      .parse(req.body);
    const auth = req.headers.authorization;
    const currentToken = auth?.startsWith("Bearer ") ? auth.slice("Bearer ".length).trim() : undefined;
    const ip = maskIp(requestIp(req as { headers: Record<string, unknown>; ip?: string }));
    const result = await confirmPasswordReset(prisma, {
      token: body.token,
      newPassword: body.newPassword,
      confirmPassword: body.confirmPassword,
      currentToken,
      ipMasked: ip
    });
    if (!result.ok) return reply.status(400).send(result);
    return result;
  });

  app.post("/auth/logout", async (req, reply) => {
    const auth = req.headers.authorization;
    if (!auth?.startsWith("Bearer ")) {
      return reply.status(401).send({ ok: false, error: "missing_token" });
    }
    const token = auth.slice("Bearer ".length).trim();
    if (!token) {
      return reply.status(401).send({ ok: false, error: "missing_token" });
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      return reply.status(500).send({ ok: false, error: "server_misconfigured" });
    }

    try {
      await revokeAuthToken(token, secret);
      await revokeSessionByToken(prisma, token);
    } catch {
      return reply.status(401).send({ ok: false, error: "invalid_token" });
    }

    return { ok: true };
  });
}
