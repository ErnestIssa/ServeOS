import type { FastifyInstance } from "fastify";
import type { PrismaClient } from "@prisma/client";
import { z } from "zod";
import {
  confirmWorkspaceDeployment,
  HARDWARE_KINDS,
  listHardwareCatalogForClient,
  listWorkspacePlansForClient,
  PLATFORM_INCLUDES,
  quoteWorkspaceDeployment,
  readWorkspaceDeploymentFromProfile,
  WORKSPACE_PLAN_IDS,
  type HardwareConfig
} from "../lib/workspaceDeploymentService.js";
import {
  dismissOwnerTrialNotice,
  getOwnerTrialNotice
} from "../lib/workspaceTrialNoticeService.js";

const hardwareSlotSchema = z.object({
  enabled: z.boolean(),
  quantity: z.number().int().min(0).max(99)
});

const hardwareConfigSchema = z.object({
  kds: hardwareSlotSchema,
  checkout: hardwareSlotSchema,
  customerStatus: hardwareSlotSchema,
  paymentTerminal: hardwareSlotSchema,
  kitchenPrinter: hardwareSlotSchema
}) as z.ZodType<HardwareConfig>;

const deploymentInputSchema = z.object({
  planId: z.enum(WORKSPACE_PLAN_IDS),
  hardware: hardwareConfigSchema
});

function requireOwner(req: { headers: { authorization?: string } }, app: FastifyInstance) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) {
    throw Object.assign(new Error("missing_token"), { statusCode: 401 });
  }
  const token = auth.slice("Bearer ".length);
  const payload = app.verifyJwt(token);
  if (payload.role !== "OWNER") {
    throw Object.assign(new Error("owner_only"), { statusCode: 403 });
  }
  return payload;
}

export function registerWorkspaceDeploymentRoutes(app: FastifyInstance, prisma: PrismaClient) {
  app.get("/workspace-deployment/catalog", async () => {
    return {
      ok: true,
      platformIncludes: PLATFORM_INCLUDES,
      plans: listWorkspacePlansForClient(),
      hardware: listHardwareCatalogForClient(),
      hardwareKinds: HARDWARE_KINDS
    };
  });

  app.post("/workspace-deployment/quote", async (req, reply) => {
    const parsed = deploymentInputSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ ok: false, error: "validation_error" });
    try {
      const quote = quoteWorkspaceDeployment(parsed.data);
      return { ok: true, quote };
    } catch (e: unknown) {
      const err = e as { statusCode?: number; message?: string };
      return reply.status(err.statusCode ?? 400).send({ ok: false, error: err.message ?? "quote_failed" });
    }
  });

  app.get("/workspace-deployment/status", async (req, reply) => {
    try {
      const payload = requireOwner(req, app);
      const user = await prisma.user.findUnique({
        where: { id: payload.sub },
        select: { signupProfile: true }
      });
      if (!user) return reply.status(404).send({ ok: false, error: "user_not_found" });
      const deployment = readWorkspaceDeploymentFromProfile(user.signupProfile);
      return { ok: true, hasDeployment: Boolean(deployment), deployment };
    } catch (e: unknown) {
      const err = e as { statusCode?: number; message?: string };
      return reply.status(err.statusCode ?? 401).send({ ok: false, error: err.message ?? "status_failed" });
    }
  });

  app.get("/workspace-deployment/trial-notice", async (req, reply) => {
    try {
      const payload = requireOwner(req, app);
      const notice = await getOwnerTrialNotice(prisma, payload.sub);
      return { ok: true, notice };
    } catch (e: unknown) {
      const err = e as { statusCode?: number; message?: string };
      return reply.status(err.statusCode ?? 401).send({ ok: false, error: err.message ?? "trial_notice_failed" });
    }
  });

  app.post("/workspace-deployment/trial-notice/dismiss", async (req, reply) => {
    const body = z.object({ noticeId: z.string().min(1) }).safeParse(req.body);
    if (!body.success) return reply.status(400).send({ ok: false, error: "validation_error" });
    try {
      const payload = requireOwner(req, app);
      const nextNotice = await dismissOwnerTrialNotice(prisma, payload.sub, body.data.noticeId);
      return { ok: true, nextNotice };
    } catch (e: unknown) {
      const err = e as { statusCode?: number; message?: string };
      return reply.status(err.statusCode ?? 400).send({ ok: false, error: err.message ?? "dismiss_failed" });
    }
  });

  app.post("/workspace-deployment/confirm", async (req, reply) => {
    const parsed = deploymentInputSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ ok: false, error: "validation_error" });
    try {
      const payload = requireOwner(req, app);
      const deployment = await confirmWorkspaceDeployment(prisma, payload.sub, parsed.data);
      const quote = quoteWorkspaceDeployment(parsed.data);
      return { ok: true, deployment, quote };
    } catch (e: unknown) {
      const err = e as { statusCode?: number; message?: string };
      return reply.status(err.statusCode ?? 400).send({ ok: false, error: err.message ?? "confirm_failed" });
    }
  });
}
