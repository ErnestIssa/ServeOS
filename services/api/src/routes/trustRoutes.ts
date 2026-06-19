import type { EventEmitter } from "node:events";
import type { FastifyInstance } from "fastify";
import jwt from "jsonwebtoken";
import type { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { isVenueMembershipRole } from "../lib/membershipAccess.js";
import {
  listPendingApprovalsForActor,
  listPendingApprovalsForVenue,
  resolveApproval
} from "../lib/trust/approvalEngine.js";
import { listTrustAuditForEntity } from "../lib/trust/auditLogService.js";
import { executeApprovedOrderAction } from "../lib/trust/orderTrustService.js";
import { publishDomainEvent } from "../notifications/eventBus.js";
import type { DomainEvent } from "../notifications/types.js";

function requireUser(req: { headers: { authorization?: string } }) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw Object.assign(new Error("JWT_SECRET is required"), { statusCode: 500 });
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) {
    throw Object.assign(new Error("missing_token"), { statusCode: 401 });
  }
  const token = auth.slice("Bearer ".length);
  return jwt.verify(token, secret) as { sub: string; role: string };
}

async function requireVenueStaff(
  prisma: PrismaClient,
  req: { headers: { authorization?: string } },
  restaurantId: string
) {
  const user = requireUser(req);
  const m = await prisma.membership.findUnique({
    where: { userId_restaurantId: { userId: user.sub, restaurantId } }
  });
  if (!m || m.status !== "ACTIVE" || !isVenueMembershipRole(m.role)) {
    throw Object.assign(new Error("forbidden"), { statusCode: 403 });
  }
  return { userId: user.sub, role: m.role };
}

export function registerTrustRoutes(
  app: FastifyInstance,
  prisma: PrismaClient,
  domainEventBus: EventEmitter
) {
  app.get("/trust/:restaurantId/approvals/pending", async (req) => {
    const { restaurantId } = req.params as { restaurantId: string };
    await requireVenueStaff(prisma, req, restaurantId);
    const tasks = await listPendingApprovalsForVenue(prisma, restaurantId);
    return {
      ok: true,
      approvals: tasks.map((t) => ({
        id: t.id,
        entityType: t.entityType,
        entityId: t.entityId,
        requestedByUserId: t.requestedByUserId,
        requiredRole: t.requiredRole,
        riskScore: t.riskScore,
        status: t.status,
        expiresAt: t.expiresAt.toISOString(),
        actionType: t.trustEvent.actionType,
        payload: t.trustEvent.payload,
        metadata: t.trustEvent.metadata
      }))
    };
  });

  app.get("/trust/:restaurantId/approvals/mine", async (req) => {
    const { restaurantId } = req.params as { restaurantId: string };
    const actor = await requireVenueStaff(prisma, req, restaurantId);
    const tasks = await listPendingApprovalsForActor(prisma, restaurantId, actor.userId);
    return {
      ok: true,
      approvals: tasks.map((t) => ({
        id: t.id,
        entityType: t.entityType,
        entityId: t.entityId,
        status: t.status,
        riskScore: t.riskScore,
        actionType: t.trustEvent.actionType,
        expiresAt: t.expiresAt.toISOString()
      }))
    };
  });

  const resolveSchema = z.object({
    action: z.enum(["APPROVE", "REJECT", "ESCALATE"]),
    comment: z.string().max(500).optional()
  });

  app.post("/trust/:restaurantId/approvals/:approvalTaskId/resolve", async (req) => {
    const { restaurantId, approvalTaskId } = req.params as {
      restaurantId: string;
      approvalTaskId: string;
    };
    const actor = await requireVenueStaff(prisma, req, restaurantId);
    const body = resolveSchema.parse(req.body);

    const result = await resolveApproval(prisma, {
      approvalTaskId,
      actedByUserId: actor.userId,
      action: body.action,
      comment: body.comment,
      actorRole: actor.role
    });

    await publishDomainEvent(domainEventBus, {
      id: crypto.randomUUID(),
      type: result.approved ? "approval.request.approved" : "approval.request.rejected",
      occurredAt: new Date().toISOString(),
      restaurantId,
      actorUserId: actor.userId,
      payload: {
        approvalTaskId,
        entityId: result.task.entityId,
        action: body.action
      }
    } satisfies DomainEvent);

    return {
      ok: true,
      approved: result.approved,
      escalated: result.escalated,
      approvalTaskId
    };
  });

  app.post("/trust/:restaurantId/approvals/:approvalTaskId/execute", async (req) => {
    const { restaurantId, approvalTaskId } = req.params as {
      restaurantId: string;
      approvalTaskId: string;
    };
    const actor = await requireVenueStaff(prisma, req, restaurantId);
    const order = await executeApprovedOrderAction(prisma, approvalTaskId, actor.userId);
    return { ok: true, order };
  });

  app.get("/trust/:restaurantId/audit/:entityType/:entityId", async (req) => {
    const { restaurantId, entityType, entityId } = req.params as {
      restaurantId: string;
      entityType: "ORDER" | "PAYMENT" | "USER" | "MENU" | "STAFF" | "SHIFT";
      entityId: string;
    };
    await requireVenueStaff(prisma, req, restaurantId);
    const logs = await listTrustAuditForEntity(prisma, restaurantId, entityType, entityId);
    return { ok: true, logs };
  });
}
