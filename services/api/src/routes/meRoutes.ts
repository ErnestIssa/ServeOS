import type { FastifyInstance } from "fastify";
import type { Prisma, PrismaClient } from "@prisma/client";
import { z } from "zod";
import { toJwtRole } from "../plugins/auth.js";
import { getAccountBundle, patchAccountProfile, saveProfileImage } from "../lib/account/profileService.js";
import { changeUserPassword } from "../lib/account/passwordService.js";
import { confirmEmailChange, requestEmailChange } from "../lib/account/emailChangeService.js";
import {
  disableTwoFactor,
  enableTwoFactor,
  setupTwoFactor
} from "../lib/account/twoFactorService.js";
import {
  listUserSessions,
  maskIp,
  requestIp,
  revokeOtherSessions,
  revokeUserSession,
  touchUserSession
} from "../lib/account/sessionService.js";
import { listSecurityActivity, logSecurityActivity } from "../lib/account/securityActivity.js";
import { buildPermissionsOverview } from "../lib/account/permissionsOverview.js";
import { getAppPreferences, patchAppPreferences } from "../lib/account/preferencesService.js";
import { requestAccountClosure, requestOwnershipTransfer } from "../lib/account/dangerZoneService.js";
import { createProfileImageUploadSession } from "../lib/integrations/objectStorage.js";
import { loadUserNotificationPrefs } from "../notifications/preferences.js";
import { revokeAuthToken } from "../lib/authTokenRevocation.js";

function bearerAuth(req: { headers: { authorization?: string } }, app: FastifyInstance) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) {
    throw Object.assign(new Error("missing_token"), { statusCode: 401 });
  }
  const token = auth.slice("Bearer ".length).trim();
  const payload = app.verifyJwt(token);
  return { userId: payload.sub, token, role: payload.role };
}

export function registerMeRoutes(app: FastifyInstance, prisma: PrismaClient) {
  app.addHook("preHandler", async (req) => {
    if (!req.url.startsWith("/me")) return;
    if (req.method === "POST" && req.url === "/me/email/confirm") return;
    const auth = req.headers.authorization;
    if (!auth?.startsWith("Bearer ")) return;
    const token = auth.slice("Bearer ".length).trim();
    await touchUserSession(prisma, token);
  });

  app.get("/me", async (req, reply) => {
    const { userId } = bearerAuth(req, app);
    const account = await getAccountBundle(prisma, userId);
    if (!account) return reply.status(404).send({ ok: false, error: "user_not_found" });
    const notificationPrefs = await loadUserNotificationPrefs(prisma, userId);
    return { ok: true, account, notificationPreferences: notificationPrefs };
  });

  app.patch("/me", async (req, reply) => {
    const { userId } = bearerAuth(req, app);
    const body = z
      .object({
        fullName: z.string().max(120).optional(),
        phone: z.string().max(24).optional(),
        jobTitle: z.string().max(80).optional()
      })
      .parse(req.body);

    const ip = maskIp(requestIp(req as { headers: Record<string, unknown>; ip?: string }));
    const result = await patchAccountProfile(prisma, userId, body, ip);
    if (!result.ok) return reply.status(400).send(result);
    const account = await getAccountBundle(prisma, userId);
    return { ok: true, account };
  });

  app.post("/me/profile-image/upload-session", async (req, reply) => {
    const { userId } = bearerAuth(req, app);
    const body = z.object({ contentType: z.string() }).parse(req.body);
    const session = await createProfileImageUploadSession(userId, body.contentType);
    if ("error" in session) {
      const status = session.error === "object_storage_not_configured" ? 503 : 400;
      return reply.status(status).send({ ok: false, error: session.error });
    }
    return { ok: true, upload: session };
  });

  app.post("/me/profile-image", async (req, reply) => {
    const { userId } = bearerAuth(req, app);
    const body = z
      .object({
        imageKey: z.string().min(8),
        dataBase64: z.string().min(20),
        contentType: z.string()
      })
      .parse(req.body);
    const ip = maskIp(requestIp(req as { headers: Record<string, unknown>; ip?: string }));
    const result = await saveProfileImage(prisma, userId, body, ip);
    if (!result.ok) return reply.status(400).send(result);
    return result;
  });

  app.patch("/me/email", async (req, reply) => {
    const { userId } = bearerAuth(req, app);
    const body = z.object({ newEmail: z.string().email(), password: z.string().min(8) }).parse(req.body);
    const ip = maskIp(requestIp(req as { headers: Record<string, unknown>; ip?: string }));
    const result = await requestEmailChange(prisma, {
      userId,
      newEmail: body.newEmail,
      password: body.password,
      ipMasked: ip
    });
    if (!result.ok) return reply.status(400).send(result);
    return result;
  });

  app.post("/me/email/confirm", async (req, reply) => {
    const body = z.object({ token: z.string().min(16) }).parse(req.body);
    const ip = maskIp(requestIp(req as { headers: Record<string, unknown>; ip?: string }));
    const result = await confirmEmailChange(prisma, body.token, ip);
    if (!result.ok) return reply.status(400).send(result);

    const secret = process.env.JWT_SECRET;
    if (!secret) return reply.status(500).send({ ok: false, error: "server_misconfigured" });

    const user = await prisma.user.findUnique({
      where: { id: result.userId },
      select: { id: true, role: true }
    });
    if (!user) return reply.status(404).send({ ok: false, error: "user_not_found" });

    const token = app.signJwt({ sub: user.id, role: toJwtRole(user.role) });
    return { ok: true, token, email: result.newEmail };
  });

  app.patch("/me/password", async (req, reply) => {
    const { userId, token } = bearerAuth(req, app);
    const body = z
      .object({
        currentPassword: z.string().min(8),
        newPassword: z.string().min(8),
        confirmPassword: z.string().min(8)
      })
      .parse(req.body);

    const secret = process.env.JWT_SECRET;
    if (!secret) return reply.status(500).send({ ok: false, error: "server_misconfigured" });

    const ip = maskIp(requestIp(req as { headers: Record<string, unknown>; ip?: string }));
    const result = await changeUserPassword(prisma, {
      userId,
      currentToken: token,
      currentPassword: body.currentPassword,
      newPassword: body.newPassword,
      confirmPassword: body.confirmPassword,
      jwtSecret: secret,
      ipMasked: ip
    });
    if (!result.ok) return reply.status(400).send(result);
    return result;
  });

  app.get("/me/sessions", async (req) => {
    const { userId, token } = bearerAuth(req, app);
    const sessions = await listUserSessions(prisma, userId, token);
    return { ok: true, sessions };
  });

  app.delete("/me/sessions/:id", async (req, reply) => {
    const { userId, token } = bearerAuth(req, app);
    const sessionId = String((req.params as { id: string }).id);
    const result = await revokeUserSession(prisma, userId, sessionId, token);
    if (!result.ok) return reply.status(400).send(result);

    const ip = maskIp(requestIp(req as { headers: Record<string, unknown>; ip?: string }));
    await logSecurityActivity(prisma, {
      userId,
      type: "SESSION_REVOKED",
      ipMasked: ip,
      metadata: { sessionId }
    });
    return { ok: true };
  });

  app.post("/me/sessions/revoke-others", async (req) => {
    const { userId, token } = bearerAuth(req, app);
    const count = await revokeOtherSessions(prisma, userId, token);
    const ip = maskIp(requestIp(req as { headers: Record<string, unknown>; ip?: string }));
    await logSecurityActivity(prisma, {
      userId,
      type: "SESSIONS_REVOKED_ALL",
      ipMasked: ip,
      metadata: { count }
    });
    return { ok: true, revokedCount: count };
  });

  app.post("/me/logout-all", async (req, reply) => {
    const { userId, token } = bearerAuth(req, app);
    const count = await revokeOtherSessions(prisma, userId, token);
    const secret = process.env.JWT_SECRET;
    if (!secret) return reply.status(500).send({ ok: false, error: "server_misconfigured" });
    await revokeAuthToken(token, secret).catch(() => undefined);
    return { ok: true, revokedCount: count };
  });

  app.post("/me/2fa/setup", async (req, reply) => {
    const { userId } = bearerAuth(req, app);
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
    if (!user) return reply.status(404).send({ ok: false, error: "user_not_found" });
    const setup = await setupTwoFactor(prisma, userId, user.email ?? userId);
    return { ok: true, ...setup };
  });

  app.post("/me/2fa/enable", async (req, reply) => {
    const { userId } = bearerAuth(req, app);
    const body = z.object({ code: z.string().min(6).max(8) }).parse(req.body);
    const ip = maskIp(requestIp(req as { headers: Record<string, unknown>; ip?: string }));
    const result = await enableTwoFactor(prisma, userId, body.code, ip);
    if (!result.ok) return reply.status(400).send(result);
    return result;
  });

  app.post("/me/2fa/disable", async (req, reply) => {
    const { userId } = bearerAuth(req, app);
    const body = z.object({ password: z.string().min(8), code: z.string().optional() }).parse(req.body);
    const ip = maskIp(requestIp(req as { headers: Record<string, unknown>; ip?: string }));
    const result = await disableTwoFactor(prisma, userId, body, ip);
    if (!result.ok) return reply.status(400).send(result);
    return result;
  });

  app.get("/me/security-activity", async (req) => {
    const { userId } = bearerAuth(req, app);
    const q = req.query as { days?: string };
    const days = Math.min(90, Math.max(7, Number(q.days) || 90));
    const activity = await listSecurityActivity(prisma, userId, days);
    return { ok: true, activity, days };
  });

  app.get("/me/permissions", async (req, reply) => {
    const { userId } = bearerAuth(req, app);
    const overview = await buildPermissionsOverview(prisma, userId);
    if (!overview) return reply.status(404).send({ ok: false, error: "user_not_found" });
    return { ok: true, permissions: overview };
  });

  app.get("/me/preferences", async (req) => {
    const { userId } = bearerAuth(req, app);
    const appPreferences = await getAppPreferences(prisma, userId);
    const notificationPreferences = await loadUserNotificationPrefs(prisma, userId);
    return { ok: true, appPreferences, notificationPreferences };
  });

  app.patch("/me/preferences", async (req) => {
    const { userId } = bearerAuth(req, app);
    const body = z
      .object({
        language: z.string().min(2).max(12).optional(),
        timezone: z.string().min(3).max(64).optional(),
        dateFormat: z.string().max(24).optional(),
        timeFormat: z.enum(["12h", "24h"]).optional(),
        theme: z.enum(["system", "light", "dark"]).optional(),
        notificationPreferences: z
          .object({
            pushEnabled: z.boolean().optional(),
            emailEnabled: z.boolean().optional(),
            smsEnabled: z.boolean().optional(),
            categoryFlags: z.record(z.boolean()).optional()
          })
          .optional()
      })
      .parse(req.body);

    const appPreferences = await patchAppPreferences(prisma, userId, body);

    let notificationPreferences = null;
    if (body.notificationPreferences) {
      const np = body.notificationPreferences;
      notificationPreferences = await prisma.userNotificationPreference.upsert({
        where: { userId },
        create: {
          userId,
          pushEnabled: np.pushEnabled ?? true,
          emailEnabled: np.emailEnabled ?? true,
          smsEnabled: np.smsEnabled ?? false,
          categoryFlags: (np.categoryFlags ?? null) as Prisma.InputJsonValue
        },
        update: {
          ...(np.pushEnabled !== undefined ? { pushEnabled: np.pushEnabled } : {}),
          ...(np.emailEnabled !== undefined ? { emailEnabled: np.emailEnabled } : {}),
          ...(np.smsEnabled !== undefined ? { smsEnabled: np.smsEnabled } : {}),
          ...(np.categoryFlags !== undefined
            ? { categoryFlags: np.categoryFlags as Prisma.InputJsonValue }
            : {})
        }
      });
    } else {
      notificationPreferences = await loadUserNotificationPrefs(prisma, userId);
    }

    return { ok: true, appPreferences, notificationPreferences };
  });

  app.post("/me/ownership-transfer", async (req, reply) => {
    const { userId } = bearerAuth(req, app);
    const body = z
      .object({
        toEmail: z.string().email(),
        restaurantId: z.string().min(1),
        password: z.string().min(8),
        twoFaCode: z.string().optional()
      })
      .parse(req.body);
    const ip = maskIp(requestIp(req as { headers: Record<string, unknown>; ip?: string }));
    const result = await requestOwnershipTransfer(prisma, {
      fromUserId: userId,
      toEmail: body.toEmail,
      restaurantId: body.restaurantId,
      password: body.password,
      twoFaCode: body.twoFaCode,
      ipMasked: ip
    });
    if (!result.ok) return reply.status(400).send(result);
    return result;
  });

  app.post("/me/account-closure", async (req, reply) => {
    const { userId } = bearerAuth(req, app);
    const body = z.object({ password: z.string().min(8), reason: z.string().max(500).optional() }).parse(req.body);
    const ip = maskIp(requestIp(req as { headers: Record<string, unknown>; ip?: string }));
    const result = await requestAccountClosure(prisma, {
      userId,
      password: body.password,
      reason: body.reason,
      ipMasked: ip
    });
    if (!result.ok) return reply.status(400).send(result);
    return result;
  });
}
