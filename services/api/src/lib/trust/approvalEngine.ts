import type { PrismaClient, ApprovalRequiredRole } from "@prisma/client";
import { APPROVAL_EXPIRY_MINUTES } from "./trustPolicies.js";

export async function createApprovalTask(
  prisma: PrismaClient,
  params: {
    trustEventId: string;
    workspaceId: string;
    entityType: "ORDER" | "PAYMENT" | "USER" | "MENU" | "STAFF" | "SHIFT";
    entityId: string;
    requestedByUserId: string;
    requiredRole: ApprovalRequiredRole;
    riskScore: number;
    payload?: Record<string, unknown>;
  }
) {
  const expiresAt = new Date(Date.now() + APPROVAL_EXPIRY_MINUTES * 60 * 1000);
  const task = await prisma.approvalTask.create({
    data: {
      trustEventId: params.trustEventId,
      workspaceId: params.workspaceId,
      entityType: params.entityType,
      entityId: params.entityId,
      requestedByUserId: params.requestedByUserId,
      requiredRole: params.requiredRole,
      riskScore: params.riskScore,
      expiresAt,
      status: "PENDING"
    }
  });

  await prisma.trustEvent.update({
    where: { id: params.trustEventId },
    data: { type: "APPROVAL_REQUESTED", status: "PENDING" }
  });

  return task;
}

export async function listPendingApprovalsForVenue(
  prisma: PrismaClient,
  workspaceId: string,
  limit = 50
) {
  const now = new Date();
  await expireStaleApprovals(prisma, workspaceId);

  const tasks = await prisma.approvalTask.findMany({
    where: { workspaceId, status: "PENDING", expiresAt: { gt: now } },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      trustEvent: { select: { actionType: true, payload: true, riskScore: true, metadata: true } },
      actions: { orderBy: { createdAt: "desc" }, take: 5 }
    }
  });

  return tasks;
}

export async function listPendingApprovalsForActor(
  prisma: PrismaClient,
  workspaceId: string,
  actorUserId: string
) {
  await expireStaleApprovals(prisma, workspaceId);
  return prisma.approvalTask.findMany({
    where: {
      workspaceId,
      requestedByUserId: actorUserId,
      status: { in: ["PENDING", "APPROVED"] }
    },
    orderBy: { createdAt: "desc" },
    take: 30,
    include: { trustEvent: true, actions: true }
  });
}

async function expireStaleApprovals(prisma: PrismaClient, workspaceId: string) {
  const now = new Date();
  const stale = await prisma.approvalTask.findMany({
    where: { workspaceId, status: "PENDING", expiresAt: { lte: now } },
    select: { id: true, trustEventId: true }
  });
  for (const row of stale) {
    await prisma.approvalTask.update({
      where: { id: row.id },
      data: { status: "EXPIRED" }
    });
    await prisma.trustEvent.update({
      where: { id: row.trustEventId },
      data: { status: "FINAL", type: "REJECTED" }
    });
  }
}

export async function resolveApproval(
  prisma: PrismaClient,
  params: {
    approvalTaskId: string;
    actedByUserId: string;
    action: "APPROVE" | "REJECT" | "ESCALATE";
    comment?: string;
    actorRole: string;
  }
) {
  const task = await prisma.approvalTask.findUnique({
    where: { id: params.approvalTaskId },
    include: { trustEvent: true }
  });
  if (!task) throw Object.assign(new Error("approval_not_found"), { statusCode: 404 });
  if (task.status !== "PENDING") {
    throw Object.assign(new Error("approval_already_resolved"), { statusCode: 409 });
  }
  if (task.expiresAt.getTime() <= Date.now()) {
    await prisma.approvalTask.update({ where: { id: task.id }, data: { status: "EXPIRED" } });
    throw Object.assign(new Error("approval_expired"), { statusCode: 410 });
  }
  if (task.requestedByUserId === params.actedByUserId) {
    throw Object.assign(new Error("self_approval_forbidden"), { statusCode: 403 });
  }

  assertApproverRole(task.requiredRole, params.actorRole, params.action);

  const membership = await prisma.membership.findFirst({
    where: {
      userId: params.actedByUserId,
      restaurantId: task.workspaceId,
      status: "ACTIVE"
    }
  });
  if (!membership) throw Object.assign(new Error("forbidden"), { statusCode: 403 });

  if (params.action === "ESCALATE") {
    await prisma.approvalAction.create({
      data: {
        approvalTaskId: task.id,
        actedByUserId: params.actedByUserId,
        action: "ESCALATE",
        comment: params.comment?.trim() || null
      }
    });
    await prisma.approvalTask.update({
      where: { id: task.id },
      data: { status: "ESCALATED", requiredRole: "OWNER" }
    });
    return { task, approved: false, escalated: true };
  }

  const approved = params.action === "APPROVE";
  await prisma.approvalAction.create({
    data: {
      approvalTaskId: task.id,
      actedByUserId: params.actedByUserId,
      action: params.action,
      comment: params.comment?.trim() || null
    }
  });

  if (task.trustEvent.decision === "BLOCK") {
    await prisma.approvalTask.update({
      where: { id: task.id },
      data: { status: "REJECTED" }
    });
    await prisma.trustEvent.update({
      where: { id: task.trustEventId },
      data: { type: "REJECTED", status: "FINAL" }
    });
    throw Object.assign(new Error("trust_block_overrides_approval"), { statusCode: 403 });
  }

  await prisma.approvalTask.update({
    where: { id: task.id },
    data: { status: approved ? "APPROVED" : "REJECTED" }
  });
  await prisma.trustEvent.update({
    where: { id: task.trustEventId },
    data: {
      type: approved ? "APPROVED" : "REJECTED",
      status: "RESOLVED"
    }
  });

  return { task, approved, escalated: false };
}

function assertApproverRole(
  required: ApprovalRequiredRole,
  actorRole: string,
  action: "APPROVE" | "REJECT" | "ESCALATE"
) {
  const role = actorRole.trim().toUpperCase();
  if (action === "REJECT") return;
  if (required === "OWNER" && role !== "OWNER") {
    throw Object.assign(new Error("owner_approval_required"), { statusCode: 403 });
  }
  if (required === "MANAGER" && !["OWNER", "MANAGER"].includes(role)) {
    throw Object.assign(new Error("manager_approval_required"), { statusCode: 403 });
  }
  if (required === "SHIFT_LEAD" && !["OWNER", "MANAGER", "STAFF"].includes(role)) {
    throw Object.assign(new Error("shift_lead_approval_required"), { statusCode: 403 });
  }
  if (required === "INDEPENDENT_STAFF" && !["OWNER", "MANAGER", "STAFF", "KITCHEN", "CASHIER"].includes(role)) {
    throw Object.assign(new Error("independent_approval_required"), { statusCode: 403 });
  }
}

export async function getApprovedTaskPayload(
  prisma: PrismaClient,
  approvalTaskId: string
): Promise<{ task: { id: string; entityId: string; workspaceId: string }; payload: Record<string, unknown> } | null> {
  const task = await prisma.approvalTask.findUnique({
    where: { id: approvalTaskId },
    include: { trustEvent: true }
  });
  if (!task || task.status !== "APPROVED") return null;
  const payload =
    task.trustEvent.payload && typeof task.trustEvent.payload === "object" && !Array.isArray(task.trustEvent.payload)
      ? (task.trustEvent.payload as Record<string, unknown>)
      : {};
  return {
    task: { id: task.id, entityId: task.entityId, workspaceId: task.workspaceId },
    payload
  };
}
