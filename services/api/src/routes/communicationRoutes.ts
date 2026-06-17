import type { FastifyInstance } from "fastify";
import type { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { bearerUserId } from "../lib/mobileAuthContext.js";
import {
  EMAIL_COMMUNICATION_KEYS,
  IN_APP_COMMUNICATION_KEYS
} from "../lib/communicationPreferenceTypes.js";
import {
  enableAllCommunications,
  previewCommunicationPreferencesByToken,
  previewCommunicationPreferencesForUser,
  requestCommunicationPreferencesAccess,
  unsubscribeAllNonEssential,
  updateCommunicationPreferences
} from "../lib/communicationPreferenceService.js";

const emailPrefsSchema = z
  .object(
    Object.fromEntries(EMAIL_COMMUNICATION_KEYS.map((k) => [k, z.boolean().optional()])) as Record<
      string,
      z.ZodOptional<z.ZodBoolean>
    >
  )
  .partial();

const inAppPrefsSchema = z
  .object(
    Object.fromEntries(IN_APP_COMMUNICATION_KEYS.map((k) => [k, z.boolean().optional()])) as Record<
      string,
      z.ZodOptional<z.ZodBoolean>
    >
  )
  .partial();

function optionalUserId(
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

export function registerCommunicationRoutes(app: FastifyInstance, prisma: PrismaClient) {
  app.get("/communication-preferences", async (req, reply) => {
    const q = req.query as { token?: string };
    const token = q.token?.trim();
    if (!token) return reply.status(400).send({ ok: false, error: "token_required" });

    const result = await previewCommunicationPreferencesByToken(prisma, token);
    if (!result.ok) {
      const status = result.error === "token_expired" ? 410 : 404;
      return reply.status(status).send(result);
    }
    return result;
  });

  app.get("/communication-preferences/session", async (req, reply) => {
    const userId = optionalUserId(req, app);
    if (!userId) return reply.status(401).send({ ok: false, error: "unauthorized" });

    const result = await previewCommunicationPreferencesForUser(prisma, userId);
    if (!result.ok) return reply.status(404).send(result);
    return result;
  });

  app.patch("/communication-preferences", async (req, reply) => {
    const body = z
      .object({
        token: z.string().min(16).optional(),
        emailPrefs: emailPrefsSchema.optional(),
        inAppPrefs: inAppPrefsSchema.optional(),
        source: z.string().max(64).optional()
      })
      .parse(req.body);

    const userId = optionalUserId(req, app);
    if (!body.token && !userId) {
      return reply.status(400).send({ ok: false, error: "token_or_auth_required" });
    }

    const result = await updateCommunicationPreferences(prisma, {
      token: body.token,
      userId,
      emailPrefs: body.emailPrefs,
      inAppPrefs: body.inAppPrefs,
      source: body.source
    });
    if (!result.ok) {
      const status = result.error === "token_expired" ? 410 : 404;
      return reply.status(status).send(result);
    }
    return result;
  });

  app.post("/communication-preferences/unsubscribe-all", async (req, reply) => {
    const body = z
      .object({
        token: z.string().min(16).optional(),
        source: z.string().max(64).optional()
      })
      .parse(req.body);

    const userId = optionalUserId(req, app);
    if (!body.token && !userId) {
      return reply.status(400).send({ ok: false, error: "token_or_auth_required" });
    }

    const result = await unsubscribeAllNonEssential(prisma, {
      token: body.token,
      userId,
      source: body.source ?? "unsubscribe_all"
    });
    if (!result.ok) {
      const status = result.error === "token_expired" ? 410 : 404;
      return reply.status(status).send(result);
    }
    return result;
  });

  app.post("/communication-preferences/enable-all", async (req, reply) => {
    const body = z
      .object({
        token: z.string().min(16).optional(),
        source: z.string().max(64).optional()
      })
      .parse(req.body);

    const userId = optionalUserId(req, app);
    if (!body.token && !userId) {
      return reply.status(400).send({ ok: false, error: "token_or_auth_required" });
    }

    const result = await enableAllCommunications(prisma, {
      token: body.token,
      userId,
      source: body.source ?? "enable_all"
    });
    if (!result.ok) {
      const status = result.error === "token_expired" ? 410 : 404;
      return reply.status(status).send(result);
    }
    return result;
  });

  app.post("/communication-preferences/lookup", async (req) => {
    const body = z.object({ email: z.string().email().max(320) }).parse(req.body);
    return requestCommunicationPreferencesAccess(prisma, body.email);
  });
}
